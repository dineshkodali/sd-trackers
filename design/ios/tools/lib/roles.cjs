/** Role access rules, copied from the web app (App.tsx gates, initialData.ts, recordLifecycle.ts). Not invented. */
const ROLES = ['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Area Manager', 'Staff'];

const SUPER_ONLY = new Set(['pageAccess', 'pageMaintenance', 'roles', 'setupOptions']);
const SETTINGS_ROLES = new Set(['Super Admin', 'Admin']);
const EXPORT_ROLES = new Set(['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Area Manager']);
const USERS_PROPS_ROLES = new Set(['Super Admin', 'Admin', 'General Manager', 'Area Manager', 'Staff']);

const PERMS = {
  'Super Admin': { allSites: true, create: true, edit: true, delete: true, archive: true, export: true, restore: true, finance: true },
  'Admin': { allSites: true, create: true, edit: true, delete: true, archive: true, export: true, restore: false, finance: true },
  'Regional Manager': { allSites: true, create: true, edit: true, delete: false, archive: true, export: true, restore: false, finance: false },
  'General Manager': { allSites: false, create: true, edit: true, delete: false, archive: true, export: true, restore: false, finance: false },
  'Area Manager': { allSites: false, create: true, edit: true, delete: false, archive: true, export: true, restore: false, finance: false },
  'Staff': { allSites: false, create: true, edit: true, delete: false, archive: false, export: false, restore: false, finance: false },
};

/** Can this role open this page by role rules alone? (A Super Admin can also restrict individual users further.) */
function canSee(role, pageId) {
  if (SUPER_ONLY.has(pageId)) return role === 'Super Admin';
  if (pageId === 'notifications' || pageId === 'settings' || pageId === 'audit') return SETTINGS_ROLES.has(role);
  if (pageId === 'reports') return EXPORT_ROLES.has(role);
  if (pageId === 'users' || pageId === 'properties') return USERS_PROPS_ROLES.has(role);
  return true;
}

const ROLE_PROFILE = {
  'Super Admin': { who: 'Platform owner', scope: 'All sites', extra: 'Page Access, Page Maintenance, Roles & RBAC, Field Options, restore of archived/deleted users and properties' },
  'Admin': { who: 'Administrator', scope: 'All sites', extra: 'Users, Properties, Audit trail, Settings, Email notifications, finance; no restore, no Roles/Page Access' },
  'Regional Manager': { who: 'Manager (regional)', scope: 'All sites', extra: 'Reports and export; no Users/Properties pages, no deletes, no Audit/Settings' },
  'General Manager': { who: 'Manager (site)', scope: 'Assigned sites', extra: 'Reports and export; Users and Properties limited to own sites and lower roles' },
  'Area Manager': { who: 'Manager (area)', scope: 'Assigned sites', extra: 'Same as General Manager' },
  'Staff': { who: 'Frontline staff', scope: 'Assigned sites', extra: 'Create and edit records; no export, no archive/restore, no Reports/Audit/Settings; Users and Properties limited to own sites' },
};

module.exports = { ROLES, PERMS, canSee, ROLE_PROFILE };
