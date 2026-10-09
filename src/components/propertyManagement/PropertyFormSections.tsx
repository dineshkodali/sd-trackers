import React from 'react';
import { Building2, Home, MapPin, CheckCircle2 } from 'lucide-react';
import { SiteInfo } from '../../types';
import { useApp } from '../../context/AppContext';
import { getUserDropdownOptions } from '../../utils/userSelectOptions';

/* -------------------------------------------------------------------------- */
/* Section 1: Core & Address                                                  */
/* -------------------------------------------------------------------------- */
export const PropertyCoreSection: React.FC<{
  propertyName: string; setPropertyName: (v: string) => void;
  siteId: string; setSiteId: (v: string) => void; sites: SiteInfo[];
  propertyType: string; setPropertyType: (v: string) => void;
  status: string; setStatus: (v: any) => void;
  addressLine1: string; setAddressLine1: (v: string) => void;
  addressLine2: string; setAddressLine2: (v: string) => void;
  city: string; setCity: (v: string) => void;
  county: string; setCounty: (v: string) => void;
  postcode: string; setPostcode: (v: string) => void;
}> = ({
  propertyName, setPropertyName, siteId, setSiteId, sites,
  propertyType, setPropertyType, status, setStatus,
  addressLine1, setAddressLine1, addressLine2, setAddressLine2,
  city, setCity, county, setCounty, postcode, setPostcode
}) => (
  <div className="space-y-4">
    <div className="p-3.5 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs space-y-3">
      <h4 className="font-bold text-xs text-[#242424] flex items-center gap-1.5 pb-2 border-b border-[#f0f0f0]">
        <Building2 className="w-3.5 h-3.5 text-[#0d9488]" />
        <span>Core Identification</span>
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
            Property Name / Reference Label <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={propertyName}
            onChange={e => setPropertyName(e.target.value)}
            placeholder="e.g. 14 Elmfield Road"
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Assigned Site *</label>
          <select
            value={siteId}
            onChange={e => setSiteId(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
          >
            <option value="">-- Select Site --</option>
            {sites.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div>
          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Property Type</label>
          <select
            value={propertyType}
            onChange={e => setPropertyType(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
          >
            <option value="HMO">HMO (House in Multiple Occupation)</option>
            <option value="House">Single Dwelling House</option>
            <option value="Apartment">Self-contained Apartment / Flat</option>
            <option value="Hostel">Hostel / Temporary Shelter</option>
            <option value="Commercial">Commercial / Hotel</option>
            <option value="Emergency Accommodation">Emergency Accommodation Hub</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Operational Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
          >
            <option value="Active">Active / Operational</option>
            <option value="Under Maintenance">Under Maintenance</option>
            <option value="Inactive">Inactive / Pending</option>
            <option value="Archived">Archived / Decommissioned</option>
          </select>
        </div>
      </div>
    </div>

    <div className="p-3.5 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs space-y-3">
      <h4 className="font-bold text-xs text-[#242424] flex items-center gap-1.5 pb-2 border-b border-[#f0f0f0]">
        <MapPin className="w-3.5 h-3.5 text-[#0d9488]" />
        <span>Location &amp; Address</span>
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
            Address Line 1 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={addressLine1}
            onChange={e => setAddressLine1(e.target.value)}
            placeholder="e.g. 14 Elmfield Road"
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Address Line 2</label>
          <input
            type="text"
            value={addressLine2}
            onChange={e => setAddressLine2(e.target.value)}
            placeholder="e.g. Flat B / Building 2"
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Town / City *</label>
          <input
            type="text"
            required
            value={city}
            onChange={e => setCity(e.target.value)}
            placeholder="e.g. Manchester"
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">County</label>
          <input
            type="text"
            value={county}
            onChange={e => setCounty(e.target.value)}
            placeholder="e.g. Greater Manchester"
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Postcode *</label>
          <input
            type="text"
            required
            value={postcode}
            onChange={e => setPostcode(e.target.value.toUpperCase())}
            placeholder="e.g. M14 5TP"
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs font-mono focus:border-[#0d9488] outline-hidden"
          />
        </div>
      </div>
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */
/* Section 2: Ownership & Management                                          */
/* -------------------------------------------------------------------------- */
export const PropertyOwnershipSection: React.FC<{
  ownershipType: string; setOwnershipType: (v: string) => void;
  provider: string; setProvider: (v: string) => void;
  landlord: string; setLandlord: (v: string) => void;
  propertyManager: string; setPropertyManager: (v: string) => void;
  startDate: string; setStartDate: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
}> = ({
  ownershipType, setOwnershipType, provider, setProvider, landlord, setLandlord,
  propertyManager, setPropertyManager, startDate, setStartDate, endDate, setEndDate, notes, setNotes
}) => {
  const { users } = useApp();
  const userOptions = getUserDropdownOptions(users);

  return (
  <div className="p-3.5 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs space-y-3">
    <h4 className="font-bold text-xs text-[#242424] pb-2 border-b border-[#f0f0f0]">
      Ownership &amp; Lease Terms
    </h4>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Ownership / Tenure Type</label>
        <select
          value={ownershipType}
          onChange={e => setOwnershipType(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
        >
          <option value="Leased">Leased (Corporate Lease)</option>
          <option value="Freehold">Freehold / Company Owned</option>
          <option value="Managed">Managed Service Contract</option>
          <option value="Council Procured">Council Procured</option>
          <option value="Private Landlord">Private Landlord AST</option>
        </select>
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Housing Provider / Entity</label>
        <input
          type="text"
          value={provider}
          onChange={e => setProvider(e.target.value)}
          placeholder="e.g. Serco / Mears / Direct"
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Head Landlord / Owner Name</label>
        <input
          type="text"
          value={landlord}
          onChange={e => setLandlord(e.target.value)}
          placeholder="e.g. Oakridge Properties Ltd"
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Assigned Property Manager</label>
        <select
          value={propertyManager}
          onChange={e => setPropertyManager(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
        >
          <option value="">-- Select Property Manager / Staff --</option>
          {propertyManager && !userOptions.some(u => u.value === propertyManager) && (
            <option value={propertyManager}>{propertyManager} (Current)</option>
          )}
          {userOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Lease / Contract Start Date</label>
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Lease Expiry / Renewal Date</label>
        <input
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
        />
      </div>
    </div>
    <div>
      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Property Access / Keys &amp; Notes</label>
      <textarea
        rows={2}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Key safe code, bin schedule, entrance code, or emergency access..."
        className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
      />
    </div>
  </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Section 3: Capacity & Specifications                                       */
/* -------------------------------------------------------------------------- */
export const PropertySpecsSection: React.FC<{
  maximumOccupancy: number; setMaximumOccupancy: (v: number) => void;
  bedrooms: number; setBedrooms: (v: number) => void;
  bathrooms: number; setBathrooms: (v: number) => void;
  numberOfFloors: number; setNumberOfFloors: (v: number) => void;
  accessibilityInformation: string; setAccessibilityInformation: (v: string) => void;
}> = ({
  maximumOccupancy, setMaximumOccupancy, bedrooms, setBedrooms,
  bathrooms, setBathrooms, numberOfFloors, setNumberOfFloors,
  accessibilityInformation, setAccessibilityInformation
}) => (
  <div className="p-3.5 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs space-y-3">
    <h4 className="font-bold text-xs text-[#242424] pb-2 border-b border-[#f0f0f0]">
      Building Capacity &amp; Specs
    </h4>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div>
        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Total Bed Spaces *</label>
        <input
          type="number"
          min={1}
          value={maximumOccupancy}
          onChange={e => setMaximumOccupancy(Number(e.target.value))}
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden font-bold text-teal-800"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Bedrooms</label>
        <input
          type="number"
          min={1}
          value={bedrooms}
          onChange={e => setBedrooms(Number(e.target.value))}
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden font-semibold"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Bathrooms</label>
        <input
          type="number"
          min={1}
          value={bathrooms}
          onChange={e => setBathrooms(Number(e.target.value))}
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Floors</label>
        <input
          type="number"
          min={1}
          value={numberOfFloors}
          onChange={e => setNumberOfFloors(Number(e.target.value))}
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
        />
      </div>
    </div>
    <div className="pt-2">
      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
        Accessibility Features (Wheelchair, Step-free, Ground floor)
      </label>
      <input
        type="text"
        value={accessibilityInformation}
        onChange={e => setAccessibilityInformation(e.target.value)}
        placeholder="e.g. Ground floor bedroom available, ramp access at entrance, wide doors"
        className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
      />
    </div>
  </div>
);

export {
  type RoomSetupItem,
  type InitialDocItem,
  PropertyRoomsSetupSection,
  PropertyDocumentsUploadSection
} from './PropertyFormRoomsDocsSections';

export {
  type PropertyComplianceData,
  type PropertyContactsData,
  PropertyComplianceSection,
  PropertyFacilitiesSection,
  PropertyContactsSection,
  savePropertyRelatedData
} from './PropertyFormComplianceFacilitiesSections';

