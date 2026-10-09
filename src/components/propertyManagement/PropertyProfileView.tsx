import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight, Building2, Edit3, Plus, Home, Users } from 'lucide-react';
import { suPropertyService } from '../../services/suPropertyService';
import { suPropertyDetailsService } from '../../services/suPropertyDetailsService';
import { useApp } from '../../context/AppContext';
import { 
  PropertyMaster, 
  PropertyRoom, 
  Placement, 
  ServiceUserMaster, 
  PropertyFacility, 
  PropertyAsset, 
  PropertyCompliance, 
  PropertyDocument, 
  PropertyContact 
} from '../../types/masterData';
import { RoomFormModal } from './RoomFormModal';
import { AssetFormModal } from './AssetFormModal';
import { ComplianceFormModal } from './ComplianceFormModal';
import { PropertyDocumentsSection } from './PropertyDocumentsSection';
import { 
  PropertyOverviewTab, 
  PropertyDetailsTab, 
  PropertyRoomsTab, 
  PropertyServiceUsersTab,
  PropertyComplianceTab,
  PropertyAssetsTab
} from './PropertyProfileTabs';

interface PropertyProfileViewProps {
  property: PropertyMaster;
  onBack: () => void;
  onEditProperty: (prop: PropertyMaster) => void;
  onRefreshData: () => void;
}

