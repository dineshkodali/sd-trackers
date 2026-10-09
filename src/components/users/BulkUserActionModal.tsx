import React, { useState, useMemo } from 'react';
import { UserAccount, RoleType } from '../../types';
import { X, Users, AlertTriangle, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export type BulkActionType = 'role' | 'status' | 'assign_sites' | 'remove_sites' | 'delete' | null;

interface BulkUserActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUserIds: string[];
  actionType: BulkActionType;
  users: UserAccount[];
  onSuccess: () => void;
}

export const BulkUserActionModal: React.FC<BulkUserActionModalProps> = ({
  isOpen, onClose, selectedUserIds, actionType, users, onSuccess
}) => {
  const { updateUser, deleteUser, properties, addAuditEntry, currentUserRole, assignedSite } = useApp();

  const [step, setStep] = useState<'input' | 'preview' | 'processing' | 'result'>('input');
  
  // Input states
  const [targetRole, setTargetRole] = useState<RoleType>('Staff');
  const [targetStatus, setTargetStatus] = useState<'Active' | 'Inactive'>('Active');
  const [targetSites, setTargetSites] = useState<string[]>([]);
  const [isAllSites, setIsAllSites] = useState(false);

  const [results, setResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });

  const selectedUsers = useMemo(() => {
    return users.filter(u => selectedUserIds.includes(u.id));
  }, [users, selectedUserIds]);

  if (!isOpen || !actionType) return null;

  const handleToggleSite = (site: string) => {
    if (isAllSites) {
      setIsAllSites(false);
      setTargetSites([site]);
      return;
    }
    if (targetSites.includes(site)) {
      setTargetSites(prev => prev.filter(s => s !== site));
    } else {
      setTargetSites(prev => [...prev, site]);
    }
  };

  const generatePreview = () => {
    return selectedUsers.map(user => {
      let changes = '';
      if (actionType === 'role') changes = `${user.role} → ${targetRole}`;
      if (actionType === 'status') changes = `${user.status} → ${targetStatus}`;
      if (actionType === 'assign_sites') {
        const sites = isAllSites ? ['All Sites'] : targetSites;
        changes = `Add: ${sites.join(', ')}`;
      }
      if (actionType === 'remove_sites') {
        const sites = isAllSites ? ['All Sites'] : targetSites;
        changes = `Remove: ${sites.join(', ')}`;
      }
      if (actionType === 'delete') changes = `Will be permanently deleted`;

      return { user, changes };
    });
  };

  const handleApply = async () => {
    setStep('processing');
    let successCount = 0;
    let failCount = 0;

    for (const user of selectedUsers) {
      try {
        if (actionType === 'delete') {
          await deleteUser(user.id);
          successCount++;
        } else if (actionType === 'role') {
          await updateUser(user.id, { role: targetRole });
          successCount++;
        } else if (actionType === 'status') {
          await updateUser(user.id, { status: targetStatus });
          successCount++;
        } else if (actionType === 'assign_sites') {
          let currentSites = Array.isArray(user.assignedSites) ? user.assignedSites : [];
          if (currentSites.includes('All Sites') || currentSites.includes('All')) {
            currentSites = ['All Sites'];
          }
          if (isAllSites) {
            currentSites = ['All Sites'];
          } else {
            if (currentSites[0] !== 'All Sites') {
              currentSites = Array.from(new Set([...currentSites, ...targetSites]));
            }
          }
          if (currentSites.length === 0) currentSites = ['Pending Assignment'];
          await updateUser(user.id, { assignedSites: currentSites });
          successCount++;
        } else if (actionType === 'remove_sites') {
          let currentSites = Array.isArray(user.assignedSites) ? user.assignedSites : [];
          if (isAllSites) {
            currentSites = ['Pending Assignment'];
          } else {
            if (currentSites.includes('All Sites') || currentSites.includes('All')) {
              // Can't remove specific sites from 'All Sites' cleanly unless we map all properties minus removed.
              // For simplicity, we'll convert to all properties minus removed.
              currentSites = properties.map(p => p.name).filter(p => !targetSites.includes(p));
            } else {
              currentSites = currentSites.filter(s => !targetSites.includes(s));
            }
          }
          if (currentSites.length === 0) currentSites = ['Pending Assignment'];
          await updateUser(user.id, { assignedSites: currentSites });
          successCount++;
        }
      } catch (err) {
        console.error(`Failed to bulk update user ${user.id}`, err);
        failCount++;
      }
    }

    addAuditEntry(
      'BULK_UPDATE',
      'Users',
      `Bulk ${actionType} on ${selectedUsers.length} users`,
      assignedSite,
      `Action: ${actionType}. Success: ${successCount}. Failed: ${failCount}.`
    );

    setResults({ success: successCount, failed: failCount });
    setStep('result');
    if (successCount > 0) {
      onSuccess();
    }
  };

  const getActionTitle = () => {
    switch (actionType) {
      case 'role': return 'Bulk Change Role';
      case 'status': return 'Bulk Change Status';
      case 'assign_sites': return 'Bulk Assign Properties';
      case 'remove_sites': return 'Bulk Remove Properties';
      case 'delete': return 'Bulk Delete Users';
      default: return 'Bulk Action';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-md shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#faf9f8] border-b border-[#e1dfdd] px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#0d9488]" />
            <h2 className="text-lg font-bold text-[#323130]">{getActionTitle()}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'processing'}
            className="text-neutral-400 hover:text-neutral-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 'input' && (
            <div className="space-y-6">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-xs border border-blue-200 text-sm">
                You have selected <strong>{selectedUsers.length}</strong> user{selectedUsers.length > 1 ? 's' : ''} for this bulk action.
              </div>

              {actionType === 'role' && (
                <div>
                  <label className="block font-semibold text-[#323130] mb-2">Select New Role</label>
                  <select
                    value={targetRole}
                    onChange={e => setTargetRole(e.target.value as RoleType)}
                    className="w-full px-3 py-2 border border-[#8a8886] rounded-xs bg-white focus:outline-hidden focus:border-[#0d9488]"
                  >
                    <option value="Staff">Staff</option>
                    <option value="Area Manager">Area Manager</option>
                    <option value="General Manager">General Manager</option>
                    <option value="Regional Manager">Regional Manager</option>
                    <option value="Admin">Admin</option>
                    <option value="Super Admin">Super Admin</option>
                  </select>
                </div>
              )}

              {actionType === 'status' && (
                <div>
                  <label className="block font-semibold text-[#323130] mb-2">Select New Status</label>
                  <select
                    value={targetStatus}
                    onChange={e => setTargetStatus(e.target.value as 'Active' | 'Inactive')}
                    className="w-full px-3 py-2 border border-[#8a8886] rounded-xs bg-white focus:outline-hidden focus:border-[#0d9488]"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              )}

              {(actionType === 'assign_sites' || actionType === 'remove_sites') && (
                <div>
                  <label className="block font-semibold text-[#323130] mb-2">Select Properties</label>
                  <div 
                    onClick={() => {
                      setIsAllSites(!isAllSites);
                      if (!isAllSites) setTargetSites([]);
                    }}
                    className={`p-2.5 rounded-xs border mb-2 cursor-pointer transition-colors flex items-center gap-2 ${
                      isAllSites ? 'bg-[#f0fdfa] border-[#5eead4] text-[#0f766e]' : 'bg-[#faf9f8] border-[#e1dfdd] text-[#323130]'
                    }`}
                  >
                    <input type="checkbox" checked={isAllSites} readOnly className="rounded-xs text-[#0d9488]" />
                    <span className="font-bold text-sm">System-Wide (All Properties)</span>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-2 space-y-1">
                    {properties.map(p => (
                      <label key={p.id || p.name} className={`flex items-center gap-2 p-1.5 rounded-xs cursor-pointer ${isAllSites ? 'opacity-50 pointer-events-none' : 'hover:bg-white'}`}>
                        <input
                          type="checkbox"
                          checked={isAllSites || targetSites.includes(p.name)}
                          onChange={() => handleToggleSite(p.name)}
                          disabled={isAllSites}
                          className="rounded-xs text-[#0d9488]"
                        />
                        <span className="text-sm">{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {actionType === 'delete' && (
                <div className="bg-red-50 text-red-800 p-4 rounded-xs border border-red-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                  <div className="text-sm">
                    <p className="font-bold mb-1">Warning: Destructive Action</p>
                    <p>You are about to permanently delete <strong>{selectedUsers.length}</strong> user accounts. This action cannot be undone.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <h3 className="font-bold text-[#323130]">Preview Changes</h3>
              <p className="text-sm text-neutral-600">Please review the following changes before applying them to {selectedUsers.length} users.</p>
              
              <div className="border border-[#e1dfdd] rounded-xs max-h-64 overflow-y-auto bg-[#faf9f8]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#edebe9] sticky top-0">
                    <tr>
                      <th className="p-2 font-semibold">User</th>
                      <th className="p-2 font-semibold">Changes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edebe9]">
                    {generatePreview().map((p, i) => (
                      <tr key={i} className="bg-white">
                        <td className="p-2 truncate max-w-[200px]">{p.user.name || p.user.email}</td>
                        <td className="p-2 text-[#0d9488] font-medium">{p.changes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-8 h-8 text-[#0d9488] animate-spin" />
              <p className="text-[#323130] font-medium">Applying bulk changes...</p>
            </div>
          )}

          {step === 'result' && (
            <div className="py-8 flex flex-col items-center justify-center space-y-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${results.failed === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                {results.failed === 0 ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-[#323130] mb-1">Bulk Action Complete</h3>
                <p className="text-sm text-neutral-600">
                  Successfully updated <strong>{results.success}</strong> users.
                  {results.failed > 0 && <span className="text-red-600 ml-1">Failed: {results.failed}.</span>}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#faf9f8] border-t border-[#e1dfdd] px-6 py-4 flex items-center justify-end gap-3 shrink-0">
          {step === 'input' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('preview')}
                disabled={actionType !== 'delete' && actionType !== 'role' && actionType !== 'status' && !isAllSites && targetSites.length === 0}
                className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white text-sm font-semibold rounded-xs shadow-xs disabled:opacity-50 flex items-center gap-2"
              >
                <span>Preview</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('input')}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Back
              </button>
              <button
                onClick={handleApply}
                className={`px-4 py-2 text-white text-sm font-semibold rounded-xs shadow-xs flex items-center gap-2 ${
                  actionType === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0d9488] hover:bg-[#0f766e]'
                }`}
              >
                <span>Confirm & Apply</span>
              </button>
            </>
          )}

          {step === 'result' && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white text-sm font-semibold rounded-xs shadow-xs"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
