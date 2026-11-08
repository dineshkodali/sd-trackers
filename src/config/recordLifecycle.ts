/**
 * Archive / Deleted records for Users and Properties - shared (browser + server) rules.
 *
 * Every record is Active, Archived or Deleted. Nothing is ever removed from the database
 * by these actions; only a Super Admin can bring a record back. The same rules are enforced
 * again inside the database (db/migrations/028_record_lifecycle.sql) - this file exists so
 * the API and the screens give the same answer without a round trip.
 */

export type LifecycleState = 'Active' | 'Archived' | 'Deleted';
export type LifecycleAction = 'archive' | 'delete' | 'restore';
export type LifecycleEntity = 'users' | 'properties';

export const LIFECYCLE_ENTITIES: LifecycleEntity[] = ['users', 'properties'];

/** Database table behind each entity (Properties page = the `sites` table). */
export const LIFECYCLE_TABLE: Record<LifecycleEntity, 'profiles' | 'sites'> = {
  users: 'profiles',
  properties: 'sites',
};

export const LIFECYCLE_ENTITY_LABEL: Record<LifecycleEntity, string> = {
  users: 'User',
  properties: 'Property',
};

/** Higher number = more authority. A user can only act on users ranked below them. */
export const ROLE_RANK: Record<string, number> = {
  'Super Admin': 6,
  'Admin': 5,
  'Regional Manager': 4,
  'General Manager': 3,
  'Area Manager': 2,
  'Staff': 1,
};

/** Roles that may archive and delete (recoverably) within their scope. Regional Manager has no Users/Properties access today. */
export const LIFECYCLE_EDITOR_ROLES = ['Super Admin', 'Admin', 'General Manager', 'Area Manager', 'Staff'] as const;

const GLOBAL_ROLES = new Set(['Super Admin', 'Admin', 'Regional Manager']);

export const isLifecycleEditor = (role?: string | null): boolean =>
  !!role && (LIFECYCLE_EDITOR_ROLES as readonly string[]).includes(role);

/** Restoring archived or deleted records is reserved for Super Admin. */
export const canRestoreRecords = (role?: string | null): boolean => role === 'Super Admin';

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
const isAllSites = (s: string) => norm(s) === 'all sites' || norm(s) === 'all';

/** Whether the person can act on every site (role, or an "All Sites" assignment). */
export function hasGlobalScope(role: string | undefined | null, sites: string[] | undefined | null): boolean {
  if (role && GLOBAL_ROLES.has(role)) return true;
  return (sites || []).some(isAllSites);
}

/** Every site in `recordSites` is one the actor is assigned to (or the actor has global scope). */
export function sitesWithinScope(
  actor: { role?: string | null; sites?: string[] | null },
  recordSites: string[] | undefined | null,
): boolean {
  if (hasGlobalScope(actor.role, actor.sites)) return true;
  const mine = new Set((actor.sites || []).map(norm).filter(Boolean));
  const theirs = (recordSites || []).map(norm).filter(s => s && s !== 'pending assignment');
  // A record with no site cannot be shown to be inside a restricted person's scope.
  if (theirs.length === 0) return false;
  return theirs.every(s => mine.has(s));
}

export interface LifecycleActor {
  id: string;
  role: string;
  sites: string[];
}

export interface LifecycleTarget {
  id: string;
  state: LifecycleState;
  /** State the record was in before it was deleted (used to restore it to the right place). */
  previousState?: LifecycleState | null;
  /** Users: the person's role. */
  role?: string | null;
  /** Users: their assigned sites. Properties: the property's own name. */
  sites: string[];
}

export type TransitionResult =
  | { ok: true; from: LifecycleState; to: LifecycleState }
  | { ok: false; error: string };

