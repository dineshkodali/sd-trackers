import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  MapPin, 
  Building2, 
  DoorOpen, 
  Calendar, 
  Edit3, 
  ArrowRightLeft, 
  Plus, 
  HeartHandshake, 
  Soup, 
  Wrench, 
  FileText, 
  LifeBuoy, 
  Users, 
  History 
} from 'lucide-react';
import { suPropertyService } from '../../services/suPropertyService';
import { suPropertyDetailsService } from '../../services/suPropertyDetailsService';
import { useApp } from '../../context/AppContext';
import { 
  ServiceUserMaster, 
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

interface ServiceUserProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  serviceUser: ServiceUserMaster | null;
  onEditSU: (su: ServiceUserMaster) => void;
  onRefreshData: () => void;
}

export const ServiceUserProfileDrawer: React.FC<ServiceUserProfileDrawerProps> = ({
  isOpen,
  onClose,
  serviceUser,
  onEditSU,
  onRefreshData
}) => {
  const { sites, welfareChecks, foodSurveys, roomChecks, requestConfirmation } = useApp();

  const [activeTab, setActiveTab] = useState<string>('overview');
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

  const [showAddSupport, setShowAddSupport] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docToEdit, setDocToEdit] = useState<ServiceUserDocument | undefined>();
  const [newSupportCat, setNewSupportCat] = useState('General Support');
  const [newSupportDesc, setNewSupportDesc] = useState('');

  useEffect(() => {
    if (isOpen && serviceUser) {
      loadProfileData(serviceUser.id);
    }
  }, [isOpen, serviceUser]);

  const loadProfileData = async (suId: string) => {
    setLoading(true);
    try {
      const plcsRes = await suPropertyService.getPlacements({ suId });
      const plcs = plcsRes.success && plcsRes.data ? plcsRes.data : [];
      setPlacementHistory(plcs);

      const active = plcs.find(p => p.status === 'Active') || null;
      setActivePlacement(active);

      if (active?.propertyId) {
        const propRes = await suPropertyService.getProperty(active.propertyId);
        if (propRes.success && propRes.data) setCurrentProperty(propRes.data);
      } else {
        setCurrentProperty(null);
      }

      if (active?.roomId) {
        const roomRes = await suPropertyService.getRoom(active.roomId);
        if (roomRes.success && roomRes.data) setCurrentRoom(roomRes.data);
      } else {
        setCurrentRoom(null);
      }

      const [houseRes, suppRes, docsRes, actRes] = await Promise.all([
        suPropertyDetailsService.getSUHousehold(suId),
        suPropertyDetailsService.getSUSupport(suId),
        suPropertyDetailsService.getSUDocuments(suId),
        suPropertyDetailsService.getUnifiedSUActivity(suId, serviceUser.externalReference)
      ]);

      if (Array.isArray(houseRes)) setHousehold(houseRes);
      if (Array.isArray(suppRes)) setSupportRecords(suppRes);
      if (Array.isArray(docsRes)) setDocuments(docsRes);
      if (Array.isArray(actRes)) setActivityItems(actRes);
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !serviceUser) return null;

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

  const handleDocumentSaved = () => {
    loadProfileData(serviceUser.id);
    onRefreshData();
  };

  const handleDeleteDocument = async (docId: string) => {
    if (typeof requestConfirmation !== 'undefined') {
      requestConfirmation({
        title: 'Delete Document',
        message: 'Are you sure you want to delete this document? This action cannot be undone.',
        isDanger: true,
        onConfirm: async () => {
          try {
            await suPropertyDetailsService.deleteSUDocument(docId);
            if (serviceUser) loadProfileData(serviceUser.id);
          } catch (err) {
            console.error('Failed to delete SU document:', err);
          }
        }
      });
    } else {
      try {
        await suPropertyDetailsService.deleteSUDocument(docId);
        if (serviceUser) loadProfileData(serviceUser.id);
      } catch (err) {
        console.error('Failed to delete SU document:', err);
      }
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'personal', label: 'Personal Details' },
    { id: 'accommodation', label: 'Accommodation' },
    { id: 'household', label: `Household (${household.length})` },
    { id: 'support', label: `Support (${supportRecords.length})` },
    { id: 'documents', label: `Documents (${documents.length})` },
    { id: 'welfare', label: `Welfare (${suWelfare.length})` },
    { id: 'foodSurveys', label: `Food Surveys (${suFood.length})` },
    { id: 'roomChecks', label: `Room Checks (${suRooms.length})` },
    { id: 'activity', label: 'Activity' },
    { id: 'audit', label: 'Audit History' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col border-l border-neutral-200">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-teal-900 to-teal-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs bg-white/20 text-white px-2 py-0.5 rounded font-bold">
                {serviceUser.suReference}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                serviceUser.status === 'Active' ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40' : 'bg-neutral-500/20 text-neutral-300'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                {serviceUser.status}
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              {serviceUser.firstName} {serviceUser.middleName} {serviceUser.lastName}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-teal-100 mt-2">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-teal-300" />
                {currentSite?.name || 'Unassigned Site'}
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-teal-300" />
                {currentProperty?.propertyName || 'Unassigned Property'}
              </span>
              <span className="flex items-center gap-1">
                <DoorOpen className="w-3.5 h-3.5 text-teal-300" />
                {currentRoom ? `Room ${currentRoom.roomNumber}` : 'No Room'}
              </span>
              {activePlacement?.startDate && (
                <span className="flex items-center gap-1 text-teal-200">
                  <Calendar className="w-3.5 h-3.5" />
                  Placed: {new Date(activePlacement.startDate).toLocaleDateString('en-GB')}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onEditSU(serviceUser)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/20 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit SU</span>
            </button>
            <button
              onClick={() => setIsMoveModalOpen(true)}
              className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-neutral-900 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Move</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation (Does NOT change URL!) */}
        <div className="flex items-center gap-1 px-6 border-b border-neutral-200 bg-white overflow-x-auto custom-scrollbar shrink-0 text-xs">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2.5 border-b-2 font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === t.id ? 'border-teal-600 text-teal-700 font-bold' : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-xs">
          {activeTab === 'overview' && (
            <SUOverviewTab
              serviceUser={serviceUser}
              currentRoom={currentRoom}
              currentProperty={currentProperty}
              suWelfareCount={suWelfare.length}
              lastWelfareDate={suWelfare.length > 0 ? new Date(suWelfare[0].checkDatetime).toLocaleDateString('en-GB') : undefined}
              supportRecords={supportRecords}
              documents={documents}
              activityItems={activityItems}
              loading={loading}
            />
          )}

          {activeTab === 'personal' && (
            <SUPersonalTab serviceUser={serviceUser} />
          )}

          {activeTab === 'accommodation' && (
            <SUAccommodationTab
              currentProperty={currentProperty}
              currentRoom={currentRoom}
              currentSiteName={currentSite?.name || 'Unassigned'}
              activePlacement={activePlacement}
              placementHistory={placementHistory}
              onOpenMoveModal={() => setIsMoveModalOpen(true)}
            />
          )}

          {activeTab === 'household' && (
            <SUHouseholdTab household={household} />
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
            />
          )}

          {activeTab === 'documents' && (
            <SUDocumentsTab
              documents={documents}
              onOpenUploadModal={(doc) => { setDocToEdit(doc); setIsDocModalOpen(true); }}
              onDeleteDoc={handleDeleteDocument}
            />
          )}

          {activeTab === 'welfare' && (
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-neutral-800">Welfare Checks History</h4>
              {suWelfare.length === 0 ? (
                <p className="text-neutral-400 italic">No welfare check records found for this Service User.</p>
              ) : (
                <div className="space-y-2">
                  {suWelfare.map(w => (
                    <div key={w.id} className="p-3 bg-white border border-neutral-200 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <HeartHandshake className="w-3.5 h-3.5 text-rose-600" />
                          <strong className="text-neutral-800">{w.siteName} — Flat/Room {w.flatNumber || 'N/A'}</strong>
                          <span className="text-neutral-400">• {new Date(w.checkDatetime).toLocaleDateString('en-GB')}</span>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5">Checked by {w.officerName || 'Staff'} ({w.locationType})</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">{w.status}</span>
                    </div>
                  ))}
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
                          <Soup className="w-3.5 h-3.5 text-emerald-600" />
                          <strong className="text-neutral-800">{f.siteName}</strong>
                          <span className="text-neutral-400">• {f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-GB') : ''}</span>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5">Quality: {f.overallFoodQuality || 'Rated'} • Server: {f.serverQuality || 'N/A'}</p>
                      </div>
                      <span className="text-xs font-semibold text-emerald-700">{f.overallFoodRating || 'Rated'}</span>
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
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-cyan-600" />
                          <strong className="text-neutral-800">Room {r.roomNumber} ({r.siteName})</strong>
                          <span className="text-neutral-400">• {r.inspectionDate}</span>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5">Inspector: {r.officerName || 'Staff'}</p>
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

          {activeTab === 'audit' && (
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-neutral-800">Master Record Audit Trail</h4>
              <p className="text-neutral-500 text-[11px]">Audit events are captured on every creation, placement change, and status change.</p>
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

      {isDocModalOpen && serviceUser && (
        <MasterDocumentModal
          isOpen={isDocModalOpen}
          onClose={() => { setIsDocModalOpen(false); setDocToEdit(undefined); }}
          entityType="serviceUser"
          entityId={serviceUser.id}
          entityName={`${serviceUser.firstName} ${serviceUser.lastName} (${serviceUser.suReference})`}
          docToEdit={docToEdit}
          onSuccess={handleDocumentSaved}
        />
      )}
    </div>
  );
};
