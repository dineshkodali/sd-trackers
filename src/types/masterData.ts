/**
 * SDTracker - Centralised Service User & Property Management Master Types
 */

export interface ServiceUserMaster {
  id: string;
  suReference: string; // Human readable: e.g. SU-000001
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  preferredLanguage?: string;
  interpreterRequired?: boolean;
  status: 'Active' | 'Inactive' | 'Discharged' | 'Pending';
  externalReference?: string; // Port Ref / Home Office Ref
  caseReference?: string;
  referralDate?: string;
  arrivalDate?: string;
  siteId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceUserContact {
  id: string;
  suId: string;
  mobile?: string;
  alternativePhone?: string;
  email?: string;
  preferredContactMethod?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  emergencyContactEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceUserHouseholdMember {
  id: string;
  suId: string;
  name: string;
  dateOfBirth?: string;
  relationship: string;
  gender?: string;
  contact?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceUserSupportRecord {
  id: string;
  supportReference?: string;
  suId: string;
  category: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  startDate?: string;
  endDate?: string;
  assignedStaff?: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceUserDocument {
  id: string;
  suId: string;
  documentType: string;
  documentName: string;
  referenceNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  verificationStatus: 'Verified' | 'Pending' | 'Expired' | 'Rejected';
  storageReference?: string;
  fileUrl?: string;
  uploadedBy?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PropertyMaster {
  id: string;
  propertyReference: string; // Human readable: e.g. PROP-000001
  propertyName: string;
  propertyType: string;
  siteId?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  ownershipType?: string;
  provider?: string;
  landlord?: string;
  propertyManager?: string;
  maximumOccupancy: number;
  bedrooms: number;
  bathrooms: number;
  numberOfFloors: number;
  accessibilityInformation?: string;
  status: 'Active' | 'Inactive' | 'Under Maintenance' | 'Archived';
  startDate?: string;
  endDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PropertyRoom {
  id: string;
  roomReference: string; // Human readable: e.g. ROOM-000001
  propertyId: string;
  roomNumber: string;
  roomName?: string;
  roomType: string;
  floor?: string;
  capacity: number;
  size?: string;
  status: string;
  occupancyStatus: string;
  description?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PropertyFacility {
  id: string;
  propertyId: string;
  facilityName: string;
  facilityType?: string;
  isAvailable: boolean;
  details?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PropertyAsset {
  id: string;
  assetReference: string; // Human readable: e.g. AST-000001
  propertyId: string;
  roomId?: string;
  category: string;
  assetName: string;
  serialNumber?: string;
  quantity: number;
  condition: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Needs Replacement';
  purchaseDate?: string;
  warrantyExpiry?: string;
  status: 'Active' | 'In Repair' | 'Retired';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PropertyCompliance {
  id: string;
  complianceReference?: string;
  propertyId: string;
  type: string;
  certificateNumber?: string;
  inspectionDate?: string;
  expiryDate?: string;
  provider?: string;
  status: 'Valid' | 'Expiring Soon' | 'Expired' | 'Missing';
  documentId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PropertyDocument {
  id: string;
  propertyId: string;
  documentType: string;
  documentName: string;
  referenceNumber?: string;
  fileUrl?: string;
  issueDate?: string;
  expiryDate?: string;
  verificationStatus: 'Verified' | 'Pending' | 'Expired';
  uploadedBy?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PropertyContact {
  id: string;
  propertyId: string;
  name: string;
  organisation?: string;
  role?: string;
  phone?: string;
  email?: string;
  contactType: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Placement {
  id: string;
  placementReference: string; // Human readable: e.g. PLC-000001
  suId: string;
  siteId: string;
  propertyId: string;
  roomId: string;
  startDate: string;
  endDate?: string;
  status: 'Active' | 'Completed' | 'Cancelled' | 'Transferred';
  placementType?: string;
  reason?: string;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MasterAuditLog {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  createdAt: string;
}

export interface UnifiedActivityItem {
  id: string;
  type: 'Welfare Check' | 'Food Survey' | 'Room Check' | 'Incident' | 'Maintenance' | 'Complaint' | 'Document' | 'Support' | 'Placement' | 'Note' | 'Communication';
  title: string;
  description: string;
  date: string;
  actor?: string;
  status?: string;
  badgeClass?: string;
}
