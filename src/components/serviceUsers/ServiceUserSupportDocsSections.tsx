import React, { useRef } from 'react';
import { HeartHandshake, FileText, UploadCloud, Trash2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { ServiceUserDocument } from '../../types/masterData';
import { useApp } from '../../context/AppContext';
import { getUserDropdownOptions } from '../../utils/userSelectOptions';

export interface SUSupportNeedsSectionProps {
  vulnerabilityFlags: string;
  setVulnerabilityFlags: (val: string) => void;
  dietaryNeeds: string;
  setDietaryNeeds: (val: string) => void;
  medicalConditions: string;
  setMedicalConditions: (val: string) => void;
  mobilityNeeds: string;
  setMobilityNeeds: (val: string) => void;
  supportPriority: 'Low' | 'Medium' | 'High' | 'Critical';
  setSupportPriority: (val: 'Low' | 'Medium' | 'High' | 'Critical') => void;
  assignedStaff: string;
  setAssignedStaff: (val: string) => void;
}

export const SUSupportNeedsSection: React.FC<SUSupportNeedsSectionProps> = ({
  vulnerabilityFlags,
  setVulnerabilityFlags,
  dietaryNeeds,
  setDietaryNeeds,
  medicalConditions,
  setMedicalConditions,
  mobilityNeeds,
  setMobilityNeeds,
  supportPriority,
  setSupportPriority,
  assignedStaff,
  setAssignedStaff
}) => {
  const { users } = useApp();
  const userOptions = getUserDropdownOptions(users);

  return (
    <div className="space-y-4">
      <div className="p-3.5 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs space-y-3">
        <h4 className="font-bold text-xs text-[#242424] flex items-center gap-1.5 pb-2 border-b border-[#f0f0f0]">
          <HeartHandshake className="w-3.5 h-3.5 text-[#0d9488]" />
          <span>Support, Safeguarding &amp; Vulnerabilities</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Support Priority / Alert Level</label>
            <select
              value={supportPriority}
              onChange={e => setSupportPriority(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] font-semibold"
            >
              <option value="Low">Low — Standard Support</option>
              <option value="Medium">Medium — Regular Monitoring</option>
              <option value="High">High — Vulnerable / Active Welfare Checks</option>
              <option value="Critical">Critical — Immediate Safeguarding Required</option>
            </select>
          </div>
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Assigned Key Worker / Staff</label>
            <select
              value={assignedStaff}
              onChange={e => setAssignedStaff(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            >
              <option value="">-- Select Key Worker / Staff --</option>
              {assignedStaff && !userOptions.some(u => u.value === assignedStaff) && (
                <option value={assignedStaff}>{assignedStaff} (Current)</option>
              )}
              {userOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-neutral-600 font-medium mb-1">Vulnerability Flags &amp; Safeguarding Notes</label>
          <textarea
            rows={2}
            value={vulnerabilityFlags}
            onChange={e => setVulnerabilityFlags(e.target.value)}
            placeholder="e.g. Unaccompanied minor, victim of trauma, language barrier, risk of absconding..."
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Medical Conditions &amp; Prescriptions</label>
            <textarea
              rows={2}
              value={medicalConditions}
              onChange={e => setMedicalConditions(e.target.value)}
              placeholder="e.g. Diabetes Type 2, Asthma, regular medication required..."
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Dietary Requirements &amp; Allergies</label>
            <textarea
              rows={2}
              value={dietaryNeeds}
              onChange={e => setDietaryNeeds(e.target.value)}
              placeholder="e.g. Halal only, Nut allergy, Vegetarian, Gluten free..."
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>
        </div>

        <div>
          <label className="block text-neutral-600 font-medium mb-1">Mobility &amp; Room Accessibility</label>
          <input
            type="text"
            value={mobilityNeeds}
            onChange={e => setMobilityNeeds(e.target.value)}
            placeholder="e.g. Ground floor required, step-free access, wheelchair accessible"
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
          />
        </div>
      </div>
    </div>
  );
};

export interface SUDocumentsUploadSectionProps {
  existingDocuments: ServiceUserDocument[];
  onDeleteExistingDoc?: (id: string) => void;
  newDocs: Array<{ type: string; name: string; fileUrl: string; fileName: string }>;
  setNewDocs: React.Dispatch<React.SetStateAction<Array<{ type: string; name: string; fileUrl: string; fileName: string }>>>;
}

export const SUDocumentsUploadSection: React.FC<SUDocumentsUploadSectionProps> = ({
  existingDocuments,
  onDeleteExistingDoc,
  newDocs,
  setNewDocs
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = React.useState('Identification');
  const [docName, setDocName] = React.useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setNewDocs(prev => [
        ...prev,
        {
          type: docType,
          name: docName.trim() || file.name,
          fileUrl: base64,
          fileName: file.name
        }
      ]);
      setDocName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const removeNewDoc = (idx: number) => {
    setNewDocs(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      {/* Upload Box */}
      <div className="p-3.5 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs space-y-3">
        <h4 className="font-bold text-xs text-[#242424] flex items-center gap-1.5 pb-2 border-b border-[#f0f0f0]">
          <FileText className="w-3.5 h-3.5 text-[#0d9488]" />
          <span>Upload Resident Documentation</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Document Category</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            >
              <option value="Identification">Identification (ARC / Passport / ID)</option>
              <option value="Referral Letter">Referral Letter / Home Office Notice</option>
              <option value="Medical Report">Medical / Prescription Form</option>
              <option value="Intake Assessment">Intake / Occupancy Agreement</option>
              <option value="Proof of Address">Proof of Address</option>
              <option value="Other">Other Supporting Document</option>
            </select>
          </div>
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Document Title</label>
            <input
              type="text"
              value={docName}
              onChange={e => setDocName(e.target.value)}
              placeholder="e.g. Tariq ARC Card Front & Back"
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>
          <div className="flex flex-col justify-end">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
              id="su-doc-file-input"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-3 py-1.5 bg-white hover:bg-neutral-50 text-neutral-700 border border-[#8a8886] rounded-xs text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UploadCloud className="w-3.5 h-3.5 text-[#0d9488]" />
              <span>Choose File to Attach</span>
            </button>
          </div>
        </div>
      </div>

      {/* Newly Attached Files */}
      {newDocs.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider">
            Files Ready to Save ({newDocs.length})
          </h5>
          <div className="space-y-1.5">
            {newDocs.map((doc, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 bg-teal-50/50 border border-teal-200 rounded-xs text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0d9488]" />
                  <span className="font-semibold text-teal-900">{doc.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-teal-100 text-teal-800 rounded font-medium">{doc.type}</span>
                  <span className="text-[10px] text-neutral-500 truncate max-w-xs">{doc.fileName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeNewDoc(idx)}
                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Uploaded Files on Record */}
      {existingDocuments.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider">
            Existing Saved Documents ({existingDocuments.length})
          </h5>
          <div className="space-y-1.5">
            {existingDocuments.map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-2.5 bg-white border border-[#e5e5e5] rounded-xs text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-neutral-500" />
                  <span className="font-medium text-neutral-800">{doc.documentName}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded">{doc.documentType}</span>
                  <span className="text-[10px] text-neutral-400">Uploaded {doc.createdAt ? doc.createdAt.split('T')[0] : '—'}</span>
                </div>
                {onDeleteExistingDoc && (
                  <button
                    type="button"
                    onClick={() => onDeleteExistingDoc(doc.id)}
                    className="p-1 text-neutral-400 hover:text-red-600 rounded cursor-pointer"
                    title="Remove document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export async function saveSUAdditionalDetails({
  suId,
  contactData,
  householdMembers,
  supportPriority,
  assignedStaff,
  vulnerabilityFlags,
  medicalConditions,
  dietaryNeeds,
  mobilityNeeds,
  newDocs,
  suPropertyDetailsService
}: {
  suId: string;
  contactData: any;
  householdMembers: any[];
  supportPriority: string;
  assignedStaff: string;
  vulnerabilityFlags: string;
  medicalConditions: string;
  dietaryNeeds: string;
  mobilityNeeds: string;
  newDocs: Array<{ type: string; name: string; fileUrl: string; fileName: string }>;
  suPropertyDetailsService: any;
}) {
  // Save contact
  if (contactData) {
    await suPropertyDetailsService.saveSUContact({
      id: `ct-${suId}`,
      suId,
      ...contactData
    });
  }

  // Support
  if (vulnerabilityFlags?.trim() || dietaryNeeds?.trim() || medicalConditions?.trim() || mobilityNeeds?.trim()) {
    await suPropertyDetailsService.addSUSupport({
      suId,
      category: vulnerabilityFlags?.trim() ? 'Safeguarding' : 'Needs Assessment',
      description: [
        vulnerabilityFlags?.trim() ? `Vulnerabilities: ${vulnerabilityFlags.trim()}` : '',
        medicalConditions?.trim() ? `Medical: ${medicalConditions.trim()}` : '',
        dietaryNeeds?.trim() ? `Dietary: ${dietaryNeeds.trim()}` : '',
        mobilityNeeds?.trim() ? `Mobility: ${mobilityNeeds.trim()}` : ''
      ].filter(Boolean).join(' | '),
      priority: supportPriority || 'Medium',
      assignedStaff: assignedStaff?.trim() || '',
      startDate: new Date().toISOString().split('T')[0],
      status: 'Open'
    });
  }

  // Docs
  if (newDocs && newDocs.length > 0) {
    for (const d of newDocs) {
      await suPropertyDetailsService.addSUDocument({
        suId,
        documentType: d.type,
        documentName: d.name,
        fileUrl: d.fileUrl,
        verificationStatus: 'Verified',
        notes: 'Uploaded via Service User Form'
      });
    }
  }
}

