import React, { useRef } from 'react';
import { IconHeartHandshake as HeartHandshake, IconFileText as FileText, IconCloudUpload as UploadCloud, IconTrash as Trash2, IconCircleCheck as CheckCircle2, IconShieldExclamation as ShieldAlert, IconFlame as Flame, IconStethoscope as Stethoscope } from '@tabler/icons-react';
import { 
  ServiceUserDocument, 
  DISABILITY_CATEGORY_OPTIONS, 
  DEFAULT_DISABILITY_TYPE_OPTIONS,
  GP_PRACTICE_OPTIONS, 
  EVACUATION_PLAN_OPTIONS, 
  VULNERABLE_OPTIONS 
} from '../../types/masterData';
import { useApp } from '../../context/AppContext';
import { getUserDropdownOptions } from '../../utils/userSelectOptions';
import { OptionSelect } from '../common/OptionSelect';

const BulletListEditor: React.FC<{
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  addLabel: string;
}> = ({ label, items, onChange, placeholder, addLabel }) => {
  const rows = items.length > 0 ? items : [''];
  const update = (i: number, v: string) => onChange(rows.map((r, j) => (j === i ? v : r)));
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-neutral-600 font-medium">{label}</label>
        <button
          type="button"
          onClick={() => onChange([...rows, ''])}
          className="px-2 py-0.5 text-[10px] font-semibold bg-teal-50 border border-teal-200 text-teal-800 rounded hover:bg-teal-100"
        >
          + {addLabel}
        </button>
      </div>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-neutral-400">•</span>
            <input
              type="text"
              value={row}
              onChange={e => update(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            />
            <button
              type="button"
              onClick={() => onChange(rows.length > 1 ? rows.filter((_, j) => j !== i) : [''])}
              title="Remove"
              className="text-rose-500 hover:text-rose-700 text-base leading-none px-1"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Marker kept in a support row's notes so each Service User's own needs rows are found again (never shared between users). */
const NEEDS_MARK = 'su-form:';
const LEGACY_RE = /^(Vulnerabilities|Medical|Dietary|Mobility):/;
const splitLines = (text?: string) => (text || '').split('\n').map(l => l.trim()).filter(Boolean);

export interface SUNeedsFormValues {
  vulnerabilityFlags: string;
  medicalConditions: string[];
  dietaryNeeds: string[];
  mobilityNeeds: string;
  supportPriority?: string;
  assignedStaff?: string;
}

/** Reads one Service User's support rows back into the form fields (including the old single combined row). */
export function parseSUNeeds(records: any[]): SUNeedsFormValues {
  const out: SUNeedsFormValues = { vulnerabilityFlags: '', medicalConditions: [], dietaryNeeds: [], mobilityNeeds: '' };
  const legacy: Record<string, string[]> = { vulnerability: [], medical: [], dietary: [], mobility: [] };
  const legacyKey: Record<string, string> = { Vulnerabilities: 'vulnerability', Medical: 'medical', Dietary: 'dietary', Mobility: 'mobility' };
  for (const r of records || []) {
    const mark = String(r.notes || '').startsWith(NEEDS_MARK) ? String(r.notes).slice(NEEDS_MARK.length) : '';
    if (mark === 'vulnerability') {
      out.vulnerabilityFlags = r.description || '';
      out.supportPriority = r.priority; out.assignedStaff = r.assignedStaff || '';
    } else if (mark === 'medical') out.medicalConditions = splitLines(r.description);
    else if (mark === 'dietary') out.dietaryNeeds = splitLines(r.description);
    else if (mark === 'mobility') out.mobilityNeeds = r.description || '';
    else if (LEGACY_RE.test(r.description || '') && ['Safeguarding', 'Needs Assessment'].includes(r.category)) {
      if (!out.supportPriority) { out.supportPriority = r.priority; out.assignedStaff = r.assignedStaff || ''; }
      for (const seg of String(r.description).split(' | ')) {
        const m = seg.match(/^((?:Vulnerabilities|Medical|Dietary|Mobility):\s*)+/);
        if (!m) continue;
        const key = legacyKey[m[0].trim().split(':')[0]];
        const text = seg.slice(m[0].length).trim();
        if (text && !legacy[key].includes(text)) legacy[key].push(text);
      }
    }
  }
  if (!out.vulnerabilityFlags) out.vulnerabilityFlags = legacy.vulnerability.join('\n');
  if (out.medicalConditions.length === 0) out.medicalConditions = legacy.medical;
  if (out.dietaryNeeds.length === 0) out.dietaryNeeds = legacy.dietary;
  if (!out.mobilityNeeds) out.mobilityNeeds = legacy.mobility.join('; ');
  return out;
}

export interface SUSupportNeedsSectionProps {
  vulnerabilityFlags: string;
  setVulnerabilityFlags: (val: string) => void;
  dietaryNeeds: string[];
  setDietaryNeeds: (val: string[]) => void;
  medicalConditions: string[];
  setMedicalConditions: (val: string[]) => void;
  mobilityNeeds: string;
  setMobilityNeeds: (val: string) => void;
  supportPriority: 'Low' | 'Medium' | 'High' | 'Critical';
  setSupportPriority: (val: 'Low' | 'Medium' | 'High' | 'Critical') => void;
  assignedStaff: string;
  setAssignedStaff: (val: string) => void;
  // Needs, Safeguarding & Inspection Fields
  disabilityCategory?: string;
  setDisabilityCategory?: (val: string) => void;
  disabilityType?: string;
  setDisabilityType?: (val: string) => void;
  vulnerable?: 'Yes' | 'No';
  setVulnerable?: (val: 'Yes' | 'No') => void;
  personalEvacuationPlan?: string;
  setPersonalEvacuationPlan?: (val: string) => void;
  gpRegistration?: string;
  setGpRegistration?: (val: string) => void;
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
  setAssignedStaff,
  disabilityCategory = 'None',
  setDisabilityCategory,
  disabilityType = '',
  setDisabilityType,
  vulnerable = 'No',
  setVulnerable,
  personalEvacuationPlan = 'GEEP – General Emergency Evacuation Plan',
  setPersonalEvacuationPlan,
  gpRegistration = '',
  setGpRegistration
}) => {
  const { users } = useApp();
  const userOptions = getUserDropdownOptions(users);

  return (
    <div className="space-y-4">
      {/* Safeguarding, Evacuation & Health Profile (Core Inspection Fields) */}
      <div className="p-3.5 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#f0f0f0]">
          <h4 className="font-bold text-xs text-[#242424] flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-[#0d9488]" />
            <span>Inspection &amp; Safeguarding Profile</span>
          </h4>
          <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
            Mandatory Inspection Standards
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Vulnerable Status */}
          <div>
            <label className="block text-neutral-600 font-semibold mb-1 flex items-center justify-between">
              <span>Vulnerable Resident</span>
              {vulnerable === 'Yes' && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">
                  Flagged Vulnerable
                </span>
              )}
            </label>
            <select
              value={vulnerable}
              onChange={e => setVulnerable && setVulnerable(e.target.value as 'Yes' | 'No')}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] font-medium"
            >
              {VULNERABLE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              Identifies residents requiring active safeguarding monitoring.
            </p>
          </div>

          {/* Personal Evacuation Plan */}
          <div>
            <label className="block text-neutral-600 font-semibold mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-rose-600" />
                <span>Personal Evacuation Plan</span>
              </span>
              {personalEvacuationPlan.startsWith('PEEP') && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded">
                  PEEP Required
                </span>
              )}
            </label>
            <select
              value={personalEvacuationPlan}
              onChange={e => setPersonalEvacuationPlan && setPersonalEvacuationPlan(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] font-medium"
            >
              {EVACUATION_PLAN_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              PEEP is required for individuals needing emergency evacuation assistance.
            </p>
          </div>

          {/* GP Registration */}
          <div className="sm:col-span-2">
            <OptionSelect
              label="GP Registration"
              category="gpPractices"
              value={gpRegistration}
              onChange={val => setGpRegistration && setGpRegistration(val)}
              fallback={[...GP_PRACTICE_OPTIONS]}
              placeholder="-- Select Registered GP Practice --"
              allowAdd={true}
            />
            <p className="text-[10px] text-neutral-400 mt-0.5">
              Assigned NHS GP medical practice. Click + Add to record additional GP practices.
            </p>
          </div>

          {/* Disability Category */}
          <div>
            <OptionSelect
              label="Disability Category"
              category="disabilityCategories"
              value={disabilityCategory}
              onChange={val => setDisabilityCategory && setDisabilityCategory(val)}
              fallback={[...DISABILITY_CATEGORY_OPTIONS]}
              placeholder="Select Disability Category..."
              allowAdd={true}
            />
            <p className="text-[10px] text-neutral-400 mt-0.5">
              Broad statutory disability classification. All users can add and manage options.
            </p>
          </div>

          {/* Disability Type */}
          <div>
            <OptionSelect
              label="Disability Type / Specification"
              category="disabilityTypes"
              value={disabilityType}
              onChange={val => setDisabilityType && setDisabilityType(val)}
              fallback={[...DEFAULT_DISABILITY_TYPE_OPTIONS]}
              placeholder="Select or add disability type..."
              allowAdd={true}
            />
            <p className="text-[10px] text-neutral-400 mt-0.5">
              Specific disability condition or physical accessibility need. Click + Add to create new types.
            </p>
          </div>
        </div>
      </div>
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
              <option value="Low">Low: Standard Support</option>
              <option value="Medium">Medium: Regular Monitoring</option>
              <option value="High">High: Vulnerable / Active Welfare Checks</option>
              <option value="Critical">Critical: Immediate Safeguarding Required</option>
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
          <BulletListEditor
            label="Medical Conditions & Prescriptions"
            items={medicalConditions}
            onChange={setMedicalConditions}
            placeholder="e.g. Diabetes Type 2 – Metformin 500mg"
            addLabel="Add"
          />
          <BulletListEditor
            label="Dietary Requirements & Allergies"
            items={dietaryNeeds}
            onChange={setDietaryNeeds}
            placeholder="e.g. Halal only, Nut allergy"
            addLabel="Add"
          />
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
  medicalConditions: string[];
  dietaryNeeds: string[];
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

  // Support: each part is its own row for THIS Service User (updated in place, never re-added or shared)
  const existing: any[] = await suPropertyDetailsService.getSUSupport(suId);
  const rowFor = (key: string) => existing.find(r => r.notes === NEEDS_MARK + key);
  const today = new Date().toISOString().split('T')[0];
  const upsert = async (key: string, category: string, description: string, keepEmpty = false, extra: Record<string, any> = {}) => {
    const cur = rowFor(key);
    if (!description.trim() && !keepEmpty) {
      if (cur) await suPropertyDetailsService.deleteSUSupport(cur.id);
      return;
    }
    if (cur) await suPropertyDetailsService.updateSUSupport(cur.id, { category, description, ...extra });
    else await suPropertyDetailsService.addSUSupport({ suId, category, description, notes: NEEDS_MARK + key, startDate: today, status: 'Open', ...extra });
  };
  const medical = (medicalConditions || []).map(i => i.trim()).filter(Boolean).join('\n');
  const dietary = (dietaryNeeds || []).map(i => i.trim()).filter(Boolean).join('\n');
  const hasPrimary = Boolean(vulnerabilityFlags?.trim() || assignedStaff?.trim() || rowFor('vulnerability'));
  await upsert('vulnerability', 'Safeguarding', (vulnerabilityFlags || '').trim(), hasPrimary, {
    priority: (supportPriority || 'Medium') as any,
    assignedStaff: assignedStaff?.trim() || ''
  });
  await upsert('medical', 'Medical Conditions & Prescriptions', medical);
  await upsert('dietary', 'Dietary Requirements & Allergies', dietary);
  await upsert('mobility', 'Mobility & Accessibility', (mobilityNeeds || '').trim());
  // The old single combined row has now been split into the rows above
  for (const r of existing) {
    if (!String(r.notes || '').startsWith(NEEDS_MARK) && LEGACY_RE.test(r.description || '') && ['Safeguarding', 'Needs Assessment'].includes(r.category)) {
      await suPropertyDetailsService.deleteSUSupport(r.id);
    }
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

