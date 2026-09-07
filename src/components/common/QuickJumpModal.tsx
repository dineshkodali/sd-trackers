import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  LayoutDashboard, 
  Users, 
  Shield, 
  Building2, 
  FileText, 
  AlertTriangle, 
  Utensils, 
  Wrench, 
  FolderLock, 
  Activity, 
  Settings, 
  CheckCircle,
  Command,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface QuickJumpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickJumpModal: React.FC<QuickJumpModalProps> = ({ isOpen, onClose }) => {
  const { setActivePage } = useApp();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const modules = [
    { id: 'dashboard', name: 'Dashboard Overview', category: 'General', icon: LayoutDashboard, desc: 'Real-time operational summary & metrics' },
    { id: 'referrals', name: 'Asylum Referrals', category: 'Resident Care', icon: Users, desc: 'Incoming referrals & placement tracking' },
    { id: 'vulnerable', name: 'Vulnerable SUs (SPCD)', category: 'Safeguarding', icon: Shield, desc: 'Safeguarding adults at risk register' },
    { id: 'challenging', name: 'Challenging Behavior SUs', category: 'Safeguarding', icon: AlertTriangle, desc: 'Risk assessments & behavior management' },
    { id: 'maintenance', name: 'Maintenance Tracker', category: 'Operations', icon: Wrench, desc: 'Property defects & repair tickets' },
    { id: 'spcd', name: 'SPCD Follow-up Register', category: 'Safeguarding', icon: CheckCircle, desc: 'Special case protection directives' },
    { id: 'laundry', name: 'Laundry Operations', category: 'Services', icon: FileText, desc: 'Weekly linen & laundry schedules' },
    { id: 'food', name: 'Hot Food & Catering', category: 'Services', icon: Utensils, desc: 'Meal distribution & dietary logging' },
    { id: 'escalations', name: 'Escalations & Incidents', category: 'Safety', icon: AlertTriangle, desc: 'Critical incident reporting' },
    { id: 'documents', name: 'Document Vault', category: 'Compliance', icon: FolderLock, desc: 'Secure operational file repository' },
    { id: 'properties', name: 'Properties Directory', category: 'Infrastructure', icon: Building2, desc: 'Managed hotel cluster directory' },
    { id: 'users', name: 'User Directory & Password Audit', category: 'Administration', icon: Users, desc: 'Staff RBAC & credential management' },
    { id: 'reports', name: 'Compliance Reports', category: 'Analytics', icon: Activity, desc: 'Home Office audit analytics' },
    { id: 'audit', name: 'System Audit Logs', category: 'Security', icon: Activity, desc: 'Immutable transaction ledger' },
    { id: 'requests', name: 'Requests & Approvals', category: 'Workflow', icon: CheckCircle, desc: 'Pending administrative approvals' },
    { id: 'roles', name: 'RBAC Role Matrix', category: 'Security', icon: Shield, desc: 'Permission levels & scopes' },
    { id: 'settings', name: 'System Settings', category: 'Administration', icon: Settings, desc: 'Global configuration & sync' }
  ];

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Handle global Cmd+K or Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open via custom event or parent state if needed
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = query.trim() === '' 
    ? modules 
    : modules.filter(m => {
        const q = (query || '').toLowerCase();
        return (
          (m.name || '').toLowerCase().includes(q) || 
          (m.category || '').toLowerCase().includes(q) ||
          (m.desc || '').toLowerCase().includes(q)
        );
      });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-20 p-4">
      <div className="bg-white rounded-xs border border-[#edebe9] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#edebe9] bg-[#f8f9fa]">
          <Search className="w-5 h-5 text-[#8a8886] mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a module name or search quick-jump (e.g. Laundry, Hot Food, Audit)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-[#201f1e] placeholder-[#8a8886] focus:outline-hidden"
          />
          <div className="flex items-center gap-1 text-[10px] text-[#8a8886] font-mono bg-white border border-[#edebe9] px-2 py-1 rounded-xs">
            <Command className="w-3 h-3" /> K
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-[#f3f2f1]">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8a8886]">
              No matching modules found for "{query}".
            </div>
          ) : (
            filtered.map((mod) => {
              const Icon = mod.icon;
              return (
                <button
                  key={mod.id}
                  onClick={() => {
                    setActivePage(mod.id);
                    onClose();
                  }}
                  className="w-full text-left p-2.5 rounded-xs hover:bg-[#f3f9fd] hover:text-[#0078d4] transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xs bg-[#f3f2f1] group-hover:bg-[#e1dfdd] flex items-center justify-center text-[#323130] group-hover:text-[#0078d4] transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#201f1e] group-hover:text-[#0078d4] flex items-center gap-2">
                        {mod.name}
                        <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-[#f3f2f1] text-[#605e5c]">
                          {mod.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#605e5c]">{mod.desc}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#8a8886] group-hover:text-[#0078d4] group-hover:translate-x-0.5 transition-all" />
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-[#f8f9fa] border-t border-[#edebe9] flex items-center justify-between text-[11px] text-[#8a8886]">
          <span>Use arrow keys or click to navigate instantly</span>
          <span className="font-mono">SD Operations Portal</span>
        </div>

      </div>
    </div>
  );
};
