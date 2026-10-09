import React, { useState, useEffect } from 'react';
import { BulkActionToolbar } from '../common/BulkActionToolbar';
import { 
  ArrowLeft,
  ChevronRight,
  User, 
  MapPin, 
  Building2, 
  DoorOpen, 
  Edit3, 
  ArrowRightLeft, 
  Plus, 
  HeartHandshake, 
  FileText,
  UserMinus,
  Trash2
} from 'lucide-react';
import { suPropertyService } from '../../services/suPropertyService';
import { suPropertyDetailsService } from '../../services/suPropertyDetailsService';
import { useApp } from '../../context/AppContext';
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
import { MoveAccommodationModal } from './MoveAccommodationModal';
import { MasterDocumentModal } from '../common/MasterDocumentModal';
import { 
  SUOverviewTab, 
  SUPersonalTab, 
  SUAccommodationTab, 
  SUHouseholdTab, 
  SUSupportTab, 
  SUDocumentsTab 
} from './SUProfileTabs';

interface ServiceUserProfileViewProps {
  serviceUser: ServiceUserMaster;
  onBack: () => void;
  onEditSU: (su: ServiceUserMaster) => void;
  onRefreshData: () => void;
}

export const ServiceUserProfileView: React.FC<ServiceUserProfileViewProps> = ({
  serviceUser,
  onBack,
  onEditSU,
  onRefreshData
}) => {
  const { sites, welfareChecks, foodSurveys, roomChecks, canManageUsers , requestConfirmation } = useApp();
  const canCRUD = canManageUsers();

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [contact, setContact] = useState<ServiceUserContact | null>(null);
  const [activePlacement, setActivePlacement] = useState<Placement | null>(null);
  const [placementHistory, setPlacementHistory] = useState<Placement[]>([]);
  const [currentProperty, setCurrentProperty] = useState<PropertyMaster | null>(null);
  const [currentRoom, setCurrentRoom] = useState<PropertyRoom | null>(null);
  const [household, setHousehold] = useState<ServiceUserHouseholdMember[]>([]);
  const [supportRecords, setSupportRecords] = useState<ServiceUserSupportRecord[]>([]);
  const [documents, setDocuments] = useState<ServiceUserDocument[]>([]);
  const [activityItems, setActivityItems] = useState<UnifiedActivityItem[]>([]);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sub-record modals
  const [showAddSupport, setShowAddSupport] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docToEdit, setDocToEdit] = useState<ServiceUserDocument | undefined>();
  const [newSupportCat, setNewSupportCat] = useState('General Support');
  const [newSupportDesc, setNewSupportDesc] = useState('');

  const loadProfileData = async (suId: string) => {
    setLoading(true);
    try {
      const [plcsRes, cts, hhRes, spRes, docRes, actRes] = await Promise.all([
        suPropertyService.getPlacements({ suId }),
        suPropertyDetailsService.getSUContacts(suId),
        suPropertyDetailsService.getSUHousehold(suId),
        suPropertyDetailsService.getSUSupport(suId),
        suPropertyDetailsService.getSUDocuments(suId),
        suPropertyDetailsService.getUnifiedSUActivity(suId, serviceUser.externalReference)
      ]);

      const plcs = plcsRes.success && plcsRes.data ? plcsRes.data : [];
      setPlacementHistory(plcs);
      if (cts && cts.length > 0) setContact(cts[0]);
      if (Array.isArray(hhRes)) setHousehold(hhRes);
      if (Array.isArray(spRes)) setSupportRecords(spRes);
      if (Array.isArray(docRes)) setDocuments(docRes);
      if (Array.isArray(actRes)) setActivityItems(actRes);

      const active = plcs.find(p => p.status === 'Active') || null;
      setActivePlacement(active);

      if (active?.propertyId) {
        const propRes = await suPropertyService.getProperty(active.propertyId);
        if (propRes.success && propRes.data) setCurrentProperty(propRes.data);
      } else {
        setCurrentProperty(null);
      }

      if (active?.roomId) {
        const rmRes = await suPropertyService.getRoom(active.roomId);
        if (rmRes.success && rmRes.data) setCurrentRoom(rmRes.data);
      } else {
        setCurrentRoom(null);
      }
    } catch (err) {
      console.error('Failed to load SU profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serviceUser) {
      loadProfileData(serviceUser.id);
    }
  }, [serviceUser]);

  const currentSite = sites.find(s => s.id === (activePlacement?.siteId || serviceUser.siteId));

  const suWelfare = welfareChecks.filter(w => 
    w.suId === serviceUser.id || 
    (serviceUser.externalReference && w.portReference === serviceUser.externalReference)
  );

  const suFood = foodSurveys.filter(f => 
    f.suId === serviceUser.id || 
    (serviceUser.externalReference && f.portReference === serviceUser.externalReference)
  );

  const suRooms = roomChecks.filter(r => 
    r.suId === serviceUser.id || 
    (activePlacement?.roomId && r.roomId === activePlacement.roomId)
  );

  const handleCreateSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupportDesc.trim()) return;
    await suPropertyDetailsService.addSUSupport({
      suId: serviceUser.id,
      category: newSupportCat,
      description: newSupportDesc.trim(),
      priority: 'Medium',
      startDate: new Date().toISOString(),
      status: 'Open'
    });
    setNewSupportDesc('');
    setShowAddSupport(false);
    loadProfileData(serviceUser.id);
  };

  const handleDischarge = () => {
    requestConfirmation({
      title: 'Discharge Service User',
      message: `Are you sure you want to discharge ${serviceUser.firstName} ${serviceUser.lastName}? Their current room placement will be closed and the room released.`,
      isDanger: false,
      onConfirm: async () => {
        try {
          const res = await suPropertyService.updateServiceUser(serviceUser.id, { status: 'Discharged' });
          if (res.success) {
            onRefreshData();
            loadProfileData(serviceUser.id);
          }
        } catch (err) {
          console.error('Failed to discharge SU:', err);
        }
      }
    });
  };

  const handleDeleteSU = () => {
    requestConfirmation({
      title: 'Delete Service User',
      message: `Are you sure you want to permanently delete ${serviceUser.firstName} ${serviceUser.lastName} (${serviceUser.suReference})? Placements, household members, and support records will be deleted.`,
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await suPropertyService.deleteServiceUser(serviceUser.id, serviceUser.suReference, `${serviceUser.firstName} ${serviceUser.lastName}`);
          if (res.success) {
            onRefreshData();
            onBack();
          }
        } catch (err) {
          console.error('Failed to delete SU:', err);
        }
      }
    });
  };

  const handleEndPlacement = (placementId: string) => {
    requestConfirmation({
      title: 'End Accommodation Placement',
      message: 'Are you sure you want to end this active placement? The room will be released immediately.',
      isDanger: false,
      onConfirm: async () => {
        try {
          const res = await suPropertyService.endPlacement(placementId, 'Manually ended by staff');
          if (res.success) {
            onRefreshData();
            loadProfileData(serviceUser.id);
          }
        } catch (err) {
          console.error('Failed to end placement:', err);
        }
      }
    });
  };

  const handleDeletePlacement = (placementId: string) => {
    requestConfirmation({
      title: 'Delete Placement Record',
      message: 'Are you sure you want to delete this accommodation placement record?',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await suPropertyService.deletePlacement(placementId);
          if (res.success) {
            onRefreshData();
            loadProfileData(serviceUser.id);
          }
        } catch (err) {
          console.error('Failed to delete placement:', err);
        }
      }
    });
  };

  const handleAddHouseholdMember = async (memberData: Partial<ServiceUserHouseholdMember>) => {
    try {
      const res = await suPropertyDetailsService.addSUHouseholdMember({
        ...memberData,
        suId: serviceUser.id
      });
      if (res.success) {
        loadProfileData(serviceUser.id);
      }
    } catch (err) {
      console.error('Failed to add household member:', err);
    }
  };

  const handleDeleteHouseholdMember = (memberId: string) => {
    requestConfirmation({
      title: 'Delete Household Member',
      message: 'Are you sure you want to remove this household member?',
      isDanger: true,
      onConfirm: async () => {
        try {
          await suPropertyDetailsService.deleteSUHouseholdMember(memberId);
          loadProfileData(serviceUser.id);
        } catch (err) {
          console.error('Failed to delete household member:', err);
        }
      }
    });
  };

  const handleDeleteSupport = (supportId: string) => {
    requestConfirmation({
      title: 'Delete Support Record',
      message: 'Are you sure you want to remove this support ticket?',
      isDanger: true,
      onConfirm: async () => {
        try {
          await suPropertyDetailsService.deleteSUSupport(supportId);
          loadProfileData(serviceUser.id);
        } catch (err) {
          console.error('Failed to delete support record:', err);
        }
      }
    });
  };

  const handleUpdateSupportStatus = async (supportId: string, newStatus: string) => {
    try {
      await suPropertyDetailsService.updateSUSupport(supportId, { status: newStatus as any });
      loadProfileData(serviceUser.id);
    } catch (err) {
      console.error('Failed to update support status:', err);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'personal', label: 'Personal & Contact' },
    { id: 'accommodation', label: 'Accommodation' },
    { id: 'household', label: `Household (${household.length})` },
    { id: 'support', label: `Support (${supportRecords.length})` },
    { id: 'documents', label: `Documents (${documents.length})` },
    { id: 'welfare', label: `Welfare (${suWelfare.length})` },
    { id: 'foodSurveys', label: `Food Surveys (${suFood.length})` },
    { id: 'roomChecks', label: `Room Checks (${suRooms.length})` },
    { id: 'activity', label: 'Activity' }
  ];

  return (
    <div className="space-y-3.5 animate-in fade-in duration-150">
      {/* Breadcrumb Navigation Bar */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs px-4 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={onBack}
            className="font-semibold text-neutral-600 hover:text-[#0d9488] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Service Users</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <span className="font-mono text-[11px] text-[#0f766e] bg-[#f0fdfa] border border-[#99f6e4] px-1.5 py-0.5 rounded-xs font-bold">
            {serviceUser.suReference}
          </span>
          <span className="font-bold text-[#242424]">
            {serviceUser.firstName} {serviceUser.lastName}
          </span>
          {serviceUser.externalReference && (
            <span className="text-[11px] text-neutral-500 font-mono">({serviceUser.externalReference})</span>
          )}
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1 text-xs font-semibold text-neutral-700 hover:text-neutral-900 hover:bg-[#edebe9] rounded-xs border border-[#d1d1d1] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Service Users</span>
        </button>
      </div>

      {/* Main Profile In-Page Container */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs overflow-hidden flex flex-col">
        {/* Profile Header */}
        <div className="p-5 border-b border-[#e5e5e5] bg-[#faf9f8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-xs bg-[#f0fdfa] text-[#0f766e] border border-[#99f6e4] px-2 py-0.5 rounded-xs font-bold">
                {serviceUser.suReference}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                serviceUser.status === 'Active' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-neutral-100 text-neutral-700 border-neutral-300'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${serviceUser.status === 'Active' ? 'bg-emerald-500' : 'bg-neutral-400'}`}></span>
                {serviceUser.status}
              </span>
              {serviceUser.interpreterRequired && (
                <span className="text-[11px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xs">
                  Interpreter Needed
                </span>
              )}
            </div>

            <h1 className="text-xl font-bold text-[#242424] tracking-tight">
              {serviceUser.firstName} {serviceUser.middleName} {serviceUser.lastName}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 mt-2">
              <span className="flex items-center gap-1 font-medium text-[#242424]">
                <Building2 className="w-3.5 h-3.5 text-[#0d9488]" />
                {currentSite?.name || 'Unassigned Site'}
              </span>
              <span className="flex items-center gap-1 font-medium text-[#242424]">
                <DoorOpen className="w-3.5 h-3.5 text-[#0d9488]" />
                {currentProperty ? currentProperty.propertyName : 'No Property'}
                {currentRoom ? ` — Room ${currentRoom.roomNumber}` : ''}
              </span>
              {serviceUser.dateOfBirth && (
                <span>DOB: <strong>{serviceUser.dateOfBirth}</strong></span>
              )}
              {serviceUser.nationality && (
                <span>Nationality: <strong>{serviceUser.nationality}</strong></span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canCRUD && (
              <button
                onClick={() => onEditSU(serviceUser)}
                className="px-3.5 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Service User</span>
              </button>
            )}
            {canCRUD && (
              <button
                onClick={() => setIsMoveModalOpen(true)}
                className="px-3 py-1.5 bg-white hover:bg-[#edebe9] text-neutral-700 border border-[#d1d1d1] rounded-xs text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-teal-700" />
                <span>Move Room</span>
              </button>
            )}
            <button
              onClick={() => setIsDocModalOpen(true)}
              className="px-3 py-1.5 bg-white hover:bg-[#edebe9] text-neutral-700 border border-[#d1d1d1] rounded-xs text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-teal-700" />
              <span>Upload Document</span>
            </button>
            {canCRUD && serviceUser.status === 'Active' && (
              <button
                onClick={handleDischarge}
                className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-700 border border-amber-300 rounded-xs text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Discharge Resident and release room"
              >
                <UserMinus className="w-3.5 h-3.5 text-amber-600" />
                <span>Discharge Resident</span>
              </button>
            )}
            {canCRUD && (
              <button
                onClick={handleDeleteSU}
                className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-xs text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Delete Service User record and cascade"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 border-b border-[#e5e5e5] bg-[#faf9f8] overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'border-[#0d9488] text-[#0d9488] bg-white rounded-t-xs'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <SUOverviewTab
              serviceUser={serviceUser}
              currentRoom={currentRoom}
              currentProperty={currentProperty}
              suWelfareCount={suWelfare.length}
              lastWelfareDate={suWelfare[0]?.checkDatetime ? suWelfare[0].checkDatetime.split('T')[0] : undefined}
              supportRecords={supportRecords}
              documents={documents}
              activityItems={activityItems}
              loading={loading}
            />
          )}

          {activeTab === 'personal' && (
            <SUPersonalTab serviceUser={serviceUser} contact={contact} />
          )}

          {activeTab === 'accommodation' && (
            <SUAccommodationTab
              currentProperty={currentProperty}
              currentRoom={currentRoom}
              currentSiteName={currentSite?.name || 'Unassigned'}
              activePlacement={activePlacement}
              placementHistory={placementHistory}
              onOpenMoveModal={() => setIsMoveModalOpen(true)}
              onEndPlacement={handleEndPlacement}
              onDeletePlacement={handleDeletePlacement}
              canCRUD={canCRUD}
            />
          )}

          {activeTab === 'household' && (
            <SUHouseholdTab 
              household={household}
              onAddMember={handleAddHouseholdMember}
              onDeleteMember={handleDeleteHouseholdMember}
              canCRUD={canCRUD}
            />
          )}

          {activeTab === 'support' && (
            <SUSupportTab
              supportRecords={supportRecords}
              showAddSupport={showAddSupport}
              setShowAddSupport={setShowAddSupport}
              newSupportCat={newSupportCat}
              setNewSupportCat={setNewSupportCat}
              newSupportDesc={newSupportDesc}
              setNewSupportDesc={setNewSupportDesc}
              onCreateSupport={handleCreateSupport}
              onDeleteSupport={handleDeleteSupport}
              onUpdateSupportStatus={handleUpdateSupportStatus}
              canCRUD={canCRUD}
            />
          )}

          {activeTab === 'documents' && (
            <SUDocumentsTab
              documents={documents}
              onOpenUploadModal={(doc) => { setDocToEdit(doc); setIsDocModalOpen(true); }}
              onDeleteDoc={async (id) => {
                if (typeof requestConfirmation !== 'undefined') {
                  requestConfirmation({
                    title: 'Delete Document',
                    message: 'Are you sure you want to delete this document? This action cannot be undone.',
                    isDanger: true,
                    onConfirm: async () => {
                      await suPropertyDetailsService.deleteSUDocument(id);
                      loadProfileData(serviceUser.id);
                    }
                  });
                } else {
                  await suPropertyDetailsService.deleteSUDocument(id);
                  loadProfileData(serviceUser.id);
                }
              }}
            />
          )}

          {activeTab === 'welfare' && (
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-neutral-800">Operational Welfare Records</h4>
              {suWelfare.length === 0 ? (
                <p className="text-neutral-400 italic">No welfare check logs recorded for this resident.</p>
              ) : (
                <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-[10px] font-bold text-neutral-500 uppercase">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Site / Room</th>
                        <th className="p-2.5">Welfare Status</th>
                        <th className="p-2.5">Officer</th>
                        <th className="p-2.5">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {suWelfare.map(w => (
                        <tr key={w.id} className="hover:bg-neutral-50">
                          <td className="p-2.5 font-medium">{w.checkDatetime ? new Date(w.checkDatetime).toLocaleDateString('en-GB') : '—'}</td>
                          <td className="p-2.5">{w.siteName} (Room {w.flatNumber || '—'})</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xs font-semibold">
                              {w.status || 'Completed'}
                            </span>
                          </td>
                          <td className="p-2.5 text-neutral-600">{w.officerName || 'Staff'}</td>
                          <td className="p-2.5 text-neutral-500">{w.locationType || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'foodSurveys' && (
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-neutral-800">Food Surveys Completed</h4>
              {suFood.length === 0 ? (
                <p className="text-neutral-400 italic">No food surveys recorded for this Service User.</p>
              ) : (
                <div className="space-y-2">
                  {suFood.map(f => (
                    <div key={f.id} className="p-3 bg-white border border-neutral-200 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-800 text-xs">{f.siteName}</span>
                          <span className="text-neutral-400">• {f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-GB') : ''}</span>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5">Quality: {f.overallFoodQuality || 'Rated'} • Server: {f.serverQuality || 'N/A'}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                        {f.overallFoodRating || 'Rated'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'roomChecks' && (
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-neutral-800">Room Inspections</h4>
              {suRooms.length === 0 ? (
                <p className="text-neutral-400 italic">No room check records found.</p>
              ) : (
                <div className="space-y-2">
                  {suRooms.map(r => (
                    <div key={r.id} className="p-3 bg-white border border-neutral-200 rounded-lg flex items-center justify-between">
                      <div>
                        <strong className="text-neutral-800 text-xs">Room {r.roomNumber} ({r.siteName})</strong>
                        <p className="text-[11px] text-neutral-500 mt-0.5">Inspector: {r.officerName || 'Staff'} • {r.inspectionDate}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${r.overallStatus === 'Passed' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {r.overallStatus}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-neutral-800">Unified Activity Timeline</h4>
              <SUActivityTimeline items={activityItems} loading={loading} />
            </div>
          )}
        </div>
      </div>

      {isMoveModalOpen && (
        <MoveAccommodationModal
          isOpen={isMoveModalOpen}
          onClose={() => setIsMoveModalOpen(false)}
          serviceUser={serviceUser}
          currentPlacement={activePlacement}
          currentProperty={currentProperty}
          currentRoom={currentRoom}
          onSuccess={() => {
            loadProfileData(serviceUser.id);
            onRefreshData();
          }}
        />
      )}

      {isDocModalOpen && (
        <MasterDocumentModal
          isOpen={isDocModalOpen}
          onClose={() => { setIsDocModalOpen(false); setDocToEdit(undefined); }}
          entityType="serviceUser"
          entityId={serviceUser.id}
          entityName={`${serviceUser.firstName} ${serviceUser.lastName} (${serviceUser.suReference})`}
          docToEdit={docToEdit}
          onSuccess={() => {
            loadProfileData(serviceUser.id);
            onRefreshData();
          }}
        />
      )}
    </div>
  );
};
