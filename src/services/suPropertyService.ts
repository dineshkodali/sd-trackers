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
    const suId = data.id || crypto.randomUUID();
    const suRef = data.suReference || this.generateReference('SU', Math.floor(Math.random() * 90000) + 1000);
    const suRecord: ServiceUserMaster = {
      id: suId,
      suReference: suRef,
      firstName: data.firstName || '',
      middleName: data.middleName || '',
      lastName: data.lastName || '',
      preferredName: data.preferredName || '',
      dateOfBirth: data.dateOfBirth,
      gender: data.gender || 'Not Specified',
      nationality: data.nationality || '',
      preferredLanguage: data.preferredLanguage || 'English',
      interpreterRequired: !!data.interpreterRequired,
      status: data.status || 'Active',
      externalReference: data.externalReference || '',
      caseReference: data.caseReference || '',
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
        mobile: contact.mobile || '',
        alternativePhone: contact.alternativePhone || '',
        email: contact.email || '',
        preferredContactMethod: contact.preferredContactMethod || 'Mobile',
        emergencyContactName: contact.emergencyContactName || '',
        emergencyContactRelationship: contact.emergencyContactRelationship || '',
        emergencyContactPhone: contact.emergencyContactPhone || '',
        emergencyContactEmail: contact.emergencyContactEmail || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Optional household members
    if (household && household.length > 0) {
      for (const m of household) {
        if (m.name) {
          await apiService.saveEntityRecord<ServiceUserHouseholdMember>('suHousehold', {
            id: crypto.randomUUID(),
            suId,
            name: m.name,
            relationship: m.relationship || 'Dependent',
            dateOfBirth: m.dateOfBirth,
            gender: m.gender || '',
            contact: m.contact || '',
            notes: m.notes || '',
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

  async updateServiceUser(id: string, data: Partial<ServiceUserMaster>): Promise<WriteResult<ServiceUserMaster>> {
    const res = await apiService.updateEntityRecord<ServiceUserMaster>('serviceUsers', id, data, {
      action: 'UPDATE',
      module: 'Service User Management',
      targetItem: data.suReference || id,
      details: `Updated Service User details for ${data.suReference || id}`
    });
    if (res.success) {
      await this.logAudit('Update', 'service_users', id, {}, data);
      this.notifyMasterChange('serviceUsers', data);
    }
    return res;
  },

  async deleteServiceUser(id: string, suRef?: string): Promise<WriteResult> {
    const res = await apiService.deleteEntityRecord('serviceUsers', id, {
      action: 'DELETE',
      module: 'Service User Management',
      targetItem: suRef || id,
      details: `Deleted Service User ${suRef || id}`
    });
    if (res.success) {
      await this.logAudit('Delete', 'service_users', id, {}, { id });
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
  async getPlacements(options?: { suId?: string; propertyId?: string; siteId?: string; status?: string }): Promise<{ success: boolean; data: Placement[]; error?: string }> {
    const eq: Record<string, any> = {};
    if (options?.suId) eq.su_id = options.suId;
    if (options?.propertyId) eq.property_id = options.propertyId;
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
    const id = data.id || crypto.randomUUID();
    const ref = data.placementReference || this.generateReference('PLC', Math.floor(Math.random() * 90000) + 1000);
    const record: Placement = {
      id,
      placementReference: ref,
      suId: data.suId!,
      siteId: data.siteId!,
      propertyId: data.propertyId!,
      roomId: data.roomId!,
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
      // Update room occupancy to Occupied
      await this.updateRoom(record.roomId, {
        status: 'Occupied',
        occupancyStatus: 'Occupied'
      });
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
    // 1. Find currently active placement for this SU
    const activeRes = await this.getPlacements({ suId, status: 'Active' });
    if (activeRes.success && activeRes.data && activeRes.data.length > 0) {
      const oldPlacement = activeRes.data[0];
      // Close old placement
      await apiService.updateEntityRecord<Placement>('placements', oldPlacement.id, {
        endDate: moveDate || new Date().toISOString(),
        status: 'Completed',
        notes: `${oldPlacement.notes || ''} [Closed on move: ${reason}]`.trim()
      });
      // Mark old room as Available
      if (oldPlacement.roomId) {
        await this.updateRoom(oldPlacement.roomId, {
          status: 'Available',
          occupancyStatus: 'Available'
        });
      }
      await this.logAudit('Placement Changes', 'placements', oldPlacement.id, oldPlacement, { status: 'Completed', endDate: moveDate });
    }

    // 2. Create new placement
    const createRes = await this.createPlacement({
      suId,
      siteId: newSiteId,
      propertyId: newPropertyId,
      roomId: newRoomId,
      startDate: moveDate || new Date().toISOString(),
      status: 'Active',
      reason,
      notes: `Transferred to room`
    });

    if (createRes.success) {
      await this.updateServiceUser(suId, { siteId: newSiteId });
      this.notifyMasterChange('serviceUsers', { id: suId, siteId: newSiteId });
      this.notifyMasterChange('placements');
    }

    return { success: createRes.success, error: createRes.error };
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
