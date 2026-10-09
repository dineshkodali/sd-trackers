import React, { useState } from 'react';
import { ArrowRightLeft, Plus, CheckCircle2, Clock, FileText, HeartHandshake, Soup, Building2, Download, Trash2, Eye, Link2, Edit3 } from 'lucide-react';
import { BulkActionToolbar } from '../common/BulkActionToolbar';
import { 
  ServiceUserMaster, 
  ServiceUserContact,
  PropertyMaster, 
  PropertyRoom, 
  Placement, 
  ServiceUserHouseholdMember, 
  ServiceUserSupportRecord, 
  ServiceUserDocument, 
  UnifiedActivityItem 
} from '../../types/masterData';
import { SUActivityTimeline } from './SUActivityTimeline';
import { openStoredDocument } from '../../utils/openStoredDocument';

export interface SUOverviewTabProps {
  serviceUser: ServiceUserMaster;
  currentRoom: PropertyRoom | null;
  currentProperty: PropertyMaster | null;
  suWelfareCount: number;
  lastWelfareDate?: string;
  supportRecords: ServiceUserSupportRecord[];
  documents: ServiceUserDocument[];
  activityItems: UnifiedActivityItem[];
  loading: boolean;
}

export const SUOverviewTab: React.FC<SUOverviewTabProps> = ({
  serviceUser, currentRoom, currentProperty, suWelfareCount,
  lastWelfareDate, supportRecords, documents, activityItems, loading
}) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Current Room</span>
        <p className="text-sm font-bold text-neutral-800">{currentRoom ? `Room ${currentRoom.roomNumber}` : 'Unassigned'}</p>
        <p className="text-[10px] text-neutral-500 truncate">{currentProperty?.propertyName || 'No property'}</p>
      </div>
      <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Status</span>
        <p className="text-sm font-bold text-teal-700">{serviceUser.status}</p>
        <p className="text-[10px] text-neutral-500 font-mono">{serviceUser.externalReference || 'No Port Ref'}</p>
      </div>
      <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Last Welfare Check</span>
        <p className="text-sm font-bold text-neutral-800">{lastWelfareDate || 'None'}</p>
        <p className="text-[10px] text-neutral-500">{suWelfareCount} checks logged</p>
      </div>
      <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Open Support / Issues</span>
        <p className="text-sm font-bold text-amber-700">
          {supportRecords.filter(s => s.status === 'Open' || s.status === 'In Progress').length} Open
        </p>
        <p className="text-[10px] text-neutral-500">{documents.length} docs uploaded</p>
      </div>
    </div>

    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
          Recent Operational Activity
        </h3>
        <span className="text-[11px] text-neutral-400">Dynamically queried from operational tables</span>
      </div>
      <SUActivityTimeline items={activityItems} loading={loading} />
    </div>
  </div>
);

export interface SUPersonalTabProps {
  serviceUser: ServiceUserMaster;
  contact?: ServiceUserContact | null;
}

