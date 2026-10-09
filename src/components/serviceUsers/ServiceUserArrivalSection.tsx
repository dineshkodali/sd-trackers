import React from 'react';
import { PlaneTakeoff, ShieldAlert, Upload, Paperclip } from 'lucide-react';
import { SiteInfo } from '../../types';
import { PropertyMaster, PropertyRoom } from '../../types/masterData';

export interface ServiceUserArrivalSectionProps {
  arrivalDateTime: string;
  setArrivalDateTime: (val: string) => void;
  portReference: string;
  setPortReference: (val: string) => void;
  caseReference: string;
  setCaseReference: (val: string) => void;
  firstName: string;
  setFirstName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
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
  // Allocation
  siteId: string;
  setSiteId: (val: string) => void;
  sites: SiteInfo[];
  propertyId: string;
  setPropertyId: (val: string) => void;
  properties: PropertyMaster[];
  roomId: string;
  setRoomId: (val: string) => void;
  rooms: PropertyRoom[];
  // Arrival specific checks
  luggageChecked: boolean;
  setLuggageChecked: (val: boolean) => void;
  vulnerabilityFlags: string;
  setVulnerabilityFlags: (val: string) => void;
  dietaryNeeds: string;
  setDietaryNeeds: (val: string) => void;
  arrivalNotes: string;
  setArrivalNotes: (val: string) => void;
  // Initial Arrival Document
  arrivalDocFile: File | null;
  setArrivalDocFile: (file: File | null) => void;
  arrivalDocName: string;
  setArrivalDocName: (val: string) => void;
}

