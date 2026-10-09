import { UserAccount, RoleType } from '../types';
import { INITIAL_USERS } from '../data/initialData';

export interface UserDropdownOption {
  label: string;
  value: string;
  role: RoleType;
  email: string;
  assignedSites: string[];
}

/**
 * Generates options for a user select dropdown pulling directly from Staff Accounts & Role Assignments.
 */
export function getUserDropdownOptions(
  users?: UserAccount[] | null,
  options?: {
    roles?: RoleType[];
    siteName?: string;
    includeRoleInLabel?: boolean;
    onlyActive?: boolean;
  }
): { label: string; value: string; role?: string }[] {
  const allUsers: UserAccount[] = (Array.isArray(users) && users.length > 0)
    ? users
    : INITIAL_USERS;

  let filtered = allUsers.filter(u => u && (options?.onlyActive !== false ? u.status !== 'Inactive' : true));

  if (options?.roles && options.roles.length > 0) {
    filtered = filtered.filter(u => options.roles!.includes(u.role));
  }

  // Prioritize users assigned to this site
  if (options?.siteName && options.siteName !== 'All' && options.siteName !== 'All Sites') {
    const sNorm = options.siteName.trim().toLowerCase();
    filtered = [...filtered].sort((a, b) => {
      const aSites = Array.isArray(a.assignedSites) ? a.assignedSites : [];
      const bSites = Array.isArray(b.assignedSites) ? b.assignedSites : [];
      const aMatches = aSites.some(s => s === 'All' || s === 'All Sites' || s.trim().toLowerCase() === sNorm);
      const bMatches = bSites.some(s => s === 'All' || s === 'All Sites' || s.trim().toLowerCase() === sNorm);
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return (a.name || a.email).localeCompare(b.name || b.email);
    });
  } else {
    filtered = [...filtered].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  }

  return filtered.map(u => {
    const name = u.name || u.email;
    const roleStr = u.role ? ` (${u.role})` : '';
    const isAssigned = options?.siteName && Array.isArray(u.assignedSites) &&
      u.assignedSites.some(s => s.toLowerCase() === options.siteName!.toLowerCase());
    const assignedBadge = isAssigned ? ' ★' : '';
    const label = options?.includeRoleInLabel !== false ? `${name}${roleStr}${assignedBadge}` : name;
    return {
      label,
      value: name,
      role: u.role
    };
  });
}

/**
 * Detects if a column configuration key or label corresponds to a user/officer/staff/manager assignment field.
 */
export function isUserAssignmentField(keyStr: string, labelStr?: string): boolean {
  const key = String(keyStr || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const label = String(labelStr || '').toLowerCase();

  // Exclusions (logged-by, site columns, dates, external authorities)
  if (
    key === 'loggedby' ||
    key === 'createdby' ||
    key === 'laofficerleading' ||
    label.includes('la officer') ||
    label.includes('council')
  ) {
    return false;
  }

  return (
    key === 'leadofficer' ||
    key === 'leadcontactofficer' ||
    key === 'officername' ||
    key === 'conductingofficer' ||
    key === 'inspector' ||
    key === 'inspectingofficer' ||
    key === 'assignedstaff' ||
    key === 'assignedworker' ||
    key === 'keyworker' ||
    key === 'supportworker' ||
    key === 'propertymanager' ||
    key === 'housingofficer' ||
    key === 'housingofficername' ||
    label.includes('lead contact officer') ||
    label.includes('conducting officer') ||
    label.includes('inspector') ||
    label.includes('assigned staff') ||
    label.includes('assigned property manager') ||
    label.includes('housing officer') ||
    label.includes('key worker')
  );
}
