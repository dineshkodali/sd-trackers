import React, { useState, useEffect } from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { suPropertyService } from '../../services/suPropertyService';
import { suPropertyDetailsService } from '../../services/suPropertyDetailsService';
import { useApp } from '../../context/AppContext';
import { PropertyMaster } from '../../types/masterData';
import { 
  PropertyCoreSection, 
  PropertyOwnershipSection, 
  PropertySpecsSection, 
  PropertyRoomsSetupSection,
  PropertyDocumentsUploadSection,
  PropertyComplianceSection,
  PropertyFacilitiesSection,
  PropertyContactsSection,
  RoomSetupItem,
  InitialDocItem,
  PropertyComplianceData,
  PropertyContactsData,
  savePropertyRelatedData
} from './PropertyFormSections';
import { PropertyFormHeader, PropertyTabType } from './PropertyFormHeader';

interface PropertyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyToEdit?: PropertyMaster | null;
  onSuccess: () => void;
}

export const PropertyFormModal: React.FC<PropertyFormModalProps> = ({
  isOpen,
  onClose,
  propertyToEdit,
  onSuccess
}) => {
  const { sites, updateProperty, addProperty } = useApp();
  const [activeTab, setActiveTab] = useState<PropertyTabType>('core');

  // Core & Address
  const [propertyName, setPropertyName] = useState('');
  const [propertyType, setPropertyType] = useState('HMO');
  const [siteId, setSiteId] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [county, setCounty] = useState('');
  const [postcode, setPostcode] = useState('');
  const [status, setStatus] = useState<PropertyMaster['status']>('Active');

  // Ownership & Lease
  const [ownershipType, setOwnershipType] = useState('Leased');
  const [provider, setProvider] = useState('');
  const [landlord, setLandlord] = useState('');
  const [propertyManager, setPropertyManager] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  // Capacity & Specs
  const [maximumOccupancy, setMaximumOccupancy] = useState(6);
  const [bedrooms, setBedrooms] = useState(4);
  const [bathrooms, setBathrooms] = useState(2);
  const [numberOfFloors, setNumberOfFloors] = useState(2);
  const [accessibilityInformation, setAccessibilityInformation] = useState('');

  // Initial Rooms Setup
  const [initialRooms, setInitialRooms] = useState<RoomSetupItem[]>([]);

  // Compliance Data
  const [complianceData, setComplianceData] = useState<PropertyComplianceData>({
    epcRating: 'C',
    epcExpiry: '',
    gasCertRef: '',
    gasExpiry: '',
    eicrRef: '',
    eicrExpiry: '',
    hmoLicenseRef: '',
    hmoExpiry: '',
    fireRiskDate: '',
    fireRiskExpiry: ''
  });

  // Facilities
  const [facilities, setFacilities] = useState<string[]>(['WiFi', 'Heating', 'Kitchen', 'Laundry']);

  // Key Contacts
  const [contactsData, setContactsData] = useState<PropertyContactsData>({
    housingOfficerName: '',
    housingOfficerPhone: '',
    housingOfficerEmail: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    contractorName: '',
    contractorPhone: ''
  });

  // Initial Document Attachments
  const [initialDocs, setInitialDocs] = useState<InitialDocItem[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const autoGenerateRooms = () => {
    const count = bedrooms || 4;
    const generated: RoomSetupItem[] = [];
    for (let i = 1; i <= count; i++) {
      generated.push({
        id: crypto.randomUUID(),
        roomNumber: String(i),
        roomName: `Room ${i}`,
        floor: i <= 2 ? 'Ground' : 'First',
        roomType: 'Bedroom',
        capacity: 1
      });
    }
    setInitialRooms(generated);
  };

  const handleComplianceChange = (field: keyof PropertyComplianceData, val: string) => {
    setComplianceData(prev => ({ ...prev, [field]: val }));
  };

  const handleToggleFacility = (id: string) => {
    setFacilities(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const handleContactsChange = (field: keyof PropertyContactsData, val: string) => {
    setContactsData(prev => ({ ...prev, [field]: val }));
  };

  useEffect(() => {
    if (isOpen) {
      if (propertyToEdit) {
        setPropertyName(propertyToEdit.propertyName);
        setPropertyType(propertyToEdit.propertyType || 'HMO');
        setSiteId(propertyToEdit.siteId || '');
        setAddressLine1(propertyToEdit.addressLine1 || '');
        setAddressLine2(propertyToEdit.addressLine2 || '');
        setCity(propertyToEdit.city || '');
        setCounty(propertyToEdit.county || '');
        setPostcode(propertyToEdit.postcode || '');
        setOwnershipType(propertyToEdit.ownershipType || 'Leased');
        setProvider(propertyToEdit.provider || '');
        setLandlord(propertyToEdit.landlord || '');
        setPropertyManager(propertyToEdit.propertyManager || '');
        setMaximumOccupancy(propertyToEdit.maximumOccupancy || 6);
        setBedrooms(propertyToEdit.bedrooms || 4);
        setBathrooms(propertyToEdit.bathrooms || 2);
        setNumberOfFloors(propertyToEdit.numberOfFloors || 2);
        setAccessibilityInformation(propertyToEdit.accessibilityInformation || '');
        setStatus(propertyToEdit.status || 'Active');
        setStartDate(propertyToEdit.startDate ? propertyToEdit.startDate.split('T')[0] : '');
        setEndDate(propertyToEdit.endDate ? propertyToEdit.endDate.split('T')[0] : '');
        setNotes(propertyToEdit.notes || '');

        // Load existing rooms
        suPropertyService.getRooms(propertyToEdit.id).then(rRes => {
          if (rRes.success && rRes.data) {
            const validRoomTypes = new Set(['Bedroom', 'Living Room', 'Kitchen', 'Bathroom', 'Other']);
            setInitialRooms(rRes.data.map(r => ({
              id: r.id,
              roomNumber: r.roomNumber,
              roomName: r.roomName || `Room ${r.roomNumber}`,
              floor: r.floor || 'Ground',
              roomType: (validRoomTypes.has(r.roomType) ? r.roomType : 'Other') as RoomSetupItem['roomType'],
              capacity: r.capacity || 1
            })));
          }
        });

        // Load compliance & contacts
        Promise.all([
          suPropertyDetailsService.getPropertyCompliance(propertyToEdit.id),
          suPropertyDetailsService.getPropertyFacilities(propertyToEdit.id),
          suPropertyDetailsService.getPropertyContacts(propertyToEdit.id)
        ]).then(([compList, facList, ctList]) => {
          if (compList && compList.length > 0) {
            const gas = compList.find(c => c.type === 'Gas Safety');
            const epc = compList.find(c => c.type === 'EPC');
            const eicr = compList.find(c => c.type === 'Electrical (EICR)');
            const hmo = compList.find(c => c.type === 'HMO License');
            setComplianceData(prev => ({
              ...prev,
              gasCertRef: gas?.certificateNumber || '',
              gasExpiry: gas?.expiryDate ? gas.expiryDate.split('T')[0] : '',
              epcRating: epc?.certificateNumber || 'C',
              epcExpiry: epc?.expiryDate ? epc.expiryDate.split('T')[0] : '',
              eicrRef: eicr?.certificateNumber || '',
              eicrExpiry: eicr?.expiryDate ? eicr.expiryDate.split('T')[0] : '',
              hmoLicenseRef: hmo?.certificateNumber || '',
              hmoExpiry: hmo?.expiryDate ? hmo.expiryDate.split('T')[0] : ''
            }));
          }
          if (facList && facList.length > 0) {
            setFacilities(facList.map(f => f.facilityName));
          }
          if (ctList && ctList.length > 0) {
            const officer = ctList.find(c => c.contactType === 'Property Manager' || c.role?.includes('Officer'));
            const emerg = ctList.find(c => c.contactType === 'Emergency' || c.role?.includes('Emergency'));
            const cont = ctList.find(c => c.contactType === 'Contractor' || c.role?.includes('Maintenance'));
            setContactsData(prev => ({
              ...prev,
              housingOfficerName: officer?.name || '',
              housingOfficerPhone: officer?.phone || '',
              emergencyContactName: emerg?.name || '',
              emergencyContactPhone: emerg?.phone || '',
              contractorName: cont?.name || '',
              contractorPhone: cont?.phone || ''
            }));
          }
        });

        setInitialDocs([]);
      } else {
        setPropertyName('');
        setPropertyType('HMO');
        setSiteId(sites[0]?.id || '');
        setAddressLine1('');
        setAddressLine2('');
        setCity('');
        setCounty('');
        setPostcode('');
        setOwnershipType('Leased');
        setProvider('');
        setLandlord('');
        setPropertyManager('');
        setMaximumOccupancy(6);
        setBedrooms(4);
        setBathrooms(2);
        setNumberOfFloors(2);
        setAccessibilityInformation('');
        setStatus('Active');
        setStartDate(new Date().toISOString().split('T')[0]);
        setEndDate('');
        setNotes('');
        setInitialDocs([]);
        setInitialRooms([
          { id: crypto.randomUUID(), roomNumber: '1', roomName: 'Room 1', floor: 'Ground', roomType: 'Bedroom', capacity: 1 },
          { id: crypto.randomUUID(), roomNumber: '2', roomName: 'Room 2', floor: 'Ground', roomType: 'Bedroom', capacity: 1 },
          { id: crypto.randomUUID(), roomNumber: '3', roomName: 'Room 3', floor: 'First', roomType: 'Bedroom', capacity: 2 },
          { id: crypto.randomUUID(), roomNumber: '4', roomName: 'Room 4', floor: 'First', roomType: 'Bedroom', capacity: 2 }
        ]);
        setFacilities(['WiFi', 'Heating', 'Kitchen', 'Laundry']);
      }
      setActiveTab('core');
      setErrorMsg('');
    }
  }, [isOpen, propertyToEdit, sites]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyName.trim()) {
      setErrorMsg('Property name is required.');
      setActiveTab('core');
      return;
    }
    if (!addressLine1.trim() || !city.trim() || !postcode.trim()) {
      setErrorMsg('Address Line 1, City, and Postcode are required.');
      setActiveTab('core');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const data: Partial<PropertyMaster> = {
        propertyName: propertyName.trim(),
        propertyType,
        siteId: siteId || undefined,
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim(),
        city: city.trim(),
        county: county.trim(),
        postcode: postcode.trim(),
        ownershipType,
        provider: provider.trim(),
        landlord: landlord.trim(),
        propertyManager: propertyManager.trim() || contactsData.housingOfficerName.trim(),
        maximumOccupancy: Number(maximumOccupancy) || 0,
        bedrooms: Number(bedrooms) || 0,
        bathrooms: Number(bathrooms) || 0,
        numberOfFloors: Number(numberOfFloors) || 1,
        accessibilityInformation: accessibilityInformation.trim(),
        status,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        notes: notes.trim()
      };

      let targetPropId = propertyToEdit?.id;

      if (propertyToEdit) {
        const res = await suPropertyService.updateProperty(propertyToEdit.id, data);
        if (!res.success) throw new Error(res.error || 'Failed to update property.');
      } else {
        const res = await suPropertyService.createProperty(data);
        if (!res.success || !res.record) throw new Error(res.error || 'Failed to create property.');
        targetPropId = res.record.id;
      }

      // Synchronize changes with Properties Directory (sites in AppContext)
      const targetManager = data.propertyManager || '';
      const matchingSite = sites.find(s =>
        (siteId && s.id === siteId) ||
        (propertyToEdit && (
          s.id === propertyToEdit.id ||
          s.id === propertyToEdit.siteId ||
          (propertyToEdit.id && s.id === propertyToEdit.id.replace('prop-', 'site-')) ||
          (propertyToEdit.id && propertyToEdit.id === s.id.replace('site-', 'prop-')) ||
          (propertyToEdit.propertyName && s.name.toLowerCase().trim() === propertyToEdit.propertyName.toLowerCase().trim()) ||
          (propertyToEdit.propertyReference && s.pid && s.pid.toLowerCase().trim() === propertyToEdit.propertyReference.toLowerCase().trim())
        )) ||
        (data.propertyName && s.name.toLowerCase().trim() === data.propertyName.toLowerCase().trim())
      );

      if (matchingSite) {
        updateProperty(matchingSite.id, {
          leadOfficer: targetManager,
          name: data.propertyName || matchingSite.name,
          city: data.city || matchingSite.city,
          address: data.addressLine1 || matchingSite.address,
          status: data.status === 'Under Maintenance' ? 'Under Maintenance' : 'Active',
          capacity: Number(data.maximumOccupancy) || matchingSite.capacity
        });
      } else if (data.propertyName) {
        addProperty({
          name: data.propertyName,
          pid: (propertyToEdit as any)?.propertyReference || (data as any).propertyReference || data.propertyName.slice(0, 8),
          city: data.city || 'London',
          address: data.addressLine1 || '',
          capacity: Number(data.maximumOccupancy) || 10,
          status: data.status === 'Under Maintenance' ? 'Under Maintenance' : 'Active',
          leadOfficer: targetManager,
          contactNumber: contactsData.housingOfficerPhone || ''
        });
      }

      if (targetPropId) {
        const effectiveContacts: PropertyContactsData = {
          ...contactsData,
          housingOfficerName: contactsData.housingOfficerName.trim() || targetManager
        };
        await savePropertyRelatedData(
          targetPropId,
          initialRooms,
          complianceData,
          effectiveContacts,
          initialDocs,
          suPropertyService,
          suPropertyDetailsService
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving property.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xs border border-[#e5e5e5] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <PropertyFormHeader
          propertyToEdit={propertyToEdit}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          roomCount={initialRooms.length}
          docCount={initialDocs.length}
          facilitiesCount={facilities.length}
          onClose={onClose}
        />

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {errorMsg && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'core' && (
            <PropertyCoreSection
              propertyName={propertyName} setPropertyName={setPropertyName}
              siteId={siteId} setSiteId={setSiteId} sites={sites}
              propertyType={propertyType} setPropertyType={setPropertyType}
              status={status} setStatus={setStatus}
              addressLine1={addressLine1} setAddressLine1={setAddressLine1}
              addressLine2={addressLine2} setAddressLine2={setAddressLine2}
              city={city} setCity={setCity}
              county={county} setCounty={setCounty}
              postcode={postcode} setPostcode={setPostcode}
            />
          )}

          {activeTab === 'ownership' && (
            <PropertyOwnershipSection
              ownershipType={ownershipType} setOwnershipType={setOwnershipType}
              provider={provider} setProvider={setProvider}
              landlord={landlord} setLandlord={setLandlord}
              propertyManager={propertyManager} setPropertyManager={setPropertyManager}
              startDate={startDate} setStartDate={setStartDate}
              endDate={endDate} setEndDate={setEndDate}
              notes={notes} setNotes={setNotes}
            />
          )}

          {activeTab === 'specs' && (
            <PropertySpecsSection
              maximumOccupancy={maximumOccupancy} setMaximumOccupancy={setMaximumOccupancy}
              bedrooms={bedrooms} setBedrooms={setBedrooms}
              bathrooms={bathrooms} setBathrooms={setBathrooms}
              numberOfFloors={numberOfFloors} setNumberOfFloors={setNumberOfFloors}
              accessibilityInformation={accessibilityInformation} setAccessibilityInformation={setAccessibilityInformation}
            />
          )}

          {activeTab === 'rooms' && (
            <PropertyRoomsSetupSection
              initialRooms={initialRooms}
              setInitialRooms={setInitialRooms}
              onAutoGenerate={autoGenerateRooms}
            />
          )}

          {activeTab === 'compliance' && (
            <PropertyComplianceSection
              data={complianceData}
              onChange={handleComplianceChange}
            />
          )}

          {activeTab === 'facilities' && (
            <PropertyFacilitiesSection
              facilities={facilities}
              onToggleFacility={handleToggleFacility}
            />
          )}

          {activeTab === 'contacts' && (
            <PropertyContactsSection
              contacts={contactsData}
              onChange={handleContactsChange}
            />
          )}

          {activeTab === 'documents' && (
            <PropertyDocumentsUploadSection
              initialDocs={initialDocs}
              setInitialDocs={setInitialDocs}
            />
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[#f0f0f0]">
            <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0d9488]" />
              <span>Centralised Property Master Data (8 Modules)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 border border-[#8a8886] text-[#323130] bg-white hover:bg-[#f3f2f1] rounded-xs font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : propertyToEdit ? 'Save Changes' : 'Create Property Master'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