export const ServiceUserArrivalSection: React.FC<ServiceUserArrivalSectionProps> = ({
  arrivalDateTime,
  setArrivalDateTime,
  portReference,
  setPortReference,
  caseReference,
  setCaseReference,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  dateOfBirth,
  setDateOfBirth,
  gender,
  setGender,
  nationality,
  setNationality,
  preferredLanguage,
  setPreferredLanguage,
  interpreterRequired,
  setInterpreterRequired,
  siteId,
  setSiteId,
  sites,
  propertyId,
  setPropertyId,
  properties,
  roomId,
  setRoomId,
  rooms,
  luggageChecked,
  setLuggageChecked,
  vulnerabilityFlags,
  setVulnerabilityFlags,
  dietaryNeeds,
  setDietaryNeeds,
  arrivalNotes,
  setArrivalNotes,
  arrivalDocFile,
  setArrivalDocFile,
  arrivalDocName,
  setArrivalDocName
}) => {
  return (
    <div className="space-y-4">
      {/* Alert Banner */}
      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlaneTakeoff className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-semibold text-xs">
            Rapid Arrival Intake — Immediately logs arrival, allocates accommodation, and updates all modules in real-time.
          </span>
        </div>
        <span className="text-[11px] font-mono bg-amber-100 px-2 py-0.5 rounded-xs border border-amber-300">
          HO Inbound
        </span>
      </div>

      {/* Arrival Details & Port References */}
      <div className="bg-[#faf9f8] p-3 rounded-xs border border-[#e5e5e5] space-y-3">
        <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">1. Arrival &amp; Home Office References</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Arrival Date &amp; Time *</label>
            <input
              type="datetime-local"
              value={arrivalDateTime}
              onChange={e => setArrivalDateTime(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Port / HO Ref *</label>
            <input
              type="text"
              placeholder="e.g. PORT-9821 / HO-1234"
              value={portReference}
              onChange={e => setPortReference(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] font-mono"
            />
          </div>
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Case / ARC Reference</label>
            <input
              type="text"
              placeholder="e.g. ARC-4488"
              value={caseReference}
              onChange={e => setCaseReference(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] font-mono"
            />
          </div>
        </div>
      </div>

      {/* Core Identity */}
      <div className="bg-[#faf9f8] p-3 rounded-xs border border-[#e5e5e5] space-y-3">
        <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">2. Service User Identity</h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-neutral-600 font-medium mb-1">First Name *</label>
            <input
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Last Name *</label>
            <input
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              required
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
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Nationality</label>
            <input
              type="text"
              placeholder="e.g. Sudanese, Afghan"
              value={nationality}
              onChange={e => setNationality(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Preferred Language</label>
            <input
              type="text"
              value={preferredLanguage}
              onChange={e => setPreferredLanguage(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>
          <div className="sm:col-span-2 flex items-center pt-5">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-neutral-700">
              <input
                type="checkbox"
                checked={interpreterRequired}
                onChange={e => setInterpreterRequired(e.target.checked)}
                className="rounded-xs text-[#0d9488] focus:ring-0"
              />
              <span>Interpreter Required for communication / induction</span>
            </label>
          </div>
        </div>
      </div>

      {/* Immediate Accommodation Allocation */}
      <div className="bg-[#faf9f8] p-3 rounded-xs border border-[#e5e5e5] space-y-3">
        <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">3. Immediate Room Allocation</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Assigned Site *</label>
            <select
              value={siteId}
              onChange={e => setSiteId(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            >
              <option value="">Select Target Site...</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Target Property *</label>
            <select
              value={propertyId}
              onChange={e => setPropertyId(e.target.value)}
              required
              disabled={!siteId || properties.length === 0}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] disabled:bg-neutral-100"
            >
              <option value="">{properties.length === 0 ? 'No properties under site' : 'Select Property...'}</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.propertyName} ({p.postcode})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Room Assignment *</label>
            <select
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              required
              disabled={!propertyId || rooms.length === 0}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] disabled:bg-neutral-100 font-medium"
            >
              <option value="">{rooms.length === 0 ? 'No available rooms' : 'Select Room...'}</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>Room {r.roomNumber} ({r.roomType}, Cap: {r.capacity})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Arrival Health, Vulnerability & Luggage */}
      <div className="bg-[#faf9f8] p-3 rounded-xs border border-[#e5e5e5] space-y-3">
        <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">4. Vulnerabilities, Health &amp; Luggage</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-neutral-600 font-medium mb-1 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Medical / Vulnerability Flags</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Mobility limitation, diabetes, pregnancy"
              value={vulnerabilityFlags}
              onChange={e => setVulnerabilityFlags(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Dietary Requirements</label>
            <input
              type="text"
              placeholder="e.g. Halal, Vegetarian, Gluten-free"
              value={dietaryNeeds}
              onChange={e => setDietaryNeeds(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-neutral-700">
              <input
                type="checkbox"
                checked={luggageChecked}
                onChange={e => setLuggageChecked(e.target.checked)}
                className="rounded-xs text-[#0d9488] focus:ring-0"
              />
              <span>Arrival Luggage &amp; Personal Inventory Inspected &amp; Logged</span>
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-neutral-600 font-medium mb-1">Arrival Observations / Notes</label>
            <textarea
              placeholder="Condition on arrival, initial demeanor, induction handover notes..."
              value={arrivalNotes}
              onChange={e => setArrivalNotes(e.target.value)}
              rows={2}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>
        </div>
      </div>

      {/* Arrival Documents Attachment */}
      <div className="bg-[#faf9f8] p-3 rounded-xs border border-[#e5e5e5] space-y-2">
        <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5 text-[#0d9488]" />
          <span>5. Attach Arrival Document / ARC / Referral Letter</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Document Label</label>
            <input
              type="text"
              placeholder="e.g. Home Office Intake Sheet / ARC Card"
              value={arrivalDocName}
              onChange={e => setArrivalDocName(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Choose File</label>
            <div className="flex items-center gap-2">
              <label className="px-3 py-1.5 bg-white border border-[#e5e5e5] hover:bg-neutral-50 rounded-xs text-xs font-semibold text-neutral-700 cursor-pointer flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-[#0d9488]" />
                <span>{arrivalDocFile ? arrivalDocFile.name : 'Select PDF or Image'}</span>
                <input
                  type="file"
                  accept=".pdf,image/*,.doc,.docx"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setArrivalDocFile(f);
                      if (!arrivalDocName) setArrivalDocName(f.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  className="hidden"
                />
              </label>
              {arrivalDocFile && (
                <button
                  type="button"
                  onClick={() => { setArrivalDocFile(null); }}
                  className="text-xs text-rose-600 hover:underline cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
