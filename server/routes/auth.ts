import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { getSupabaseAdmin, getSupabaseAnon, isSupabaseConfigured } from '../supabase.js';
import { sendEmail, isSmtpConfigured } from '../mailer.js';
import { getClientOrigin, getAppBaseUrl } from '../urlHelper.js';
import { signAdminToken } from '../tokenSigner.js';
import { requireAuth, requireRole, resolveUser, invalidateTokenCache, ProfileLookupError } from '../middleware/requireAuth.js';

const router = Router();

/**
 * Failed-login throttle (BUG-009). Counts failures per client IP and per
 * account; after MAX_FAILURES within the window further attempts are refused
 * until the window expires. In-memory: sufficient for a single instance, and
 * a restart only ever resets it in the attacker's favour for one window.
 */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const loginFailures = new Map<string, { count: number; first: number }>();

function throttleKeys(req: Request, email: string) {
  return [`ip:${req.ip || 'unknown'}`, `acct:${email}`];
}

function isThrottled(keys: string[]): number {
  const now = Date.now();
  let retryAfter = 0;
  for (const key of keys) {
    const entry = loginFailures.get(key);
    if (!entry) continue;
    if (now - entry.first > LOGIN_WINDOW_MS) {
      loginFailures.delete(key);
    } else if (entry.count >= MAX_FAILURES) {
      retryAfter = Math.max(retryAfter, Math.ceil((entry.first + LOGIN_WINDOW_MS - now) / 1000));
    }
  }
  return retryAfter;
}

function recordFailure(keys: string[]) {
  const now = Date.now();
  for (const key of keys) {
    const entry = loginFailures.get(key);
    if (!entry || now - entry.first > LOGIN_WINDOW_MS) loginFailures.set(key, { count: 1, first: now });
    else entry.count += 1;
  }
  if (loginFailures.size > 10_000) loginFailures.clear(); // bound memory under a spray attack
}

function clearFailures(keys: string[]) {
  for (const key of keys) loginFailures.delete(key);
}

/**
 * Only a Super Admin may grant the Super Admin role or change the credentials,
 * role or status of an existing Super Admin; an Admin could otherwise promote
 * themselves or take over a Super Admin account.
 */
async function guardSuperAdminChange(req: Request, admin: any, opts: { newRole?: string; targetUserId?: string }): Promise<string | null> {
  if (req.user?.role === 'Super Admin') return null;
  if (opts.newRole === 'Super Admin') return 'Only a Super Admin can grant the Super Admin role.';
  if (opts.targetUserId) {
    if (opts.targetUserId === BREAKGLASS_USER_ID) return 'Only a Super Admin can modify this account.';
    const { data } = await admin.from('profiles').select('role').eq('id', opts.targetUserId).maybeSingle();
    if (data?.role === 'Super Admin') return 'Only a Super Admin can modify a Super Admin account.';
  }
  return null;
}

export const MIN_PASSWORD_LENGTH = 12;

function randomTemporaryPassword(): string {
  return crypto.randomBytes(18).toString('base64url');
}

export const BREAKGLASS_USER_ID ='ce98b46b-4a6a-4a66-a70a-72e6c56d7691';

/** Constant-time check of the env-configured break-glass credential; false when unset. */
function verifyBreakGlass(email: string, password: string): boolean {
  const configuredEmail = (process.env.BREAKGLASS_EMAIL || '').trim().toLowerCase();
  const configuredHash = (process.env.BREAKGLASS_PASSWORD_HASH || '').trim();
  if (!configuredEmail || !configuredHash || email !== configuredEmail) return false;
  const [scheme, saltHex, hashHex] = configuredHash.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return expected.length > 0 && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Validates that an email is well-formed and belongs to a real, routable domain.
 * Strictly disallows .local, localhost, or test domains so notifications and resets
 * are only dispatched to genuine staff/organization email addresses.
 */
export function isValidDomainEmail(email: any): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Valid email address is required.' };
  }
  const clean = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(clean)) {
    return { valid: false, error: 'Please enter a valid email address with an official domain (e.g. user@sdcommercial.co.uk).' };
  }
  const domain = clean.split('@')[1];
  if (domain.endsWith('.local') || domain === 'localhost' || domain.endsWith('.test') || domain.endsWith('.invalid')) {
    return { valid: false, error: 'Local and placeholder email domains (.local) are not permitted. Please use your official organization or personal domain email.' };
  }
  return { valid: true };
}

// GET /api/auth/status — Supabase Authentication Status
router.get('/status', (req: Request, res: Response) => {
  const supabaseConfigured = isSupabaseConfigured();

  res.json({
    provider: 'supabase',
    supabaseConfigured,
    features: {
      emailPassword: true,
      passwordRecovery: true,
      roleBasedAccess: true,
      smtpNotifications: isSmtpConfigured()
    }
  });
});

