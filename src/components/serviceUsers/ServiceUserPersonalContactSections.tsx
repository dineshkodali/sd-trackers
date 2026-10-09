import React from 'react';

export interface PersonalSectionProps {
  firstName: string;
  setFirstName: (val: string) => void;
  middleName: string;
  setMiddleName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
  preferredName: string;
  setPreferredName: (val: string) => void;
  dateOfBirth: string;
  setDateOfBirth: (val: string) => void;
  gender: string;
  setGender: (val: string) => void;
  nationality: string;
  setNationality: (val: string) => void;
  preferredLanguage: string;
  setPreferredLanguage: (val: string) => void;
  interpreterRequired: boolean;
  setInterpreterRequired: (val: boolean) => void;
  status: 'Active' | 'Inactive' | 'Discharged' | 'Pending';
  setStatus: (val: 'Active' | 'Inactive' | 'Discharged' | 'Pending') => void;
  externalReference: string;
  setExternalReference: (val: string) => void;
  caseReference: string;
  setCaseReference: (val: string) => void;
  referralDate: string;
  setReferralDate: (val: string) => void;
  arrivalDate: string;
  setArrivalDate: (val: string) => void;
}

export const PersonalSection: React.FC<PersonalSectionProps> = ({
  firstName, setFirstName, middleName, setMiddleName, lastName, setLastName,
  preferredName, setPreferredName, dateOfBirth, setDateOfBirth, gender, setGender,
  nationality, setNationality, preferredLanguage, setPreferredLanguage,
  interpreterRequired, setInterpreterRequired, status, setStatus,
  externalReference, setExternalReference, caseReference, setCaseReference,
  referralDate, setReferralDate, arrivalDate, setArrivalDate
}) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label className="block text-neutral-600 font-medium mb-1">
          First Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          required
          placeholder="e.g. Tariq"
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
        />
      </div>
      <div>
        <label className="block text-neutral-600 font-medium mb-1">Middle Name</label>
        <input
          type="text"
          value={middleName}
          onChange={e => setMiddleName(e.target.value)}
          placeholder="Optional"
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
        />
      </div>
      <div>
        <label className="block text-neutral-600 font-medium mb-1">
          Last Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          required
          placeholder="e.g. Al-Mansoor"
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
        />
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label className="block text-neutral-600 font-medium mb-1">Preferred Name</label>
        <input
          type="text"
          value={preferredName}
          onChange={e => setPreferredName(e.target.value)}
          placeholder="Nickname or alias"
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
        />
      </div>
      <div>
        <label className="block text-neutral-600 font-medium mb-1">Date of Birth</label>
        <input
          type="date"
          value={dateOfBirth}
          onChange={e => setDateOfBirth(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
        />
      </div>
      <div>
        <label className="block text-neutral-600 font-medium mb-1">Gender</label>
        <select
          value={gender}
          onChange={e => setGender(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
        >
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Non-binary">Non-binary</option>
          <option value="Other">Other</option>
          <option value="Prefer not to say">Prefer not to say</option>
        </select>
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label className="block text-neutral-600 font-medium mb-1">Nationality</label>
        <input
          type="text"
          value={nationality}
          onChange={e => setNationality(e.target.value)}
          placeholder="e.g. Sudanese"
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
        />
      </div>
      <div>
        <label className="block text-neutral-600 font-medium mb-1">Preferred Language</label>
        <input
          type="text"
          value={preferredLanguage}
          onChange={e => setPreferredLanguage(e.target.value)}
          placeholder="e.g. Arabic, English"
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
        />
      </div>
      <div>
        <label className="block text-neutral-600 font-medium mb-1">Status</label>
        <select
          value={status}
          onChange={e => setStatus(e.target.value as any)}
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
        >
          <option value="Active">Active</option>
          <option value="Pending">Pending</option>
          <option value="Inactive">Inactive</option>
          <option value="Discharged">Discharged</option>
        </select>
      </div>
    </div>

    <div className="flex items-center gap-2 pt-1">
      <input
        type="checkbox"
        id="chk-interpreter"
        checked={interpreterRequired}
        onChange={e => setInterpreterRequired(e.target.checked)}
        className="rounded-xs text-[#0d9488] focus:ring-0"
      />
      <label htmlFor="chk-interpreter" className="text-xs text-neutral-700 select-none cursor-pointer">
        Interpreter Required during meetings and assessments
      </label>
    </div>

    <div className="border-t border-[#e5e5e5] pt-3">
      <h4 className="text-xs font-bold text-neutral-800 mb-2 uppercase tracking-wider">Reference &amp; Dates</h4>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-neutral-600 font-medium mb-1">Home Office / Port Ref</label>
          <input
            type="text"
            value={externalReference}
            onChange={e => setExternalReference(e.target.value)}
            placeholder="e.g. L0012345"
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] font-mono"
          />
        </div>
        <div>
          <label className="block text-neutral-600 font-medium mb-1">Case Reference</label>
          <input
            type="text"
            value={caseReference}
            onChange={e => setCaseReference(e.target.value)}
            placeholder="e.g. CR-88391"
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] font-mono"
          />
        </div>
        <div>
          <label className="block text-neutral-600 font-medium mb-1">Referral Date</label>
          <input
            type="date"
            value={referralDate}
            onChange={e => setReferralDate(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
          />
        </div>
        <div>
          <label className="block text-neutral-600 font-medium mb-1">Arrival Date</label>
          <input
            type="date"
            value={arrivalDate}
            onChange={e => setArrivalDate(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
          />
        </div>
      </div>
    </div>
  </div>
);

export interface ContactSectionProps {
  mobile: string;
  setMobile: (val: string) => void;
  alternativePhone: string;
  setAlternativePhone: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  preferredContactMethod: string;
  setPreferredContactMethod: (val: string) => void;
  emergencyName: string;
  setEmergencyName: (val: string) => void;
  emergencyRelationship: string;
  setEmergencyRelationship: (val: string) => void;
  emergencyPhone: string;
  setEmergencyPhone: (val: string) => void;
  emergencyEmail: string;
  setEmergencyEmail: (val: string) => void;
}

export const ContactSection: React.FC<ContactSectionProps> = ({
  mobile, setMobile, alternativePhone, setAlternativePhone, email, setEmail,
  preferredContactMethod, setPreferredContactMethod, emergencyName, setEmergencyName,
  emergencyRelationship, setEmergencyRelationship, emergencyPhone, setEmergencyPhone,
  emergencyEmail, setEmergencyEmail
}) => (
  <div className="space-y-4">
    <h4 className="text-xs font-bold text-neutral-800">Primary Contact Details</h4>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label className="block text-neutral-600 font-medium mb-1">Mobile Number</label>
        <input
          type="tel"
          value={mobile}
          onChange={e => setMobile(e.target.value)}
          placeholder="+44 7123 456789"
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
        />
      </div>
      <div>
        <label className="block text-neutral-600 font-medium mb-1">Alternative Phone</label>
        <input
          type="tel"
          value={alternativePhone}
          onChange={e => setAlternativePhone(e.target.value)}
          placeholder="Optional"
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
        />
      </div>
      <div>
        <label className="block text-neutral-600 font-medium mb-1">Email Address</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="resident@example.com"
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
        />
      </div>
    </div>

    <div>
      <label className="block text-neutral-600 font-medium mb-1">Preferred Contact Method</label>
      <select
        value={preferredContactMethod}
        onChange={e => setPreferredContactMethod(e.target.value)}
        className="w-full max-w-xs px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
      >
        <option value="Mobile">Mobile Call</option>
        <option value="SMS / WhatsApp">SMS / WhatsApp</option>
        <option value="In Person">In Person Notice</option>
        <option value="Email">Email</option>
      </select>
    </div>

    <div className="border-t border-[#e5e5e5] pt-3">
      <h4 className="text-xs font-bold text-neutral-800 mb-2 uppercase tracking-wider">Emergency Contact</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-neutral-600 font-medium mb-1">Contact Name</label>
          <input
            type="text"
            value={emergencyName}
            onChange={e => setEmergencyName(e.target.value)}
            placeholder="e.g. Fatima Smith"
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
          />
        </div>
        <div>
          <label className="block text-neutral-600 font-medium mb-1">Relationship</label>
          <input
            type="text"
            value={emergencyRelationship}
            onChange={e => setEmergencyRelationship(e.target.value)}
            placeholder="e.g. Sister, Sponsor, Friend"
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
          />
        </div>
        <div>
          <label className="block text-neutral-600 font-medium mb-1">Emergency Phone</label>
          <input
            type="tel"
            value={emergencyPhone}
            onChange={e => setEmergencyPhone(e.target.value)}
            placeholder="+44 7987 654321"
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
          />
        </div>
        <div>
          <label className="block text-neutral-600 font-medium mb-1">Emergency Email</label>
          <input
            type="email"
            value={emergencyEmail}
            onChange={e => setEmergencyEmail(e.target.value)}
            placeholder="emergency@example.com"
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
          />
        </div>
      </div>
    </div>
  </div>
);
