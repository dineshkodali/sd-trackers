import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Siren, 
  X, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  Building2, 
  User, 
  CheckCircle2,
  ArrowRight,
  Flame,
  Shield,
  PhoneCall,
  Save,
  RotateCcw,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RiskLevel, EscalationRecord, RecordAttachment } from '../../types';
import { saveFormDraft, loadFormDraft, clearFormDraft, formatDraftTime } from '../../utils/autoSave';
import { AttachmentsSection } from '../common/AttachmentsSection';
import { ManageableSelect } from '../common/ManageableSelect';

interface QuickIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DRAFT_KEY = 'quick_incident';

interface QuickIncidentDraftData {
  site: string;
  suName: string;
  suPortNassRef: string;
  roomNumber: string;
  incidentType: string;
  urgency: RiskLevel;
  dateOfIncident: string;
  timeOfIncident: string;
  personReporting: string;
  reportedAuthorities: string;
  wlIssued: EscalationRecord['wlIssued'];
  incidentNotes: string;
  actionTaken: string;
  status: EscalationRecord['status'];
}

export const QuickIncidentModal: React.FC<QuickIncidentModalProps> = ({ isOpen, onClose }) => {
  const { 
    allowedSites, 
    assignedSite, 
    sites,
    canAccessAllSites, 
    addEscalation, 
    setActivePage,
    currentUserRole,
    currentUserName,
    authProfile
  } = useApp();

  const loggedInUserName = authProfile?.name || authProfile?.email?.split('@')[0] || currentUserName || (currentUserRole ? `${currentUserRole} (User)` : 'Duty Lead Officer');

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5);

  const userAssignedHotel = useMemo(() => {
    if (assignedSite && assignedSite !== 'All Sites' && assignedSite !== 'all') {
      return assignedSite;
    }
    if (authProfile?.assignedSite && authProfile.assignedSite !== 'All Sites' && authProfile.assignedSite !== 'all') {
      return authProfile.assignedSite;
    }
    const pAny = authProfile as any;
    if (pAny?.assigned_site && pAny.assigned_site !== 'All Sites' && pAny.assigned_site !== 'all') {
      return pAny.assigned_site;
    }
    if (pAny?.hotel && pAny.hotel !== 'All Sites' && pAny.hotel !== 'all') {
      return pAny.hotel;
    }
    if (allowedSites && allowedSites.length > 0 && allowedSites[0] !== 'All Sites' && allowedSites[0] !== 'all') {
      return allowedSites[0];
    }
    const firstReal = sites?.find(s => {
      const name = typeof s === 'string' ? s : s?.name;
      return name && name !== 'All Sites' && name !== 'all';
    });
    if (firstReal) {
      return typeof firstReal === 'string' ? firstReal : firstReal.name;
    }
    return '';
  }, [assignedSite, authProfile, allowedSites, sites]);

  const defaultSite = canAccessAllSites() ? (allowedSites[0] || userAssignedHotel) : userAssignedHotel;

  const [site, setSite] = useState<string>(defaultSite);

  useEffect(() => {
    if (isOpen) {
      if (!canAccessAllSites()) {
        setSite(userAssignedHotel);
      } else if (!site) {
        setSite(defaultSite);
      }
    }
  }, [isOpen, canAccessAllSites, userAssignedHotel, defaultSite]);
  const [suName, setSuName] = useState<string>('');
  const [suPortNassRef, setSuPortNassRef] = useState<string>('');
  const [roomNumber, setRoomNumber] = useState<string>('');
  const [incidentType, setIncidentType] = useState<string>('Critical Safeguarding Emergency');
  const [urgency, setUrgency] = useState<RiskLevel>('Critical');
  const [dateOfIncident, setDateOfIncident] = useState<string>(todayStr);
  const [timeOfIncident, setTimeOfIncident] = useState<string>(timeStr);
  const [personReporting, setPersonReporting] = useState<string>(loggedInUserName);

  useEffect(() => {
    if (loggedInUserName && (!personReporting || personReporting === 'Duty Lead Officer')) {
      setPersonReporting(loggedInUserName);
    }
  }, [loggedInUserName]);
  const [reportedAuthorities, setReportedAuthorities] = useState<string>('Emergency Services (999), LA Safeguarding Hub');
  const [wlIssued, setWlIssued] = useState<EscalationRecord['wlIssued']>('No');
  const [incidentNotes, setIncidentNotes] = useState<string>('');
  const [actionTaken, setActionTaken] = useState<string>('');
  const [status, setStatus] = useState<EscalationRecord['status']>('Active');
  const [attachments, setAttachments] = useState<RecordAttachment[]>([]);

  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Auto-save & draft restoration states
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Restore draft when modal opens
  useEffect(() => {
    if (isOpen) {
      isInitializedRef.current = false;
      const draft = loadFormDraft<QuickIncidentDraftData>(DRAFT_KEY);
      if (draft && draft.data) {
        const d = draft.data;
        const hasContent = Boolean(
          (d.suName && d.suName.trim()) ||
          (d.incidentNotes && d.incidentNotes.trim()) ||
          (d.actionTaken && d.actionTaken.trim()) ||
          (d.roomNumber && d.roomNumber.trim()) ||
          (d.suPortNassRef && d.suPortNassRef.trim())
        );

        if (hasContent) {
          if (d.site) setSite(d.site);
          if (d.suName !== undefined) setSuName(d.suName);
          if (d.suPortNassRef !== undefined) setSuPortNassRef(d.suPortNassRef);
          if (d.roomNumber !== undefined) setRoomNumber(d.roomNumber);
          if (d.incidentType) setIncidentType(d.incidentType);
          if (d.urgency) setUrgency(d.urgency);
          if (d.dateOfIncident) setDateOfIncident(d.dateOfIncident);
          if (d.timeOfIncident) setTimeOfIncident(d.timeOfIncident);
          if (d.personReporting) setPersonReporting(d.personReporting);
          if (d.reportedAuthorities) setReportedAuthorities(d.reportedAuthorities);
          if (d.wlIssued) setWlIssued(d.wlIssued);
          if (d.incidentNotes !== undefined) setIncidentNotes(d.incidentNotes);
          if (d.actionTaken !== undefined) setActionTaken(d.actionTaken);
          if (d.status) setStatus(d.status);

          setDraftRestoredAt(draft.savedAt);
          setLastSavedTime(formatDraftTime(draft.savedAt));
        }
      }
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 100);
    } else {
      setDraftRestoredAt(null);
      setErrorMsg('');
      setIsSuccess(false);
    }
  }, [isOpen, defaultSite]);

  // Continuously auto-save partial progress when any field changes
  useEffect(() => {
    if (!isOpen || !isInitializedRef.current || isSuccess) return;

    const hasAnyContent = Boolean(
      suName.trim() ||
      incidentNotes.trim() ||
      actionTaken.trim() ||
      roomNumber.trim() ||
      suPortNassRef.trim()
    );

    if (hasAnyContent) {
      const draftData: QuickIncidentDraftData = {
        site,
        suName,
        suPortNassRef,
        roomNumber,
        incidentType,
        urgency,
        dateOfIncident,
        timeOfIncident,
        personReporting,
        reportedAuthorities,
        wlIssued,
        incidentNotes,
        actionTaken,
        status
      };
      saveFormDraft(DRAFT_KEY, draftData);
      setLastSavedTime(formatDraftTime(new Date().toISOString()));
    }
  }, [
    isOpen,
    isSuccess,
    site,
    suName,
    suPortNassRef,
    roomNumber,
    incidentType,
    urgency,
    dateOfIncident,
    timeOfIncident,
    personReporting,
    reportedAuthorities,
    wlIssued,
    incidentNotes,
    actionTaken,
    status
  ]);

  if (!isOpen) return null;

  const handleDiscardDraft = () => {
    clearFormDraft(DRAFT_KEY);
    setSuName('');
    setSuPortNassRef('');
    setRoomNumber('');
    setIncidentNotes('');
    setActionTaken('');
    setIncidentType('Critical Safeguarding Emergency');
    setUrgency('Critical');
    setDateOfIncident(todayStr);
    setTimeOfIncident(timeStr);
    setWlIssued('No');
    setDraftRestoredAt(null);
    setLastSavedTime(null);
  };

  // Preset Handlers for rapid 1-click filing under pressure
  const applyPreset = (preset: '999' | 'police' | 'selfharm' | 'conflict') => {
    if (preset === '999') {
      setIncidentType('Severe Medical Emergency / Ambulance Dispatched');
      setUrgency('Critical');
      setReportedAuthorities('Ambulance / NHS 999, Duty Manager');
      setActionTaken('Ambulance called immediately. First aiders dispatched to room. Resident monitored until paramedic handover.');
    } else if (preset === 'police') {
      setIncidentType('Police Attendance / Crime / Weapon / Altercation');
      setUrgency('Critical');
      setReportedAuthorities('Met Police (CAD Logged), Duty Manager, Operations Director');
      setActionTaken('Police called via 999. Area cordoned off. Statements collected and CCTV secured.');
    } else if (preset === 'selfharm') {
      setIncidentType('Acute Self-Harm / Suicide Risk Alert');
      setUrgency('Critical');
      setReportedAuthorities('NHS Crisis Resolution Team, Local Authority Safeguarding Hub');
      setActionTaken('1-to-1 constant safeguarding watch initiated. Safe environment secured. Immediate crisis assessment requested.');
    } else if (preset === 'conflict') {
      setIncidentType('Severe Anti-Social Behavior / Threat to Residents & Staff');
      setUrgency('High');
      setReportedAuthorities('Duty Manager, Local Authority Outreach');
      setWlIssued('Warning Letter Issued');
      setActionTaken('De-escalation completed. Warning Letter served in person. SU warned regarding Home Office tenancy rules.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!suName.trim()) {
      setErrorMsg('Please specify the Service User / Resident Name.');
      return;
    }
    if (!incidentNotes.trim()) {
      setErrorMsg('Please provide a brief Incident Summary.');
      return;
    }
    if (!actionTaken.trim()) {
      setErrorMsg('Please record the Immediate Actions Taken.');
      return;
    }

    if (currentUserRole !== 'Super Admin' && dateOfIncident < todayStr) {
      setErrorMsg('Incident date cannot be in the past (must be today or later). Only Super Admin can log incidents for past dates.');
      return;
    }

    const fullNotes = roomNumber 
      ? `[Room: ${roomNumber}] [Time: ${timeOfIncident}] ${incidentNotes.trim()}`
      : `[Time: ${timeOfIncident}] ${incidentNotes.trim()}`;

    const effectiveSite = !canAccessAllSites() ? userAssignedHotel : (site || userAssignedHotel);

    // Dispatch escalation via AppContext
    addEscalation({
      dateOfIncident,
      suPortNassRef: suPortNassRef.trim() || 'Pending Ref',
      suName: suName.trim(),
      siteName: effectiveSite,
      site: effectiveSite,
      personReporting,
      incidentType,
      wlIssued,
      reportedAuthorities,
      incidentNotes: fullNotes,
      actionTaken: actionTaken.trim(),
      status,
      urgency,
      attachments,
      attachmentUrl: (attachments && attachments[0]?.url) || (attachments && attachments[0]?.dataUrl) || '',
      attachment_url: (attachments && attachments[0]?.url) || (attachments && attachments[0]?.dataUrl) || '',
      fileUrl: (attachments && attachments[0]?.url) || (attachments && attachments[0]?.dataUrl) || '',
      file_url: (attachments && attachments[0]?.url) || (attachments && attachments[0]?.dataUrl) || '',
      loggedBy: personReporting || loggedInUserName,
      // Backward compatibility fields
      incidentTitle: incidentType,
      refNumber: suPortNassRef.trim() || 'Pending Ref',
      reportedBy: personReporting || loggedInUserName,
      dateTime: `${dateOfIncident} ${timeOfIncident}`,
      incidentSummary: fullNotes,
      immediateAction: actionTaken.trim(),
      escalatedTo: reportedAuthorities
    });

    // Clear saved draft on successful dispatch
    clearFormDraft(DRAFT_KEY);
    setDraftRestoredAt(null);
    setLastSavedTime(null);
    setIsSuccess(true);
  };

  const handleResetForm = () => {
    handleDiscardDraft();
    setIsSuccess(false);
    setErrorMsg('');
    onClose();
  };

  const handleGoToEscalations = () => {
    onClose();
    setActivePage('escalations');
  };

  return (
    <div 
      id="quick-incident-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSuccess) onClose();
      }}
    >
      <div 
        className="bg-white border-2 border-red-600 rounded-sm shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-red-700 via-red-800 to-neutral-900 text-white px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-red-600 text-white rounded-xs shadow-xs animate-pulse">
              <Siren className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight text-white">
                  Quick Incident Log
                </h3>
                <span className="text-[10px] uppercase font-black tracking-wider px-1.5 py-0.5 bg-red-500 text-white rounded-xs">
                  Immediate Escalation
                </span>
              </div>
              <p className="text-xs text-red-100">
                Rapid multi-agency safeguarding escalation intake & emergency dispatch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-red-200 hover:text-white hover:bg-red-700/50 rounded transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {isSuccess ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-bold text-neutral-800">
                Critical Incident Escalated Successfully
              </h4>
              <p className="text-xs text-[#605e5c] max-w-md mx-auto">
                Incident logged for <strong className="text-neutral-800">{suName}</strong> at <strong className="text-neutral-800">{site}</strong>. The escalation has been registered with priority <span className="font-bold text-red-700">{urgency}</span> and recorded in the audit log.
              </p>
            </div>

            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded text-xs text-left max-w-md mx-auto space-y-1">
              <div><strong className="text-neutral-600">Incident:</strong> {incidentType}</div>
              <div><strong className="text-neutral-600">Authorities Notified:</strong> {reportedAuthorities}</div>
              <div><strong className="text-neutral-600">Action:</strong> {actionTaken}</div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleResetForm}
                className="px-4 py-2 text-xs font-semibold bg-white hover:bg-neutral-100 border border-[#8a8886] rounded-xs text-[#323130] transition-colors"
              >
                Close & Return
              </button>
              <button
                onClick={handleGoToEscalations}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs transition-colors shadow-xs"
              >
                <span>Go to Escalations Tracker</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Draft Restored Banner */}
            {draftRestoredAt && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xs flex items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    <strong>Unsaved draft restored</strong> (auto-saved {formatDraftTime(draftRestoredAt)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="px-2 py-0.5 text-[11px] font-semibold text-amber-900 hover:text-red-700 hover:bg-amber-100 rounded border border-amber-400 transition-colors"
                >
                  Discard Draft
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Quick 1-Click Fill Presets */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-neutral-700 uppercase tracking-wider text-[10px]">
                  Emergency 1-Click Presets:
                </label>
                <span className="text-[10px] text-neutral-400">Pre-populates incident details</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset('999')}
                  className="p-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 rounded text-left font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span className="truncate">999 / Paramedic</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('police')}
                  className="p-2 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-blue-800 rounded text-left font-semibold transition-colors flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-teal-800 shrink-0" />
                  <span className="truncate">Police Call-Out</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('selfharm')}
                  className="p-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 rounded text-left font-semibold transition-colors flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                  <span className="truncate">Crisis / Self-Harm</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('conflict')}
                  className="p-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded text-left font-semibold transition-colors flex items-center gap-1.5"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="truncate">Threat / ASB Alert</span>
                </button>
              </div>
            </div>

            {/* Core Identification Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-neutral-700 block mb-1 flex items-center justify-between">
                  <span>Hotel / Site <span className="text-red-600">*</span></span>
                  {!canAccessAllSites() && (
                    <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5 text-teal-600" /> Locked
                    </span>
                  )}
                </label>
                {!canAccessAllSites() ? (
                  <div className="relative">
                    <input
                      type="text"
                      value={userAssignedHotel}
                      readOnly
                      disabled
                      className="w-full p-2 pr-7 border border-teal-200 rounded-xs bg-teal-50/50 text-teal-950 font-medium cursor-not-allowed text-xs"
                    />
                    <Lock className="w-3.5 h-3.5 text-teal-600 absolute right-2 top-1/2 -translate-y-1/2" />
                  </div>
                ) : (
                  <select
                    id="incident-site"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    className="w-full p-2 border border-neutral-300 rounded-xs bg-white text-neutral-900 focus:outline-2 focus:outline-red-500 text-xs"
                  >
                    {allowedSites.map((s, idx) => (
                      <option key={`${s}-${idx}`} value={s}>{s}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">
                  Service User (Resident) <span className="text-red-600">*</span>
                </label>
                <input
                  id="incident-su-name"
                  type="text"
                  value={suName}
                  onChange={(e) => setSuName(e.target.value)}
                  placeholder="e.g. Tariq Al-Mansoor"
                  className="w-full p-2 border border-neutral-300 rounded-xs bg-white text-neutral-900 focus:outline-2 focus:outline-red-500"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">
                  Room / Flat No.
                </label>
                <input
                  id="incident-room"
                  type="text"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="e.g. Room 204"
                  className="w-full p-2 border border-neutral-300 rounded-xs bg-white text-neutral-900 focus:outline-2 focus:outline-red-500"
                />
              </div>
            </div>

            {/* Incident Specifics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <ManageableSelect
                  label="Incident Category / Type"
                  value={incidentType}
                  onChange={val => setIncidentType(val)}
                  optionCategory="incidentTypes"
                  required
                />
              </div>

              <div>
                <ManageableSelect
                  label="Escalation Urgency"
                  value={urgency}
                  onChange={val => setUrgency(val as RiskLevel)}
                  optionCategory="riskLevels"
                  required
                />
              </div>
            </div>

            {/* Timing & Personnel */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">
                  Port / NASS Ref
                </label>
                <input
                  id="incident-ref"
                  type="text"
                  value={suPortNassRef}
                  onChange={(e) => setSuPortNassRef(e.target.value)}
                  placeholder="e.g. 9845-2940"
                  className="w-full p-2 border border-neutral-300 rounded-xs bg-white text-neutral-900 focus:outline-2 focus:outline-red-500"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 mb-1 flex items-center justify-between">
                  <span>Date & Time of Incident</span>
                  {currentUserRole !== 'Super Admin' ? (
                    <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded font-medium">
                      Today or Later
                    </span>
                  ) : (
                    <span className="text-[10px] text-purple-800 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded font-medium">
                      Super Admin: All Dates
                    </span>
                  )}
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="incident-date"
                    type="date"
                    value={dateOfIncident}
                    min={currentUserRole !== 'Super Admin' ? todayStr : undefined}
                    onChange={(e) => setDateOfIncident(e.target.value)}
                    className="w-2/3 p-2 border border-neutral-300 rounded-xs bg-white text-neutral-900 focus:outline-2 focus:outline-red-500"
                  />
                  <input
                    id="incident-time"
                    type="time"
                    value={timeOfIncident}
                    onChange={(e) => setTimeOfIncident(e.target.value)}
                    className="w-1/3 p-2 border border-neutral-300 rounded-xs bg-white text-neutral-900 focus:outline-2 focus:outline-red-500"
                  />
                </div>
                {currentUserRole !== 'Super Admin' ? (
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Date must be today or later. Only Super Admin can file incidents for past dates.
                  </p>
                ) : (
                  <p className="text-[10px] text-purple-700 mt-1">
                    Super Admin: Past dates permitted.
                  </p>
                )}
              </div>

              <div>
                <label className="font-semibold text-neutral-700 mb-1 flex items-center justify-between">
                  <span>Logged By</span>
                  <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 text-teal-600" /> Locked to Logged-in User
                  </span>
                </label>
                <div className="relative">
                  <input
                    id="incident-reporter"
                    type="text"
                    value={personReporting || loggedInUserName}
                    readOnly
                    className="w-full p-2 pr-8 border border-teal-200 rounded-xs bg-teal-50/50 text-neutral-900 font-medium cursor-not-allowed text-xs"
                    title="Logged by is locked to the authenticated user for compliance and accountability."
                  />
                  <Lock className="w-3.5 h-3.5 text-teal-600 absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            {/* External Authorities & Warning Letter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">
                  Reported Authorities / Escalated To
                </label>
                <input
                  id="incident-authorities"
                  type="text"
                  value={reportedAuthorities}
                  onChange={(e) => setReportedAuthorities(e.target.value)}
                  placeholder="e.g. Met Police CAD #4928, LA Safeguarding Lead, 999"
                  className="w-full p-2 border border-neutral-300 rounded-xs bg-white text-neutral-900 focus:outline-2 focus:outline-red-500"
                />
              </div>

              <div>
                <ManageableSelect
                  label="Warning Letter / Notice to Quit"
                  value={wlIssued}
                  onChange={val => setWlIssued(val as EscalationRecord['wlIssued'])}
                  optionCategory="wlIssuedStatuses"
                />
              </div>
            </div>

            {/* Narrative Notes */}
            <div>
              <label className="font-semibold text-neutral-700 block mb-1">
                Incident Summary & Circumstances <span className="text-red-600">*</span>
              </label>
              <textarea
                id="incident-summary"
                rows={3}
                value={incidentNotes}
                onChange={(e) => setIncidentNotes(e.target.value)}
                placeholder="State exactly what happened, persons involved, immediate risks observed, and current condition..."
                className="w-full p-2 border border-neutral-300 rounded-xs bg-white text-neutral-900 focus:outline-2 focus:outline-red-500"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-neutral-700 block mb-1">
                Immediate Action(s) Taken On Site <span className="text-red-600">*</span>
              </label>
              <textarea
                id="incident-action"
                rows={2}
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                placeholder="Detail emergency services called, medical aid, separation of residents, duty manager briefed..."
                className="w-full p-2 border border-neutral-300 rounded-xs bg-white text-neutral-900 focus:outline-2 focus:outline-red-500"
                required
              />
            </div>

            {/* Universal Proof & Document Attachments */}
            <AttachmentsSection
              attachments={attachments}
              onChange={setAttachments}
              allowUpload={true}
              entityName="Quick Incident"
            />

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                  <Save className="w-3 h-3 text-emerald-600" />
                  {lastSavedTime ? `Auto-saved at ${lastSavedTime}` : 'Auto-save active'}
                </span>
                <span className="hidden sm:inline">• Immutable audit trail</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 border border-neutral-300 rounded-xs text-neutral-700 hover:bg-neutral-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-quick-incident"
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xs font-bold shadow-sm transition-colors"
                >
                  <Siren className="w-4 h-4" />
                  <span>Submit & Escalate Immediately</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
