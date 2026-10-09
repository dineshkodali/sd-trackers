import { apiService, WriteResult } from './apiService';
import { INITIAL_SITES } from '../data/initialData';
import {
  ServiceUserMaster,
  ServiceUserContact,
  ServiceUserHouseholdMember,
  ServiceUserSupportRecord,
  ServiceUserDocument,
  PropertyMaster,
  PropertyRoom,
  PropertyFacility,
  PropertyAsset,
  PropertyCompliance,
  PropertyDocument,
  PropertyContact,
  Placement,
  MasterAuditLog,
  UnifiedActivityItem
} from '../types/masterData';

export const suPropertyService = {
  // ---------------------------------------------------------------------------
  // Reference Generators
  // ---------------------------------------------------------------------------
  generateReference(prefix: string, count: number): string {
    const num = String(count + 1).padStart(6, '0');
    return `${prefix}-${num}`;
  },

  notifyMasterChange(type: string, data?: any) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sdtracker:masterDataUpdated', { detail: { type, data } }));
    }
  },

  // ---------------------------------------------------------------------------
  // Validation & Helpers
  // ---------------------------------------------------------------------------
  async validateServiceUser(data: Partial<ServiceUserMaster>, existingId?: string): Promise<{ valid: boolean; error?: string }> {
    if (existingId) {
      if (data.firstName !== undefined && !data.firstName.trim()) {
        return { valid: false, error: 'First name cannot be empty.' };
      }
      if (data.lastName !== undefined && !data.lastName.trim()) {
        return { valid: false, error: 'Last name cannot be empty.' };
      }
    } else {
      if (!data.firstName?.trim() || !data.lastName?.trim()) {
        return { valid: false, error: 'First name and Last name are required.' };
      }
    }

    // Check duplicate external reference (Port / Home Office Ref)
    if (data.externalReference?.trim()) {
      const ext = data.externalReference.trim().toLowerCase();
      const existingRes = await this.getServiceUsers();
      if (existingRes.success && existingRes.data) {
        const dup = existingRes.data.find(u => 
          u.id !== existingId && 
          u.externalReference && 
          u.externalReference.trim().toLowerCase() === ext
        );
        if (dup) {
          return {
            valid: false,
            error: `A Service User with Port / HO Reference "${data.externalReference}" already exists (${dup.firstName} ${dup.lastName} [${dup.suReference}]).`
          };
        }
      }
    }

    // Check duplicate full name + DOB combination
    if (data.dateOfBirth?.trim() && data.firstName?.trim() && data.lastName?.trim()) {
      const fName = data.firstName.trim().toLowerCase();
      const lName = data.lastName.trim().toLowerCase();
      const dob = data.dateOfBirth.trim();
      const existingRes = await this.getServiceUsers();
      if (existingRes.success && existingRes.data) {
        const dup = existingRes.data.find(u =>
          u.id !== existingId &&
          u.firstName.trim().toLowerCase() === fName &&
          u.lastName.trim().toLowerCase() === lName &&
          u.dateOfBirth === dob
        );
        if (dup) {
          return {
            valid: false,
            error: `A Service User with name "${data.firstName} ${data.lastName}" and Date of Birth "${dob}" is already registered [${dup.suReference}].`
          };
        }
      }
    }

    return { valid: true };
  },

  // ---------------------------------------------------------------------------
  // Service User Master
  // ---------------------------------------------------------------------------
  async getServiceUsers(siteId?: string): Promise<{ success: boolean; data: ServiceUserMaster[]; error?: string }> {
    let resolvedSiteId = siteId;
    if (resolvedSiteId && resolvedSiteId !== 'all' && resolvedSiteId !== 'All Sites') {
      const match = INITIAL_SITES.find(s => s.name === resolvedSiteId || s.id === resolvedSiteId);
      if (match) resolvedSiteId = match.id;
    }
    const eq = resolvedSiteId && resolvedSiteId !== 'all' && resolvedSiteId !== 'All Sites' ? { site_id: resolvedSiteId } : undefined;
    return await apiService.fetchEntityRecords<ServiceUserMaster>('serviceUsers', {
      order: 'created_at.desc',
      eq
    });
  },

  async getServiceUser(id: string): Promise<{ success: boolean; data?: ServiceUserMaster; error?: string }> {
    const res = await apiService.fetchEntityRecords<ServiceUserMaster>('serviceUsers', {
      eq: { id },
      limit: 1
    });
    if (res.success && res.data && res.data.length > 0) {
      return { success: true, data: res.data[0] };
    }
    return { success: false, error: res.error || 'Service user not found' };
  },

  async createServiceUser(
    data: Partial<ServiceUserMaster>,
    contact?: Partial<ServiceUserContact>,
    household?: Partial<ServiceUserHouseholdMember>[],
    initialPlacement?: { siteId: string; propertyId: string; roomId: string; startDate?: string; notes?: string }
  ): Promise<WriteResult<ServiceUserMaster>> {
    // Validate inputs and prevent duplicate records
    const validation = await this.validateServiceUser(data);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // If initial placement is requested, validate the room availability first
    if (initialPlacement && initialPlacement.roomId) {
      const roomCheck = await this.getRoom(initialPlacement.roomId);
      if (!roomCheck.success || !roomCheck.data) {
        return { success: false, error: 'Selected accommodation room does not exist.' };
      }
      if (roomCheck.data.status === 'Under Maintenance' || roomCheck.data.status === 'Blocked') {
        return { success: false, error: `Selected Room ${roomCheck.data.roomNumber} is currently ${roomCheck.data.status} and cannot accept occupants.` };
      }
      const existingPlcs = await this.getPlacements({ propertyId: initialPlacement.propertyId, status: 'Active' });
      const activeInRoom = (existingPlcs.data || []).filter(p => p.roomId === initialPlacement.roomId);
      const cap = Number(roomCheck.data.capacity) || 1;
      if (activeInRoom.length >= cap) {
        return { success: false, error: `Selected Room ${roomCheck.data.roomNumber} is at maximum capacity (${cap} occupant(s)). Please select an available room.` };
      }
    }

    const suId = data.id || crypto.randomUUID();
    const suRef = data.suReference || this.generateReference('SU', Math.floor(Math.random() * 90000) + 1000);
    const suRecord: ServiceUserMaster = {
      id: suId,
      suReference: suRef,
      firstName: data.firstName!.trim(),
      middleName: data.middleName?.trim() || '',
      lastName: data.lastName!.trim(),
      preferredName: data.preferredName?.trim() || '',
      dateOfBirth: data.dateOfBirth,
      gender: data.gender || 'Not Specified',
      nationality: data.nationality || '',
      preferredLanguage: data.preferredLanguage || 'English',
      interpreterRequired: !!data.interpreterRequired,
      status: data.status || 'Active',
      externalReference: data.externalReference?.trim() || '',
      caseReference: data.caseReference?.trim() || '',
      referralDate: data.referralDate || new Date().toISOString().split('T')[0],
      arrivalDate: data.arrivalDate || new Date().toISOString().split('T')[0],
      siteId: initialPlacement?.siteId || data.siteId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const res = await apiService.saveEntityRecord<ServiceUserMaster>('serviceUsers', suRecord, {
      action: 'CREATE',
      module: 'Service User Management',
      targetItem: `${suRecord.suReference} (${suRecord.firstName} ${suRecord.lastName})`,
      details: `Created Service User ${suRecord.suReference} ${suRecord.firstName} ${suRecord.lastName}`
    });

    if (!res.success) return res;

    // Optional contact creation
    if (contact && (contact.mobile || contact.email || contact.emergencyContactName)) {
      await apiService.saveEntityRecord<ServiceUserContact>('suContacts', {
        id: crypto.randomUUID(),
        suId,
        mobile: contact.mobile?.trim() || '',
        alternativePhone: contact.alternativePhone?.trim() || '',
        email: contact.email?.trim() || '',
        preferredContactMethod: contact.preferredContactMethod || 'Mobile',
        emergencyContactName: contact.emergencyContactName?.trim() || '',
        emergencyContactRelationship: contact.emergencyContactRelationship?.trim() || '',
        emergencyContactPhone: contact.emergencyContactPhone?.trim() || '',
        emergencyContactEmail: contact.emergencyContactEmail?.trim() || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Optional household members
    if (household && household.length > 0) {
      for (const m of household) {
        if (m.name?.trim()) {
          await apiService.saveEntityRecord<ServiceUserHouseholdMember>('suHousehold', {
            id: crypto.randomUUID(),
            suId,
            name: m.name.trim(),
            relationship: m.relationship || 'Dependent',
            dateOfBirth: m.dateOfBirth,
            gender: m.gender || '',
            contact: m.contact?.trim() || '',
            notes: m.notes?.trim() || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    // Optional initial placement
    if (initialPlacement && initialPlacement.propertyId && initialPlacement.roomId && initialPlacement.siteId) {
      await this.createPlacement({
        suId,
        siteId: initialPlacement.siteId,
        propertyId: initialPlacement.propertyId,
        roomId: initialPlacement.roomId,
        startDate: initialPlacement.startDate || new Date().toISOString(),
        notes: initialPlacement.notes || 'Initial accommodation placement',
        status: 'Active'
      });
    }

    await this.logAudit('Create', 'service_users', suId, {}, suRecord);
    this.notifyMasterChange('serviceUsers', suRecord);
    return res;
  },

  async updateServiceUser(
    id: string, 
    data: Partial<ServiceUserMaster>,
    placementOptions?: {
      includeAccommodation: boolean;
      siteId?: string;
      propertyId?: string;
      roomId?: string;
      startDate?: string;
      notes?: string;
    }
  ): Promise<WriteResult<ServiceUserMaster>> {
    // Validate inputs
    const validation = await this.validateServiceUser(data, id);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const res = await apiService.updateEntityRecord<ServiceUserMaster>('serviceUsers', id, data, {
      action: 'UPDATE',
      module: 'Service User Management',
      targetItem: data.suReference || id,
      details: `Updated Service User details for ${data.suReference || id}`
    });

    if (!res.success) return res;

    // Handle deactivation / discharge: release active placements
    if (data.status === 'Inactive' || data.status === 'Discharged') {
      const activeRes = await this.getPlacements({ suId: id, status: 'Active' });
      if (activeRes.success && activeRes.data && activeRes.data.length > 0) {
        for (const plc of activeRes.data) {
          await this.endPlacement(plc.id, `Status updated to ${data.status}`);
        }
      }
    }

    // Handle accommodation updates from form if placementOptions is provided
    if (placementOptions) {
      const activePlcRes = await this.getPlacements({ suId: id, status: 'Active' });
      const currentPlc = activePlcRes.success && activePlcRes.data && activePlcRes.data.length > 0 ? activePlcRes.data[0] : null;

      if (!placementOptions.includeAccommodation) {
        // User deselected accommodation -> release current room if placed
        if (currentPlc) {
          await this.endPlacement(currentPlc.id, 'Accommodation removed by administrator');
        }
      } else if (placementOptions.siteId && placementOptions.propertyId && placementOptions.roomId) {
        if (currentPlc) {
          // If room or property changed, transfer to the new room
          if (currentPlc.roomId !== placementOptions.roomId || currentPlc.propertyId !== placementOptions.propertyId) {
            await this.moveServiceUser(
              id,
              placementOptions.siteId,
              placementOptions.propertyId,
              placementOptions.roomId,
              placementOptions.startDate || new Date().toISOString(),
              placementOptions.notes || 'Room reallocated during profile update'
            );
          }
        } else {
          // User previously had no placement, allocate now
          await this.createPlacement({
            suId: id,
            siteId: placementOptions.siteId,
            propertyId: placementOptions.propertyId,
            roomId: placementOptions.roomId,
            startDate: placementOptions.startDate || new Date().toISOString(),
            notes: placementOptions.notes || 'Accommodation allocated during profile update',
            status: 'Active'
          });
        }
      }
    }

    await this.logAudit('Update', 'service_users', id, {}, data);
    this.notifyMasterChange('serviceUsers', data);
    return res;
  },

  async deleteServiceUser(id: string, suRef?: string, userName?: string): Promise<WriteResult> {
    // 1. Release all active placements and update room occupancies
    const activePlcs = await this.getPlacements({ suId: id, status: 'Active' });
    if (activePlcs.success && activePlcs.data && activePlcs.data.length > 0) {
      for (const plc of activePlcs.data) {
        await this.endPlacement(plc.id, 'Service User deleted');
      }
    }

    // 2. Cascade delete child entities
    try {
      const contacts = await apiService.fetchEntityRecords('suContacts', { eq: { su_id: id } });
      for (const c of contacts.data || []) await apiService.deleteEntityRecord('suContacts', c.id);

      const household = await apiService.fetchEntityRecords('suHousehold', { eq: { su_id: id } });
      for (const h of household.data || []) await apiService.deleteEntityRecord('suHousehold', h.id);

      const support = await apiService.fetchEntityRecords('suSupport', { eq: { su_id: id } });
      for (const s of support.data || []) await apiService.deleteEntityRecord('suSupport', s.id);

      const docs = await apiService.fetchEntityRecords('suDocuments', { eq: { su_id: id } });
      for (const d of docs.data || []) await apiService.deleteEntityRecord('suDocuments', d.id);
    } catch (err) {
      console.warn('Error during child entity cleanup for service user:', err);
    }

    // 3. Delete master Service User record
    const res = await apiService.deleteEntityRecord('serviceUsers', id, {
      action: 'DELETE',
      module: 'Service User Management',
      targetItem: suRef || id,
      details: `Deleted Service User ${userName ? `${userName} (${suRef || id})` : (suRef || id)}`
    });

    if (res.success) {
      await this.logAudit('Delete', 'service_users', id, {}, { id });
      this.notifyMasterChange('serviceUsers', { id });
    }
    return res;
  },

  // ---------------------------------------------------------------------------
  // Properties Master
  // ---------------------------------------------------------------------------
  async getProperties(siteId?: string): Promise<{ success: boolean; data: PropertyMaster[]; error?: string }> {
    let resolvedSiteId = siteId;
    if (resolvedSiteId && resolvedSiteId !== 'all' && resolvedSiteId !== 'All Sites') {
      const match = INITIAL_SITES.find(s => s.name === resolvedSiteId || s.id === resolvedSiteId);
      if (match) resolvedSiteId = match.id;
    }
    const eq = resolvedSiteId && resolvedSiteId !== 'all' && resolvedSiteId !== 'All Sites' ? { site_id: resolvedSiteId } : undefined;
    return await apiService.fetchEntityRecords<PropertyMaster>('properties', {
      order: 'created_at.desc',
      eq
    });
  },

  async getProperty(id: string): Promise<{ success: boolean; data?: PropertyMaster; error?: string }> {
    const res = await apiService.fetchEntityRecords<PropertyMaster>('properties', {
      eq: { id },
      limit: 1
    });
    if (res.success && res.data && res.data.length > 0) {
      return { success: true, data: res.data[0] };
    }
    return { success: false, error: res.error || 'Property not found' };
  },

  async createProperty(data: Partial<PropertyMaster>): Promise<WriteResult<PropertyMaster>> {
    const id = data.id || crypto.randomUUID();
    const ref = data.propertyReference || this.generateReference('PROP', Math.floor(Math.random() * 90000) + 1000);
    const record: PropertyMaster = {
      id,
      propertyReference: ref,
      propertyName: data.propertyName || 'New Property',
      propertyType: data.propertyType || 'HMO',
      siteId: data.siteId,
      addressLine1: data.addressLine1 || '',
      addressLine2: data.addressLine2 || '',
      city: data.city || '',
      county: data.county || '',
      postcode: data.postcode || '',
      ownershipType: data.ownershipType || 'Leased',
      provider: data.provider || '',
      landlord: data.landlord || '',
      propertyManager: data.propertyManager || '',
      maximumOccupancy: Number(data.maximumOccupancy) || 0,
      bedrooms: Number(data.bedrooms) || 0,
      bathrooms: Number(data.bathrooms) || 0,
      numberOfFloors: Number(data.numberOfFloors) || 1,
      accessibilityInformation: data.accessibilityInformation || '',
      status: data.status || 'Active',
      startDate: data.startDate,
      endDate: data.endDate,
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const res = await apiService.saveEntityRecord<PropertyMaster>('properties', record, {
      action: 'CREATE',
      module: 'Property Management',
      targetItem: `${record.propertyReference} (${record.propertyName})`,
      details: `Created Property ${record.propertyReference} - ${record.propertyName}`
    });
    if (res.success) {
      await this.logAudit('Create', 'properties', id, {}, record);
      this.notifyMasterChange('properties', record);
    }
    return res;
  },

  async updateProperty(id: string, data: Partial<PropertyMaster>): Promise<WriteResult<PropertyMaster>> {
    const res = await apiService.updateEntityRecord<PropertyMaster>('properties', id, data, {
      action: 'UPDATE',
      module: 'Property Management',
      targetItem: data.propertyReference || id,
      details: `Updated Property details for ${data.propertyReference || id}`
    });
    if (res.success) {
      await this.logAudit('Update', 'properties', id, {}, data);
      this.notifyMasterChange('properties', data);
    }
    return res;
  },

  async deleteProperty(id: string, propRef?: string, propName?: string): Promise<WriteResult> {
    const res = await apiService.deleteEntityRecord('properties', id, {
      action: 'DELETE',
      module: 'Property Management',
      targetItem: propRef || id,
      details: `Deleted Property ${propRef || id}`
    });
    if (res.success) {
      await this.logAudit('Delete', 'properties', id, {}, { id });
      this.notifyMasterChange('properties', { id });

      // Cascade delete matching site record if present
      try {
        await apiService.deleteEntityRecord('sites', id, {
          action: 'DELETE',
          module: 'Property Management',
          targetItem: propRef || id,
          details: `Cascade deleted matching site for property ${propRef || id}`
        });
      } catch {
        // ignore if not present
      }

      // Dispatch global event so AppContext, dropdowns, and modules update state immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sdtracker:propertyDeleted', {
          detail: { id, propertyReference: propRef, propertyName: propName }
        }));
      }
    }
    return res;
  },

  // ---------------------------------------------------------------------------
  // Property Rooms
  // ---------------------------------------------------------------------------
  async getRooms(propertyId?: string): Promise<{ success: boolean; data: PropertyRoom[]; error?: string }> {
    const eq = propertyId ? { property_id: propertyId } : undefined;
    return await apiService.fetchEntityRecords<PropertyRoom>('propertyRooms', {
      order: 'room_number.asc',
      eq
    });
  },

  async getRoom(id: string): Promise<{ success: boolean; data?: PropertyRoom; error?: string }> {
    const res = await apiService.fetchEntityRecords<PropertyRoom>('propertyRooms', {
      eq: { id },
      limit: 1
    });
    if (res.success && res.data && res.data.length > 0) {
      return { success: true, data: res.data[0] };
    }
    return { success: false, error: res.error || 'Room not found' };
  },

  async createRoom(data: Partial<PropertyRoom>): Promise<WriteResult<PropertyRoom>> {
    const id = data.id || crypto.randomUUID();
    const ref = data.roomReference || this.generateReference('ROOM', Math.floor(Math.random() * 90000) + 1000);
    const record: PropertyRoom = {
      id,
      roomReference: ref,
      propertyId: data.propertyId!,
      roomNumber: data.roomNumber || '1',
      roomName: data.roomName || `Room ${data.roomNumber || '1'}`,
      roomType: data.roomType || 'Bedroom',
      floor: data.floor || 'Ground',
      capacity: Number(data.capacity) || 1,
      size: data.size || '',
      status: data.status || 'Available',
      occupancyStatus: data.occupancyStatus || 'Available',
      description: data.description || '',
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const res = await apiService.saveEntityRecord<PropertyRoom>('propertyRooms', record, {
      action: 'CREATE',
      module: 'Property Management',
      targetItem: `${record.roomReference} (${record.roomNumber})`,
      details: `Created Room ${record.roomReference} in Property ${record.propertyId}`
    });
    if (res.success) {
      await this.logAudit('Room Changes', 'property_rooms', id, {}, record);
    }
    return res;
  },

  async updateRoom(id: string, data: Partial<PropertyRoom>): Promise<WriteResult<PropertyRoom>> {
    const res = await apiService.updateEntityRecord<PropertyRoom>('propertyRooms', id, data, {
      action: 'UPDATE',
      module: 'Property Management',
      targetItem: data.roomReference || id,
      details: `Updated Room ${data.roomReference || id}`
    });
    if (res.success) {
      await this.logAudit('Room Changes', 'property_rooms', id, {}, data);
    }
    return res;
  },

  async syncRoomOccupancy(roomId: string): Promise<WriteResult<PropertyRoom>> {
    if (!roomId) return { success: false, error: 'Room ID is required to sync occupancy' };
    const roomRes = await this.getRoom(roomId);
    if (!roomRes.success || !roomRes.data) {
      return { success: false, error: 'Room not found for occupancy sync' };
    }
    const room = roomRes.data;

    // Placements currently active in this room
    const plcsRes = await this.getPlacements({ roomId, status: 'Active' });
    const activePlcs = (plcsRes.data || []).filter(p => (p.roomId === roomId || (p as any).room_id === roomId) && p.status === 'Active');
    const cap = Math.max(1, Number(room.capacity) || 1);

    let newStatus = room.status;
    let newOccupancyStatus = 'Available';

    if (room.status === 'Under Maintenance' || room.status === 'Blocked') {
      newOccupancyStatus = activePlcs.length > 0 ? (activePlcs.length >= cap ? 'Occupied' : 'Partially Occupied') : 'Available';
    } else {
      if (activePlcs.length === 0) {
        newStatus = 'Available';
        newOccupancyStatus = 'Available';
      } else if (activePlcs.length >= cap) {
        newStatus = 'Occupied';
        newOccupancyStatus = 'Occupied';
      } else {
        newStatus = 'Partially Occupied';
        newOccupancyStatus = 'Partially Occupied';
      }
    }

    const res = await this.updateRoom(roomId, {
      status: newStatus,
      occupancyStatus: newOccupancyStatus
    });

    this.notifyMasterChange('propertyRooms', { id: roomId, status: newStatus, occupancyStatus: newOccupancyStatus });
    return res;
  },

  async deleteRoom(id: string): Promise<WriteResult> {
    const res = await apiService.deleteEntityRecord('propertyRooms', id, {
      action: 'DELETE',
      module: 'Property Management',
      targetItem: id,
      details: `Deleted Room ${id}`
    });
    if (res.success) {
      await this.logAudit('Room Changes', 'property_rooms', id, {}, { id });
    }
    return res;
  },

  // ---------------------------------------------------------------------------
  // Placements & Occupancy Engine
  // ---------------------------------------------------------------------------
  async getPlacements(options?: { suId?: string; propertyId?: string; roomId?: string; siteId?: string; status?: string }): Promise<{ success: boolean; data: Placement[]; error?: string }> {
    const eq: Record<string, any> = {};
    if (options?.suId) eq.su_id = options.suId;
    if (options?.propertyId) eq.property_id = options.propertyId;
    if (options?.roomId) eq.room_id = options.roomId;
    if (options?.siteId && options.siteId !== 'all' && options.siteId !== 'All Sites') {
      const match = INITIAL_SITES.find(s => s.name === options.siteId || s.id === options.siteId);
      eq.site_id = match ? match.id : options.siteId;
    }
    if (options?.status) eq.status = options.status;

    return await apiService.fetchEntityRecords<Placement>('placements', {
      order: 'start_date.desc',
      eq: Object.keys(eq).length > 0 ? eq : undefined
    });
  },

  async createPlacement(data: Partial<Placement>): Promise<WriteResult<Placement>> {
    if (!data.suId || !data.siteId || !data.propertyId || !data.roomId) {
      return { success: false, error: 'Service User, Site, Property, and Room are all required for placement.' };
    }

    // 1. Validate target room status and capacity
    const roomRes = await this.getRoom(data.roomId);
    if (!roomRes.success || !roomRes.data) {
      return { success: false, error: 'Target room does not exist.' };
    }
    const room = roomRes.data;
    if (room.status === 'Under Maintenance' || room.status === 'Blocked') {
      return { success: false, error: `Room ${room.roomNumber} is currently ${room.status} and cannot accept occupants.` };
    }

    const currentPlcs = await this.getPlacements({ status: 'Active' });
    const activeInRoom = (currentPlcs.data || []).filter(p => p.roomId === data.roomId && p.suId !== data.suId);
    const capacity = Math.max(1, Number(room.capacity) || 1);
    if (activeInRoom.length >= capacity) {
      return { success: false, error: `Room ${room.roomNumber} has reached maximum capacity (${capacity} occupant(s)). Please select an available room.` };
    }

    // 2. Safely close any existing active placement for this SU (prevents conflicting/duplicate active placements)
    const existingUserPlcs = (currentPlcs.data || []).filter(p => p.suId === data.suId && p.id !== data.id);
    for (const oldPlc of existingUserPlcs) {
      await apiService.updateEntityRecord<Placement>('placements', oldPlc.id, {
        endDate: data.startDate || new Date().toISOString(),
        status: 'Completed',
        notes: `${oldPlc.notes || ''} [Closed: Reallocated to new room]`.trim()
      });
      if (oldPlc.roomId && oldPlc.roomId !== data.roomId) {
        await this.syncRoomOccupancy(oldPlc.roomId);
      }
    }

    // 3. Create new placement
    const id = data.id || crypto.randomUUID();
    const ref = data.placementReference || this.generateReference('PLC', Math.floor(Math.random() * 90000) + 1000);
    const record: Placement = {
      id,
      placementReference: ref,
      suId: data.suId,
      siteId: data.siteId,
      propertyId: data.propertyId,
      roomId: data.roomId,
      startDate: data.startDate || new Date().toISOString(),
      endDate: data.endDate,
      status: data.status || 'Active',
      placementType: data.placementType || 'Standard',
      reason: data.reason || 'Placement Created',
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const res = await apiService.saveEntityRecord<Placement>('placements', record, {
      action: 'CREATE',
      module: 'Placements',
      targetItem: record.placementReference,
      details: `Created Placement ${record.placementReference} for SU ${record.suId}`
    });

    if (res.success) {
      // Sync room occupancy based on new placement
      await this.syncRoomOccupancy(record.roomId);
      // Update SU site_id
      await this.updateServiceUser(record.suId, { siteId: record.siteId });
      await this.logAudit('Placement Changes', 'placements', id, {}, record);
      this.notifyMasterChange('placements', record);
    }

    return res;
  },

  async moveServiceUser(
    suId: string,
    newSiteId: string,
    newPropertyId: string,
    newRoomId: string,
    moveDate: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!suId || !newSiteId || !newPropertyId || !newRoomId) {
      return { success: false, error: 'Service User ID, Site, Property, and Room are required for relocation.' };
    }

    // 1. Verify target room capacity & status
    const targetRoomRes = await this.getRoom(newRoomId);
    if (!targetRoomRes.success || !targetRoomRes.data) {
      return { success: false, error: 'Target room does not exist.' };
    }
    const targetRoom = targetRoomRes.data;
    if (targetRoom.status === 'Under Maintenance' || targetRoom.status === 'Blocked') {
      return { success: false, error: `Target Room ${targetRoom.roomNumber} is currently ${targetRoom.status} and cannot accept occupants.` };
    }

    const currentPlcs = await this.getPlacements({ status: 'Active' });
    const activeInTarget = (currentPlcs.data || []).filter(p => p.roomId === newRoomId && p.suId !== suId);
    const capacity = Math.max(1, Number(targetRoom.capacity) || 1);
    if (activeInTarget.length >= capacity) {
      return { success: false, error: `Target Room ${targetRoom.roomNumber} has reached maximum capacity (${capacity} occupant(s)).` };
    }

    // 2. Find currently active placement for this SU
    const oldPlacements = (currentPlcs.data || []).filter(p => p.suId === suId);
    for (const oldPlacement of oldPlacements) {
      if (oldPlacement.roomId === newRoomId && oldPlacement.propertyId === newPropertyId) {
        return { success: false, error: 'Service User is already allocated to this room.' };
      }
      // Close old placement
      await apiService.updateEntityRecord<Placement>('placements', oldPlacement.id, {
        endDate: moveDate || new Date().toISOString(),
        status: 'Completed',
        notes: `${oldPlacement.notes || ''} [Closed on move: ${reason}]`.trim()
      });
      // Re-evaluate old room occupancy
      if (oldPlacement.roomId) {
        await this.syncRoomOccupancy(oldPlacement.roomId);
      }
      await this.logAudit('Placement Changes', 'placements', oldPlacement.id, oldPlacement, { status: 'Completed', endDate: moveDate });
    }

    // 3. Create new placement
    const createRes = await this.createPlacement({
      suId,
      siteId: newSiteId,
      propertyId: newPropertyId,
      roomId: newRoomId,
      startDate: moveDate || new Date().toISOString(),
      status: 'Active',
      reason,
      notes: `Transferred to room: ${reason}`
    });

    if (createRes.success) {
      await this.syncRoomOccupancy(newRoomId);
      await this.updateServiceUser(suId, { siteId: newSiteId });
      this.notifyMasterChange('serviceUsers', { id: suId, siteId: newSiteId });
      this.notifyMasterChange('placements');
    }

    return { success: createRes.success, error: createRes.error };
  },

  async endPlacement(placementId: string, reason = 'Placement ended', endDate?: string): Promise<WriteResult> {
    const plcsRes = await this.getPlacements();
    const plc = (plcsRes.data || []).find(p => p.id === placementId);
    if (!plc) return { success: false, error: 'Placement not found' };

    const effectiveEnd = endDate || new Date().toISOString();
    const res = await apiService.updateEntityRecord<Placement>('placements', placementId, {
      endDate: effectiveEnd,
      status: 'Completed',
      notes: `${plc.notes || ''} [Ended: ${reason}]`.trim()
    }, {
      action: 'UPDATE',
      module: 'Placements',
      targetItem: plc.placementReference,
      details: `Ended placement ${plc.placementReference} for SU ${plc.suId}`
    });

    if (res.success && plc.roomId) {
      await this.syncRoomOccupancy(plc.roomId);
      await this.logAudit('Placement Changes', 'placements', placementId, plc, { status: 'Completed', endDate: effectiveEnd });
      this.notifyMasterChange('placements', { id: placementId });
    }

    return res;
  },

  async deletePlacement(placementId: string): Promise<WriteResult> {
    const plcsRes = await this.getPlacements();
    const plc = (plcsRes.data || []).find(p => p.id === placementId);

    const res = await apiService.deleteEntityRecord('placements', placementId, {
      action: 'DELETE',
      module: 'Placements',
      targetItem: plc?.placementReference || placementId,
      details: `Deleted placement ${placementId}`
    });

    if (res.success && plc?.roomId) {
      await this.syncRoomOccupancy(plc.roomId);
      this.notifyMasterChange('placements', { id: placementId });
    }

    return res;
  },

  // ---------------------------------------------------------------------------
  // Master Audit Logger
  // ---------------------------------------------------------------------------
  async logAudit(action: string, entityType: string, entityId: string, oldValues: any, newValues: any): Promise<void> {
    try {
      const user = apiService.getAuditUserContext();
      await apiService.saveEntityRecord<MasterAuditLog>('auditLogs', {
        id: crypto.randomUUID(),
        userId: user?.userId,
        userName: user?.userName || 'Staff Member',
        action,
        entityType,
        entityId,
        oldValues: oldValues || {},
        newValues: newValues || {},
        createdAt: new Date().toISOString()
      });
    } catch {}
  }
};