// POST /api/auth/login — Supabase Auth only, no hardcoded accounts
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Both email address and password are required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const keys = throttleKeys(req, cleanEmail);
  const retryAfter = isThrottled(keys);
  if (retryAfter > 0) {
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: `Too many failed sign-in attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).` });
  }

  // Optional break-glass Super Admin account. Disabled unless BREAKGLASS_EMAIL and
  // BREAKGLASS_PASSWORD_HASH ("scrypt$<saltHex>$<hashHex>") are set in the
  // environment. No credential is stored in source.
  if (verifyBreakGlass(cleanEmail, String(password))) {
    clearFailures(keys);
    console.warn(`[Auth] Break-glass Super Admin login used from ${req.ip || 'unknown'}`);
    const masterUser = {
      id: BREAKGLASS_USER_ID,
      email: cleanEmail,
      name: 'Break-glass Administrator',
      role: 'Super Admin' as const,
      assignedSite: 'All Sites',
      assignedSites: ['All Sites'],
      status: 'Active',
      provider: 'default-superadmin'
    };

    const tokenPayload = {
      sub: masterUser.id,
      email: masterUser.email,
      role: masterUser.role,
      iss: 'sdtracker-internal',
      // Shortened from 30 days to 12 hours: this is a privileged break-glass
      // session, not a long-lived one.
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12
    };
    // Signed, not merely encoded — see server/tokenSigner.ts (BUG-002).
    const defaultToken = signAdminToken(tokenPayload);

    return res.json({
      success: true,
      user: masterUser,
      token: defaultToken,
      session: {
        accessToken: defaultToken,
        expiresAt: tokenPayload.exp
      }
    });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Authentication service (Supabase) is not configured. Please set SUPABASE_URL and keys in .env.' });
  }

  try {
    const supabase = getSupabaseAnon() || getSupabaseAdmin();
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase client unavailable.' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    if (error || !data?.user) {
      recordFailure(keys);
      return res.status(401).json({ error: error?.message || 'Invalid email or password.' });
    }
    clearFailures(keys);

    // Fetch or create the profile. The role is never taken from user_metadata,
    // which the account holder can set themselves.
    const admin = getSupabaseAdmin();
    let profile: any = null;
    if (admin) {
      const { data: prof } = await admin.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
      if (prof) {
        profile = prof;
      } else {
        // The auth.users trigger normally creates this row. An account that
        // reaches here without one was not provisioned by an administrator.
        const name = data.user.user_metadata?.name || cleanEmail.split('@')[0];
        const role = data.user.app_metadata?.role || 'Staff';
        const assignedSite = data.user.app_metadata?.assigned_site || 'All Sites';
        const status = data.user.app_metadata?.role ? 'Active' : 'Inactive';
        await admin.from('profiles').upsert({ id: data.user.id, email: cleanEmail, name, role, assigned_site: assignedSite, status });
        profile = { name, role, assigned_site: assignedSite, status };
      }
    }

    if (profile?.status && String(profile.status).toLowerCase() !== 'active') {
      return res.status(403).json({ error: `Your account is ${profile.status}. Contact an administrator to activate it.` });
    }

    const userPayload = {
      id: data.user.id,
      email: cleanEmail,
      name: profile?.name || data.user.user_metadata?.name || cleanEmail.split('@')[0],
      role: profile?.role || 'Staff',
      assignedSite: profile?.assigned_site || 'All Sites',
      provider: 'supabase'
    };

    const token = data.session?.access_token;
    if (!token) {
      return res.status(500).json({ error: 'Authentication succeeded but no session token was returned.' });
    }

    return res.json({
      success: true,
      user: userPayload,
      token,
      session: {
        accessToken: token,
        expiresAt: data.session?.expires_at || Math.floor(Date.now() / 1000) + 86400 * 7
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message || 'Authentication failed.' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      invalidateTokenCache(token);
    }
    const supabase = getSupabaseAnon();
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch {
    // ignore
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// Helper to synchronize user property assignments in property_user_assignments table
async function syncPropertyUserAssignments(
  admin: any,
  userId: string,
  userEmail: string,
  userName: string,
  role: string,
  sites: string[]
) {
  try {
    await admin.from('property_user_assignments').delete().eq('user_id', userId);
    if (!sites || sites.length === 0) return;

    // Fetch sites to match site id
    const { data: siteList } = await admin.from('sites').select('id, name');
    const siteMap = new Map<string, string>();
    (siteList || []).forEach((s: any) => {
      if (s.name) siteMap.set(s.name.toLowerCase().trim(), s.id);
      if (s.id) siteMap.set(s.id.toLowerCase().trim(), s.id);
    });

    const cleanSites = sites.filter(s => s && s.trim());
    const assignmentRows = cleanSites.map((siteName, idx) => {
      const propId = siteMap.get(siteName.toLowerCase().trim()) || null;
      return {
        id: `pua-${userId}-${idx}-${Date.now()}`,
        user_id: userId,
        user_email: userEmail,
        user_name: userName,
        property_id: propId,
        property_name: siteName,
        role: role || 'Staff',
        assigned_properties: cleanSites,
        updated_at: new Date().toISOString()
      };
    });

    if (assignmentRows.length > 0) {
      const { error: insErr } = await admin.from('property_user_assignments').insert(assignmentRows);
      if (insErr) {
        console.warn('[Auth] syncPropertyUserAssignments insert notice:', insErr.message);
      }
    }
  } catch (err: any) {
    console.warn('[Auth] syncPropertyUserAssignments error:', err.message);
  }
}

// POST /api/auth/signup — Creates user in Supabase Auth + profile + property_user_assignments
router.post('/signup', requireAuth, requireRole('Super Admin', 'Admin'), async (req: Request, res: Response) => {
  const { email, password, name, role = 'Staff' } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const emailValidation = isValidDomainEmail(cleanEmail);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.error });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Authentication service (Supabase) is not configured.' });
  }

  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error('Supabase admin client unavailable');
    }

    const denied = await guardSuperAdminChange(req, admin, { newRole: role });
    if (denied) return res.status(403).json({ error: denied });

    const rawSites: string[] = Array.isArray(req.body.assignedSites) && req.body.assignedSites.length > 0
      ? req.body.assignedSites
      : (req.body.assignedSite ? [req.body.assignedSite] : ['Pending Assignment']);
    const cleanSites = rawSites.map((s: any) => String(s).trim()).filter(s => s && s !== 'Pending Assignment');
    const finalSites = cleanSites.length > 0
      ? cleanSites
      : (rawSites.includes('Pending Assignment') ? ['Pending Assignment'] : ['All Sites']);
    const primarySite = finalSites[0] || 'Pending Assignment';
    const assignedSiteStr = finalSites.join(', ');

    // Create user via Admin API to automatically confirm without email bounce during setup
    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { name, role, assigned_site: assignedSiteStr, assignedSites: finalSites },
      app_metadata: { role, assigned_site: assignedSiteStr, assignedSites: finalSites }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (data.user) {
      const userName = name || email.split('@')[0];
      // Upsert profile (the trigger also creates it; this guarantees role, status and assigned sites)
      const { error: profileError } = await admin.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        name: userName,
        role,
        assigned_site: assignedSiteStr,
        status: 'Active',
        updated_at: new Date().toISOString()
      });
      if (profileError) {
        return res.status(500).json({ error: `Account created but its profile could not be saved: ${profileError.message}` });
      }

      // Synchronize property_user_assignments
      await syncPropertyUserAssignments(admin, data.user.id, data.user.email || email.trim(), userName, role, finalSites);

      // Invalidate token cache
      invalidateTokenCache();

      // If SMTP configured, dispatch welcome notification
      if (isSmtpConfigured()) {
        sendEmail({
          to: email,
          subject: 'SD Operations - Account Created',
          html: `
            <h2>Welcome to SD Operations</h2>
            <p>Hello ${userName},</p>
            <p>Your user profile has been created with role: <strong>${role}</strong>.</p>
            <p>Assigned Site(s): <strong>${assignedSiteStr}</strong></p>
          `
        }).catch(err => console.error('Error dispatching signup email:', err));
      }
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        name: name || email.split('@')[0],
        role,
        assignedSite: primarySite,
        assignedSites: finalSites
      }
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message || 'Failed to create user account' });
  }
});

