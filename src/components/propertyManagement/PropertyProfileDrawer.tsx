import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  Edit3, 
  Plus, 
  Home, 
  Users 
} from 'lucide-react';
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

interface PropertyProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  property: PropertyMaster | null;
  onEditProperty: (prop: PropertyMaster) => void;
  onRefreshData: () => void;
}

export const PropertyProfileDrawer: React.FC<PropertyProfileDrawerProps> = ({
  isOpen,
  onClose,
  property,
  onEditProperty,
  onRefreshData
}) => {
  const { sites, maintenanceRecords } = useApp();

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

  useEffect(() => {
    if (isOpen && property) {
      loadPropertyData(property.id);
    }
  }, [isOpen, property]);

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

      const propRooms = rRes.success && rRes.data ? rRes.data : [];
      const propPlcs = pRes.success && pRes.data ? pRes.data : [];
      const allSUs = suRes.success && suRes.data ? suRes.data : [];

      setRooms(propRooms);
      setPlacements(propPlcs);

      const activePlcs = propPlcs.filter(p => p.status === 'Active');
      const activeSUs = allSUs.filter(u => activePlcs.some(p => p.suId === u.id));
      setOccupants(activeSUs);

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

  if (!isOpen || !property) return null;

  const currentSite = sites.find(s => s.id === property.siteId);
  const activePlacements = placements.filter(p => p.status === 'Active');
  const activeOccupantsCount = activePlacements.length;
  const totalCapacity = property.maximumOccupancy || rooms.reduce((acc, r) => acc + (r.capacity || 1), 0);
  const occupiedRoomsCount = rooms.filter(r => r.occupancyStatus === 'Occupied' || activePlacements.some(p => p.roomId === r.id)).length;
  const availableRoomsCount = Math.max(0, rooms.length - occupiedRoomsCount);

  const roomOccupantMap = new Map<string, { placement: Placement; su?: ServiceUserMaster }>();
  activePlacements.forEach(plc => {
    if (plc.roomId) {
      const su = occupants.find(u => u.id === plc.suId);
      roomOccupantMap.set(plc.roomId, { placement: plc, su });
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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex justify-end animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col border-l border-[#e5e5e5]">
        
        {/* Modern Fluent Header */}
        <div className="px-6 py-4 border-b border-[#e5e5e5] bg-[#faf9f8] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-2xs">
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
            <h2 className="text-base font-bold text-[#242424] tracking-tight">
              {property.propertyName}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 mt-1.5">
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
                {activeOccupantsCount} / {totalCapacity} Occupied
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onEditProperty(property)}
              className="px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Property</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-[#edebe9] rounded-xs transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-[#e5e5e5] bg-white overflow-x-auto custom-scrollbar shrink-0 text-xs select-none">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === t.id ? 'border-[#0d9488] text-[#0f766e] font-bold' : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-xs">
          {activeTab === 'overview' && (
            <PropertyOverviewTab
              totalCapacity={totalCapacity}
              activeOccupantsCount={activeOccupantsCount}
              rooms={rooms}
              occupiedRoomsCount={occupiedRoomsCount}
              availableRoomsCount={availableRoomsCount}
              complianceList={complianceList}
              propertyMaintenanceCount={propertyMaintenance.filter(m => m.defectStatus !== 'Completed').length}
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
                        if (onRefreshData) onRefreshData();
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
              onRefresh={() => loadPropertyData(property.id)}
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
                  className="px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded font-semibold hover:bg-teal-100 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Facility</span>
                </button>
              </div>

              {showAddFacility && (
                <form onSubmit={handleAddFacility} className="p-3 bg-neutral-50 border rounded-lg flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Facility Name (e.g. Wi-Fi, Garden, Washing Machine)"
                    value={newFacName}
                    onChange={e => setNewFacName(e.target.value)}
                    required
                    className="flex-1 px-2.5 py-1 bg-white border rounded text-xs"
                  />
                  <button type="button" onClick={() => setShowAddFacility(false)} className="px-2.5 py-1 border rounded cursor-pointer">Cancel</button>
                  <button type="submit" className="px-3 py-1 bg-teal-600 text-white rounded font-semibold cursor-pointer">Save</button>
                </form>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {facilities.map(f => (
                  <div key={f.id} className="p-2.5 bg-white border border-neutral-200 rounded-lg flex items-center justify-between">
                    <span className="font-semibold text-neutral-800">{f.facilityName}</span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Active</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs text-neutral-800">Property Contacts</h3>
                <button
                  onClick={() => setShowAddContact(true)}
                  className="px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded font-semibold hover:bg-teal-100 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Contact</span>
                </button>
              </div>

              {showAddContact && (
                <form onSubmit={handleAddContact} className="p-3 bg-neutral-50 border rounded-lg space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Contact Name"
                      value={newContactName}
                      onChange={e => setNewContactName(e.target.value)}
                      required
                      className="px-2 py-1 bg-white border rounded text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Role (e.g. Landlord, Contractor)"
                      value={newContactRole}
                      onChange={e => setNewContactRole(e.target.value)}
                      className="px-2 py-1 bg-white border rounded text-xs"
                    />
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={newContactPhone}
                      onChange={e => setNewContactPhone(e.target.value)}
                      className="px-2 py-1 bg-white border rounded text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowAddContact(false)} className="px-2 py-1 border rounded cursor-pointer">Cancel</button>
                    <button type="submit" className="px-3 py-1 bg-teal-600 text-white rounded font-semibold cursor-pointer">Save Contact</button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {contacts.map(c => (
                  <div key={c.id} className="p-3 bg-white border border-neutral-200 rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-neutral-800">{c.name}</strong>
                      <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded font-semibold">{c.role}</span>
                    </div>
                    <p className="text-[11px] text-neutral-500">{c.phone || 'No phone'} • {c.email || 'No email'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub-record Modals */}
      {isRoomModalOpen && (
        <RoomFormModal
          isOpen={isRoomModalOpen}
          onClose={() => setIsRoomModalOpen(false)}
          propertyId={property.id}
          roomToEdit={selectedRoomToEdit}
          onSuccess={() => { loadPropertyData(property.id); onRefreshData(); }}
        />
      )}

      {isAssetModalOpen && (
        <AssetFormModal
          isOpen={isAssetModalOpen}
          onClose={() => setIsAssetModalOpen(false)}
          propertyId={property.id}
          rooms={rooms}
          assetToEdit={selectedAssetToEdit}
          onSuccess={() => { loadPropertyData(property.id); onRefreshData(); }}
        />
      )}

      {isComplianceModalOpen && (
        <ComplianceFormModal
          isOpen={isComplianceModalOpen}
          onClose={() => setIsComplianceModalOpen(false)}
          propertyId={property.id}
          complianceToEdit={selectedComplianceToEdit}
          onSuccess={() => { loadPropertyData(property.id); onRefreshData(); }}
        />
      )}
    </div>
  );
};
