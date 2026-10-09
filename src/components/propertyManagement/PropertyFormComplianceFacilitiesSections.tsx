import React from 'react';
import { ShieldCheck, Wifi, Phone, Wrench, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getUserDropdownOptions } from '../../utils/userSelectOptions';

export interface PropertyComplianceData {
  epcRating: string;
  epcExpiry: string;
  gasCertRef: string;
  gasExpiry: string;
  eicrRef: string;
  eicrExpiry: string;
  hmoLicenseRef: string;
  hmoExpiry: string;
  fireRiskDate: string;
  fireRiskExpiry: string;
}

export const PropertyComplianceSection: React.FC<{
  data: PropertyComplianceData;
  onChange: (field: keyof PropertyComplianceData, val: string) => void;
}> = ({ data, onChange }) => (
  <div className="p-3.5 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs space-y-4">
    <div className="flex items-center justify-between pb-2 border-b border-[#f0f0f0]">
      <h4 className="font-bold text-xs text-[#242424] flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-[#0d9488]" />
        <span>Statutory Compliance &amp; Safety Certificates</span>
      </h4>
      <span className="text-[10px] text-neutral-400">All certificates audit-logged</span>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      {/* EPC */}
      <div className="p-2.5 bg-white border border-[#e5e5e5] rounded-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-neutral-800">Energy Performance (EPC)</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-teal-50 text-teal-800 rounded font-semibold">Required</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-neutral-500 mb-0.5">Rating</label>
            <select
              value={data.epcRating}
              onChange={e => onChange('epcRating', e.target.value)}
              className="w-full px-2 py-1 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs text-xs font-bold"
            >
              <option value="">Select...</option>
              {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(r => (
                <option key={r} value={r}>Rating {r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-neutral-500 mb-0.5">Expiry Date</label>
            <input
              type="date"
              value={data.epcExpiry}
              onChange={e => onChange('epcExpiry', e.target.value)}
              className="w-full px-2 py-1 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs text-xs"
            />
          </div>
        </div>
      </div>

      {/* Gas Safety */}
      <div className="p-2.5 bg-white border border-[#e5e5e5] rounded-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-neutral-800">Gas Safety (CP12)</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-amber-50 text-amber-800 rounded font-semibold">Annual</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-neutral-500 mb-0.5">Cert Ref Number</label>
            <input
              type="text"
              value={data.gasCertRef}
              onChange={e => onChange('gasCertRef', e.target.value)}
              placeholder="e.g. GS-2026-9021"
              className="w-full px-2 py-1 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] text-neutral-500 mb-0.5">Renewal Expiry</label>
            <input
              type="date"
              value={data.gasExpiry}
              onChange={e => onChange('gasExpiry', e.target.value)}
              className="w-full px-2 py-1 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs text-xs"
            />
          </div>
        </div>
      </div>

      {/* Electrical EICR */}
      <div className="p-2.5 bg-white border border-[#e5e5e5] rounded-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-neutral-800">Electrical Installation (EICR)</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-800 rounded font-semibold">5-Year</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-neutral-500 mb-0.5">Report / Cert Ref</label>
            <input
              type="text"
              value={data.eicrRef}
              onChange={e => onChange('eicrRef', e.target.value)}
              placeholder="e.g. EICR-88421"
              className="w-full px-2 py-1 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] text-neutral-500 mb-0.5">Expiry Date</label>
            <input
              type="date"
              value={data.eicrExpiry}
              onChange={e => onChange('eicrExpiry', e.target.value)}
              className="w-full px-2 py-1 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs text-xs"
            />
          </div>
        </div>
      </div>

      {/* HMO License */}
      <div className="p-2.5 bg-white border border-[#e5e5e5] rounded-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-neutral-800">Local Authority HMO License</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-purple-50 text-purple-800 rounded font-semibold">Statutory</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-neutral-500 mb-0.5">HMO License No.</label>
            <input
              type="text"
              value={data.hmoLicenseRef}
              onChange={e => onChange('hmoLicenseRef', e.target.value)}
              placeholder="e.g. HMO-LBH-2024"
              className="w-full px-2 py-1 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] text-neutral-500 mb-0.5">License Expiry</label>
            <input
              type="date"
              value={data.hmoExpiry}
              onChange={e => onChange('hmoExpiry', e.target.value)}
              className="w-full px-2 py-1 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const PropertyFacilitiesSection: React.FC<{
  facilities: string[];
  onToggleFacility: (facilityName: string) => void;
}> = ({ facilities, onToggleFacility }) => {
  const options = [
    { id: 'WiFi', label: 'High-speed WiFi / Internet', desc: 'Active broadband router available for residents' },
    { id: 'CCTV', label: '24/7 CCTV Security', desc: 'External cameras and communal entrance monitoring' },
    { id: 'Heating', label: 'Central Heating System', desc: 'Automated thermostat & serviced radiators' },
    { id: 'Kitchen', label: 'Fitted Kitchen & Dining', desc: 'Communal kitchen with cookers, fridges & microwaves' },
    { id: 'Laundry', label: 'On-site Laundry / Washing', desc: 'Washing machines and dryers available for SUs' },
    { id: 'Garden', label: 'Private Garden / Outdoor Space', desc: 'Enclosed patio or garden area' },
    { id: 'Parking', label: 'Off-street Parking', desc: 'Designated parking bays for staff/visitors' },
    { id: 'Accessibility', label: 'Step-free / Wheelchair Access', desc: 'Ramps, wide doors, ground floor bathrooms' }
  ];

  return (
    <div className="p-3.5 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-[#f0f0f0]">
        <h4 className="font-bold text-xs text-[#242424] flex items-center gap-1.5">
          <Wifi className="w-3.5 h-3.5 text-[#0d9488]" />
          <span>Facilities &amp; Amenities Configuration</span>
        </h4>
        <span className="text-[11px] text-teal-800 font-semibold">{facilities.length} active</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {options.map(opt => {
          const isSelected = facilities.includes(opt.id);
          return (
            <div
              key={opt.id}
              onClick={() => onToggleFacility(opt.id)}
              className={`p-2.5 rounded-xs border transition-all cursor-pointer flex items-start gap-2.5 ${
                isSelected
                  ? 'bg-white border-[#0d9488] shadow-2xs'
                  : 'bg-white/60 border-[#e5e5e5] hover:border-neutral-400'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                className="mt-0.5 text-[#0d9488] rounded-xs focus:ring-0 cursor-pointer"
              />
              <div>
                <p className="font-semibold text-xs text-neutral-800">{opt.label}</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">{opt.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export interface PropertyContactsData {
  housingOfficerName: string;
  housingOfficerPhone: string;
  housingOfficerEmail: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  contractorName: string;
  contractorPhone: string;
}

export const PropertyContactsSection: React.FC<{
  contacts: PropertyContactsData;
  onChange: (field: keyof PropertyContactsData, val: string) => void;
}> = ({ contacts, onChange }) => {
  const { users } = useApp();
  const userOptions = getUserDropdownOptions(users);

  return (
  <div className="p-3.5 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs space-y-4">
    <div className="flex items-center justify-between pb-2 border-b border-[#f0f0f0]">
      <h4 className="font-bold text-xs text-[#242424] flex items-center gap-1.5">
        <Phone className="w-3.5 h-3.5 text-[#0d9488]" />
        <span>Operational &amp; Emergency Contacts</span>
      </h4>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Housing Officer */}
      <div className="p-2.5 bg-white border border-[#e5e5e5] rounded-xs space-y-2">
        <h5 className="font-bold text-[11px] text-teal-800">Assigned Housing Officer</h5>
        <div>
          <label className="block text-[10px] text-neutral-500 mb-0.5">Name</label>
          <select
            value={contacts.housingOfficerName}
            onChange={e => onChange('housingOfficerName', e.target.value)}
            className="w-full px-2 py-1 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs text-xs"
          >
            <option value="">-- Select Housing Officer --</option>
            {contacts.housingOfficerName && !userOptions.some(u => u.value === contacts.housingOfficerName) && (
              <option value={contacts.housingOfficerName}>{contacts.housingOfficerName} (Current)</option>
            )}
            {userOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-neutral-500 mb-0.5">Direct Phone</label>
          <input
            type="text"
            value={contacts.housingOfficerPhone}
            onChange={e => onChange('housingOfficerPhone', e.target.value)}
            placeholder="07123 456789"
            className="w-full px-2 py-1 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs text-xs"
          />
        </div>
      </div>

      {/* Emergency Contact */}
      <div className="p-2.5 bg-white border border-[#e5e5e5] rounded-xs space-y-2">
        <h5 className="font-bold text-[11px] text-red-800">24/7 Out of Hours Emergency</h5>
        <div>
          <label className="block text-[10px] text-neutral-500 mb-0.5">Contact / Service Name</label>
          <input
            type="text"
            value={contacts.emergencyContactName}
            onChange={e => onChange('emergencyContactName', e.target.value)}
            placeholder="e.g. SDC Control Room"
            className="w-full px-2 py-1 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs text-xs"
          />
        </div>
        <div>
          <label className="block text-[10px] text-neutral-500 mb-0.5">Emergency Hotline</label>
          <input
            type="text"
            value={contacts.emergencyContactPhone}
            onChange={e => onChange('emergencyContactPhone', e.target.value)}
            placeholder="0800 123 4567"
            className="w-full px-2 py-1 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs text-xs"
          />
        </div>
      </div>

      {/* Maintenance Contractor */}
      <div className="p-2.5 bg-white border border-[#e5e5e5] rounded-xs space-y-2">
        <h5 className="font-bold text-[11px] text-amber-800">Primary Maintenance Contractor</h5>
        <div>
          <label className="block text-[10px] text-neutral-500 mb-0.5">Contractor Company</label>
          <input
            type="text"
            value={contacts.contractorName}
            onChange={e => onChange('contractorName', e.target.value)}
            placeholder="e.g. Apex Property Repairs"
            className="w-full px-2 py-1 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs text-xs"
          />
        </div>
        <div>
          <label className="block text-[10px] text-neutral-500 mb-0.5">Work Phone</label>
          <input
            type="text"
            value={contacts.contractorPhone}
            onChange={e => onChange('contractorPhone', e.target.value)}
            placeholder="020 7946 0192"
            className="w-full px-2 py-1 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs text-xs"
          />
        </div>
      </div>
    </div>
  </div>
  );
};

export async function savePropertyRelatedData(
  targetPropId: string,
  initialRooms: any[],
  complianceData: PropertyComplianceData,
  contactsData: PropertyContactsData,
  initialDocs: any[],
  suPropertyService: any,
  suPropertyDetailsService: any
) {
  // Rooms
  const existingRoomRes = await suPropertyService.getRooms(targetPropId);
  const existingNumbers = new Set((existingRoomRes.data || []).map((r: any) => r.roomNumber));
  for (const r of initialRooms) {
    if (r.roomNumber && !existingNumbers.has(r.roomNumber.trim())) {
      await suPropertyService.createRoom({
        propertyId: targetPropId,
        roomNumber: r.roomNumber.trim(),
        roomName: r.roomName || `Room ${r.roomNumber}`,
        roomType: r.roomType || 'Bedroom',
        floor: r.floor || 'Ground',
        capacity: Number(r.capacity) || 1,
        status: 'Available',
        occupancyStatus: 'Available'
      });
    }
  }

  // Compliance
  if (complianceData.gasCertRef || complianceData.gasExpiry) {
    await suPropertyDetailsService.savePropertyCompliance({
      propertyId: targetPropId, type: 'Gas Safety',
      certificateNumber: complianceData.gasCertRef,
      expiryDate: complianceData.gasExpiry || undefined, status: 'Valid'
    });
  }
  if (complianceData.epcRating || complianceData.epcExpiry) {
    await suPropertyDetailsService.savePropertyCompliance({
      propertyId: targetPropId, type: 'EPC',
      certificateNumber: complianceData.epcRating,
      expiryDate: complianceData.epcExpiry || undefined, status: 'Valid'
    });
  }
  if (complianceData.eicrRef || complianceData.eicrExpiry) {
    await suPropertyDetailsService.savePropertyCompliance({
      propertyId: targetPropId, type: 'Electrical (EICR)',
      certificateNumber: complianceData.eicrRef,
      expiryDate: complianceData.eicrExpiry || undefined, status: 'Valid'
    });
  }
  if (complianceData.hmoLicenseRef || complianceData.hmoExpiry) {
    await suPropertyDetailsService.savePropertyCompliance({
      propertyId: targetPropId, type: 'HMO License',
      certificateNumber: complianceData.hmoLicenseRef,
      expiryDate: complianceData.hmoExpiry || undefined, status: 'Valid'
    });
  }

  // Contacts
  if (contactsData.housingOfficerName) {
    await suPropertyDetailsService.savePropertyContact({
      propertyId: targetPropId, name: contactsData.housingOfficerName,
      phone: contactsData.housingOfficerPhone, role: 'Housing Officer', contactType: 'Property Manager'
    });
  }
  if (contactsData.emergencyContactName) {
    await suPropertyDetailsService.savePropertyContact({
      propertyId: targetPropId, name: contactsData.emergencyContactName,
      phone: contactsData.emergencyContactPhone, role: '24/7 Emergency', contactType: 'Emergency'
    });
  }
  if (contactsData.contractorName) {
    await suPropertyDetailsService.savePropertyContact({
      propertyId: targetPropId, name: contactsData.contractorName,
      phone: contactsData.contractorPhone, role: 'Repairs & Maintenance', contactType: 'Contractor'
    });
  }

  // Docs
  for (const doc of initialDocs) {
    await suPropertyDetailsService.savePropertyDocument({
      propertyId: targetPropId, documentType: doc.documentType,
      documentName: doc.documentName, referenceNumber: doc.referenceNumber,
      fileUrl: doc.fileUrl, verificationStatus: 'Verified', notes: 'Attached via Property Form'
    });
  }
}