// POST /api/auth/bulk-import — Bulk creates or updates users in Supabase Auth + profiles
router.post('/bulk-import', requireAuth, requireRole('Super Admin', 'Admin'), async (req: Request, res: Response) => {
  const { users } = req.body;

  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: 'A non-empty "users" array is required.' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Authentication service (Supabase) is not configured.' });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: 'Supabase admin client unavailable' });
  }

  const results: Array<{ email: string; success: boolean; id?: string; error?: string }> = [];
  const errors: Array<{ email: string; error: string }> = [];
  let importedCount = 0;
  let failedCount = 0;

  // Process concurrently in chunks of 5 for connection stability
  const CHUNK_SIZE = 5;
  for (let i = 0; i < users.length; i += CHUNK_SIZE) {
    const chunk = users.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (u: any) => {
        const rawEmail = typeof u.email === 'string' ? u.email.trim().toLowerCase() : '';
        // No shared default: users imported without a password get an unguessable
        // one and must use "Forgot password" to set their own.
        const password = (u.password && String(u.password).trim().length >= MIN_PASSWORD_LENGTH) ? String(u.password).trim() : randomTemporaryPassword();
        const name = u.name ? String(u.name).trim() : rawEmail.split('@')[0] || 'User';
        const role = u.role || 'Staff';
        const assignedSite = Array.isArray(u.assignedSites) ? u.assignedSites.join(',') : (u.assignedSite || 'All Sites');
        const status = u.status === 'Inactive' ? 'Inactive' : 'Active';

        const emailValidation = isValidDomainEmail(rawEmail);
        if (!emailValidation.valid) {
          failedCount++;
          const errObj = { email: rawEmail || 'Unknown', error: emailValidation.error || 'Invalid or placeholder (.local) email address.' };
          errors.push(errObj);
          results.push({ email: rawEmail || 'Unknown', success: false, error: errObj.error });
          return;
        }

        const roleDenied = await guardSuperAdminChange(req, admin, { newRole: role });
        if (roleDenied) {
          failedCount++;
          errors.push({ email: rawEmail, error: roleDenied });
          results.push({ email: rawEmail, success: false, error: roleDenied });
          return;
        }

        try {
          const { data, error } = await admin.auth.admin.createUser({
            email: rawEmail,
            password,
            email_confirm: true,
            user_metadata: { name, role, assigned_site: assignedSite },
            app_metadata: { role, assigned_site: assignedSite }
          });

          let userId = data?.user?.id;

          if (error) {
            const isAlreadyRegistered =
              error.message.toLowerCase().includes('already') ||
              error.message.toLowerCase().includes('registered') ||
              error.status === 422;

            if (isAlreadyRegistered) {
              const { data: existingProfile } = await admin
                .from('profiles')
                .select('id')
                .eq('email', rawEmail)
                .maybeSingle();

              if (existingProfile?.id) {
                userId = existingProfile.id;
              } else {
                const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
                const found = (userList?.users as any[])?.find((usr: any) => usr.email?.toLowerCase() === rawEmail);
                if (found) userId = found.id;
              }

              const targetDenied = userId ? await guardSuperAdminChange(req, admin, { targetUserId: userId }) : null;
              if (targetDenied) {
                failedCount++;
                errors.push({ email: rawEmail, error: targetDenied });
                results.push({ email: rawEmail, success: false, error: targetDenied });
                return;
              }

              if (userId && u.password && String(u.password).trim().length >= MIN_PASSWORD_LENGTH) {
                await admin.auth.admin.updateUserById(userId, {
                  password: String(u.password).trim(),
                  user_metadata: { name, role, assigned_site: assignedSite },
                  app_metadata: { role, assigned_site: assignedSite }
                }).catch(() => {});
              }
            } else {
              failedCount++;
              errors.push({ email: rawEmail, error: error.message });
              results.push({ email: rawEmail, success: false, error: error.message });
              return;
            }
          }

          if (userId) {
            const { error: profileError } = await admin.from('profiles').upsert({
              id: userId,
              email: rawEmail,
              name,
              role,
              assigned_site: assignedSite,
              status,
              updated_at: new Date().toISOString()
            });

            if (profileError) {
              failedCount++;
              errors.push({ email: rawEmail, error: profileError.message });
              results.push({ email: rawEmail, success: false, error: profileError.message });
              return;
            }
          }

          importedCount++;
          results.push({ email: rawEmail, success: true, id: userId });
        } catch (err: any) {
          failedCount++;
          const msg = err?.message || String(err);
          errors.push({ email: rawEmail, error: msg });
          results.push({ email: rawEmail, success: false, error: msg });
        }
      })
    );
  }

  return res.json({
    success: true,
    total: users.length,
    imported: importedCount,
    failed: failedCount,
    errors,
    results
  });
});


// GET /api/auth/me — Instant session verification with in-memory caching
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed authorization token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const user = await resolveUser(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        assignedSite: user.assignedSite,
        assignedSites: user.assignedSites || [user.assignedSite || 'All Sites'],
        status: 'Active',
        provider: user.provider
      }
    });
  } catch (err: any) {
    if (err instanceof ProfileLookupError) {
      return res.status(503).json({ error: 'User profile lookup is temporarily unavailable. Please retry.' });
    }
    res.status(401).json({ error: err.message || 'Token verification failed' });
  }
});

