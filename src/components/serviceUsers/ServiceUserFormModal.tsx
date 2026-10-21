import React, { useState, useEffect } from 'react';
import { X, User, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { suPropertyService } from '../../services/suPropertyService';
import { suPropertyDetailsService } from '../../services/suPropertyDetailsService';
import { ServiceUserMaster, PropertyMaster, PropertyRoom, ServiceUserDocument } from '../../types/masterData';
import { PersonalSection, ContactSection } from './ServiceUserPersonalContactSections';
import { HouseholdSection, AccommodationSection } from './ServiceUserPlacementHouseholdSections';
import { ServiceUserFormHeader, SUTabType } from './ServiceUserFormHeader';
import { ServiceUserFormFooter } from './ServiceUserFormFooter';
import { pickActivePlacement, activePlacementBySu } from '../../utils/placementSelection';
import { 
  SUSupportNeedsSection, 
  SUDocumentsUploadSection, 
  saveSUAdditionalDetails 
} from './ServiceUserSupportDocsSections';

interface ServiceUserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceUserToEdit?: ServiceUserMaster | null;
  onSuccess: () => void;
}

export const ServiceUserFormModal: React.FC<ServiceUserFormModalProps> = ({
  isOpen,
  onClose,
  serviceUserToEdit,
  onSuccess
}) => {
  const { sites, canAccessAllSites, allowedSites, isSitePermitted } = useApp();

  const permittedSites = React.useMemo(() => {
    if (canAccessAllSites()) return sites;
    return sites.filter(s => isSitePermitted(s.name, 'all') || isSitePermitted(s.id, 'all'));
  }, [sites, canAccessAllSites, isSitePermitted]);

  const [roomOccupancy, setRoomOccupancy] = useState<Record<string, number>>({});
  const [originalRoomId, setOriginalRoomId] = useState('');
  const [activeTab, setActiveTab] = useState<SUTabType>('personal');

  // Personal Information
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('Male');
  const [nationality, setNationality] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [interpreterRequired, setInterpreterRequired] = useState(false);
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Discharged' | 'Pending'>('Active');

  // Reference Information
  const [externalReference, setExternalReference] = useState('');
  const [caseReference, setCaseReference] = useState('');
  const [referralDate, setReferralDate] = useState(new Date().toISOString().split('T')[0]);
  const [arrivalDate, setArrivalDate] = useState(new Date().toISOString().split('T')[0]);

  // Contact Information
  const [mobile, setMobile] = useState('');
  const [alternativePhone, setAlternativePhone] = useState('');
  const [email, setEmail] = useState('');
  const [preferredContactMethod, setPreferredContactMethod] = useState('Mobile');

  // Emergency Contact
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyEmail, setEmergencyEmail] = useState('');

  // Household Members
  const [householdMembers, setHouseholdMembers] = useState<Array<{ name: string; dateOfBirth?: string; relationship: string; gender?: string; contact?: string }>>([]);

  // Accommodation
  const [siteId, setSiteId] = useState('');
  const [properties, setProperties] = useState<PropertyMaster[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [rooms, setRooms] = useState<PropertyRoom[]>([]);
  const [roomId, setRoomId] = useState('');

  // Support & Needs
  const [vulnerabilityFlags, setVulnerabilityFlags] = useState('');
  const [dietaryNeeds, setDietaryNeeds] = useState('');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [mobilityNeeds, setMobilityNeeds] = useState('');
  const [supportPriority, setSupportPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [assignedStaff, setAssignedStaff] = useState('');

  // Documents
  const [existingDocuments, setExistingDocuments] = useState<ServiceUserDocument[]>([]);
  const [newDocs, setNewDocs] = useState<Array<{ type: string; name: string; fileUrl: string; fileName: string }>>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const resetForm = () => {
    setFirstName(''); setMiddleName(''); setLastName(''); setPreferredName('');
    setDateOfBirth(''); setGender('Male'); setNationality(''); setPreferredLanguage('English');
    setInterpreterRequired(false); setStatus('Active'); setExternalReference(''); setCaseReference('');
    const today = new Date().toISOString().split('T')[0];
    setReferralDate(today); setArrivalDate(today);
    setMobile(''); setAlternativePhone(''); setEmail(''); setPreferredContactMethod('Mobile');
    setEmergencyName(''); setEmergencyRelationship(''); setEmergencyPhone(''); setEmergencyEmail('');
    setHouseholdMembers([]); setSiteId(permittedSites[0]?.id || sites[0]?.id || '');
    setVulnerabilityFlags(''); setDietaryNeeds(''); setMedicalConditions(''); setMobilityNeeds('');
    setSupportPriority('Medium'); setAssignedStaff('');
    setExistingDocuments([]); setNewDocs([]);
  };

  useEffect(() => {
    if (isOpen) {
      if (serviceUserToEdit) {
        setFirstName(serviceUserToEdit.firstName);
        setMiddleName(serviceUserToEdit.middleName || '');
        setLastName(serviceUserToEdit.lastName);
        setPreferredName(serviceUserToEdit.preferredName || '');
        setDateOfBirth(serviceUserToEdit.dateOfBirth || '');
        setGender(serviceUserToEdit.gender || 'Male');
        setNationality(serviceUserToEdit.nationality || '');
        setPreferredLanguage(serviceUserToEdit.preferredLanguage || 'English');
        setInterpreterRequired(!!serviceUserToEdit.interpreterRequired);
        setStatus(serviceUserToEdit.status || 'Active');
        setExternalReference(serviceUserToEdit.externalReference || '');
        setCaseReference(serviceUserToEdit.caseReference || '');
        setReferralDate(serviceUserToEdit.referralDate || '');
        setArrivalDate(serviceUserToEdit.arrivalDate || '');
        setSiteId(serviceUserToEdit.siteId || '');

        // Preload contact, household, placement, support, and documents
        Promise.all([
          suPropertyDetailsService.getSUContacts(serviceUserToEdit.id),
          suPropertyDetailsService.getSUHousehold(serviceUserToEdit.id),
          suPropertyService.getPlacements({ suId: serviceUserToEdit.id, status: 'Active' }),
          suPropertyDetailsService.getSUSupport(serviceUserToEdit.id),
          suPropertyDetailsService.getSUDocuments(serviceUserToEdit.id)
        ]).then(([cts, hhRes, plcRes, spRes, docRes]) => {
          if (cts && cts.length > 0) {
            const ct = cts[0];
            setMobile(ct.mobile || ''); setAlternativePhone(ct.alternativePhone || '');
            setEmail(ct.email || ''); setPreferredContactMethod(ct.preferredContactMethod || 'Mobile');
            setEmergencyName(ct.emergencyContactName || ''); setEmergencyRelationship(ct.emergencyContactRelationship || '');
            setEmergencyPhone(ct.emergencyContactPhone || ''); setEmergencyEmail(ct.emergencyContactEmail || '');
          }
          if (hhRes && hhRes.length > 0) {
            setHouseholdMembers(hhRes.map(h => ({
              name: h.name, relationship: h.relationship, dateOfBirth: h.dateOfBirth, gender: h.gender, contact: h.contact
            })));
          }
          if (plcRes.success && plcRes.data && plcRes.data.length > 0) {
            const plc = pickActivePlacement(plcRes.data) || plcRes.data[0];
            setOriginalRoomId(plc.roomId || '');
            setSiteId(plc.siteId || serviceUserToEdit.siteId || '');
            setPropertyId(plc.propertyId);
            setRoomId(plc.roomId);
          }
          if (spRes && spRes.length > 0) {
            const sp = spRes[0];
            setSupportPriority((sp.priority as any) || 'Medium');
            setAssignedStaff(sp.assignedStaff || '');
            setVulnerabilityFlags(sp.description || '');
          }
          if (docRes && docRes.length > 0) {
            setExistingDocuments(docRes);
          }
        });
      } else {
        resetForm();
      }
      setActiveTab('personal');
      setErrorMsg('');
    }
  }, [isOpen, serviceUserToEdit, sites]);

  useEffect(() => {
    async function loadProps() {
      if (!siteId) return;
      const res = await suPropertyService.getProperties(siteId);
      if (res.success && res.data) {
        setProperties(res.data);
        if (res.data.length > 0 && !propertyId) setPropertyId(res.data[0].id);
      }
    }
    loadProps();
  }, [siteId]);

  useEffect(() => {
    async function loadRooms() {
      if (!propertyId) { setRooms([]); return; }
      const [res, plcsRes] = await Promise.all([
        suPropertyService.getRooms(propertyId),
        suPropertyService.getPlacements({ propertyId, status: 'Active' })
      ]);
      if (res.success && res.data) {
        const activePlcs = plcsRes.success && plcsRes.data ? plcsRes.data : [];
        const occ: Record<string, number> = {};
        // Count each resident once, in their newest placement only
        activePlacementBySu(activePlcs).forEach(p => { occ[p.roomId] = (occ[p.roomId] || 0) + 1; });
        setRoomOccupancy(occ);

        // Every room of the property is listed (full ones are shown but cannot be chosen). A room is never
        // picked for the user: a previously chosen room that belongs to another property is simply cleared.
        setRooms(res.data);
        setRoomId(prev => (prev && res.data.some(r => r.id === prev) ? prev : ''));
      }
    }
    loadRooms();
  }, [propertyId, serviceUserToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg('First name and last name are required.');
      setActiveTab('personal');
      return;
    }

    if (siteId) {
      const selectedSite = sites.find(s => s.id === siteId || s.name === siteId);
      const siteName = selectedSite?.name || siteId;
      if (!canAccessAllSites() && !isSitePermitted(siteName, 'all')) {
        setErrorMsg(`You do not have permission to register or place service users for site: ${siteName}`);
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const contactData = {
        mobile: mobile.trim(), alternativePhone: alternativePhone.trim(), email: email.trim(),
        preferredContactMethod, emergencyContactName: emergencyName.trim(),
        emergencyContactRelationship: emergencyRelationship.trim(), emergencyContactPhone: emergencyPhone.trim(),
        emergencyContactEmail: emergencyEmail.trim()
      };

      let targetSuId = serviceUserToEdit?.id;

      if (serviceUserToEdit) {
        // The room chosen here is the resident's room. Empty means "leave the room as it is".
        const res = await suPropertyService.updateServiceUser(serviceUserToEdit.id, {
          firstName: firstName.trim(), middleName: middleName.trim(), lastName: lastName.trim(),
          preferredName: preferredName.trim(), dateOfBirth, gender, nationality,
          preferredLanguage, interpreterRequired, status,
          externalReference: externalReference.trim(), caseReference: caseReference.trim(),
          referralDate, arrivalDate, siteId
        }, { siteId, propertyId, roomId });
        if (!res.success) throw new Error(res.error || 'Failed to update Service User.');
      } else {
        const res = await suPropertyService.createServiceUser({
          firstName: firstName.trim(), middleName: middleName.trim(), lastName: lastName.trim(),
          preferredName: preferredName.trim(), dateOfBirth, gender, nationality, preferredLanguage,
          interpreterRequired, status: 'Active', externalReference: externalReference.trim(),
          caseReference: caseReference.trim(), referralDate: referralDate || arrivalDate,
          arrivalDate, siteId
        }, contactData, householdMembers, siteId && propertyId && roomId ? { siteId, propertyId, roomId } : undefined);

        if (!res.success || !res.record) throw new Error(res.error || 'Failed to create Service User.');
        targetSuId = res.record.id;
      }

      if (targetSuId) {
        await saveSUAdditionalDetails({
          suId: targetSuId,
          contactData,
          householdMembers,
          supportPriority,
          assignedStaff,
          vulnerabilityFlags,
          medicalConditions,
          dietaryNeeds,
          mobilityNeeds,
          newDocs,
          suPropertyDetailsService
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving Service User.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xs border border-[#e5e5e5] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e5e5e5] bg-[#faf9f8] flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-sm text-[#242424] flex items-center gap-2">
              <User className="w-4 h-4 text-[#0d9488]" />
              <span>
                {serviceUserToEdit
                  ? `Edit Service User — ${serviceUserToEdit.suReference}`
                  : 'Register New Service User Master'}
              </span>
            </h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {serviceUserToEdit 
                ? 'Update resident identity, contact, room placement, vulnerabilities, and files'
                : 'Centralized master record for identity, contact, household, and accommodation history'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xs text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <ServiceUserFormHeader
          serviceUserToEdit={serviceUserToEdit}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          householdCount={householdMembers.length}
          docsCount={existingDocuments.length + newDocs.length}
        />

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {(
            <>
              {activeTab === 'personal' && (
                <PersonalSection
                  firstName={firstName} setFirstName={setFirstName}
                  middleName={middleName} setMiddleName={setMiddleName}
                  lastName={lastName} setLastName={setLastName}
                  preferredName={preferredName} setPreferredName={setPreferredName}
                  dateOfBirth={dateOfBirth} setDateOfBirth={setDateOfBirth}
                  gender={gender} setGender={setGender}
                  nationality={nationality} setNationality={setNationality}
                  preferredLanguage={preferredLanguage} setPreferredLanguage={setPreferredLanguage}
                  interpreterRequired={interpreterRequired} setInterpreterRequired={setInterpreterRequired}
                  status={status} setStatus={setStatus}
                  externalReference={externalReference} setExternalReference={setExternalReference}
                  caseReference={caseReference} setCaseReference={setCaseReference}
                  referralDate={referralDate} setReferralDate={setReferralDate}
                  arrivalDate={arrivalDate} setArrivalDate={setArrivalDate}
                />
              )}

              {activeTab === 'contact' && (
                <ContactSection
                  mobile={mobile} setMobile={setMobile}
                  alternativePhone={alternativePhone} setAlternativePhone={setAlternativePhone}
                  email={email} setEmail={setEmail}
                  preferredContactMethod={preferredContactMethod} setPreferredContactMethod={setPreferredContactMethod}
                  emergencyName={emergencyName} setEmergencyName={setEmergencyName}
                  emergencyRelationship={emergencyRelationship} setEmergencyRelationship={setEmergencyRelationship}
                  emergencyPhone={emergencyPhone} setEmergencyPhone={setEmergencyPhone}
                  emergencyEmail={emergencyEmail} setEmergencyEmail={setEmergencyEmail}
                />
              )}

              {activeTab === 'accommodation' && (
                <AccommodationSection
                  siteId={siteId} setSiteId={setSiteId} sites={permittedSites}
                  propertyId={propertyId} setPropertyId={setPropertyId} properties={properties}
                  roomId={roomId} setRoomId={setRoomId} rooms={rooms}
                  roomOccupancy={roomOccupancy} originalRoomId={originalRoomId}
                  isEditing={Boolean(serviceUserToEdit)}
                />
              )}

              {activeTab === 'household' && (
                <HouseholdSection
                  householdMembers={householdMembers}
                  onAdd={() => setHouseholdMembers(prev => [...prev, { name: '', relationship: 'Child / Dependent', gender: 'Female' }])}
                  onRemove={(idx) => setHouseholdMembers(prev => prev.filter((_, i) => i !== idx))}
                  onUpdate={(idx, field, val) => setHouseholdMembers(prev => prev.map((m, i) => (i === idx ? { ...m, [field]: val } : m)))}
                />
              )}

              {activeTab === 'support' && (
                <SUSupportNeedsSection
                  vulnerabilityFlags={vulnerabilityFlags} setVulnerabilityFlags={setVulnerabilityFlags}
                  dietaryNeeds={dietaryNeeds} setDietaryNeeds={setDietaryNeeds}
                  medicalConditions={medicalConditions} setMedicalConditions={setMedicalConditions}
                  mobilityNeeds={mobilityNeeds} setMobilityNeeds={setMobilityNeeds}
                  supportPriority={supportPriority} setSupportPriority={setSupportPriority}
                  assignedStaff={assignedStaff} setAssignedStaff={setAssignedStaff}
                />
              )}

              {activeTab === 'documents' && (
                <SUDocumentsUploadSection
                  existingDocuments={existingDocuments}
                  onDeleteExistingDoc={async (id) => {
                    await suPropertyDetailsService.deleteSUDocument(id);
                    setExistingDocuments(prev => prev.filter(d => d.id !== id));
                  }}
                  newDocs={newDocs}
                  setNewDocs={setNewDocs}
                />
              )}
            </>
          )}

          {/* Footer Actions */}
          <ServiceUserFormFooter
            onClose={onClose}
            isSubmitting={isSubmitting}
            serviceUserToEdit={serviceUserToEdit}
          />
        </form>
      </div>
    </div>
  );
};
