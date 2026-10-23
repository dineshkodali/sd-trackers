import React, { useEffect, useMemo, useState } from 'react';
import { X, UserRound, Building2, FileText, ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { suPropertyService } from '../../services/suPropertyService';
import type { ServiceUserMaster, PropertyMaster } from '../../types/masterData';
import type { DocumentLinkType } from '../../utils/repositoryDocuments';

export interface DocumentUploadTarget {
  linkType: DocumentLinkType;
  site: string;
  category: string;
  suId?: string;
  suName?: string;
  refNumber?: string;
  propertyId?: string;
  propertyName?: string;
}

export const SU_DOCUMENT_TYPES = [
  'Identity / ARC Card', 'Proof of Address', 'Immigration / Asylum Paper', 'Medical Assessment', 'Safeguarding Details',
  'Risk Assessment', 'Consent Form', 'Incident Report', 'Support Plan', 'Other'
];
export const PROPERTY_DOCUMENT_TYPES = [
  'Gas Safety Certificate', 'Electrical Safety (EICR)', 'Fire Risk Assessment', 'Lease / Tenancy', 'Insurance',
  'EPC', 'Inspection Report', 'Compliance Certificate', 'Other'
];
export const GENERAL_DOCUMENT_TYPES = [
  'Risk Assessment', 'Incident Report', 'Medical Assessment', 'Safeguarding Details', 'Police Report',
  'Compliance Certificate', 'Legal Notice'
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (target: DocumentUploadTarget) => void;
}

const TypeCard: React.FC<{ icon: React.ReactNode; title: string; text: string; onPick: () => void }> = ({ icon, title, text, onPick }) => (
  <button
    type="button"
    onClick={onPick}
    className="text-left p-4 border border-[#e5e5e5] rounded-xs bg-white hover:border-[#0d9488] hover:bg-[#f0fdfa] transition-colors cursor-pointer"
  >
    <div className="flex items-center gap-2 font-semibold text-sm text-[#242424]">{icon}<span>{title}</span></div>
    <p className="mt-1 text-[11px] text-neutral-500">{text}</p>
  </button>
);

const inputCls = 'w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]';

/**
 * First step of every upload: what is the document for? The answer decides where it is stored and where it
 * shows up (the resident's profile, the property's documents, or the general repository).
 */
export const DocumentUploadWizard: React.FC<Props> = ({ isOpen, onClose, onSelect }) => {
  const { sites, allowedSites, isSitePermitted, canAccessAllSites } = useApp();
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [linkType, setLinkType] = useState<DocumentLinkType>('general');
  const [serviceUsers, setServiceUsers] = useState<ServiceUserMaster[]>([]);
  const [properties, setProperties] = useState<PropertyMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [suId, setSuId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [site, setSite] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');

  const siteName = (idOrName?: string) => sites.find(s => s.id === idOrName || s.name === idOrName)?.name || idOrName || '';

  useEffect(() => {
    if (!isOpen) return;
    setStep('type'); setSearch(''); setSuId(''); setPropertyId(''); setError('');
    setSite(allowedSites[0] || '');
    let alive = true;
    setLoading(true);
    Promise.all([suPropertyService.getServiceUsers(), suPropertyService.getProperties()]).then(([su, pr]) => {
      if (!alive) return;
      setServiceUsers((su.data || []).filter(u => u.status !== 'Discharged' && isSitePermitted(siteName(u.siteId), 'all')));
      setProperties((pr.data || []).filter(p => isSitePermitted(siteName(p.siteId) || p.propertyName, 'all')));
    }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const typeOptions = linkType === 'service_user' ? SU_DOCUMENT_TYPES : linkType === 'property' ? PROPERTY_DOCUMENT_TYPES : GENERAL_DOCUMENT_TYPES;
  useEffect(() => { setCategory(typeOptions[0]); }, [linkType]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? serviceUsers.filter(u => `${u.firstName} ${u.lastName} ${u.suReference} ${u.externalReference || ''}`.toLowerCase().includes(q))
      : serviceUsers;
    return list.slice(0, 200);
  }, [serviceUsers, search]);

  useEffect(() => {
    if (linkType === 'service_user' && search.trim() && filteredUsers.length === 1) setSuId(filteredUsers[0].id);
  }, [filteredUsers, search, linkType]);

  if (!isOpen) return null;

  const choose = (t: DocumentLinkType) => { setLinkType(t); setStep('details'); setError(''); };

  const handleContinue = () => {
    if (linkType === 'service_user') {
      const su = serviceUsers.find(u => u.id === suId);
      if (!su) { setError('Choose the Service User this document belongs to.'); return; }
      onSelect({
        linkType, category, suId: su.id, suName: `${su.firstName} ${su.lastName}`.trim(),
        refNumber: su.externalReference || su.suReference, site: siteName(su.siteId) || allowedSites[0] || ''
      });
    } else if (linkType === 'property') {
      const p = properties.find(x => x.id === propertyId);
      if (!p) { setError('Choose the property this document belongs to.'); return; }
      onSelect({
        linkType, category, propertyId: p.id, propertyName: p.propertyName,
        suName: p.propertyName, refNumber: p.propertyReference, site: siteName(p.siteId) || allowedSites[0] || ''
      });
    } else {
      if (!site) { setError('Choose a site.'); return; }
      onSelect({ linkType, category, site });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-xs border border-[#e5e5e5] shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e5e5e5] bg-[#faf9f8] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[#242424]">Upload Document</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xs text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'type' ? (
          <div className="p-5 grid grid-cols-1 gap-3">
            <TypeCard onPick={() => choose('service_user')} icon={<UserRound className="w-4 h-4 text-indigo-600" />} title="Service User document"
              text="ID, medical, safeguarding or support papers. Shows in that resident's profile under Documents." />
            <TypeCard onPick={() => choose('property')} icon={<Building2 className="w-4 h-4 text-[#0d9488]" />} title="Property document"
              text="Certificates, leases, inspections. Shows in that property's Documents section." />
            <TypeCard onPick={() => choose('general')} icon={<FileText className="w-4 h-4 text-amber-600" />} title="General / compliance document"
              text="Site-level compliance and other records that are not tied to one person or property." />
          </div>
        ) : (
          <div className="p-5 space-y-3.5 overflow-y-auto text-xs">
            {linkType === 'service_user' && (
              <div>
                <label className="block text-neutral-600 font-medium mb-1">Service User <span className="text-red-500">*</span></label>
                <select className={inputCls} value={suId} onChange={e => { setSuId(e.target.value); setError(''); }}>
                  <option value="">{loading ? 'Loading Service Users...' : filteredUsers.length === 0 ? 'No Service Users found' : 'Select Service User...'}</option>
                  {filteredUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} - {u.suReference}{u.externalReference ? ` - ${u.externalReference}` : ''} - {siteName(u.siteId) || 'No site'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {linkType === 'property' && (
              <div>
                <label className="block text-neutral-600 font-medium mb-1">Property <span className="text-red-500">*</span></label>
                <select className={inputCls} value={propertyId} onChange={e => { setPropertyId(e.target.value); setError(''); }}>
                  <option value="">{loading ? 'Loading properties...' : 'Select Property...'}</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.propertyReference} - {p.propertyName}</option>
                  ))}
                </select>
              </div>
            )}

            {linkType === 'general' && (
              <div>
                <label className="block text-neutral-600 font-medium mb-1">Hotel / Site <span className="text-red-500">*</span></label>
                <select className={inputCls} value={site} onChange={e => setSite(e.target.value)} disabled={!canAccessAllSites() && allowedSites.length <= 1}>
                  {allowedSites.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-neutral-600 font-medium mb-1">Document type</label>
              <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
                {typeOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {error && <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-xs font-medium">{error}</div>}

            <div className="flex items-center justify-between pt-2 border-t border-[#e5e5e5]">
              <button type="button" onClick={() => setStep('type')} className="flex items-center gap-1 px-3 py-1.5 border border-[#e5e5e5] rounded-xs text-neutral-700 hover:bg-neutral-100 cursor-pointer">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button type="button" onClick={handleContinue} className="px-4 py-1.5 bg-[#0d9488] hover:bg-teal-700 text-white rounded-xs font-semibold cursor-pointer">
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