// POST /api/auth/update-password — Update password using recovery access token or current session
// NOTE: this registration previously sat INSIDE the catch block above, so it only
// ever ran if token verification threw during a request — meaning the route was
// never registered at startup and every call returned 404 (BUG-005).
router.post('/update-password', async (req: Request, res: Response) => {
  const { password, accessToken } = req.body;
  const authHeader = req.headers.authorization;
  const token = accessToken || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

  if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` });
  }

  if (!token) {
    return res.status(401).json({ error: 'Missing recovery session token. Please request a new password reset link.' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Authentication service (Supabase) is not configured.' });
  }

  try {
    const admin = getSupabaseAdmin();
    const supabase = getSupabaseAnon();
    if (!admin && !supabase) {
      throw new Error('Supabase client unavailable');
    }

    // Verify token to get the user
    let targetUserId: string | null = null;
    let targetEmail: string = 'user';

    const clientToVerify = supabase || admin;
    const { data: { user }, error: verifyErr } = await clientToVerify!.auth.getUser(token);

    if (!verifyErr && user) {
      targetUserId = user.id;
      targetEmail = user.email || 'user';
    } else if (admin) {
      // Fallback check with admin
      const { data: adminUser } = await admin.auth.getUser(token);
      if (adminUser?.user) {
        targetUserId = adminUser.user.id;
        targetEmail = adminUser.user.email || 'user';
      }
    }

    if (!targetUserId) {
      return res.status(401).json({
        error: 'Password recovery session has expired or is invalid. Please request a fresh password reset link from the login screen.'
      });
    }

    // Update password in Supabase Auth via Admin API
    const { error: updateError } = await admin!.auth.admin.updateUserById(targetUserId, {
      password
    });

    if (updateError) {
      await savePasswordAuditLog({
        adminEmail: targetEmail,
        targetEmail,
        targetUserId,
        action: 'UPDATE_PASSWORD',
        status: 'FAILURE',
        error: updateError.message
      });
      return res.status(400).json({ error: updateError.message });
    }

    await savePasswordAuditLog({
      adminEmail: targetEmail,
      targetEmail,
      targetUserId,
      action: 'UPDATE_PASSWORD',
      status: 'SUCCESS'
    });

    return res.json({
      success: true,
      message: 'Password updated successfully! You can now log in with your new password.'
    });
  } catch (err: any) {
    console.error('Password reset update error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update password.' });
  }
});

// GET /api/auth/password-audit-logs
router.get('/password-audit-logs', requireAuth, requireRole('Super Admin', 'Admin'), async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.json({ success: true, logs: [] });
  }

  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.json({ success: true, logs: [] });
    }
    const { data, error } = await admin.from('password_audit_logs').select('*').order('timestamp', { ascending: false }).limit(100);
    if (error) {
      return res.json({ success: true, logs: [] });
    }
    res.json({ success: true, logs: data || [] });
  } catch {
    res.json({ success: true, logs: [] });
  }
});

// Helper to save password audit log to database
async function savePasswordAuditLog(entry: {
  adminEmail: string;
  targetEmail: string;
  targetUserId?: string;
  action: 'UPDATE_PASSWORD' | 'RESET_PASSWORD';
  status: 'SUCCESS' | 'FAILURE';
  error?: string;
}) {
  if (!isSupabaseConfigured()) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;

  try {
    await admin.from('password_audit_logs').insert({
      id: `pwd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      admin_email: entry.adminEmail,
      target_email: entry.targetEmail,
      target_user_id: entry.targetUserId || null,
      action: entry.action,
      status: entry.status,
      error: entry.error || null
    });
  } catch (err: any) {
    console.warn('Password audit log save error:', err.message);
  }
}

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  const adminEmail = 'self-service-request'; // never trust a client-supplied identity for the audit log

  if (!email || !email.trim()) {
    await savePasswordAuditLog({ adminEmail, targetEmail: email || 'unknown', action: 'RESET_PASSWORD', status: 'FAILURE', error: 'Missing email address' });
    return res.status(400).json({ error: 'Valid email address is required for password reset.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailValidation = isValidDomainEmail(cleanEmail);
  if (!emailValidation.valid) {
    await savePasswordAuditLog({ adminEmail, targetEmail: cleanEmail, action: 'RESET_PASSWORD', status: 'FAILURE', error: emailValidation.error });
    return res.status(400).json({ error: emailValidation.error });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Supabase is not configured.' });
  }

  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error('Supabase admin client unavailable');
    }

    // Always use the configured production APP_URL for password reset links.
    // Never derive from the request origin — this avoids localhost links when
    // the dev server is running behind a tunnel (e.g. Bounce/ngrok).
    const configuredAppUrl = (process.env.APP_URL || process.env.PUBLIC_URL)?.trim().replace(/\/+$/, '');
    const baseUrl = configuredAppUrl || getAppBaseUrl(req);
    const redirectTarget = `${baseUrl}/reset-password`;
    console.log(`[Auth] Initiating password recovery for ${cleanEmail} -> redirectTarget: ${redirectTarget}`);

    // 1. Primary: Generate secure recovery link via Supabase Admin API and dispatch via SMTP
    // This sends a branded email containing the direct application reset link AND the 6-digit verification code.
    // It completely avoids Supabase's default mailer which sends links pointing to localhost:3000.
    if (isSmtpConfigured()) {
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: cleanEmail,
        options: {
          redirectTo: redirectTarget
        }
      });

      if (!linkError && linkData) {
        const hashedToken = linkData?.properties?.hashed_token;
        const emailOtp = linkData?.properties?.email_otp;
        const supabaseActionLink = linkData?.properties?.action_link;

        // Direct application reset password link
        const resetLink = hashedToken
          ? `${baseUrl}/reset-password?token_hash=${encodeURIComponent(hashedToken)}&type=recovery&email=${encodeURIComponent(cleanEmail)}`
          : (supabaseActionLink || `${baseUrl}/reset-password`);

        // Dispatch branded email to user's real email address using production SMTP
        const emailResult = await sendEmail({
          to: cleanEmail,
          subject: 'SD Operations - Password Reset Request & Verification Code',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0;">SD Commercial Operations Portal</h1>
                <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Housing Management & Compliance System</p>
              </div>
              <div style="background-color: #f8fafc; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                <p style="font-size: 15px; color: #1e293b; margin: 0 0 12px 0;">Hello,</p>
                <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
                  We received a request to reset your password for your SD Operations account (<strong>${cleanEmail}</strong>).
                </p>
                <div style="text-align: center; margin: 28px 0;">
                  <a href="${resetLink}" style="background-color: #0d9488; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(13, 148, 136, 0.2);">
                    Reset Your Password
                  </a>
                </div>
                ${emailOtp ? `
                  <div style="background-color: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 16px; margin: 20px 0; text-align: center;">
                    <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">Your 6-Digit Verification Code</span>
                    <strong style="font-size: 26px; letter-spacing: 6px; color: #0d9488; font-family: monospace;">${emailOtp}</strong>
                    <p style="font-size: 11px; color: #64748b; margin: 8px 0 0 0;">
                      You can enter this code directly on the Reset Password page.
                    </p>
                  </div>
                ` : ''}
                <p style="font-size: 12px; color: #64748b; margin: 0 0 8px 0;">
                  If the button above does not work, copy and paste this link into your browser:
                </p>
                <p style="font-size: 11px; color: #0284c7; word-break: break-all; margin: 0;">
                  <a href="${resetLink}" style="color: #0284c7;">${resetLink}</a>
                </p>
              </div>
              <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
                <p style="margin: 0 0 6px 0;">This password reset code and link are valid for 1 hour.</p>
                <p style="margin: 0;">If you did not request this password reset, you can safely ignore this email.</p>
              </div>
            </div>
          `
        });

        if (emailResult.success) {
          await savePasswordAuditLog({ adminEmail, targetEmail: cleanEmail, action: 'RESET_PASSWORD', status: 'SUCCESS' });
          return res.json({
            success: true,
            message: `Password reset instructions and verification code sent to ${cleanEmail}. Please check your inbox.`
          });
        }
        console.warn(`[Auth] SMTP dispatch failed for ${cleanEmail}: ${emailResult.message}, falling back to Supabase mailer`);
      } else {
        console.warn(`[Auth] Failed to generate recovery link via admin for ${cleanEmail}:`, linkError?.message);
      }
    }

    // 2. Fallback: Trigger Supabase built-in mailer only if SMTP is not configured or failed
    const supabase = getSupabaseAnon() || admin;
    if (supabase) {
      const { data: sbData, error: sbError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectTarget
      });

      if (sbError) {
        // Handle Supabase rate-limit protection gracefully
        const rateLimitMatch = sbError.message.match(/after (\d+) seconds/i);
        if (rateLimitMatch || (sbError as any).status === 429 || (sbError as any).code === 'over_email_send_rate_limit') {
          const waitSeconds = rateLimitMatch ? parseInt(rateLimitMatch[1], 10) : 25;
          console.warn(`[Auth] Supabase recovery rate-limit active for ${cleanEmail}: ${waitSeconds}s`);
          return res.status(429).json({
            rateLimited: true,
            waitSeconds,
            error: `Please wait ${waitSeconds} seconds before requesting another reset email.`
          });
        }
        console.warn(`[Auth] Supabase built-in mailer notice for ${cleanEmail}: ${sbError.message}`);
        return res.status(400).json({ error: sbError.message });
      }

      await savePasswordAuditLog({ adminEmail, targetEmail: cleanEmail, action: 'RESET_PASSWORD', status: 'SUCCESS' });
      return res.json({
        success: true,
        message: `Password reset link sent to ${cleanEmail}. Please check your inbox and click the reset link.`
      });
    }

    return res.status(503).json({ error: 'No email service or Supabase client available to send password reset.' });
  } catch (err: any) {
    console.error('Password reset error:', err);
    await savePasswordAuditLog({ adminEmail, targetEmail: cleanEmail || 'unknown', action: 'RESET_PASSWORD', status: 'FAILURE', error: err.message });
    res.status(500).json({ error: err.message || 'Failed to send reset email' });
  }
});

// GET /api/auth/verify-recovery — Verifies recovery token_hash and safely redirects to application
router.get('/verify-recovery', async (req: Request, res: Response) => {
  const tokenHash = (req.query.token_hash as string) || (req.query.token as string);
  const baseUrl = getAppBaseUrl(req);

  if (!tokenHash) {
    return res.redirect(`${baseUrl}/reset-password#error=access_denied&error_description=${encodeURIComponent('Recovery token is missing.')}`);
  }

  try {
    const supabase = getSupabaseAnon() || getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase client unavailable');
    }

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery'
    });

    if (error || !data?.session) {
      console.warn('[Auth] verifyOtp recovery token invalid or expired:', error?.message);
      return res.redirect(`${baseUrl}/reset-password#error=access_denied&error_code=${encodeURIComponent(error?.code || 'otp_expired')}&error_description=${encodeURIComponent(error?.message || 'Password reset link is invalid or has expired.')}`);
    }

    const { access_token, refresh_token } = data.session;
    const userEmail = data.session.user?.email || '';
    return res.redirect(`${baseUrl}/reset-password#access_token=${access_token}&refresh_token=${refresh_token || ''}&type=recovery&email=${encodeURIComponent(userEmail)}`);
  } catch (err: any) {
    console.error('[Auth] verify-recovery handler exception:', err);
    return res.redirect(`${baseUrl}/reset-password#error=server_error&error_description=${encodeURIComponent(err.message || 'Failed to verify reset token')}`);
  }
});

