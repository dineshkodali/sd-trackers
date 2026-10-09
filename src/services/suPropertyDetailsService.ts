import { apiService, WriteResult } from './apiService';
import {
  ServiceUserContact,
  ServiceUserHouseholdMember,
  ServiceUserSupportRecord,
  ServiceUserDocument,
  PropertyFacility,
  PropertyAsset,
  PropertyCompliance,
  PropertyDocument,
  PropertyContact,
  UnifiedActivityItem
} from '../types/masterData';
import { suPropertyService } from './suPropertyService';

export const suPropertyDetailsService = {
  // ---------------------------------------------------------------------------
  // SU Contacts, Household, Support, Documents
  // ---------------------------------------------------------------------------
  async getSUContacts(suId: string): Promise<ServiceUserContact[]> {
    const res = await apiService.fetchEntityRecords<ServiceUserContact>('suContacts', { eq: { su_id: suId } });
    return res.success && res.data ? res.data : [];
  },

  async saveSUContact(contact: ServiceUserContact): Promise<WriteResult<ServiceUserContact>> {
    return await apiService.saveEntityRecord<ServiceUserContact>('suContacts', contact, {
      action: 'UPDATE',
      module: 'Service Users',
      details: `Updated contact details for SU ${contact.suId}`
    });
  },

  async getSUHousehold(suId: string): Promise<ServiceUserHouseholdMember[]> {
    const res = await apiService.fetchEntityRecords<ServiceUserHouseholdMember>('suHousehold', { eq: { su_id: suId } });
    return res.success && res.data ? res.data : [];
  },

  async addSUHouseholdMember(member: Partial<ServiceUserHouseholdMember>): Promise<WriteResult<ServiceUserHouseholdMember>> {
    const record: ServiceUserHouseholdMember = {
      id: member.id || crypto.randomUUID(),
      suId: member.suId!,
      name: member.name || '',
      dateOfBirth: member.dateOfBirth,
      relationship: member.relationship || 'Dependent',
      gender: member.gender || '',
      contact: member.contact || '',
      notes: member.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return await apiService.saveEntityRecord<ServiceUserHouseholdMember>('suHousehold', record, {
      action: 'CREATE',
      module: 'Service Users',
      details: `Added household member ${record.name} for SU ${record.suId}`
    });
  },

  async deleteSUHouseholdMember(id: string): Promise<WriteResult> {
    return await apiService.deleteEntityRecord('suHousehold', id);
  },

  async getSUSupport(suId: string): Promise<ServiceUserSupportRecord[]> {
    const res = await apiService.fetchEntityRecords<ServiceUserSupportRecord>('suSupport', {
      eq: { su_id: suId },
      order: 'created_at.desc'
    });
    return res.success && res.data ? res.data : [];
  },

  async addSUSupport(record: Partial<ServiceUserSupportRecord>): Promise<WriteResult<ServiceUserSupportRecord>> {
    const data: ServiceUserSupportRecord = {
      id: record.id || crypto.randomUUID(),
      supportReference: record.supportReference || suPropertyService.generateReference('SUP', Math.floor(Math.random() * 90000)),
      suId: record.suId!,
      category: record.category || 'General Support',
      description: record.description || '',
      priority: record.priority || 'Medium',
      startDate: record.startDate || new Date().toISOString().split('T')[0],
      endDate: record.endDate,
      assignedStaff: record.assignedStaff || '',
      status: record.status || 'Open',
      notes: record.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return await apiService.saveEntityRecord<ServiceUserSupportRecord>('suSupport', data, {
      action: 'CREATE',
      module: 'Service Users',
      details: `Added support record ${data.supportReference} for SU ${data.suId}`
    });
  },

  async updateSUSupport(id: string, record: Partial<ServiceUserSupportRecord>): Promise<WriteResult<ServiceUserSupportRecord>> {
    return await apiService.updateEntityRecord<ServiceUserSupportRecord>('suSupport', id, record);
  },

  async getSUDocuments(suId: string): Promise<ServiceUserDocument[]> {
    const res = await apiService.fetchEntityRecords<ServiceUserDocument>('suDocuments', {
      eq: { su_id: suId },
      order: 'created_at.desc'
    });
    return res.success && res.data ? res.data : [];
  },

  async addSUDocument(doc: Partial<ServiceUserDocument>): Promise<WriteResult<ServiceUserDocument>> {
    const data: ServiceUserDocument = {
      id: doc.id || crypto.randomUUID(),
      suId: doc.suId!,
      documentType: doc.documentType || 'Identification',
      documentName: doc.documentName || 'Document',
      referenceNumber: doc.referenceNumber || '',
      issueDate: doc.issueDate,
      expiryDate: doc.expiryDate,
      verificationStatus: doc.verificationStatus || 'Pending',
      storageReference: doc.storageReference || '',
      fileUrl: doc.fileUrl || '',
      uploadedBy: doc.uploadedBy || 'Staff Member',
      notes: doc.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return await apiService.saveEntityRecord<ServiceUserDocument>('suDocuments', data, {
      action: 'CREATE',
      module: 'Service Users',
      details: `Uploaded document ${data.documentName} for SU ${data.suId}`
    });
  },

  async updateSUDocument(id: string, doc: Partial<ServiceUserDocument>): Promise<WriteResult<ServiceUserDocument>> {
    return await apiService.updateEntityRecord<ServiceUserDocument>('suDocuments', id, { ...doc, updatedAt: new Date().toISOString() });
  },

  async deleteSUDocument(id: string): Promise<WriteResult> {
    return await apiService.deleteEntityRecord('suDocuments', id);
  },

  // ---------------------------------------------------------------------------
  // Property Facilities, Assets, Compliance, Documents, Contacts
  // ---------------------------------------------------------------------------
  async getPropertyFacilities(propertyId: string): Promise<PropertyFacility[]> {
    const res = await apiService.fetchEntityRecords<PropertyFacility>('propertyFacilities', { eq: { property_id: propertyId } });
    return res.success && res.data ? res.data : [];
  },

  async savePropertyFacility(facility: Partial<PropertyFacility>): Promise<WriteResult<PropertyFacility>> {
    const data: PropertyFacility = {
      id: facility.id || crypto.randomUUID(),
      propertyId: facility.propertyId!,
      facilityName: facility.facilityName || '',
      facilityType: facility.facilityType || 'Amenity',
      isAvailable: facility.isAvailable !== false,
      details: facility.details || '',
      notes: facility.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return facility.id
      ? await apiService.updateEntityRecord<PropertyFacility>('propertyFacilities', facility.id, data)
      : await apiService.saveEntityRecord<PropertyFacility>('propertyFacilities', data);
  },

  async deletePropertyFacility(id: string): Promise<WriteResult> {
    return await apiService.deleteEntityRecord('propertyFacilities', id);
  },

  async getPropertyAssets(propertyId: string): Promise<PropertyAsset[]> {
    const res = await apiService.fetchEntityRecords<PropertyAsset>('propertyAssets', {
      eq: { property_id: propertyId },
      order: 'created_at.desc'
    });
    return res.success && res.data ? res.data : [];
  },

  async savePropertyAsset(asset: Partial<PropertyAsset>): Promise<WriteResult<PropertyAsset>> {
    const data: PropertyAsset = {
      id: asset.id || crypto.randomUUID(),
      assetReference: asset.assetReference || suPropertyService.generateReference('AST', Math.floor(Math.random() * 90000)),
      propertyId: asset.propertyId!,
      roomId: asset.roomId,
      category: asset.category || 'Furniture',
      assetName: asset.assetName || 'New Asset',
      serialNumber: asset.serialNumber || '',
      quantity: Number(asset.quantity) || 1,
      condition: asset.condition || 'Good',
      purchaseDate: asset.purchaseDate,
      warrantyExpiry: asset.warrantyExpiry,
      status: asset.status || 'Active',
      notes: asset.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return asset.id
      ? await apiService.updateEntityRecord<PropertyAsset>('propertyAssets', asset.id, data)
      : await apiService.saveEntityRecord<PropertyAsset>('propertyAssets', data);
  },

  async deletePropertyAsset(id: string): Promise<WriteResult> {
    return await apiService.deleteEntityRecord('propertyAssets', id);
  },

  async getPropertyCompliance(propertyId: string): Promise<PropertyCompliance[]> {
    const res = await apiService.fetchEntityRecords<PropertyCompliance>('propertyCompliance', {
      eq: { property_id: propertyId },
      order: 'expiry_date.asc'
    });
    return res.success && res.data ? res.data : [];
  },

  async savePropertyCompliance(item: Partial<PropertyCompliance>): Promise<WriteResult<PropertyCompliance>> {
    const data: PropertyCompliance = {
      id: item.id || crypto.randomUUID(),
      complianceReference: item.complianceReference || suPropertyService.generateReference('CMP', Math.floor(Math.random() * 90000)),
      propertyId: item.propertyId!,
      type: item.type || 'Gas Safety',
      certificateNumber: item.certificateNumber || '',
      inspectionDate: item.inspectionDate,
      expiryDate: item.expiryDate,
      provider: item.provider || '',
      status: item.status || 'Valid',
      documentId: item.documentId,
      notes: item.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return item.id
      ? await apiService.updateEntityRecord<PropertyCompliance>('propertyCompliance', item.id, data)
      : await apiService.saveEntityRecord<PropertyCompliance>('propertyCompliance', data);
  },

  async deletePropertyCompliance(id: string): Promise<WriteResult> {
    return await apiService.deleteEntityRecord('propertyCompliance', id);
  },

  async getPropertyDocuments(propertyId: string): Promise<PropertyDocument[]> {
    const res = await apiService.fetchEntityRecords<PropertyDocument>('propertyDocuments', {
      eq: { property_id: propertyId },
      order: 'created_at.desc'
    });
    return res.success && res.data ? res.data : [];
  },

  async savePropertyDocument(doc: Partial<PropertyDocument>): Promise<WriteResult<PropertyDocument>> {
    const data: PropertyDocument = {
      id: doc.id || crypto.randomUUID(),
      propertyId: doc.propertyId!,
      documentType: doc.documentType || 'Lease / Tenancy',
      documentName: doc.documentName || 'Document',
      referenceNumber: doc.referenceNumber || '',
      fileUrl: doc.fileUrl || '',
      issueDate: doc.issueDate,
      expiryDate: doc.expiryDate,
      verificationStatus: doc.verificationStatus || 'Pending',
      uploadedBy: doc.uploadedBy || 'Staff Member',
      notes: doc.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return await apiService.saveEntityRecord<PropertyDocument>('propertyDocuments', data);
  },

  async updatePropertyDocument(id: string, doc: Partial<PropertyDocument>): Promise<WriteResult<PropertyDocument>> {
    return await apiService.updateEntityRecord<PropertyDocument>('propertyDocuments', id, { ...doc, updatedAt: new Date().toISOString() });
  },

  async deletePropertyDocument(id: string): Promise<WriteResult> {
    return await apiService.deleteEntityRecord('propertyDocuments', id);
  },

  async getPropertyContacts(propertyId: string): Promise<PropertyContact[]> {
    const res = await apiService.fetchEntityRecords<PropertyContact>('propertyContacts', { eq: { property_id: propertyId } });
    return res.success && res.data ? res.data : [];
  },

  async savePropertyContact(contact: Partial<PropertyContact>): Promise<WriteResult<PropertyContact>> {
    const data: PropertyContact = {
      id: contact.id || crypto.randomUUID(),
      propertyId: contact.propertyId!,
      name: contact.name || '',
      organisation: contact.organisation || '',
      role: contact.role || '',
      phone: contact.phone || '',
      email: contact.email || '',
      contactType: contact.contactType || 'Landlord',
      notes: contact.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return contact.id
      ? await apiService.updateEntityRecord<PropertyContact>('propertyContacts', contact.id, data)
      : await apiService.saveEntityRecord<PropertyContact>('propertyContacts', data);
  },

  async deletePropertyContact(id: string): Promise<WriteResult> {
    return await apiService.deleteEntityRecord('propertyContacts', id);
  },

  // ---------------------------------------------------------------------------
  // Unified SU Activity Timeline Aggregator (Section 36 & 37)
  // ---------------------------------------------------------------------------
  async getUnifiedSUActivity(suId: string, portRef?: string): Promise<UnifiedActivityItem[]> {
    const items: UnifiedActivityItem[] = [];

    try {
      // 1. Placements
      const plcRes = await apiService.fetchEntityRecords<any>('placements', { eq: { su_id: suId } });
      if (plcRes.success && plcRes.data) {
        plcRes.data.forEach(p => {
          items.push({
            id: `plc-${p.id}`,
            type: 'Placement',
            title: `Placement ${p.status || 'Active'}`,
            description: `${p.placementType || 'Standard'} placement — ${p.reason || 'Accommodation assigned'}`,
            date: p.startDate || p.createdAt || '',
            status: p.status,
            badgeClass: 'bg-indigo-100 text-indigo-800'
          });
        });
      }

      // 2. Welfare Checks (by su_id OR portReference)
      const wRes = await apiService.fetchEntityRecords<any>('welfareChecks', {
        eq: { su_id: suId },
        limit: 50
      });
      let wList = (wRes.success && wRes.data) ? wRes.data : [];
      if (wList.length === 0 && portRef) {
        const wPortRes = await apiService.fetchEntityRecords<any>('welfareChecks', {
          eq: { port_reference: portRef },
          limit: 50
        });
        if (wPortRes.success && wPortRes.data) wList = wPortRes.data;
      }
      wList.forEach(w => {
        items.push({
          id: `welfare-${w.id}`,
          type: 'Welfare Check',
          title: `Welfare Check — ${w.status || 'Completed'}`,
          description: `${w.locationType || 'In Person'} check by ${w.officerName || 'Staff Member'}`,
          date: w.checkDatetime || w.createdAt || '',
          actor: w.officerName,
          status: w.status,
          badgeClass: 'bg-rose-100 text-rose-800'
        });
      });

      // 3. Food Surveys
      const fRes = await apiService.fetchEntityRecords<any>('foodSurveys', {
        eq: { su_id: suId },
        limit: 50
      });
      let fList = (fRes.success && fRes.data) ? fRes.data : [];
      if (fList.length === 0 && portRef) {
        const fPortRes = await apiService.fetchEntityRecords<any>('foodSurveys', {
          eq: { port_reference: portRef },
          limit: 50
        });
        if (fPortRes.success && fPortRes.data) fList = fPortRes.data;
      }
      fList.forEach(f => {
        items.push({
          id: `food-${f.id}`,
          type: 'Food Survey',
          title: `Food Survey Feedback Submitted`,
          description: `Overall rating: ${f.overallFoodRating || f.overallFoodQuality || 'Rated'} by ${f.houseOfficerName || 'Officer'}`,
          date: f.createdAt || '',
          actor: f.houseOfficerName,
          badgeClass: 'bg-emerald-100 text-emerald-800'
        });
      });

      // 4. Room Checks
      const rRes = await apiService.fetchEntityRecords<any>('roomChecks', {
        eq: { su_id: suId },
        limit: 50
      });
      let rList = (rRes.success && rRes.data) ? rRes.data : [];
      rList.forEach(r => {
        items.push({
          id: `room-${r.id}`,
          type: 'Room Check',
          title: `Room Check — ${r.overallStatus || 'Passed'}`,
          description: `Inspection for Room ${r.roomNumber || ''} by ${r.officerName || 'Officer'}`,
          date: r.inspectionDate || r.createdAt || '',
          actor: r.officerName,
          status: r.overallStatus,
          badgeClass: 'bg-cyan-100 text-cyan-800'
        });
      });

      // 5. Support Records
      const sRes = await apiService.fetchEntityRecords<any>('suSupport', { eq: { su_id: suId } });
      if (sRes.success && sRes.data) {
        sRes.data.forEach(s => {
          items.push({
            id: `sup-${s.id}`,
            type: 'Support',
            title: `Support: ${s.category}`,
            description: `${s.description} (Priority: ${s.priority || 'Medium'})`,
            date: s.startDate || s.createdAt || '',
            actor: s.assignedStaff,
            status: s.status,
            badgeClass: 'bg-purple-100 text-purple-800'
          });
        });
      }

      // 6. Documents
      const dRes = await apiService.fetchEntityRecords<any>('suDocuments', { eq: { su_id: suId } });
      if (dRes.success && dRes.data) {
        dRes.data.forEach(d => {
          items.push({
            id: `doc-${d.id}`,
            type: 'Document',
            title: `Document Uploaded: ${d.documentName}`,
            description: `Type: ${d.documentType} (Status: ${d.verificationStatus || 'Pending'})`,
            date: d.createdAt || '',
            actor: d.uploadedBy,
            status: d.verificationStatus,
            badgeClass: 'bg-amber-100 text-amber-800'
          });
        });
      }
    } catch {}

    // Sort descending by date
    return items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }
};
