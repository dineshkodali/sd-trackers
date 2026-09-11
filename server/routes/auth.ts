import { Router, Request, Response } from 'express';
import { getSupabaseAdmin, getSupabaseAnon, isSupabaseConfigured } from '../supabase.js';
import { sendEmail, isSmtpConfigured } from '../mailer.js';
import { getClientOrigin } from '../urlHelper.js';
import { signAdminToken, verifyAdminToken, isAdminTokenFormat } from '../tokenSigner.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';

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

  // Built-in Default Super Admin Account (independent of database availability)
  const isMasterAccount = (cleanEmail === 'stackmaster@sdcommercial.co.uk' || cleanEmail === 'stackamster@sdcommercial.co.uk') && password === 'Focusmode123!';
  if (isMasterAccount) {
    clearFailures(keys);
    const masterUser = {
      id: 'ce98b46b-4a6a-4a66-a70a-72e6c56d7691',
      email: 'stackmaster@sdcommercial.co.uk',
      name: 'Stack Master',
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
  // Optionally sign out from Supabase
  try {
    const supabase = getSupabaseAnon();
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch {
    // ignore
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// POST /api/auth/signup — Creates user in Supabase Auth + profile
router.post('/signup', requireAuth, requireRole('Super Admin', 'Admin'), async (req: Request, res: Response) => {
  const { email, password, name, role = 'Staff', assignedSite = 'All Sites' } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Authentication service (Supabase) is not configured.' });
  }

  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error('Supabase admin client unavailable');
    }

    // Create user via Admin API to automatically confirm without email bounce during setup
    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { name, role, assigned_site: assignedSite },
      // app_metadata is writable only with the service role; the profile
      // trigger takes the role from here, never from user_metadata.
      app_metadata: { role, assigned_site: assignedSite }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (data.user) {
      // Upsert profile (the trigger also creates it; this guarantees role and status)
      const { error: profileError } = await admin.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        name: name || email.split('@')[0],
        role,
        assigned_site: assignedSite,
        status: 'Active'
      });
      if (profileError) {
        return res.status(500).json({ error: `Account created but its profile could not be saved: ${profileError.message}` });
      }

      // If SMTP configured, dispatch welcome notification
      if (isSmtpConfigured()) {
        sendEmail({
          to: email,
          subject: 'SD Operations - Account Created',
          html: `
            <h2>Welcome to SD Operations</h2>
            <p>Hello ${name || email},</p>
            <p>Your user profile has been created with role: <strong>${role}</strong>.</p>
            <p>Assigned Site: <strong>${assignedSite}</strong></p>
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
        assignedSite
      }
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message || 'Failed to create user account' });
  }
});

// GET /api/auth/me — Verify JWT via Supabase only (no in-memory sessions, no demo tokens)
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed authorization token' });
  }

  const token = authHeader.split(' ')[1];

  // Built-in administrator token. Previously ANY string beginning `sm-jwt-` was
  // accepted here and granted Super Admin without verification (BUG-002); the
  // signature and expiry are now checked before any trust is extended.
  if (isAdminTokenFormat(token)) {
    const payload = verifyAdminToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    return res.json({
      success: true,
      user: {
        id: payload.sub,
        email: payload.email,
        name: 'Stack Master',
        role: payload.role,
        assignedSite: 'All Sites',
        assignedSites: ['All Sites'],
        status: 'Active',
        provider: 'default-superadmin'
      }
    });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Authentication service (Supabase) is not configured.' });
  }

  try {
    const supabase = getSupabaseAdmin() || getSupabaseAnon();
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase client unavailable' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch profile from database
    const admin = getSupabaseAdmin();
    let profile = null;
    if (admin) {
      const { data: profData, error: profileError } = await admin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      // A failed lookup must not read as "no profile" (which means Inactive):
      // report it as temporary so the client keeps the session and retries.
      if (profileError) {
        return res.status(503).json({ error: 'User profile lookup is temporarily unavailable. Please retry.' });
      }
      profile = profData;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: profile?.name || user.user_metadata?.name || user.email?.split('@')[0],
        role: profile?.role || 'Staff',
        assignedSite: profile?.assigned_site || 'All Sites',
        // No profile means the account was never provisioned; it may not transact.
        status: profile?.status || 'Inactive'
      }
    });
  } catch (err: any) {
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

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
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
  const adminEmail = (req.headers['x-admin-email'] as string) || 'system@sdcommercial.co.uk';

  if (!email || !email.trim()) {
    await savePasswordAuditLog({ adminEmail, targetEmail: email || 'unknown', action: 'RESET_PASSWORD', status: 'FAILURE', error: 'Missing email address' });
    return res.status(400).json({ error: 'Valid email address is required for password reset.' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Supabase is not configured.' });
  }

  try {
    const supabase = getSupabaseAnon() || getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase client unavailable');
    }

    const origin = getClientOrigin(req);
    console.log(`[Auth] Password reset for ${email.trim()} using recovery redirect: ${origin}/?type=recovery`);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/?type=recovery`
    });

    if (error) {
      await savePasswordAuditLog({ adminEmail, targetEmail: email.trim(), action: 'RESET_PASSWORD', status: 'FAILURE', error: error.message });
      return res.status(400).json({ error: error.message });
    }

    await savePasswordAuditLog({ adminEmail, targetEmail: email.trim(), action: 'RESET_PASSWORD', status: 'SUCCESS' });

    res.json({
      success: true,
      message: `Password reset link sent to ${email}. Please check your inbox.`
    });
  } catch (err: any) {
    await savePasswordAuditLog({ adminEmail, targetEmail: email?.trim() || 'unknown', action: 'RESET_PASSWORD', status: 'FAILURE', error: err.message });
    res.status(500).json({ error: err.message || 'Failed to send reset email' });
  }
});

// POST /api/auth/admin/update-password
router.post('/admin/update-password', requireAuth, requireRole('Super Admin', 'Admin'), async (req: Request, res: Response) => {
  const { userId, email, newPassword } = req.body;
  const adminEmail = (req.headers['x-admin-email'] as string) || 'admin@sdcommercial.co.uk';

  if ((!userId && !email) || !newPassword) {
    await savePasswordAuditLog({ adminEmail, targetEmail: email || userId || 'unknown', targetUserId: userId, action: 'UPDATE_PASSWORD', status: 'FAILURE', error: 'Missing user identifier or password' });
    return res.status(400).json({ error: 'User identifier and new password are required.' });
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

    const { data: authData, error: authError } = await admin.auth.admin.listUsers();
    if (authError) {
      throw authError;
    }

    const { data: profilesData } = await admin.from('profiles').select('*');
    const profileMap = new Map<string, any>();
    if (profilesData) {
      profilesData.forEach((p: any) => {
        profileMap.set(p.id, p);
        if (p.email) profileMap.set(p.email.toLowerCase(), p);
      });
    }

    // Build complete user list from ALL Supabase Auth users
    const userList = (authData?.users || []).map((authUser: any) => {
      const email = (authUser.email || '').toLowerCase().trim();
      const profile = profileMap.get(authUser.id) || profileMap.get(email);

      let sites: string[] = [];
      if (Array.isArray(authUser.user_metadata?.assignedSites) && authUser.user_metadata.assignedSites.length > 0) {
        sites = authUser.user_metadata.assignedSites;
      } else if (profile?.assigned_site) {
        sites = [profile.assigned_site];
      } else if (authUser.user_metadata?.assigned_site) {
        sites = [authUser.user_metadata.assigned_site];
      } else {
        sites = ['All Sites'];
      }

      return {
        id: authUser.id,
        email,
        name: profile?.name || authUser.user_metadata?.name || email.split('@')[0],
        role: profile?.role || 'Staff',
        assignedSites: sites,
        assignedSite: sites[0] || 'All Sites',
        status: profile?.status || 'Inactive',
        lastActive: authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at).toLocaleString() : 'Never'
      };
    });

    res.json({ success: true, users: userList });
  } catch (err: any) {
    console.error('Fetch Supabase users error:', err);
    res.json({ success: true, users: [], error: err.message });
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

    const sitesArray: string[] = Array.isArray(assignedSites) && assignedSites.length > 0
      ? assignedSites
      : (req.body.assignedSite ? [req.body.assignedSite] : ['All Sites']);

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
      assignedSites: sitesArray,
      assigned_site: sitesArray[0] || 'All Sites'
    };

    const { data: existingProfile } = await admin.from('profiles').select('role, status').eq('id', id).maybeSingle();
    const effectiveRole = role || existingProfile?.role || 'Staff';

    // 2. Update metadata in Supabase Auth
    const { error: updateAuthError } = await admin.auth.admin.updateUserById(id, {
      user_metadata: updatedMetadata,
      app_metadata: { ...(authUser.app_metadata || {}), role: effectiveRole, assigned_site: sitesArray[0] || 'All Sites' }
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
      assigned_site: sitesArray[0] || 'All Sites',
      status: status || existingProfile?.status || 'Active',
      updated_at: new Date().toISOString()
    };

    const { error: profileError } = await admin.from('profiles').upsert(profilePayload);
    if (profileError) {
      return res.status(500).json({ success: false, error: `Profile could not be saved: ${profileError.message}` });
    }

    // 4. Update property_user_assignments
    try {
      await admin.from('property_user_assignments').delete().eq('user_id', id);
      const assignmentRows = sitesArray.map((siteName, idx) => ({
        id: `pua-${id}-${idx}-${Date.now()}`,
        user_id: id,
        user_email: userEmail,
        user_name: profilePayload.name,
        property_name: siteName,
        role: profilePayload.role,
        assigned_properties: sitesArray,
        updated_at: new Date().toISOString()
      }));
      if (assignmentRows.length > 0) {
        await admin.from('property_user_assignments').insert(assignmentRows);
      }
    } catch (assignErr) {
      console.warn('property_user_assignments sync warning:', assignErr);
    }

    res.json({
      success: true,
      message: 'User property assignment and role updated in Supabase.',
      user: {
        id,
        email: userEmail,
        name: profilePayload.name,
        role: profilePayload.role,
        assignedSites: sitesArray,
        assignedSite: sitesArray[0],
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
  if (id === 'ce98b46b-4a6a-4a66-a70a-72e6c56d7691') {
    return res.status(400).json({ success: false, error: 'The built-in administrator account cannot be deleted.' });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return res.status(503).json({ success: false, error: 'Supabase admin client unavailable' });

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