// POST /api/auth/confirm-reset-password — Resets user password using either OTP code or token_hash
router.post('/confirm-reset-password', async (req: Request, res: Response) => {
  const { email, otpCode, tokenHash, newPassword } = req.body;

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.` });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Database service is not configured.' });
  }

  const admin = getSupabaseAdmin();
  const anon = getSupabaseAnon() || admin;
  if (!admin || !anon) {
    return res.status(503).json({ error: 'Supabase authentication service unavailable.' });
  }

  try {
    let targetUserId: string | null = null;
    let targetEmail: string = email ? email.trim().toLowerCase() : '';

    if (otpCode && targetEmail) {
      // Mode 1: 6-digit OTP verification. Throttled per account and per IP so the
      // short code cannot be guessed, independent of the identity provider's limits.
      const otpKeys = [`otp-ip:${req.ip || 'unknown'}`, `otp-acct:${targetEmail}`];
      const otpRetryAfter = isThrottled(otpKeys);
      if (otpRetryAfter > 0) {
        res.setHeader('Retry-After', String(otpRetryAfter));
        return res.status(429).json({ error: `Too many attempts. Try again in ${Math.ceil(otpRetryAfter / 60)} minute(s).` });
      }
      const cleanOtp = String(otpCode).trim();
      const { data: vData, error: vErr } = await anon.auth.verifyOtp({
        email: targetEmail,
        token: cleanOtp,
        type: 'recovery'
      });

      if (vErr || !vData?.user) {
        recordFailure(otpKeys);
        console.warn(`[Auth] OTP verification failed for ${targetEmail}:`, vErr?.message);
        await savePasswordAuditLog({
          adminEmail: 'self-service-otp',
          targetEmail,
          action: 'RESET_PASSWORD',
          status: 'FAILURE',
          error: vErr?.message || 'Invalid or expired OTP code'
        });
        return res.status(400).json({ error: vErr?.message || 'Invalid or expired verification code. Please request a new one.' });
      }

      targetUserId = vData.user.id;
      targetEmail = vData.user.email || targetEmail;
    } else if (tokenHash) {
      // Mode 2: Token hash verification
      const cleanHash = String(tokenHash).trim();
      const { data: vData, error: vErr } = await anon.auth.verifyOtp({
        token_hash: cleanHash,
        type: 'recovery'
      });

      if (vErr || !vData?.user) {
        console.warn(`[Auth] Token hash verification failed:`, vErr?.message);
        await savePasswordAuditLog({
          adminEmail: 'self-service-link',
          targetEmail: targetEmail || 'unknown',
          action: 'RESET_PASSWORD',
          status: 'FAILURE',
          error: vErr?.message || 'Invalid or expired recovery link'
        });
        return res.status(400).json({ error: vErr?.message || 'The password reset link is invalid or has expired.' });
      }

      targetUserId = vData.user.id;
      targetEmail = vData.user.email || targetEmail;
    } else {
      return res.status(400).json({ error: 'Please provide either a 6-digit verification code with your email, or a valid recovery link.' });
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'Unable to identify account for password update.' });
    }

    // Update password via Supabase Admin API
    const { error: updateError } = await admin.auth.admin.updateUserById(targetUserId, {
      password: newPassword
    });

    if (updateError) {
      console.error(`[Auth] Failed to update user password for ${targetEmail}:`, updateError.message);
      await savePasswordAuditLog({
        adminEmail: 'self-service',
        targetEmail,
        targetUserId,
        action: 'RESET_PASSWORD',
        status: 'FAILURE',
        error: updateError.message
      });
      return res.status(400).json({ error: updateError.message });
    }

    await savePasswordAuditLog({
      adminEmail: 'self-service',
      targetEmail,
      targetUserId,
      action: 'RESET_PASSWORD',
      status: 'SUCCESS'
    });

    return res.json({
      success: true,
      message: 'Your password has been successfully reset! You can now sign in with your new credentials.'
    });
  } catch (err: any) {
    console.error('[Auth] confirm-reset-password exception:', err);
    return res.status(500).json({ error: err.message || 'An unexpected error occurred during password reset.' });
  }
});

// POST /api/auth/update-password — Updates password for an authenticated session or recovery session
router.post('/update-password', async (req: Request, res: Response) => {
  const { password, accessToken } = req.body;
  const token = accessToken || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : null);

  if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.` });
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required.' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Database service is not configured.' });
  }

  const admin = getSupabaseAdmin();
  const anon = getSupabaseAnon() || admin;
  if (!admin || !anon) {
    return res.status(503).json({ error: 'Supabase service unavailable.' });
  }

  try {
    const { data: { user }, error: userError } = await anon.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid or expired session. Please request a new password reset link.' });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      password
    });

    if (updateError) {
      await savePasswordAuditLog({
        adminEmail: 'self-service-token',
        targetEmail: user.email || user.id,
        targetUserId: user.id,
        action: 'UPDATE_PASSWORD',
        status: 'FAILURE',
        error: updateError.message
      });
      return res.status(400).json({ error: updateError.message });
    }

    await savePasswordAuditLog({
      adminEmail: 'self-service-token',
      targetEmail: user.email || user.id,
      targetUserId: user.id,
      action: 'UPDATE_PASSWORD',
      status: 'SUCCESS'
    });

    return res.json({
      success: true,
      message: 'Password updated successfully. You can now sign in.'
    });
  } catch (err: any) {
    console.error('[Auth] update-password exception:', err);
    return res.status(500).json({ error: err.message || 'Failed to update password.' });
  }
});

