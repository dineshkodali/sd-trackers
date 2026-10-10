import { RoleType, UserAccount } from '../types';

/**
 * Roles whose accounts are made the lead officer of a property automatically
 * when an administrator assigns them to it. Other roles can still be chosen as
 * lead officer explicitly from the property record.
 */
export const LEAD_OFFICER_ROLES: readonly RoleType[] = ['General Manager', 'Area Manager'];

export interface OfficerMatch {
  user: UserAccount | null;
  /** More than one account matches, so none may be changed on the strength of the text alone. */
  ambiguous: boolean;
}

/**
 * Resolves the free-text lead officer on a property to a single account.
 * An email address is tried first because it is unique; a display name is
 * accepted only when exactly one account carries it. Site access is granted
 * from this result, so a doubtful match must resolve to nothing.
 */
export function findUserForOfficer(users: UserAccount[], officer?: string | null): OfficerMatch {
  const clean = (officer || '').trim().toLowerCase();
  if (!clean || clean === 'unassigned') return { user: null, ambiguous: false };

  const byEmail = users.filter(u => (u.email || '').trim().toLowerCase() === clean);
  if (byEmail.length === 1) return { user: byEmail[0], ambiguous: false };
  if (byEmail.length > 1) return { user: null, ambiguous: true };

  const byName = users.filter(u => (u.name || '').trim().toLowerCase() === clean);
  if (byName.length === 1) return { user: byName[0], ambiguous: false };
  return { user: null, ambiguous: byName.length > 1 };
}

/** The text stored as a property's lead officer: the name, or the email when the name is shared. */
export function officerLabelFor(users: UserAccount[], user: UserAccount): string {
  const name = (user.name || '').trim();
  if (!name) return user.email;
  const sameName = users.filter(u => (u.name || '').trim().toLowerCase() === name.toLowerCase());
  return sameName.length > 1 && user.email ? user.email : name;
}

export function hasAllSitesAccess(assignedSites: string[] | undefined): boolean {
  return Array.isArray(assignedSites) && assignedSites.some(s => s === 'All Sites' || s === 'All');
}
