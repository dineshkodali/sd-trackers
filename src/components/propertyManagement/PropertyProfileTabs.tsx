import React, { useState } from 'react';
import { Plus, Users, Edit3, Trash2, DoorOpen, Building2 } from 'lucide-react';
import { BulkActionToolbar } from '../common/BulkActionToolbar';
import { 
  PropertyMaster, 
  PropertyRoom, 
  Placement, 
  ServiceUserMaster, 
  PropertyFacility, 
  PropertyAsset, 
  PropertyCompliance, 
  PropertyContact 
} from '../../types/masterData';

export interface PropertyOverviewTabProps {
  totalCapacity: number;
  activeOccupantsCount: number;
  rooms: PropertyRoom[];
  occupiedRoomsCount: number;
  availableRoomsCount: number;
  complianceList: PropertyCompliance[];
  propertyMaintenanceCount: number;
  assetsCount: number;
  roomOccupantMap: Map<string, Array<{ placement: Placement; su?: ServiceUserMaster }>>;
  onAddRoom: () => void;
}

export const PropertyOverviewTab: React.FC<PropertyOverviewTabProps> = ({
  totalCapacity, activeOccupantsCount, rooms, occupiedRoomsCount,
  availableRoomsCount, complianceList, propertyMaintenanceCount,
  assetsCount, roomOccupantMap, onAddRoom
}) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Occupancy Rate</span>
        <p className="text-sm font-bold text-teal-700">
          {totalCapacity > 0 ? `${Math.round((activeOccupantsCount / totalCapacity) * 100)}%` : '0%'}
        </p>
        <p className="text-[10px] text-neutral-500">{activeOccupantsCount} / {totalCapacity} bed spaces</p>
      </div>
      <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Total Rooms</span>
        <p className="text-sm font-bold text-neutral-800">{rooms.length}</p>
        <p className="text-[10px] text-neutral-500">{occupiedRoomsCount} occupied, {availableRoomsCount} available</p>
      </div>
      <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Compliance Status</span>
        <p className="text-sm font-bold text-emerald-700">
          {complianceList.filter(c => c.status === 'Valid').length} / {complianceList.length} Valid
        </p>
        <p className="text-[10px] text-neutral-500">{complianceList.filter(c => c.status === 'Expired').length} expired</p>
      </div>
      <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Active Defect Tickets</span>
        <p className="text-sm font-bold text-amber-700">{propertyMaintenanceCount} Open</p>
        <p className="text-[10px] text-neutral-500">{assetsCount} inventoried items</p>
      </div>
    </div>

    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Room Allocation Snapshot</h3>
        <button onClick={onAddRoom} className="text-teal-700 font-semibold hover:underline flex items-center gap-1 cursor-pointer">
          <Plus className="w-3.5 h-3.5" />
          <span>Add Room</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {rooms.map(r => {
          const occs = roomOccupantMap.get(r.id) || [];
          const occ = occs[0];
          const cap = r.capacity || 1;
          const isFull = occs.length >= cap;
          const isOccupied = occs.length > 0;
          const isMaintenance = r.status === 'Maintenance' || r.status === 'Under Maintenance';
          const statusColor = isFull 
            ? 'bg-purple-50 border-purple-200 text-purple-900'
            : isOccupied
              ? 'bg-blue-50 border-blue-200 text-blue-900' 
              : isMaintenance
                ? 'bg-amber-50 border-amber-200 text-amber-900' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-900';
              
          const badgeColor = isFull 
            ? 'bg-purple-100 text-purple-800 border-purple-200'
            : isOccupied 
              ? 'bg-blue-100 text-blue-800 border-blue-200' 
              : isMaintenance
                ? 'bg-amber-100 text-amber-800 border-amber-200' 
                : 'bg-emerald-100 text-emerald-800 border-emerald-200';

          const statusBadgeText = isMaintenance 
            ? 'Maintenance' 
            : isFull 
              ? `Full (${occs.length}/${cap})` 
              : isOccupied 
                ? `Partial (${occs.length}/${cap})` 
                : `Available (0/${cap})`;

          return (
            <div 
              key={r.id} 
              className={`p-4 border rounded-xl shadow-xs hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 ${statusColor} relative overflow-hidden group`}
            >
              <div className="absolute top-0 right-0 w-16 h-16 bg-white/20 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              
              <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="font-mono text-[11px] font-bold opacity-80">{r.roomReference}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor} shadow-sm flex items-center gap-1.5`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isFull ? 'bg-purple-500' : isOccupied ? 'bg-blue-500' : isMaintenance ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`}></div>
                  {statusBadgeText}
                </span>
              </div>
              
              <h4 className="font-bold text-lg mb-1 relative z-10">Room {r.roomNumber}</h4>
              <p className="text-xs font-medium opacity-80 mb-3 relative z-10">{r.roomType} • Cap: {cap}</p>
              
              <div className="pt-3 border-t border-black/5 relative z-10 h-[40px] flex flex-col justify-center">
                {occs.length > 0 ? (
                  <div className="text-[12px] font-semibold flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate">
                      {occ?.su ? `${occ.su.firstName} ${occ.su.lastName}` : 'Resident'}
                      {occs.length > 1 && <span className="text-[10px] opacity-75 font-normal ml-1">+{occs.length - 1} more</span>}
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] opacity-60 italic flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 block"></span>
                    Available for placement
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

export interface PropertyDetailsTabProps {
  property: PropertyMaster;
}

export const PropertyDetailsTab: React.FC<PropertyDetailsTabProps> = ({ property }) => (
  <div className="space-y-4">
    <div className="bg-white p-4 rounded-lg border border-neutral-200 space-y-4">
      <h3 className="font-bold text-xs text-neutral-800 border-b pb-2">Full Address &amp; Location</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-neutral-400 block text-[10px]">Address Line 1</span>
          <strong className="text-neutral-800">{property.addressLine1 || '—'}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Address Line 2</span>
          <strong className="text-neutral-800">{property.addressLine2 || '—'}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">City</span>
          <strong className="text-neutral-800">{property.city || '—'}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Postcode</span>
          <strong className="text-teal-700 font-mono font-semibold">{property.postcode || '—'}</strong>
        </div>
      </div>

      <h3 className="font-bold text-xs text-neutral-800 border-b pb-2 pt-2">Specification &amp; Capacity</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <span className="text-neutral-400 block text-[10px]">Max Occupancy</span>
          <strong className="text-neutral-800">{property.maximumOccupancy} residents</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Bedrooms / Bathrooms</span>
          <strong className="text-neutral-800">{property.bedrooms} Beds / {property.bathrooms} Baths</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Floors</span>
          <strong className="text-neutral-800">{property.numberOfFloors} Level(s)</strong>
        </div>
      </div>

      <h3 className="font-bold text-xs text-neutral-800 border-b pb-2 pt-2">Ownership, Provider &amp; Management</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-neutral-400 block text-[10px]">Ownership Type</span>
          <strong className="text-neutral-800">{property.ownershipType || 'Leased'}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Provider</span>
          <strong className="text-neutral-800">{property.provider || 'SD Commercial Operations'}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Landlord / Owner</span>
          <strong className="text-neutral-800">{property.landlord || '—'}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Property Manager</span>
          <strong className="text-neutral-800">{property.propertyManager || '—'}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Lease Start Date</span>
          <strong className="text-neutral-800">{property.startDate ? new Date(property.startDate).toLocaleDateString('en-GB') : '—'}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Lease End Date</span>
          <strong className="text-neutral-800">{property.endDate ? new Date(property.endDate).toLocaleDateString('en-GB') : 'Open Ended'}</strong>
        </div>
        <div>
          <span className="text-neutral-400 block text-[10px]">Operational Status</span>
          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
            property.status === 'Active' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-neutral-100 text-neutral-700'
          }`}>
            {property.status}
          </span>
        </div>
      </div>

      {property.accessibilityInformation && (
        <div className="pt-2 border-t border-neutral-100">
          <span className="text-neutral-400 block text-[10px]">Accessibility Features</span>
          <p className="text-neutral-700 text-xs mt-0.5">{property.accessibilityInformation}</p>
        </div>
      )}

      {property.notes && (
        <div className="pt-2 border-t border-neutral-100">
          <span className="text-neutral-400 block text-[10px]">Operational Notes &amp; Key Safe Details</span>
          <p className="text-neutral-700 text-xs mt-0.5 bg-neutral-50 p-2.5 rounded border border-neutral-200 font-mono">
            {property.notes}
          </p>
        </div>
      )}
    </div>
  </div>
);

export interface PropertyRoomsTabProps {
  rooms: PropertyRoom[];
  roomOccupantMap: Map<string, Array<{ placement: Placement; su?: ServiceUserMaster }>>;
  onAddRoom: () => void;
  onEditRoom: (r: PropertyRoom) => void;
  onDeleteRooms: (ids: string[]) => void;
}

export const PropertyRoomsTab: React.FC<PropertyRoomsTabProps> = ({
  rooms, roomOccupantMap, onAddRoom, onEditRoom, onDeleteRooms
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleToggleSelectAll = () => {
    if (selectedIds.length === rooms.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rooms.map(r => r.id));
    }
  };

  const handleToggleSelect = (e: React.SyntheticEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-xs text-neutral-800">Rooms &amp; Units</h3>
        <button
          onClick={onAddRoom}
          className="px-3 py-1.5 bg-[#0d9488] text-white rounded-md font-semibold text-xs hover:bg-[#0f766e] flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Room</span>
        </button>
      </div>

      <div className="border border-[#e5e5e5] rounded-xs overflow-hidden shadow-2xs bg-white relative">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
            <tr>
              <th className="p-2.5 w-10 text-center sticky left-0 bg-[#faf9f8] z-10 border-r border-[#edebe9]">
                <input 
                  type="checkbox" 
                  className="cursor-pointer"
                  checked={rooms.length > 0 && selectedIds.length === rooms.length}
                  onChange={handleToggleSelectAll}
                />
              </th>
              <th className="p-2.5">Room Ref</th>
              <th className="p-2.5">Room Number</th>
              <th className="p-2.5">Type</th>
              <th className="p-2.5">Floor</th>
              <th className="p-2.5">Capacity</th>
              <th className="p-2.5">Status</th>
              <th className="p-2.5">Current Occupants</th>
              <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edebe9] text-[#323130]">
            {rooms.map(r => {
              const occs = roomOccupantMap.get(r.id) || [];
              const cap = r.capacity || 1;
              const isMaintenance = r.status === 'Under Maintenance';
              const isBlocked = r.status === 'Blocked';

              let statusBadgeClass = 'bg-emerald-100 text-emerald-800';
              let statusText = `Available (0/${cap})`;
              if (isMaintenance) {
                statusBadgeClass = 'bg-amber-100 text-amber-800';
                statusText = 'Under Maintenance';
              } else if (isBlocked) {
                statusBadgeClass = 'bg-rose-100 text-rose-800';
                statusText = 'Blocked';
              } else if (occs.length >= cap) {
                statusBadgeClass = 'bg-purple-100 text-purple-800';
                statusText = `Occupied (${occs.length}/${cap})`;
              } else if (occs.length > 0) {
                statusBadgeClass = 'bg-blue-100 text-blue-800';
                statusText = `Partially Occupied (${occs.length}/${cap})`;
              }

              return (
                <tr 
                  key={r.id} 
                  className={`transition-colors cursor-pointer group ${selectedIds.includes(r.id) ? 'bg-[#e5f3ff]' : 'hover:bg-[#f3f8fd]'}`}
                  onClick={() => onEditRoom(r)}
                >
                  <td className="p-2.5 text-center sticky left-0 bg-white group-hover:bg-[#f3f8fd] z-10 border-r border-[#edebe9]" onClick={e => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      className="cursor-pointer"
                      checked={selectedIds.includes(r.id)}
                      onChange={(e) => handleToggleSelect(e, r.id)}
                    />
                  </td>
                  <td className="p-2.5 font-mono font-bold text-[#0d9488]">{r.roomReference}</td>
                <td className="p-2.5 font-semibold">Room {r.roomNumber}</td>
                <td className="p-2.5">{r.roomType}</td>
                <td className="p-2.5">{r.floor || 'Ground'}</td>
                <td className="p-2.5">{cap}</td>
                <td className="p-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass}`}>
                    {statusText}
                  </span>
                </td>
                <td className="p-2.5 font-medium">
                  {occs.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {occs.map((item, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 text-xs">
                          <span className="font-semibold text-neutral-800">
                            {item.su ? `${item.su.firstName} ${item.su.lastName}` : 'Resident'}
                          </span>
                          {item.su?.suReference && (
                            <span className="font-mono text-[10px] text-teal-700 bg-teal-50 px-1 rounded">
                              {item.su.suReference}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
                <td className="p-2.5 text-right sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); onEditRoom(r); }} className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs transition-colors cursor-pointer" title="Edit Room">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteRooms([r.id]); }} className="p-1 hover:bg-[#fceef1] text-[#a4262c] hover:text-[#d13438] rounded-xs transition-colors cursor-pointer" title="Delete Room">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      <BulkActionToolbar
        selectedCount={selectedIds.length}
        totalCount={rooms.length}
        onClearSelection={() => setSelectedIds([])}
        onSelectAll={handleToggleSelectAll}
        onDeleteSelected={() => { onDeleteRooms(selectedIds); setSelectedIds([]); }}
      />
    </div>
  </div>
  );
};

export interface PropertyServiceUsersTabProps {
  occupants: ServiceUserMaster[];
  activePlacements: Placement[];
  rooms: PropertyRoom[];
}

export const PropertyServiceUsersTab: React.FC<PropertyServiceUsersTabProps> = ({
  occupants, activePlacements, rooms
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleToggleSelectAll = () => {
    if (selectedIds.length === occupants.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(occupants.map(o => o.id));
    }
  };

  const handleToggleSelect = (e: React.SyntheticEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
  <div className="space-y-4">
    <h3 className="font-bold text-xs text-neutral-800">Service Users Placed at this Property</h3>
    {occupants.length === 0 ? (
      <p className="text-neutral-400 italic">No Service Users currently placed at this property.</p>
    ) : (
      <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
            <tr>
              <th className="p-2.5 w-10 text-center sticky left-0 bg-[#faf9f8] z-10 border-r border-[#edebe9]">
                <input 
                  type="checkbox" 
                  className="cursor-pointer"
                  checked={occupants.length > 0 && selectedIds.length === occupants.length}
                  onChange={handleToggleSelectAll}
                />
              </th>
              <th className="p-2.5">SU ID</th>
              <th className="p-2.5">Name</th>
              <th className="p-2.5">Assigned Room</th>
              <th className="p-2.5">Placement Start</th>
              <th className="p-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {occupants.map(u => {
              const plc = activePlacements.find(p => p.suId === u.id);
              const rm = rooms.find(r => r.id === plc?.roomId);
              return (
                <tr 
                  key={u.id} 
                  className={`transition-colors cursor-pointer group ${selectedIds.includes(u.id) ? 'bg-[#e5f3ff]' : 'hover:bg-[#f3f8fd]'}`}
                >
                  <td className="p-2.5 text-center sticky left-0 bg-white group-hover:bg-[#f3f8fd] z-10 border-r border-[#edebe9]" onClick={e => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      className="cursor-pointer"
                      checked={selectedIds.includes(u.id)}
                      onChange={(e) => handleToggleSelect(e, u.id)}
                    />
                  </td>
                  <td className="p-2.5 font-mono font-bold text-[#0d9488]">{u.suReference}</td>
                  <td className="p-2.5 font-semibold">{u.firstName} {u.lastName}</td>
                  <td className="p-2.5 font-medium">{rm ? `Room ${rm.roomNumber}` : 'Unassigned'}</td>
                  <td className="p-2.5 text-neutral-600">{plc?.startDate ? new Date(plc.startDate).toLocaleDateString('en-GB') : '—'}</td>
                  <td className="p-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Active</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        <BulkActionToolbar
          selectedCount={selectedIds.length}
          totalCount={occupants.length}
          onClearSelection={() => setSelectedIds([])}
          onSelectAll={handleToggleSelectAll}
        />
      </div>
    )}
  </div>
  );
};

export interface PropertyComplianceTabProps {
  complianceList: PropertyCompliance[];
  onAddCompliance: () => void;
  onEditCompliance: (c: PropertyCompliance) => void;
}

export const PropertyComplianceTab: React.FC<PropertyComplianceTabProps> = ({
  complianceList, onAddCompliance, onEditCompliance
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleToggleSelectAll = () => {
    if (selectedIds.length === complianceList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(complianceList.map(c => c.id));
    }
  };

  const handleToggleSelect = (e: React.SyntheticEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="font-bold text-xs text-neutral-800">Compliance &amp; Safety Certificates</h3>
      <button
        onClick={onAddCompliance}
        className="px-3 py-1.5 bg-[#0d9488] text-white rounded-md font-semibold text-xs hover:bg-[#0f766e] flex items-center gap-1.5 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Certificate</span>
      </button>
    </div>

    <div className="border border-[#e5e5e5] rounded-xs overflow-hidden shadow-2xs bg-white relative">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
          <tr>
            <th className="p-2.5 w-10 text-center sticky left-0 bg-[#faf9f8] z-10 border-r border-[#edebe9]">
              <input 
                type="checkbox" 
                className="cursor-pointer"
                checked={complianceList.length > 0 && selectedIds.length === complianceList.length}
                onChange={handleToggleSelectAll}
              />
            </th>
            <th className="p-2.5">Compliance Type</th>
            <th className="p-2.5">Certificate Ref</th>
            <th className="p-2.5">Inspection Date</th>
            <th className="p-2.5">Expiry Date</th>
            <th className="p-2.5">Provider</th>
            <th className="p-2.5">Status</th>
            <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#edebe9] text-[#323130]">
          {complianceList.map(c => (
            <tr 
              key={c.id} 
              className={`transition-colors cursor-pointer group ${selectedIds.includes(c.id) ? 'bg-[#e5f3ff]' : 'hover:bg-[#f3f8fd]'}`}
              onClick={() => onEditCompliance(c)}
            >
              <td className="p-2.5 text-center sticky left-0 bg-white group-hover:bg-[#f3f8fd] z-10 border-r border-[#edebe9]" onClick={e => e.stopPropagation()}>
                <input 
                  type="checkbox" 
                  className="cursor-pointer"
                  checked={selectedIds.includes(c.id)}
                  onChange={(e) => handleToggleSelect(e, c.id)}
                />
              </td>
              <td className="p-2.5 font-semibold text-neutral-800">{c.type}</td>
              <td className="p-2.5 font-mono text-[11px] text-teal-800">{c.certificateNumber || '—'}</td>
              <td className="p-2.5 text-neutral-600">{c.inspectionDate ? new Date(c.inspectionDate).toLocaleDateString('en-GB') : '—'}</td>
              <td className="p-2.5 font-medium text-neutral-800">{c.expiryDate ? new Date(c.expiryDate).toLocaleDateString('en-GB') : '—'}</td>
              <td className="p-2.5 text-neutral-600">{c.provider || '—'}</td>
              <td className="p-2.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  c.status === 'Valid' ? 'bg-emerald-100 text-emerald-800' : c.status === 'Expiring Soon' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                }`}>
                  {c.status}
                </span>
              </td>
              <td className="p-2.5 text-right sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditCompliance(c); }}
                    className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <BulkActionToolbar
        selectedCount={selectedIds.length}
        totalCount={complianceList.length}
        onClearSelection={() => setSelectedIds([])}
        onSelectAll={handleToggleSelectAll}
      />
    </div>
  </div>
  );
};

export interface PropertyAssetsTabProps {
  assets: PropertyAsset[];
  rooms: PropertyRoom[];
  onAddAsset: () => void;
  onEditAsset: (a: PropertyAsset) => void;
}

export const PropertyAssetsTab: React.FC<PropertyAssetsTabProps> = ({
  assets, rooms, onAddAsset, onEditAsset
}) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="font-bold text-xs text-neutral-800">Inventory &amp; Asset Register</h3>
      <button
        onClick={onAddAsset}
        className="px-3 py-1.5 bg-[#0d9488] text-white rounded-md font-semibold text-xs hover:bg-[#0f766e] flex items-center gap-1.5 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Asset</span>
      </button>
    </div>

    <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
      <table className="w-full text-left">
        <thead className="bg-neutral-50 border-b text-[10px] font-bold text-neutral-500 uppercase">
          <tr>
            <th className="p-2.5">Asset Ref</th>
            <th className="p-2.5">Name</th>
            <th className="p-2.5">Category</th>
            <th className="p-2.5">Room</th>
            <th className="p-2.5">Qty</th>
            <th className="p-2.5">Condition</th>
            <th className="p-2.5">Status</th>
            <th className="p-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {assets.map(a => {
            const rm = rooms.find(r => r.id === a.roomId);
            return (
              <tr key={a.id} className="hover:bg-neutral-50/80">
                <td className="p-2.5 font-mono font-bold text-teal-800">{a.assetReference}</td>
                <td className="p-2.5 font-semibold text-neutral-800">{a.assetName}</td>
                <td className="p-2.5 text-neutral-600">{a.category}</td>
                <td className="p-2.5">{rm ? `Room ${rm.roomNumber}` : 'Communal'}</td>
                <td className="p-2.5">{a.quantity}</td>
                <td className="p-2.5">{a.condition}</td>
                <td className="p-2.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">{a.status}</span>
                </td>
                <td className="p-2.5 text-right">
                  <button
                    onClick={() => onEditAsset(a)}
                    className="p-1 text-neutral-500 hover:text-blue-700 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);