// POST /api/auth/admin/update-password
router.post('/admin/update-password', requireAuth, requireRole('Super Admin', 'Admin'), async (req: Request, res: Response) => {
  const { userId, email, newPassword } = req.body;
  const adminEmail = req.user?.email || 'admin';

  if ((!userId && !email) || !newPassword) {
    await savePasswordAuditLog({ adminEmail, targetEmail: email || userId || 'unknown', targetUserId: userId, action: 'UPDATE_PASSWORD', status: 'FAILURE', error: 'Missing user identifier or password' });
    return res.status(400).json({ error: 'User identifier and new password are required.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.` });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Supabase is not configured.' });
  }

  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error('Supabase admin client unavailable');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let targetUid = userId;

    if (!targetUid || !uuidRegex.test(targetUid)) {
      const { data: listData, error: listError } = await admin.auth.admin.listUsers();
      if (!listError && listData?.users) {
        const found = listData.users.find((u: any) => u.email?.toLowerCase() === email?.trim().toLowerCase());
        if (found) {
          targetUid = found.id;
        }
      }
    }

    if (!targetUid || !uuidRegex.test(targetUid)) {
      await savePasswordAuditLog({ adminEmail, targetEmail: email || userId || 'unknown', targetUserId: userId, action: 'UPDATE_PASSWORD', status: 'FAILURE', error: 'User not found in Supabase Auth' });
      return res.status(404).json({ error: 'User not found in Supabase Auth.' });
    }

    const denied = await guardSuperAdminChange(req, admin, { targetUserId: targetUid });
    if (denied) {
      await savePasswordAuditLog({ adminEmail, targetEmail: email || targetUid, targetUserId: targetUid, action: 'UPDATE_PASSWORD', status: 'FAILURE', error: denied });
      return res.status(403).json({ error: denied });
    }

    const { data, error } = await admin.auth.admin.updateUserById(targetUid, {
      password: newPassword
    });

    if (error) {
      await savePasswordAuditLog({ adminEmail, targetEmail: email || targetUid, targetUserId: targetUid, action: 'UPDATE_PASSWORD', status: 'FAILURE', error: error.message });
      return res.status(400).json({ error: error.message });
    }

    await savePasswordAuditLog({ adminEmail, targetEmail: email || targetUid, targetUserId: targetUid, action: 'UPDATE_PASSWORD', status: 'SUCCESS' });

    res.json({
      success: true,
      message: `Password updated successfully for user ${email || targetUid}`
    });
  } catch (err: any) {
    console.error('Admin password update error:', err);
    await savePasswordAuditLog({ adminEmail, targetEmail: email || userId || 'unknown', targetUserId: userId, action: 'UPDATE_PASSWORD', status: 'FAILURE', error: err.message });
    res.status(500).json({ error: err.message || 'Failed to update password' });
  }
});

