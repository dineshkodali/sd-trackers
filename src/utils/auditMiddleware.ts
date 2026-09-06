/**
 * Centralized Audit Middleware for CRUD operations across all modules.
 * Automatically captures user ID, timestamp, and action metadata.
 */

export interface AuditMetadata {
  userId: string;
  userName: string;
  userRole: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE';
  timestamp: string;
}

export function attachAuditMetadata<T extends Record<string, any>>(
  record: T,
  currentUser: { id: string; name: string; role: string },
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE'
): T & { auditMetadata: AuditMetadata; updatedAt?: string; updatedBy?: string; createdAt?: string; createdBy?: string } {
  const timestamp = new Date().toISOString();
  const metadata: AuditMetadata = {
    userId: currentUser.id || 'system-admin',
    userName: currentUser.name || 'System Administrator',
    userRole: currentUser.role || 'Super Admin',
    action,
    timestamp
  };

  const enhanced: any = { ...record };
  if (action === 'CREATE') {
    enhanced.createdAt = timestamp;
    enhanced.createdBy = currentUser.name || currentUser.id;
  }
  enhanced.updatedAt = timestamp;
  enhanced.updatedBy = currentUser.name || currentUser.id;
  enhanced.auditMetadata = metadata;

  return enhanced;
}