export const SUPersonalTab: React.FC<SUPersonalTabProps> = ({ serviceUser, contact }) => (
  <div className="space-y-4">
    <div className="bg-white p-4 rounded-lg border border-neutral-200 space-y-4">
      <h3 className="font-bold text-xs text-neutral-800 border-b pb-2">Personal &amp; Demographic Information</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <span className="text-neutral-400 block text-[10px]">Full Name</span>
          <strong className="text-neutral-800">{serviceUser.firstName} {serviceUser.middleName} {serviceUser.lastName}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Preferred Name</span>
          <strong className="text-neutral-800">{serviceUser.preferredName || 'None'}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Date of Birth</span>
          <strong className="text-neutral-800">{serviceUser.dateOfBirth || 'Not specified'}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Gender</span>
          <strong className="text-neutral-800">{serviceUser.gender || 'Not specified'}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Nationality</span>
          <strong className="text-neutral-800">{serviceUser.nationality || 'Not specified'}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Preferred Language</span>
          <strong className="text-neutral-800">{serviceUser.preferredLanguage || 'English'}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Interpreter Required</span>
          <strong className={serviceUser.interpreterRequired ? 'text-amber-700' : 'text-neutral-800'}>
            {serviceUser.interpreterRequired ? 'Yes (Required)' : 'No'}
          </strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Account Status</span>
          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
            serviceUser.status === 'Active' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-neutral-100 text-neutral-700'
          }`}>
            {serviceUser.status}
          </span>
        </div>
      </div>

      <h3 className="font-bold text-xs text-neutral-800 border-b pb-2 pt-2">Case &amp; Reference Identifiers</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <span className="text-neutral-400 block text-[10px]">SU Master Ref</span>
          <strong className="text-teal-700 font-mono">{serviceUser.suReference}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Home Office / Port Ref</span>
          <strong className="text-neutral-800 font-mono">{serviceUser.externalReference || '—'}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Case Reference</span>
          <strong className="text-neutral-800 font-mono">{serviceUser.caseReference || '—'}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Referral / Arrival Date</span>
          <strong className="text-neutral-800">{serviceUser.arrivalDate || serviceUser.referralDate || '—'}</strong>
        </div>
      </div>
    </div>

    {/* Primary & Emergency Contact Cards - 100% Parity with Edit Form */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="bg-white p-4 rounded-lg border border-neutral-200 space-y-3">
        <h3 className="font-bold text-xs text-neutral-800 border-b pb-2 flex items-center justify-between">
          <span>Primary Contact Details</span>
          <span className="text-[10px] text-teal-700 font-medium font-mono">{contact?.preferredContactMethod || 'Mobile'} Preferred</span>
        </h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-neutral-400 block text-[10px]">Mobile Phone</span>
            <strong className="text-neutral-800">{contact?.mobile || 'Not provided'}</strong>
          </div>
          <div>
            <span className="text-neutral-400 block text-[10px]">Alternative Phone</span>
            <strong className="text-neutral-800">{contact?.alternativePhone || '—'}</strong>
          </div>
          <div className="col-span-2">
            <span className="text-neutral-400 block text-[10px]">Email Address</span>
            <strong className="text-neutral-800">{contact?.email || '—'}</strong>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-neutral-200 space-y-3">
        <h3 className="font-bold text-xs text-neutral-800 border-b pb-2">Emergency Contact Details</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-neutral-400 block text-[10px]">Contact Name</span>
            <strong className="text-neutral-800">{contact?.emergencyContactName || 'Not recorded'}</strong>
          </div>
          <div>
            <span className="text-neutral-400 block text-[10px]">Relationship</span>
            <strong className="text-neutral-800">{contact?.emergencyContactRelationship || '—'}</strong>
          </div>
          <div>
            <span className="text-neutral-400 block text-[10px]">Emergency Phone</span>
            <strong className="text-neutral-800">{contact?.emergencyContactPhone || '—'}</strong>
          </div>
          <div>
            <span className="text-neutral-400 block text-[10px]">Emergency Email</span>
            <strong className="text-neutral-800">{contact?.emergencyContactEmail || '—'}</strong>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export interface SUAccommodationTabProps {
  currentProperty: PropertyMaster | null;
  currentRoom: PropertyRoom | null;
  currentSiteName: string;
  activePlacement: Placement | null;
  placementHistory: Placement[];
  onOpenMoveModal: () => void;
}

export const SUAccommodationTab: React.FC<SUAccommodationTabProps> = ({
  currentProperty, currentRoom, currentSiteName, activePlacement,
  placementHistory, onOpenMoveModal
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleToggleSelectAll = () => {
    if (selectedIds.length === placementHistory.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(placementHistory.map(p => p.id));
    }
  };

  const handleToggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
  <div className="space-y-4">
    <div className="p-4 bg-teal-50/60 rounded-lg border border-teal-200/80 flex items-center justify-between">
      <div>
        <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">Current Active Placement</span>
        <h4 className="text-sm font-bold text-neutral-800 mt-0.5">
          {currentProperty?.propertyName || 'Unassigned Property'} — {currentRoom ? `Room ${currentRoom.roomNumber} (${currentRoom.roomType})` : 'No Room'}
        </h4>
        <p className="text-[11px] text-neutral-500 mt-0.5">
          Assigned site: <strong>{currentSiteName}</strong> • Placement active since {activePlacement?.startDate ? new Date(activePlacement.startDate).toLocaleDateString('en-GB') : 'N/A'}
        </p>
      </div>
      <button
        onClick={onOpenMoveModal}
        className="px-3.5 py-1.5 bg-[#0d9488] text-white rounded-md font-semibold text-xs hover:bg-[#0f766e] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
      >
        <ArrowRightLeft className="w-3.5 h-3.5" />
        <span>Move Accommodation</span>
      </button>
    </div>

    <div>
      <h4 className="text-xs font-bold text-neutral-800 mb-2">Accommodation History</h4>
      {placementHistory.length === 0 ? (
        <p className="text-neutral-400 italic">No placement records found.</p>
      ) : (
        <div className="border border-[#e5e5e5] rounded-xs overflow-hidden shadow-2xs bg-white relative">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
              <tr>
                <th className="p-2.5 w-10 text-center sticky left-0 bg-[#faf9f8] z-10 border-r border-[#edebe9]">
                  <input 
                    type="checkbox" 
                    className="cursor-pointer"
                    checked={placementHistory.length > 0 && selectedIds.length === placementHistory.length}
                    onChange={handleToggleSelectAll}
                  />
                </th>
                <th className="p-2.5">Placement Ref</th>
                <th className="p-2.5">Property / Room</th>
                <th className="p-2.5">Start Date</th>
                <th className="p-2.5">End Date</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Reason / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {placementHistory.map(p => (
                <tr 
                  key={p.id} 
                  className={`transition-colors cursor-pointer group ${selectedIds.includes(p.id) ? 'bg-[#e5f3ff]' : 'hover:bg-[#f3f8fd]'}`}
                >
                  <td className="p-2.5 text-center sticky left-0 bg-white group-hover:bg-[#f3f8fd] z-10 border-r border-[#edebe9]" onClick={e => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      className="cursor-pointer"
                      checked={selectedIds.includes(p.id)}
                      onChange={(e) => handleToggleSelect(e, p.id)}
                    />
                  </td>
                  <td className="p-2.5 font-mono text-[11px] font-bold text-teal-800">{p.placementReference}</td>
                  <td className="p-2.5 font-medium">{p.propertyId} (Room {p.roomId})</td>
                  <td className="p-2.5 text-neutral-600">{p.startDate ? new Date(p.startDate).toLocaleDateString('en-GB') : '—'}</td>
                  <td className="p-2.5 text-neutral-600">{p.endDate ? new Date(p.endDate).toLocaleDateString('en-GB') : 'Active'}</td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-600'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-2.5 text-neutral-500">{p.reason || p.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <BulkActionToolbar
            selectedCount={selectedIds.length}
            totalCount={placementHistory.length}
            onClearSelection={() => setSelectedIds([])}
            onSelectAll={handleToggleSelectAll}
          />
        </div>
      )}
    </div>
  </div>
  );
};

export interface SUHouseholdTabProps {
  household: ServiceUserHouseholdMember[];
}

export const SUHouseholdTab: React.FC<SUHouseholdTabProps> = ({ household }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h4 className="font-bold text-xs text-neutral-800">Associated Household &amp; Dependents</h4>
    </div>
    {household.length === 0 ? (
      <div className="p-6 text-center bg-neutral-50 rounded-lg border border-dashed border-neutral-200 text-neutral-400">
        No household members registered.
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {household.map(m => (
          <div key={m.id} className="p-3 bg-white border border-neutral-200 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <strong className="text-neutral-800">{m.name}</strong>
              <span className="text-[10px] bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded font-semibold">{m.relationship}</span>
            </div>
            <p className="text-neutral-500 text-[11px]">DOB: {m.dateOfBirth || 'N/A'} • Gender: {m.gender || 'N/A'}</p>
          </div>
        ))}
      </div>
    )}
  </div>
);

export interface SUSupportTabProps {
  supportRecords: ServiceUserSupportRecord[];
  showAddSupport: boolean;
  setShowAddSupport: (val: boolean) => void;
  newSupportCat: string;
  setNewSupportCat: (val: string) => void;
  newSupportDesc: string;
  setNewSupportDesc: (val: string) => void;
  onCreateSupport: (e: React.FormEvent) => void;
}

export const SUSupportTab: React.FC<SUSupportTabProps> = ({
  supportRecords, showAddSupport, setShowAddSupport, newSupportCat,
  setNewSupportCat, newSupportDesc, setNewSupportDesc, onCreateSupport
}) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h4 className="font-bold text-xs text-neutral-800">Support Register</h4>
      <button
        onClick={() => setShowAddSupport(true)}
        className="px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded font-semibold hover:bg-teal-100 flex items-center gap-1 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Support Ticket</span>
      </button>
    </div>

    {showAddSupport && (
      <form onSubmit={onCreateSupport} className="p-3.5 bg-neutral-50 border border-neutral-300 rounded-lg space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Category (e.g. Healthcare, Safeguarding)"
            value={newSupportCat}
            onChange={e => setNewSupportCat(e.target.value)}
            required
            className="px-2 py-1 bg-white border rounded text-xs"
          />
          <textarea
            placeholder="Description of support required..."
            value={newSupportDesc}
            onChange={e => setNewSupportDesc(e.target.value)}
            required
            rows={2}
            className="px-2 py-1 bg-white border rounded text-xs col-span-2"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setShowAddSupport(false)} className="px-2 py-1 border rounded text-neutral-600">Cancel</button>
          <button type="submit" className="px-3 py-1 bg-teal-600 text-white rounded font-semibold">Save Support</button>
        </div>
      </form>
    )}

    {supportRecords.length === 0 ? (
      <p className="text-neutral-400 italic">No support tickets recorded.</p>
    ) : (
      <div className="space-y-2">
        {supportRecords.map(s => (
          <div key={s.id} className="p-3 bg-white border border-neutral-200 rounded-lg flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-teal-800 font-bold">{s.supportReference}</span>
                <strong className="text-neutral-800">{s.category}</strong>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">{s.priority}</span>
              </div>
              <p className="text-[11px] text-neutral-600 mt-0.5">{s.description}</p>
            </div>
            <span className="font-semibold text-teal-700">{s.status}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export interface SUDocumentsTabProps {
  documents: ServiceUserDocument[];
  onOpenUploadModal: (doc?: ServiceUserDocument) => void;
  onDeleteDoc?: (docId: string) => void;
}

export const SUDocumentsTab: React.FC<SUDocumentsTabProps> = ({
  documents, onOpenUploadModal, onDeleteDoc
}) => {
  const handleOpenDoc = (doc: ServiceUserDocument) => {
    openStoredDocument(doc.fileUrl, doc.documentName);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-xs text-[#242424]">Service User Documents &amp; Papers</h4>
          <p className="text-[11px] text-neutral-500">ARC cards, identification, proof of address, medical notes, and occupancy papers</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenUploadModal()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold text-xs shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Upload Document</span>
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="p-8 text-center bg-[#faf9f8] border border-[#e5e5e5] rounded-xs">
          <FileText className="w-8 h-8 text-neutral-400 mx-auto mb-2 opacity-60" />
          <p className="text-xs font-semibold text-neutral-700">No documents attached yet</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">Attach identity papers, ARC cards, medical letters, or arrival forms.</p>
          <button
            type="button"
            onClick={() => onOpenUploadModal()}
            className="mt-3 px-3 py-1 border border-[#8a8886] text-xs font-semibold rounded-xs bg-white hover:bg-[#f3f2f1] cursor-pointer"
          >
            Upload First Document
          </button>
        </div>
      ) : (
        <div className="border border-[#e5e5e5] rounded-xs overflow-hidden bg-white shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#e5e5e5] text-neutral-600 font-semibold select-none">
                <th className="py-2.5 px-3">Document Title</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Ref / ID #</th>
                <th className="py-2.5 px-3">Uploaded</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {documents.map(d => (
                <tr key={d.id} className="hover:bg-[#fbfbfa] transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#0d9488] shrink-0" />
                      <div>
                        <span className="font-semibold text-[#242424] block">{d.documentName}</span>
                        {d.notes && <span className="text-[10px] text-neutral-400">{d.notes}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-[#f3f2f1] text-[#323130] rounded-xs border border-[#e5e5e5]">
                      {d.documentType}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-700">
                    {d.referenceNumber || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-500 text-[11px]">
                    {d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${
                      d.verificationStatus === 'Verified' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {d.verificationStatus || 'Verified'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {d.fileUrl && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenDoc(d)}
                            className="p-1 text-[#605e5c] hover:text-[#242424] hover:bg-[#edebe9] rounded-xs transition-colors cursor-pointer"
                            title="View Document"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(d.fileUrl!);
                            }}
                            className="p-1 text-[#605e5c] hover:text-[#0078d4] hover:bg-[#e5f3ff] rounded-xs transition-colors cursor-pointer"
                            title="Copy Link to Share"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenUploadModal(d)}
                        className="p-1 text-[#605e5c] hover:text-[#242424] hover:bg-[#edebe9] rounded-xs transition-colors cursor-pointer"
                        title="Edit Document"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {onDeleteDoc && (
                        <button
                          type="button"
                          onClick={() => onDeleteDoc(d.id)}
                          className="p-1 text-[#a4262c] hover:text-[#d13438] hover:bg-[#fceef1] rounded-xs transition-colors cursor-pointer"
                          title="Delete Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