// GET /api/auth/users - Fetch ALL users from Supabase Auth joined with profiles
router.get('/users', requireAuth, async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.json({ success: true, users: [] });
  }

  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.json({ success: true, users: [] });
    }

    // 1. Fetch profiles table first via PostgREST HTTPS (fast, reliable, IPv4/IPv6 neutral)
    const { data: profilesData, error: profilesError } = await admin.from('profiles').select('*');
    if (profilesError) {
      console.warn('[Auth] Note: profiles query returned error:', profilesError.message);
    }

    // 1b. Fetch property_user_assignments to build complete mapping of assigned hotels
    const { data: puaData } = await admin.from('property_user_assignments').select('*');
    const puaMap = new Map<string, string[]>();
    if (Array.isArray(puaData)) {
      puaData.forEach((row: any) => {
        const uid = row.user_id;
        const uemail = (row.user_email || '').toLowerCase().trim();
        const currentList: string[] = [];
        if (row.property_name && row.property_name !== 'Pending Assignment') {
          currentList.push(row.property_name);
        }
        if (Array.isArray(row.assigned_properties)) {
          for (const ap of row.assigned_properties) {
            if (ap && ap !== 'Pending Assignment') currentList.push(ap);
          }
        }
        if (uid) {
          puaMap.set(uid, Array.from(new Set([...(puaMap.get(uid) || []), ...currentList])));
        }
        if (uemail) {
          puaMap.set(uemail, Array.from(new Set([...(puaMap.get(uemail) || []), ...currentList])));
        }
      });
    }

    // 2. Fetch auth users with retry & graceful fallback (handles AuthRetryableFetchError transient network issues)
    let authUsers: any[] = [];
    try {
      const fetchAuthUsers = async () => {
        const { data, error } = await admin.auth.admin.listUsers();
        if (error) throw error;
        return data?.users || [];
      };

      try {
        authUsers = await fetchAuthUsers();
      } catch (firstErr: any) {
        // Transient socket error / AuthRetryableFetchError - wait 300ms and retry once
        await new Promise(r => setTimeout(r, 300));
        authUsers = await fetchAuthUsers();
      }
    } catch (authErr: any) {
      console.warn('[Auth] Note: listUsers API transient error, serving user directory from profiles table:', authErr?.message || authErr);
    }

    const authMap = new Map<string, any>();
    authUsers.forEach((u: any) => {
      if (u.id) authMap.set(u.id, u);
      if (u.email) authMap.set(u.email.toLowerCase().trim(), u);
    });

    const seenIds = new Set<string>();
    const userList: any[] = [];

    // Prioritize and map profiles records
    if (profilesData && Array.isArray(profilesData)) {
      profilesData.forEach((p: any) => {
        if (!p || !p.id) return;
        seenIds.add(p.id);
        const email = (p.email || '').toLowerCase().trim();
        const authUser = authMap.get(p.id) || authMap.get(email);

        let sites: string[] = [];
        if (p.assigned_site) {
          sites = p.assigned_site.includes(',')
            ? p.assigned_site.split(',').map((s: string) => s.trim()).filter(Boolean)
            : [p.assigned_site.trim()];
        } else if (authUser?.user_metadata?.assigned_site) {
          sites = [authUser.user_metadata.assigned_site];
        }

        const puaSites = puaMap.get(p.id) || (email ? puaMap.get(email) : []);
        if (puaSites && puaSites.length > 0) {
          sites = Array.from(new Set([...sites.filter(s => s !== 'Pending Assignment'), ...puaSites]));
        }

        const actualSites = sites.filter(s => s && s !== 'Pending Assignment');
        const role = p.role || authUser?.user_metadata?.role || 'Staff';
        const isGlobalRole = ['Super Admin', 'Admin', 'Regional Manager'].includes(role);
        const finalSites = actualSites.length > 0
          ? actualSites
          : (sites.includes('Pending Assignment') ? ['Pending Assignment'] : (isGlobalRole ? ['All Sites'] : ['Pending Assignment']));

        userList.push({
          id: p.id,
          email: p.email,
          name: p.name || authUser?.user_metadata?.name || (email ? email.split('@')[0] : 'User'),
          role,
          assignedSites: finalSites,
          assignedSite: finalSites[0] || 'All Sites',
          status: p.status || 'Active',
          lastActive: authUser?.last_sign_in_at ? new Date(authUser.last_sign_in_at).toLocaleString() : 'Never'
        });
      });
    }

    // Include any remaining auth users who do not have a profile row yet
    authUsers.forEach((authUser: any) => {
      if (!authUser?.id || seenIds.has(authUser.id)) return;
      seenIds.add(authUser.id);
      const email = (authUser.email || '').toLowerCase().trim();
      const meta = authUser.user_metadata || {};
      let sites = Array.isArray(meta.assignedSites)
        ? meta.assignedSites
        : (meta.assigned_site ? [meta.assigned_site] : []);

      const puaSites = puaMap.get(authUser.id) || (email ? puaMap.get(email) : []);
      if (puaSites && puaSites.length > 0) {
        sites = Array.from(new Set([...sites.filter((s: string) => s !== 'Pending Assignment'), ...puaSites]));
      }

      const actualSites = sites.filter((s: string) => s && s !== 'Pending Assignment');
      const role = meta.role || 'Staff';
      const isGlobalRole = ['Super Admin', 'Admin', 'Regional Manager'].includes(role);
      const finalSites = actualSites.length > 0
        ? actualSites
        : (isGlobalRole ? ['All Sites'] : ['Pending Assignment']);

      userList.push({
        id: authUser.id,
        email: authUser.email,
        name: meta.name || (email ? email.split('@')[0] : 'User'),
        role,
        assignedSites: finalSites,
        assignedSite: finalSites[0] || 'All Sites',
        status: 'Active',
        lastActive: authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at).toLocaleString() : 'Never'
      });
    });

    // Administrators get the full directory. Everyone else sees only colleagues
    // who share one of their sites plus managers/approvers (needed for
    // assignment pickers), without sign-in activity.
    const callerRole = req.user?.role || '';
    if (['Super Admin', 'Admin'].includes(callerRole)) {
      return res.json({ success: true, users: userList });
    }
    const callerSites = new Set((req.user?.assignedSites || [req.user?.assignedSite || '']).map(s => String(s).trim().toLowerCase()).filter(Boolean));
    const callerSeesAll = callerSites.has('all sites') || callerSites.has('all') || callerRole === 'Regional Manager';
    const visible = userList
      .filter(u => {
        if (u.id === req.user?.id || callerSeesAll) return true;
        if (['Super Admin', 'Admin', 'Regional Manager'].includes(u.role)) return true;
        return (u.assignedSites || []).some((s: string) => callerSites.has(String(s).trim().toLowerCase()));
      })
      .map(({ lastActive: _lastActive, ...rest }) => rest);
    res.json({ success: true, users: visible });
  } catch (err: any) {
    console.error('Fetch Supabase users error:', err);
    res.json({ success: true, users: [], error: 'User directory is temporarily unavailable.' });
  }
});

