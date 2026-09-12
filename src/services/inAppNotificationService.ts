import { RoleType, AuditLog, EscalationRecord, DataChangeRequest } from '../types';

export type NotificationType = 'urgent' | 'info' | 'sync' | 'success' | 'security';
export type NotificationActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'SECURITY' | 'REQUEST' | 'INFO' | 'SYNC' | 'URGENT' | 'ALERT';
export type NotificationCategory = 'site_activity' | 'profile_personal' | 'critical_security' | 'approval_workflow';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  timestamp?: string; // Optional ISO date string
  type: NotificationType;
  read: boolean;
  linkPage?: string;
  site?: string;
  performedByUser?: string;
  performedByRole?: string;
  module?: string;
  action?: NotificationActionType;
  category?: NotificationCategory;
  recordId?: string;
  targetItem?: string;
}

/**
 * Format timestamp into relative or concise date
 */
export function formatNotificationTime(isoStr?: string): string {
  if (!isoStr) return 'Just now';
  const time = new Date(isoStr).getTime();
  if (isNaN(time)) return 'Just now';

  const diffMs = Date.now() - time;
  if (diffMs < 0) return 'Just now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  const d = new Date(isoStr);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

/**
 * Map module or audit entity to application navigation page
 */
export function getModuleLinkPage(moduleName?: string): string {
  if (!moduleName) return 'dashboard';
  const m = moduleName.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (m.includes('maintenance') || m.includes('defect')) return 'maintenance';
  if (m.includes('referral') || m.includes('safeguard')) return 'referrals';
  if (m.includes('vulnerable')) return 'vulnerable';
  if (m.includes('challenging')) return 'challenging';
  if (m.includes('welfare') || m.includes('rfa')) return 'rfaWelfare';
  if (m.includes('gp') || m.includes('appoint')) return 'gpAppointments';
  if (m.includes('transport')) return 'publicTransport';
  if (m.includes('dispersal')) return 'dispersal';
  if (m.includes('booklet')) return 'booklets';
  if (m.includes('compliance')) return 'compliance';
  if (m.includes('vcs') || m.includes('agency')) return 'vcsDirectory';
  if (m.includes('laundry')) return 'laundry';
  if (m.includes('food') || m.includes('catering')) return 'food';
  if (m.includes('escalat') || m.includes('incident')) return 'escalations';
  if (m.includes('document') || m.includes('file')) return 'documents';
  if (m.includes('propert') || m.includes('site')) return 'properties';
  if (m.includes('user') || m.includes('account')) return 'users';
  if (m.includes('role') || m.includes('permission')) return 'roles';
  if (m.includes('request') || m.includes('approval')) return 'requests';
  if (m.includes('setting') || m.includes('option')) return 'settings';
  if (m.includes('audit')) return 'audit';

  return 'dashboard';
}

/**
 * Clean and compare site strings with tolerance for aliases and punctuation
 */
export function isSiteMatch(siteA?: string, siteB?: string): boolean {
  if (!siteA || !siteB) return false;
  const a = siteA.trim().toLowerCase();
  const b = siteB.trim().toLowerCase();
  if (a === 'all sites' || b === 'all sites' || a === 'all' || b === 'all') return true;
  if (a === b) return true;

  const cleanA = a.replace(/[^a-z0-9]/g, '');
  const cleanB = b.replace(/[^a-z0-9]/g, '');
  if (cleanA === cleanB) return true;

  // Partial contains check if string is sufficiently descriptive (>= 4 chars)
  if (cleanA.length >= 4 && cleanB.length >= 4) {
    if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
  }
  return false;
}

/**
 * Check if a role corresponds to frontline staff / employee
 */
export function isStaffLevel(role?: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return r === 'staff' || r === 'employee';
}

/**
 * Check if a user string matches the current user's name or email
 */
export function isUserMatch(targetUser?: string, currentUserName?: string, userEmail?: string): boolean {
  if (!targetUser) return false;
  const t = targetUser.trim().toLowerCase();
  if (currentUserName && t === currentUserName.trim().toLowerCase()) return true;
  if (userEmail && t === userEmail.trim().toLowerCase()) return true;
  if (userEmail && t === userEmail.split('@')[0].toLowerCase()) return true;
  return false;
}

/**
 * Check if an audit log is a global administrative event (e.g. role permissions, global system configs)
 */
function isGlobalAdminEvent(audit: AuditLog): boolean {
  const m = String(audit.module || '').toLowerCase();
  const a = String(audit.action || '').toLowerCase();
  const d = String(audit.details || '').toLowerCase();

  return (
    m.includes('role') ||
    m.includes('permission') ||
    a.includes('role_change') ||
    a.includes('settings_update') ||
    a.includes('backup') ||
    a.includes('restore') ||
    d.includes('system configuration') ||
    d.includes('role permissions') ||
    d.includes('purged') ||
    d.includes('batch retention')
  );
}

/**
 * Synthesize raw events from audit logs, critical escalations, and change requests into standard NotificationItems
 */
export function deriveInAppNotifications(params: {
  auditLogs: AuditLog[];
  escalations: EscalationRecord[];
  dataChangeRequests: DataChangeRequest[];
  extraNotifications?: NotificationItem[];
  readNotificationIds?: Set<string>;
  clearedBeforeTimestamp?: number;
}): NotificationItem[] {
  const {
    auditLogs = [],
    escalations = [],
    dataChangeRequests = [],
    extraNotifications = [],
    readNotificationIds = new Set<string>(),
    clearedBeforeTimestamp = 0
  } = params;

  const items: NotificationItem[] = [];
  const seenIds = new Set<string>();

  // 1. Extra explicit system / error notifications (e.g. persistence failures, sync alerts)
  extraNotifications.forEach(n => {
    if (!seenIds.has(n.id)) {
      seenIds.add(n.id);
      const ts = n.timestamp || new Date().toISOString();
      items.push({
        ...n,
        timestamp: ts,
        read: n.read || readNotificationIds.has(n.id),
        time: n.time || formatNotificationTime(ts)
      });
    }
  });

  // 2. Critical & Urgent Escalations
  escalations.forEach((esc: any) => {
    const escTime = new Date(esc.createdAt || esc.dateOfIncident || esc.date || Date.now()).getTime();
    if (escTime < clearedBeforeTimestamp) return;

    const id = `notif-esc-${esc.id}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      const isCritical = esc.urgency === 'Critical' || esc.priority === 'Emergency' || esc.priority === 'High' || esc.incidentType?.toLowerCase().includes('emergency');
      const escSite = esc.site || esc.siteName || esc.assignedHotel || esc.hotel || '';
      items.push({
        id,
        title: `${esc.urgency || esc.priority || 'Urgent'} Incident: ${esc.suName || esc.residentName || esc.incidentType || 'Incident'}`,
        description: `${esc.incidentType || 'Incident'} reported at ${escSite || 'Assigned Site'}. Action: ${esc.actionTaken || esc.incidentNotes || 'Review required'}.`,
        time: formatNotificationTime(esc.createdAt || esc.dateOfIncident || esc.date),
        timestamp: esc.createdAt || esc.dateOfIncident || esc.date || new Date().toISOString(),
        type: isCritical ? 'urgent' : 'info',
        read: readNotificationIds.has(id),
        linkPage: 'escalations',
        site: escSite,
        performedByUser: esc.loggedBy || esc.personReporting || esc.submittedBy,
        performedByRole: 'Duty Officer',
        module: 'Escalations',
        action: isCritical ? 'URGENT' : 'ALERT',
        category: 'critical_security',
        recordId: esc.id,
        targetItem: esc.suName || esc.residentName || esc.incidentType
      });
    }
  });

  // 3. Data Change Requests & Approvals
  dataChangeRequests.forEach(req => {
    const reqTime = new Date(req.createdAt || Date.now()).getTime();
    if (reqTime < clearedBeforeTimestamp) return;

    const id = `notif-req-${req.id}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      const isPending = req.status === 'Pending';
      const isApproved = req.status === 'Approved';
      items.push({
        id,
        title: `Change Request (${req.status}): ${req.recordTitle || req.module}`,
        description: `${req.requestType} request for ${req.module} at ${req.site}. Submitted by ${req.requestedBy} (${req.requestedByRole}). Reason: ${req.reason}`,
        time: formatNotificationTime(req.createdAt),
        timestamp: req.createdAt || new Date().toISOString(),
        type: isPending ? 'info' : (isApproved ? 'success' : 'urgent'),
        read: readNotificationIds.has(id),
        linkPage: 'requests',
        site: req.site,
        performedByUser: req.reviewedBy || req.requestedBy,
        performedByRole: req.requestedByRole,
        module: req.module,
        action: 'REQUEST',
        category: 'approval_workflow',
        recordId: req.id,
        targetItem: req.recordTitle
      });
    }
  });

  // 4. Comprehensive Audit Trail Events
  auditLogs.slice(0, 300).forEach(audit => {
    const auditTime = new Date(audit.timestamp).getTime();
    if (auditTime < clearedBeforeTimestamp) return;

    const id = `notif-aud-${audit.id}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);

      const action = String(audit.action || 'UPDATE').toUpperCase() as NotificationActionType;
      const moduleName = audit.module || 'Operations';
      const details = audit.details || '';
      const target = audit.targetItem || 'Record';

      let type: NotificationType = 'info';
      if (action === 'DELETE' || details.toLowerCase().includes('critical') || details.toLowerCase().includes('cat 1')) {
        type = 'urgent';
      } else if (action === 'CREATE') {
        type = 'success';
      } else if (action === 'SECURITY' || isGlobalAdminEvent(audit)) {
        type = 'security';
      }

      let category: NotificationCategory = 'site_activity';
      if (
        details.toLowerCase().includes('profile') ||
        details.toLowerCase().includes('password') ||
        moduleName === 'Users' ||
        target.toLowerCase().includes('user')
      ) {
        category = 'profile_personal';
      } else if (type === 'urgent' || type === 'security') {
        category = 'critical_security';
      } else if (String(moduleName).toLowerCase().includes('request')) {
        category = 'approval_workflow';
      }

      // Readable action title
      const actionVerb = action === 'CREATE' ? 'New record logged' : action === 'DELETE' ? 'Record deleted' : action === 'UPDATE' ? 'Record updated' : action;
      const title = `${moduleName}: ${actionVerb}`;
      const performedByUser = (audit as any).performedByUser || (audit as any).user || (audit as any).userName || (audit as any).loggedBy || 'System';
      const performedByRole = String((audit as any).performedByRole || (audit as any).role || 'System');

      items.push({
        id,
        title,
        description: details || `${actionVerb} for ${target} at ${audit.site || 'Site'} by ${performedByUser}.`,
        time: formatNotificationTime(audit.timestamp),
        timestamp: audit.timestamp,
        type,
        read: readNotificationIds.has(id),
        linkPage: getModuleLinkPage(moduleName),
        site: audit.site,
        performedByUser,
        performedByRole,
        module: moduleName,
        action,
        category,
        recordId: (audit as any).recordId || audit.id,
        targetItem: target
      });
    }
  });

  // Sort descending by timestamp (newest events first)
  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Filter notifications strictly according to RBAC rules and role permissions
 */
export function filterNotificationsForRole(
  firstArg: {
    notifications: NotificationItem[];
    userRole: RoleType;
    assignedSite: string;
    allowedSites?: string[];
    currentUserName: string;
    userEmail?: string;
    authProfileId?: string;
  } | NotificationItem[],
  secondArg?: {
    role?: string;
    userRole?: RoleType;
    assignedSite?: string;
    allowedSites?: string[];
    currentUserName?: string;
    username?: string;
    name?: string;
    userEmail?: string;
    email?: string;
    authProfileId?: string;
    id?: string;
  }
): NotificationItem[] {
  let notifications: NotificationItem[] = [];
  let userRole: RoleType = 'Staff';
  let assignedSite = '';
  let allowedSites: string[] = [];
  let currentUserName = '';
  let userEmail = '';
  let authProfileId = '';

  if (Array.isArray(firstArg)) {
    notifications = firstArg;
    const u = secondArg || {};
    userRole = (u.userRole || u.role || 'Staff') as RoleType;
    assignedSite = u.assignedSite || '';
    allowedSites = u.allowedSites || [];
    currentUserName = u.currentUserName || u.name || u.username || '';
    userEmail = u.userEmail || u.email || '';
    authProfileId = u.authProfileId || u.id || '';
  } else if (firstArg && typeof firstArg === 'object') {
    notifications = firstArg.notifications || [];
    userRole = firstArg.userRole;
    assignedSite = firstArg.assignedSite || '';
    allowedSites = firstArg.allowedSites || [];
    currentUserName = firstArg.currentUserName || '';
    userEmail = firstArg.userEmail || '';
    authProfileId = firstArg.authProfileId || '';
  }

  const effectiveAssignedSite = assignedSite && assignedSite !== 'All Sites' && assignedSite !== 'all'
    ? assignedSite
    : '';

  return notifications.filter(n => {
    // 1. Super Admin: Unrestricted enterprise access to everything
    if (userRole === 'Super Admin') {
      return true;
    }

    // 2. Admin: Full operational visibility across all sites
    if (userRole === 'Admin') {
      return true;
    }

    // 3. Regional Manager: Permitted across all regional sites in allowedSites
    if (userRole === 'Regional Manager') {
      if (!n.site || n.site === 'All Sites' || n.site === 'System') return true;
      if (allowedSites.length > 0 && allowedSites.some(site => isSiteMatch(site, n.site))) {
        return true;
      }
      if (effectiveAssignedSite && isSiteMatch(effectiveAssignedSite, n.site)) {
        return true;
      }
      // Personal actions by the Regional Manager
      if (isUserMatch(n.performedByUser, currentUserName, userEmail)) return true;
      return false;
    }

    // 4. Site Manager / General Manager: Strictly scoped to their managed site
    if (userRole === 'Site Manager' || userRole === 'General Manager') {
      // Personal actions by the manager
      if (isUserMatch(n.performedByUser, currentUserName, userEmail)) return true;

      // Personal profile changes regarding this manager
      if (n.category === 'profile_personal' && isUserMatch(n.targetItem, currentUserName, userEmail)) {
        return true;
      }

      // Actions occurring at their managed site
      if (effectiveAssignedSite && isSiteMatch(effectiveAssignedSite, n.site)) {
        // Exclude internal enterprise role permission modifications
        if (n.module === 'Roles' || n.action === 'SECURITY') return false;
        return true;
      }

      return false;
    }

    // 5. Staff / Employee (Frontline Level): Strictly restricted to their assigned property only
    if (isStaffLevel(userRole)) {
      if (!effectiveAssignedSite) {
        return false;
      }

      // Frontline staff should NEVER see sensitive role permissions, system settings, or enterprise security audits
      if (n.action === 'SECURITY' || (n.module && ['roles', 'permissions', 'settings', 'appsettings', 'schemas'].includes(n.module.toLowerCase()))) {
        return false;
      }

      // Personal profile changes regarding this staff member
      const isPersonalProfile = n.category === 'profile_personal' && (
        isUserMatch(n.targetItem, currentUserName, userEmail) || 
        isUserMatch(n.performedByUser, currentUserName, userEmail)
      );
      if (isPersonalProfile) {
        return true;
      }

      // Must strictly match their assigned property
      if (!n.site || !isSiteMatch(effectiveAssignedSite, n.site)) {
        return false;
      }

      return true;
    }

    // Fallback default: only strictly assigned site
    return Boolean(
      effectiveAssignedSite && n.site && isSiteMatch(effectiveAssignedSite, n.site)
    );
  });
}