/** Pure decision used by the API and the screens; the database repeats these checks. */
export function checkTransition(
  entity: LifecycleEntity,
  action: LifecycleAction,
  actor: LifecycleActor,
  target: LifecycleTarget,
): TransitionResult {
  if (!isLifecycleEditor(actor.role)) return { ok: false, error: 'Your role cannot change the status of this record.' };

  if (action === 'restore') {
    if (!canRestoreRecords(actor.role)) return { ok: false, error: 'Only a Super Admin can restore records.' };
    if (target.state === 'Active') return { ok: false, error: 'This record is already active.' };
    const to: LifecycleState = target.state === 'Deleted' && target.previousState === 'Archived' ? 'Archived' : 'Active';
    return { ok: true, from: target.state, to };
  }

  if (target.state === 'Deleted') return { ok: false, error: 'This record is already deleted.' };
  if (action === 'archive' && target.state === 'Archived') return { ok: false, error: 'This record is already archived.' };

  if (actor.role !== 'Super Admin') {
    if (!sitesWithinScope(actor, target.sites)) return { ok: false, error: 'This record is outside your assigned sites.' };
  }

  if (entity === 'users') {
    if (target.id === actor.id) return { ok: false, error: 'You cannot archive or delete your own account.' };
    if (actor.role !== 'Super Admin') {
      const mine = ROLE_RANK[actor.role] ?? 0;
      const theirs = ROLE_RANK[target.role ?? ''] ?? Number.MAX_SAFE_INTEGER;
      if (theirs >= mine) return { ok: false, error: 'You can only manage users with a lower role than yours.' };
    }
  }

  return { ok: true, from: target.state, to: action === 'archive' ? 'Archived' : 'Deleted' };
}

/**
 * Create / edit rules for the Users page. Anyone allowed onto the page may only create or
 * change users ranked below them, and only inside their own sites - so nobody can create
 * or promote an account above their own authority.
 */
export function checkUserWrite(
  actor: LifecycleActor,
  next: { id?: string; role: string; sites: string[]; currentRole?: string | null },
): { ok: true } | { ok: false; error: string } {
  if (!isLifecycleEditor(actor.role)) return { ok: false, error: 'Your role cannot manage users.' };
  if (actor.role === 'Super Admin') return { ok: true };
  const mine = ROLE_RANK[actor.role] ?? 0;
  if ((ROLE_RANK[next.role] ?? Number.MAX_SAFE_INTEGER) >= mine) {
    return { ok: false, error: 'You can only assign roles lower than your own.' };
  }
  if (next.currentRole !== undefined && next.currentRole !== null && (ROLE_RANK[next.currentRole] ?? Number.MAX_SAFE_INTEGER) >= mine) {
    return { ok: false, error: 'You can only change users with a lower role than yours.' };
  }
  if (next.id && next.id === actor.id) return { ok: false, error: 'You cannot change your own role or sites.' };
  if (!sitesWithinScope(actor, next.sites)) return { ok: false, error: 'You can only assign sites you are assigned to.' };
  return { ok: true };
}

/** Properties can only be created by someone who can act on every site; a new site is outside any narrower scope. */
export function canCreateProperty(actor: { role?: string | null; sites?: string[] | null }): boolean {
  return isLifecycleEditor(actor.role) && hasGlobalScope(actor.role, actor.sites);
}

export interface LifecycleRow {
  id: string;
  /** Display name or identifier. */
  label: string;
  /** "User" or "Property" */
  recordType: string;
  state: LifecycleState;
  previousState?: LifecycleState | null;
  /** The record's own status before the lifecycle change (e.g. Active / Inactive, Operational). */
  previousStatus?: string | null;
  changedAt?: string | null;
  changedBy?: string | null;
  reason?: string | null;
  /** Extra identifying detail (email, PID, role). */
  detail?: string | null;
}

export interface LifecycleEvent {
  id: string;
  entity: LifecycleEntity;
  recordId: string;
  recordLabel: string;
  action: LifecycleAction;
  previousState: LifecycleState;
  newState: LifecycleState;
  actorName: string;
  actorRole?: string | null;
  reason?: string | null;
  createdAt: string;
}

export function cleanReason(input: unknown): string {
  return typeof input === 'string' ? input.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
}