// PUT /api/auth/users/:id - Update user's properties assignment & role in Supabase
router.put('/users/:id', requireAuth, requireRole('Super Admin', 'Admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, role, assignedSites, status } = req.body;

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ success: false, error: 'Supabase is not configured.' });
  }

  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error('Supabase admin client unavailable');
    }

    const denied = await guardSuperAdminChange(req, admin, { newRole: role, targetUserId: id });
    if (denied) return res.status(403).json({ success: false, error: denied });

    const rawSites: string[] = Array.isArray(assignedSites) && assignedSites.length > 0
      ? assignedSites
      : (req.body.assignedSite ? [req.body.assignedSite] : ['Pending Assignment']);
    const cleanSites = rawSites.map((s: any) => String(s).trim()).filter(s => s && s !== 'Pending Assignment');
    const finalSites = cleanSites.length > 0
      ? cleanSites
      : (rawSites.includes('Pending Assignment') ? ['Pending Assignment'] : ['All Sites']);
    const assignedSiteStr = finalSites.join(', ');
    const primarySite = finalSites[0] || 'Pending Assignment';

    // 1. Fetch user to verify they exist in Supabase Auth
    const { data: userData, error: getUserError } = await admin.auth.admin.getUserById(id);
    if (getUserError || !userData?.user) {
      return res.status(404).json({ success: false, error: `User ${id} not found in Supabase Auth: ${getUserError?.message}` });
    }

    const authUser = userData.user;
    const userEmail = authUser.email || '';
    const updatedMetadata = {
      ...(authUser.user_metadata || {}),
      ...(name ? { name } : {}),
      ...(role ? { role } : {}),
      assignedSites: finalSites,
      assigned_site: assignedSiteStr
    };

    const { data: existingProfile } = await admin.from('profiles').select('role, status').eq('id', id).maybeSingle();
    const effectiveRole = role || existingProfile?.role || 'Staff';

    // 2. Update metadata in Supabase Auth
    const { error: updateAuthError } = await admin.auth.admin.updateUserById(id, {
      user_metadata: updatedMetadata,
      app_metadata: { ...(authUser.app_metadata || {}), role: effectiveRole, assigned_site: assignedSiteStr, assignedSites: finalSites }
    });

    if (updateAuthError) {
      console.error('Error updating Supabase user metadata:', updateAuthError);
    }

    // 3. Upsert into public.profiles — the record every authorization decision reads
    const profilePayload: Record<string, any> = {
      id,
      email: userEmail,
      name: name || updatedMetadata.name || userEmail.split('@')[0],
      role: effectiveRole,
      assigned_site: assignedSiteStr,
      status: status || existingProfile?.status || 'Active',
      updated_at: new Date().toISOString()
    };

    const { error: profileError } = await admin.from('profiles').upsert(profilePayload);
    if (profileError) {
      return res.status(500).json({ success: false, error: `Profile could not be saved: ${profileError.message}` });
    }

    // 4. Update property_user_assignments
    await syncPropertyUserAssignments(admin, id, userEmail, profilePayload.name, profilePayload.role, finalSites);

    // Invalidate token cache so permissions/sites refresh immediately
    invalidateTokenCache();

    res.json({
      success: true,
      message: 'User property assignment and role updated in Supabase.',
      user: {
        id,
        email: userEmail,
        name: profilePayload.name,
        role: profilePayload.role,
        assignedSites: finalSites,
        assignedSite: primarySite,
        status: profilePayload.status
      }
    });
  } catch (err: any) {
    console.error('Update Supabase user assignment error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to update user assignment' });
  }
});

// DELETE /api/auth/users/:id - Remove the account from Supabase Auth.
// Deleting only the profile row (as the data API used to) left the login
// working; the profile and property assignments cascade from auth.users.
router.delete('/users/:id', requireAuth, requireRole('Super Admin', 'Admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ success: false, error: 'Supabase is not configured.' });
  }
  if (req.user?.id === id) {
    return res.status(400).json({ success: false, error: 'You cannot delete your own account.' });
  }
  if (id === BREAKGLASS_USER_ID) {
    return res.status(400).json({ success: false, error: 'The built-in administrator account cannot be deleted.' });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return res.status(503).json({ success: false, error: 'Supabase admin client unavailable' });

  const denied = await guardSuperAdminChange(req, admin, { targetUserId: id });
  if (denied) return res.status(403).json({ success: false, error: denied });

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    const notFound = /not found/i.test(error.message);
    return res.status(notFound ? 404 : 500).json({ success: false, error: error.message });
  }
  // Defensive: remove any profile left behind by a missing cascade.
  await admin.from('profiles').delete().eq('id', id);

  res.json({ success: true, id });
});

export default router;
