import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertTriangle, CheckCircle, Loader2, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RoleType } from '../../types';
import { apiService } from '../../services/apiService';

interface BulkUserImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedUser {
  name: string;
  email: string;
  password?: string;
  role: RoleType;
  assignedSites: string[];
  status: 'Active' | 'Inactive';
}

export const BulkUserImportModal: React.FC<BulkUserImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { properties, addAuditEntry, assignedSite } = useApp();
  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'result'>('upload');
  
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  
  const [results, setResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
  const [importErrors, setImportErrors] = useState<Array<{ email: string; error: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const validRoles: RoleType[] = ['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Area Manager', 'Staff'];

  const normalizeRole = (roleStr: string): RoleType => {
    const clean = roleStr.toLowerCase().replace(/[\s_\-]+/g, '');
    if (clean === 'superadmin') return 'Super Admin';
    if (clean === 'admin' || clean === 'administrator') return 'Admin';
    if (clean === 'regionalmanager') return 'Regional Manager';
    if (clean === 'generalmanager') return 'General Manager';
    if (clean === 'areamanager') return 'Area Manager';
    return 'Staff';
  };

  const downloadTemplate = () => {
    const headers = ['Name', 'Email', 'Password', 'Role', 'Assigned Properties', 'Status'];
    const sampleRows = [
      ['John Doe', 'john@example.com', 'TempPass123!', 'Staff', 'Brit Hotel, Leigham Court Hotel', 'Active'],
      ['Jane Smith', 'jane@example.com', 'TempPass123!', 'Area Manager', 'All Sites', 'Active']
    ];
    
    const csvContent = [headers.join(','), ...sampleRows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'users_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSVLine = (text: string) => {
    const ret: string[] = [];
    let inQuote = false;
    let value = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuote && text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (char === ',' && !inQuote) {
        ret.push(value.trim());
        value = '';
      } else {
        value += char;
      }
    }
    ret.push(value.trim());
    return ret;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
      
      if (lines.length <= 1) {
        setErrors(['File is empty or contains only headers.']);
        return;
      }

      const users: ParsedUser[] = [];
      const validationErrors: string[] = [];

      // Detect header columns dynamically if headers are provided
      const headerCols = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim().replace(/[\s_\-]+/g, ''));
      const findHeader = (patterns: string[]) => headerCols.findIndex(h => patterns.some(p => h.includes(p)));

      const nameIdx = findHeader(['name', 'fullname', 'username']);
      const emailIdx = findHeader(['email', 'mail']);
      const passwordIdx = findHeader(['pass', 'pwd']);
      const roleIdx = findHeader(['role', 'type', 'permission']);
      const sitesIdx = findHeader(['site', 'properties', 'property', 'location']);
      const statusIdx = findHeader(['status', 'active', 'state']);

      // If headers match email, use detected indices; otherwise default to standard column order (0=Name, 1=Email, 2=Password, etc.)
      const hasDetectedHeaders = emailIdx !== -1;
      const colMap = {
        name: hasDetectedHeaders && nameIdx !== -1 ? nameIdx : 0,
        email: hasDetectedHeaders ? emailIdx : 1,
        password: hasDetectedHeaders && passwordIdx !== -1 ? passwordIdx : 2,
        role: hasDetectedHeaders && roleIdx !== -1 ? roleIdx : 3,
        sites: hasDetectedHeaders && sitesIdx !== -1 ? sitesIdx : 4,
        status: hasDetectedHeaders && statusIdx !== -1 ? statusIdx : 5
      };

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

        const email = (cols[colMap.email] || '').trim();
        const name = (cols[colMap.name] || '').trim() || (email ? email.split('@')[0] : `User ${i}`);
        const password = (cols[colMap.password] || '').trim() || '';
        const roleRaw = (cols[colMap.role] || '').trim() || 'Staff';
        const sitesStr = (cols[colMap.sites] || '').trim() || 'All Sites';
        const statusStr = (cols[colMap.status] || '').trim() || 'Active';

        if (!email || !email.includes('@')) {
          validationErrors.push(`Row ${i + 1}: Valid email address is required (found: "${email || 'empty'}")`);
          continue;
        }

        const role = normalizeRole(roleRaw);
        const assignedSites = sitesStr.split(',').map(s => s.trim()).filter(Boolean);
        const status = statusStr.toLowerCase() === 'inactive' ? 'Inactive' : 'Active';

        users.push({
          name,
          email,
          password: password.length >= 12 ? password : undefined, // server assigns a random password; user resets it
          role,
          assignedSites: assignedSites.length > 0 ? assignedSites : ['All Sites'],
          status
        });
      }

      setParsedUsers(users);
      setErrors(validationErrors);
      setStep('preview');
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleProcess = async () => {
    setStep('processing');
    setImportErrors([]);

    const payload = parsedUsers.map(u => ({
      email: u.email,
      password: u.password,
      name: u.name,
      role: u.role,
      assignedSites: u.assignedSites,
      assignedSite: u.assignedSites.join(','),
      status: u.status
    }));

    try {
      const res = await apiService.bulkImportUsers(payload);

      const successCount = res.imported ?? (res.success ? parsedUsers.length : 0);
      const failCount = res.failed ?? (res.success ? 0 : parsedUsers.length);
      const errorsList = res.errors || [];

      setResults({ success: successCount, failed: failCount });
      setImportErrors(errorsList);

      addAuditEntry(
        'BULK_IMPORT',
        'Users',
        `Bulk imported ${successCount} users`,
        assignedSite,
        `Attempted: ${parsedUsers.length}. Success: ${successCount}. Failed: ${failCount}.`
      );

      setStep('result');
      if (successCount > 0) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Bulk import error:', err);
      setResults({ success: 0, failed: parsedUsers.length });
      setImportErrors([{ email: 'Bulk Import', error: err?.message || 'Unexpected network error' }]);
      setStep('result');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-md shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-[#faf9f8] border-b border-[#e1dfdd] px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-[#323130] flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#0d9488]" />
            Bulk Import Users
          </h2>
          <button onClick={onClose} disabled={step === 'processing'} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {step === 'upload' && (
            <div className="space-y-6 text-center">
              <div className="bg-[#f0fdfa] p-6 rounded-md border border-teal-200">
                <FileText className="w-12 h-12 text-[#0d9488] mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-2 text-[#0f766e]">Upload CSV File</h3>
                <p className="text-sm text-teal-800 mb-4 max-w-md mx-auto">
                  Upload a CSV file containing user details. Make sure your file matches the required template structure.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button 
                    onClick={downloadTemplate}
                    className="px-4 py-2 bg-white text-[#0d9488] border border-[#0d9488] rounded-xs shadow-xs text-sm font-semibold flex items-center gap-2 hover:bg-teal-50 transition-colors"
                  >
                    <Download className="w-4 h-4" /> Download Template
                  </button>
                  <label className="px-4 py-2 bg-[#0d9488] text-white rounded-xs shadow-xs text-sm font-semibold flex items-center gap-2 hover:bg-[#0f766e] transition-colors cursor-pointer">
                    <Upload className="w-4 h-4" /> Select CSV File
                    <input 
                      type="file" 
                      accept=".csv" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>
              
              {errors.length > 0 && (
                <div className="bg-red-50 text-red-800 p-4 rounded-xs border border-red-200 text-left">
                  <p className="font-bold mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Error processing file</p>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#323130]">Preview Users ({parsedUsers.length})</h3>
                {errors.length > 0 && (
                  <span className="text-sm text-red-600 font-semibold">{errors.length} validation errors</span>
                )}
              </div>
              
              <div className="border border-[#e1dfdd] rounded-xs max-h-[50vh] overflow-y-auto bg-[#faf9f8]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#edebe9] sticky top-0 shadow-sm">
                    <tr>
                      <th className="p-2 font-semibold">Name</th>
                      <th className="p-2 font-semibold">Email</th>
                      <th className="p-2 font-semibold">Role</th>
                      <th className="p-2 font-semibold">Assigned Properties</th>
                      <th className="p-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edebe9]">
                    {parsedUsers.map((u, i) => (
                      <tr key={i} className="bg-white hover:bg-neutral-50">
                        <td className="p-2">{u.name}</td>
                        <td className="p-2">{u.email}</td>
                        <td className="p-2"><span className="px-2 py-0.5 bg-neutral-100 rounded text-[10px] font-semibold">{u.role}</span></td>
                        <td className="p-2 text-neutral-500">{u.assignedSites.join(', ') || 'Pending'}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${u.status === 'Active' ? 'bg-teal-50 text-teal-700' : 'bg-neutral-100 text-neutral-600'}`}>{u.status}</span>
                        </td>
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
              <p className="text-[#323130] font-medium">Importing {parsedUsers.length} users... Please wait.</p>
            </div>
          )}

          {step === 'result' && (
            <div className="py-6 flex flex-col items-center justify-center space-y-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${results.failed === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                {results.failed === 0 ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <div className="text-center w-full max-w-lg">
                <h3 className="text-lg font-bold text-[#323130] mb-1">Import Complete</h3>
                <p className="text-sm text-neutral-600">
                  Successfully imported <strong>{results.success}</strong> users.
                  {results.failed > 0 && <span className="text-red-600 ml-1 font-semibold">Failed: {results.failed}.</span>}
                </p>

                {importErrors.length > 0 && (
                  <div className="mt-4 text-left max-h-48 overflow-y-auto bg-red-50 p-3 rounded-xs border border-red-200 text-xs">
                    <div className="font-semibold text-red-800 mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Breakdown of Failures ({importErrors.length}):
                    </div>
                    <ul className="space-y-1 text-red-700">
                      {importErrors.map((e, idx) => (
                        <li key={idx} className="flex flex-col sm:flex-row sm:gap-2">
                          <span className="font-mono font-medium text-neutral-900">{e.email}:</span>
                          <span>{e.error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#faf9f8] border-t border-[#e1dfdd] px-6 py-4 flex items-center justify-end gap-3 shrink-0">
          {step === 'upload' && (
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900">Cancel</button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('upload')} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900">Back</button>
              <button onClick={handleProcess} disabled={parsedUsers.length === 0} className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white text-sm font-semibold rounded-xs shadow-xs">
                Confirm & Import
              </button>
            </>
          )}
          {step === 'result' && (
            <button onClick={onClose} className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white text-sm font-semibold rounded-xs shadow-xs">Close</button>
          )}
        </div>
      </div>
    </div>
  );
};
