import React, { useState } from 'react';
import { ShieldAlert, Lock, User, RefreshCw, KeyRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RoleType } from '../../types';

export const SessionLockModal: React.FC = () => {
  const { isSessionLocked, sessionLockReason, unlockSession, currentUserRole, currentUserName, setCurrentUserRole, assignedSite } = useApp();

  if (!isSessionLocked) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border border-[#edebe9] rounded-xs shadow-2xl max-w-md w-full p-6 space-y-5 text-center">
        <div className="w-14 h-14 rounded-full bg-[#fdf3f2] border border-[#f8d7d6] flex items-center justify-center mx-auto text-[#a4262c] shadow-xs">
          <Lock className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-[#242424]">Session Locked for Security</h2>
          <p className="text-xs text-[#605e5c] mt-1">
            {sessionLockReason || 'Your session has been securely locked due to inactivity or policy timeout.'}
          </p>
        </div>

        <div className="p-3 bg-[#faf9f8] border border-[#edebe9] rounded-xs text-left space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#605e5c]">Current Operator:</span>
            <span className="font-semibold text-[#242424]">{currentUserName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#605e5c]">Security Role:</span>
            <span className="font-semibold text-[#0d9488] bg-[#f0fdfa] px-2 py-0.5 rounded border border-[#5eead4]">{currentUserRole}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#605e5c]">Assigned Site:</span>
            <span className="font-semibold text-[#242424]">{assignedSite || 'Global'}</span>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <button
            onClick={() => unlockSession()}
            className="w-full py-2.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-semibold text-xs rounded-xs shadow-xs transition-colors flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            <span>Unlock &amp; Resume Session</span>
          </button>

          <div className="text-[11px] text-[#8a8886] pt-1">
            Or select a role to re-authenticate:
          </div>

          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {(['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Employee'] as RoleType[]).map(role => (
              <button
                key={role}
                onClick={() => {
                  setCurrentUserRole(role);
                  unlockSession();
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-xs border transition-colors ${
                  currentUserRole === role 
                    ? 'bg-[#0f766e] text-white border-[#0f766e]' 
                    : 'bg-white text-[#323130] border-[#8a8886] hover:bg-[#edebe9]'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