export const PropertyProfileView: React.FC<PropertyProfileViewProps> = ({
  property,
  onBack,
  onEditProperty,
  onRefreshData
}) => {
  const { sites, maintenanceRecords, canManageProperties, requestConfirmation } = useApp();
  const canCRUD = canManageProperties();

  const [activeTab, setActiveTab] = useState('overview');
  const [rooms, setRooms] = useState<PropertyRoom[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [occupants, setOccupants] = useState<ServiceUserMaster[]>([]);
  const [facilities, setFacilities] = useState<PropertyFacility[]>([]);
  const [assets, setAssets] = useState<PropertyAsset[]>([]);
  const [complianceList, setComplianceList] = useState<PropertyCompliance[]>([]);
  const [documents, setDocuments] = useState<PropertyDocument[]>([]);
  const [contacts, setContacts] = useState<PropertyContact[]>([]);
  const [loading, setLoading] = useState(false);

  // Sub-record modals
  const [selectedRoomToEdit, setSelectedRoomToEdit] = useState<PropertyRoom | null>(null);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [selectedAssetToEdit, setSelectedAssetToEdit] = useState<PropertyAsset | null>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [selectedComplianceToEdit, setSelectedComplianceToEdit] = useState<PropertyCompliance | null>(null);
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);

  // Quick inline facility & contact adders
  const [showAddFacility, setShowAddFacility] = useState(false);
  const [newFacName, setNewFacName] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactRole, setNewContactRole] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  const loadPropertyData = async (propId: string) => {
    setLoading(true);
    try {
      const [rRes, pRes, suRes, fList, aList, cList, dList, ctList] = await Promise.all([
        suPropertyService.getRooms(propId),
        suPropertyService.getPlacements({ propertyId: propId }),
        suPropertyService.getServiceUsers(),
        suPropertyDetailsService.getPropertyFacilities(propId),
        suPropertyDetailsService.getPropertyAssets(propId),
        suPropertyDetailsService.getPropertyCompliance(propId),
        suPropertyDetailsService.getPropertyDocuments(propId),
        suPropertyDetailsService.getPropertyContacts(propId)
      ]);

      const loadedRooms = rRes.success && rRes.data ? rRes.data : [];
      const loadedPlcs = pRes.success && pRes.data ? pRes.data : [];
      const allSUs = suRes.success && suRes.data ? suRes.data : [];

      setRooms(loadedRooms);
      setPlacements(loadedPlcs);

      const activePlcSuIds = new Set(loadedPlcs.filter(p => p.status === 'Active').map(p => p.suId));
      setOccupants(allSUs.filter(u => activePlcSuIds.has(u.id)));

      if (Array.isArray(fList)) setFacilities(fList);
      if (Array.isArray(aList)) setAssets(aList);
      if (Array.isArray(cList)) setComplianceList(cList);
      if (Array.isArray(dList)) setDocuments(dList);
      if (Array.isArray(ctList)) setContacts(ctList);
    } catch (err) {
      console.error('Failed to load property details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (property) {
      loadPropertyData(property.id);
    }
  }, [property]);

  const handleAddFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFacName.trim() || !property) return;
    await suPropertyDetailsService.savePropertyFacility({
      propertyId: property.id,
      facilityName: newFacName.trim(),
      facilityType: 'General',
      isAvailable: true
    });
    setNewFacName('');
    setShowAddFacility(false);
    loadPropertyData(property.id);
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !property) return;
    await suPropertyDetailsService.savePropertyContact({
      propertyId: property.id,
      name: newContactName.trim(),
      role: newContactRole.trim() || 'Contact',
      phone: newContactPhone.trim()
    });
    setNewContactName('');
    setNewContactRole('');
    setNewContactPhone('');
    setShowAddContact(false);
    loadPropertyData(property.id);
  };

  const currentSite = sites.find(s => s.id === property.siteId);
  const activePlacements = placements.filter(p => p.status === 'Active');
  const activeOccupantsCount = activePlacements.length;
  const totalCapacity = property.maximumOccupancy || rooms.reduce((acc, r) => acc + (r.capacity || 1), 0);
  const occupiedRoomsCount = rooms.filter(r => r.occupancyStatus === 'Occupied' || activePlacements.some(p => p.roomId === r.id)).length;
  const availableRoomsCount = Math.max(0, rooms.length - occupiedRoomsCount);

  const roomOccupantMap = new Map<string, Array<{ placement: Placement; su?: ServiceUserMaster }>>();
  activePlacements.forEach(plc => {
    if (plc.roomId) {
      const su = occupants.find(u => u.id === plc.suId);
      const list = roomOccupantMap.get(plc.roomId) || [];
      list.push({ placement: plc, su });
      roomOccupantMap.set(plc.roomId, list);
    }
  });

  const propertyMaintenance = maintenanceRecords.filter(m => 
    m.location?.toLowerCase().includes(property.propertyName.toLowerCase()) || 
    m.site?.toLowerCase() === currentSite?.name.toLowerCase()
  );

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'details', label: 'Property Details' },
    { id: 'rooms', label: `Rooms (${rooms.length})` },
    { id: 'serviceUsers', label: `Service Users (${occupants.length})` },
    { id: 'compliance', label: `Compliance (${complianceList.length})` },
    { id: 'documents', label: `Documents (${documents.length})` },
    { id: 'assets', label: `Assets / Inventory (${assets.length})` },
    { id: 'facilities', label: `Facilities (${facilities.length})` },
    { id: 'contacts', label: `Contacts (${contacts.length})` }
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
            <span>Properties</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <span className="font-mono text-[11px] text-[#0f766e] bg-[#f0fdfa] border border-[#99f6e4] px-1.5 py-0.5 rounded-xs font-bold">
            {property.propertyReference}
          </span>
          <span className="font-bold text-[#242424]">
            {property.propertyName}
          </span>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1 text-xs font-semibold text-neutral-700 hover:text-neutral-900 hover:bg-[#edebe9] rounded-xs border border-[#d1d1d1] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Properties</span>
        </button>
      </div>

      {/* Main In-Page Property Profile */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs overflow-hidden flex flex-col">
        {/* Header Section */}
        <div className="p-5 border-b border-[#e5e5e5] bg-[#faf9f8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-xs bg-[#f0fdfa] text-[#0f766e] border border-[#99f6e4] px-2 py-0.5 rounded-xs font-bold">
                {property.propertyReference}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                property.status === 'Active' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-neutral-100 text-neutral-700 border-neutral-300'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${property.status === 'Active' ? 'bg-emerald-500' : 'bg-neutral-400'}`}></span>
                {property.status}
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 bg-[#f3f2f1] text-[#323130] rounded-xs border border-[#e5e5e5]">
                {property.propertyType}
              </span>
            </div>

            <h1 className="text-xl font-bold text-[#242424] tracking-tight">
              {property.propertyName}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 mt-2">
              <span className="flex items-center gap-1 font-medium text-[#242424]">
                <Building2 className="w-3.5 h-3.5 text-[#0d9488]" />
                {currentSite?.name || 'Unassigned Site'}
              </span>
              <span className="flex items-center gap-1">
                <Home className="w-3.5 h-3.5 text-neutral-400" />
                {[property.addressLine1, property.city, property.postcode].filter(Boolean).join(', ')}
              </span>
              <span className="flex items-center gap-1 text-[#0f766e] font-semibold">
                <Users className="w-3.5 h-3.5 text-[#0d9488]" />
                {activeOccupantsCount} / {totalCapacity} Occupied ({occupiedRoomsCount} Rooms)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canCRUD && (
              <button
                onClick={() => onEditProperty(property)}
                className="px-3.5 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Property</span>
              </button>
            )}
            {canCRUD && (
              <button
                onClick={() => { setSelectedRoomToEdit(null); setIsRoomModalOpen(true); }}
                className="px-3 py-1.5 bg-white hover:bg-[#edebe9] text-neutral-700 border border-[#d1d1d1] rounded-xs text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-teal-700" />
                <span>Add Room</span>
              </button>
            )}
            {canCRUD && (
              <button
                onClick={() => { setSelectedComplianceToEdit(null); setIsComplianceModalOpen(true); }}
                className="px-3 py-1.5 bg-white hover:bg-[#edebe9] text-neutral-700 border border-[#d1d1d1] rounded-xs text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-teal-700" />
                <span>Certificate</span>
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
            <PropertyOverviewTab
              totalCapacity={totalCapacity}
              activeOccupantsCount={activeOccupantsCount}
              rooms={rooms}
              occupiedRoomsCount={occupiedRoomsCount}
              availableRoomsCount={availableRoomsCount}
              complianceList={complianceList}
              propertyMaintenanceCount={propertyMaintenance.length}
              assetsCount={assets.length}
              roomOccupantMap={roomOccupantMap}
              onAddRoom={() => { setSelectedRoomToEdit(null); setIsRoomModalOpen(true); }}
            />
          )}

          {activeTab === 'details' && (
            <PropertyDetailsTab property={property} />
          )}

          {activeTab === 'rooms' && (
            <PropertyRoomsTab
              rooms={rooms}
              roomOccupantMap={roomOccupantMap}
              onAddRoom={() => { setSelectedRoomToEdit(null); setIsRoomModalOpen(true); }}
              onEditRoom={(r) => { setSelectedRoomToEdit(r); setIsRoomModalOpen(true); }}
              onDeleteRooms={(ids) => {
                if (typeof requestConfirmation !== 'undefined') {
                  requestConfirmation({
                    title: 'Delete Rooms',
                    message: `Are you sure you want to delete ${ids.length} selected room(s)? This action cannot be undone.`,
                    isDanger: true,
                    onConfirm: async () => {
                      try {
                        for (const id of ids) {
                          await suPropertyService.deleteRoom(id);
                        }
                        loadPropertyData(property.id);
                        onRefreshData();
                      } catch (err) {
                        console.error('Failed to delete rooms:', err);
                      }
                    }
                  });
                }
              }}
            />
          )}

          {activeTab === 'serviceUsers' && (
            <PropertyServiceUsersTab
              occupants={occupants}
              activePlacements={activePlacements}
              rooms={rooms}
            />
          )}

          {activeTab === 'compliance' && (
            <PropertyComplianceTab
              complianceList={complianceList}
              onAddCompliance={() => { setSelectedComplianceToEdit(null); setIsComplianceModalOpen(true); }}
              onEditCompliance={(c) => { setSelectedComplianceToEdit(c); setIsComplianceModalOpen(true); }}
            />
          )}

          {activeTab === 'documents' && (
            <PropertyDocumentsSection
              propertyId={property.id}
              propertyName={property.propertyName}
              documents={documents}
              onRefresh={() => {
                loadPropertyData(property.id);
                onRefreshData();
              }}
            />
          )}

          {activeTab === 'assets' && (
            <PropertyAssetsTab
              assets={assets}
              rooms={rooms}
              onAddAsset={() => { setSelectedAssetToEdit(null); setIsAssetModalOpen(true); }}
              onEditAsset={(a) => { setSelectedAssetToEdit(a); setIsAssetModalOpen(true); }}
            />
          )}

          {activeTab === 'facilities' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs text-neutral-800">Facilities &amp; Amenities</h3>
                <button
                  onClick={() => setShowAddFacility(true)}
                  className="px-3 py-1.5 bg-[#0d9488] text-white rounded-xs font-semibold text-xs hover:bg-[#0f766e] flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Facility</span>
                </button>
              </div>

              {showAddFacility && (
                <form onSubmit={handleAddFacility} className="p-3 bg-neutral-50 border border-neutral-300 rounded-xs flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Facility name (e.g. Communal Kitchen, Laundry Room, Wi-Fi)"
                    value={newFacName}
                    onChange={e => setNewFacName(e.target.value)}
                    required
                    className="flex-1 px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-xs"
                  />
                  <button type="submit" className="px-3 py-1.5 bg-[#0d9488] text-white rounded-xs text-xs font-semibold">Save</button>
                  <button type="button" onClick={() => setShowAddFacility(false)} className="px-2.5 py-1.5 border rounded-xs text-xs">Cancel</button>
                </form>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {facilities.map(f => (
                  <div key={f.id} className="p-3 bg-white border border-neutral-200 rounded-xs flex items-center justify-between shadow-2xs">
                    <span className="font-medium text-xs text-neutral-800">{f.facilityName}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold">Active</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs text-neutral-800">Key Contacts &amp; Contractors</h3>
                <button
                  onClick={() => setShowAddContact(true)}
                  className="px-3 py-1.5 bg-[#0d9488] text-white rounded-xs font-semibold text-xs hover:bg-[#0f766e] flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Contact</span>
                </button>
              </div>

              {showAddContact && (
                <form onSubmit={handleAddContact} className="p-3 bg-neutral-50 border border-neutral-300 rounded-xs grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Contact Name"
                    value={newContactName}
                    onChange={e => setNewContactName(e.target.value)}
                    required
                    className="p-1.5 bg-white border rounded-xs text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Role (e.g. Caretaker, Plumber)"
                    value={newContactRole}
                    onChange={e => setNewContactRole(e.target.value)}
                    className="p-1.5 bg-white border rounded-xs text-xs"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={newContactPhone}
                    onChange={e => setNewContactPhone(e.target.value)}
                    className="p-1.5 bg-white border rounded-xs text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <button type="submit" className="px-3 py-1.5 bg-[#0d9488] text-white rounded-xs text-xs font-semibold">Save</button>
                    <button type="button" onClick={() => setShowAddContact(false)} className="px-2 py-1.5 border rounded-xs text-xs">Cancel</button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {contacts.map(c => (
                  <div key={c.id} className="p-3 bg-white border border-neutral-200 rounded-xs space-y-1 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-xs text-neutral-800">{c.name}</strong>
                      <span className="text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-600">{c.role}</span>
                    </div>
                    {c.phone && <p className="text-xs text-teal-700 font-mono">{c.phone}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {isRoomModalOpen && (
        <RoomFormModal
          isOpen={isRoomModalOpen}
          onClose={() => setIsRoomModalOpen(false)}
          propertyId={property.id}
          roomToEdit={selectedRoomToEdit}
          onSuccess={() => {
            loadPropertyData(property.id);
            onRefreshData();
          }}
        />
      )}

      {isAssetModalOpen && (
        <AssetFormModal
          isOpen={isAssetModalOpen}
          onClose={() => setIsAssetModalOpen(false)}
          propertyId={property.id}
          rooms={rooms}
          assetToEdit={selectedAssetToEdit}
          onSuccess={() => {
            loadPropertyData(property.id);
            onRefreshData();
          }}
        />
      )}

      {isComplianceModalOpen && (
        <ComplianceFormModal
          isOpen={isComplianceModalOpen}
          onClose={() => setIsComplianceModalOpen(false)}
          propertyId={property.id}
          complianceToEdit={selectedComplianceToEdit}
          onSuccess={() => {
            loadPropertyData(property.id);
            onRefreshData();
          }}
        />
      )}
    </div>
  );
};
