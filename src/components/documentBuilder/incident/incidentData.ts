/**
 * Incident Report Builder — static data
 *
 * Incident scenarios (standard wording), the per-scenario detail fields, the site list,
 * warning-letter options and reported-authority rows used by the guided HO Report Generator
 * "Incident Report" flow. The wording is the agreed Clearsprings standard wording; text in
 * [square brackets] is a placeholder that is shown in red until the user completes it.
 */

export type DetailFieldType = 'text' | 'time' | 'date' | 'select' | 'textarea';

export interface DetailFieldDef {
  key: string;
  label: string;
  type: DetailFieldType;
  ph?: string;
  hint?: string;
  options?: [string, string][];
  fmt?: (raw: string) => string;
  showIf?: { key: string; eq: string };
}

export type ScenarioFieldRef = string | [string, Partial<DetailFieldDef>];
export type ScenarioLine = string | ((values: Record<string, string>) => string);

export interface Scenario {
  id: string;
  group: string;
  label: string;
  sub: string;
  draft?: boolean;
  note: string | null;
  police?: boolean;
  ambulance?: boolean;
  offenders?: 'na' | 'write';
  fields: ScenarioFieldRef[];
  lead: string;
  bullets: ScenarioLine[];
  actions: string[];
  warning: string;
}

/* ---------- small formatters (also used by the wording engine) ---------- */
export function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '');
}
export function fmtTime(v: string): string {
  return `${v} hrs`;
}

/* ---------- fields that scenarios can use ---------- */
export const FIELD_LIB: Record<string, Omit<DetailFieldDef, 'key'>> = {
  time: { label: 'Time', type: 'time', ph: '[Insert Time]', fmt: fmtTime },
  time2: { label: 'Time', type: 'time', ph: '[Insert Time]', fmt: fmtTime },
  su: { label: 'SU – full name & port ref', type: 'text', ph: '[Insert SU Full Name and Port Reference Number]', hint: 'e.g. John Smith (CIU/123456)' },
  ho: { label: 'Housing Officer – full name', type: 'text', ph: '[Insert HO Full Name]', hint: 'Leave blank to use the Person Reporting name' },
  checkType: { label: 'Type of check', type: 'select', options: [['welfare', 'Welfare check'], ['room', 'Room check']] },
  material: { label: 'What covered the alarm?', type: 'text', ph: '[Insert Material – e.g. paper or socks]', hint: 'e.g. paper, socks, a plastic bag' },
  location: { label: 'Where were they found?', type: 'text', ph: '[Insert location – e.g. in the bathroom / on the window sill]', hint: 'e.g. in the bathroom, on the window sill' },
  applianceType: { label: 'Type of appliance', type: 'select', options: [['personal electrical appliance', 'Personal electrical appliance'], ['cooking appliance', 'Cooking appliance']] },
  appliance: { label: 'Appliance found', type: 'text', ph: '[Insert Appliance, e.g. kettle]', hint: 'e.g. kettle' },
  room: { label: 'Room number', type: 'text', ph: '[Insert Room Number]' },
  reason: { label: 'Reason given by the SU', type: 'text', ph: '[Insert Reason]', hint: 'A short reason, e.g. medical appointments in the area' },
  lastDate: { label: 'Last recorded signature – date', type: 'date', ph: '[Insert Date]', fmt: fmtDate },
  lastTime: { label: 'Last recorded signature – time', type: 'time', ph: '[Insert Time]', fmt: fmtTime },
  days: { label: 'Days absent', type: 'text', ph: '[Insert Number of Days]', hint: 'e.g. 7' },
  sinceDate: { label: 'Absent since', type: 'date', ph: '[Insert date]', fmt: fmtDate },
  belongings: { label: 'Personal belongings', type: 'select', options: [['remain in the property', 'Remain in the property'], ['have been removed from the property', 'Removed from the property']] },
  policeForce: { label: 'Police force', type: 'text', ph: '[Insert Police Force]', hint: 'e.g. Metropolitan Police' },
  ref: { label: 'Missing person report reference', type: 'text', ph: '[Insert Reference Number]' },
  safeguarding: { label: 'Safeguarding markers on the SU', type: 'select', options: [['none', 'No safeguarding markers'], ['present', 'Safeguarding markers present']] },
  markerDetails: { label: 'Safeguarding marker details', type: 'text', ph: '[Insert safeguarding marker details]', showIf: { key: 'safeguarding', eq: 'present' } },
  detectedBy: { label: 'Odour detected by', type: 'select', options: [['security', 'Security'], ['the HO', 'Housing Officer']] },
  site: { label: 'Site name', type: 'text', ph: '[Insert Site Name]' },
  referral: { label: 'How was the referral made?', type: 'select', options: [['a self-referral', 'Self-referral'], ['a staff referral', 'Staff referral']] },
  address: { label: 'SU moved to (address)', type: 'text', ph: '[Insert address]' },
  state: { label: 'Window restrictor was', type: 'select', options: [['opened', 'Opened'], ['damaged', 'Damaged']] },
  dmg: { label: 'What did the HO find?', type: 'select', options: [['damaged', 'Damaged items'], ['missing', 'Missing items'], ['damaged and missing', 'Damaged and missing items']] },
  visitor: { label: 'Visitor details', type: 'text', ph: '[Insert visitor name / description]', hint: 'e.g. an adult male, not a resident' },
  su2: { label: 'Other SU – full name & port ref', type: 'text', ph: '[Insert other SU Full Name and Port Reference Number]', hint: 'e.g. Jane Roe (MST/654321)' },
  where: { label: 'Where did it happen?', type: 'text', ph: '[Insert location – e.g. in the reception area]', hint: 'e.g. in the reception area, in the corridor' },
  cause: { label: 'What was it about?', type: 'text', ph: '[Insert brief cause]', hint: 'e.g. a disagreement over the laundry room' },
  symptoms: { label: 'What happened?', type: 'text', ph: '[Insert brief description – e.g. SU complained of chest pain]', hint: 'e.g. SU complained of chest pain' },
  outcome: { label: 'Outcome', type: 'select', options: [['was taken to hospital by ambulance', 'Taken to hospital'], ['was treated on site by the paramedics and remained at the hotel', 'Treated on site']] },
  policeReason: { label: 'Reason police attended', type: 'text', ph: '[Insert reason for attendance]', hint: 'e.g. a welfare check requested by the Home Office' },
  policeOutcome: { label: 'Outcome', type: 'text', ph: '[Insert outcome – e.g. SU spoken to by officers, no further action]' },
  damage: { label: 'Damage found', type: 'text', ph: '[Insert details of damage – e.g. broken mirror, damaged door]', hint: 'e.g. broken mirror, damaged door' },
  admitted: { label: 'SU response', type: 'select', options: [['The SU accepted responsibility for the damage', 'Accepted responsibility'], ['The SU denied causing the damage', 'Denied causing it'], ['The SU was not present at the time of the check', 'Not present']] },
  details: { label: 'Details of damage / missing items', type: 'textarea', ph: '[Insert details – e.g. lamp broken, TV not working, item(s) missing from the room]', hint: 'e.g. lamp broken, TV not working, kettle missing' },
};

/* ---------- review notes (taken from the standard templates) ---------- */
export const NOTE_GENERIC = 'If there are any circumstances that differ from the standard scenarios, please send the report for review before submission.';
export const NOTE_AGGRESSIVE = 'If the circumstances differ from the standard wording – for example, if the SU becomes aggressive, refuses to comply, or does not understand/accept the housing rules – please send the report for review before submission.';
export const NOTE_APPLIANCE = 'If the SU refuses to remove the prohibited items from the room, or otherwise refuses to comply with the instruction, the report must be sent for review before submission.';
export const NOTE_WINDOW = 'If the SU refuses to comply, requests that the window remain open fully, or there is any other variation from the standard scenario, the report must be sent for review before submission.';

export const G_MOVE = 'SU movement & welfare';
export const G_ROOM = 'Room checks – safety & prohibited items';
export const G_OTHER = 'Other';
export const G_DRAFT = 'Draft scenarios – wording to be agreed';

const APPL_B1 = 'At approximately {time}, during a routine {checkType} check, the HO identified a {applianceType} ({appliance}) in the room of SU {su}';
const FIRE_B1 = 'At {time}, during routine {checkType} checks, Housing Officer {ho} found the fire alarm covered with {material} in the room of SU {su}. (Please see attached photo on the email for reference).';
const CIG_B1 = 'At around {time}, during routine {checkType} checks, Housing Officer {ho} found cigarette butts {location} in the room of SU {su}. (Pictures attached for reference on the body of the email).';
const WELFARE_RETURN = 'HO will conduct a welfare check and remind the SU of the housing rules upon their return to the hotel.';

/* ---------- the scenarios ---------- */
export const SCENARIOS: Scenario[] = [
  {
    id: 'ftt_present', group: G_MOVE, label: 'Fail to travel', sub: 'SU present, declines',
    note: null,
    fields: [['time', { label: 'Time the taxi arrived' }], 'su', 'ho', 'reason', ['time2', { label: 'Time the driver left' }]],
    lead: 'Fail to travel due to {reason}',
    bullets: [
      'At {time}, the taxi driver arrived on site to collect SU {su} for their scheduled dispersal.',
      'Housing Officer {ho} informed the SU that the taxi has arrived to pick them up for the dispersal accommodation.',
      'SU informed the HO that they did not wish to travel due to {reason}.',
      'HO informed the taxi driver, following which the driver departed the premises at approximately {time2}.',
    ],
    actions: [
      'Informed the line management and concerned department about the SU’s FTT.',
      'HO reminded the SU that accommodation is non-choice-based and advised them to contact Migrant Help.',
    ],
    warning: 'N/A',
  },
  {
    id: 'ftt_absent', group: G_MOVE, label: 'Fail to travel', sub: 'SU not present / not answering',
    note: null,
    fields: [['time', { label: 'Time the taxi arrived' }], 'su', 'ho', 'lastDate', 'lastTime', ['time2', { label: 'Time the driver left' }]],
    lead: 'Failed to travel as the SU was not present on the premises and could not be reached by telephone.',
    bullets: [
      'At {time}, the taxi driver arrived on site to collect SU {su} for their scheduled dispersal.',
      'Housing Officer {ho} was unable to reach the SU via phone to inform that the taxi has arrived to pick them up for the dispersal accommodation, hence went to the room to inform the SU, however the SU was not in the room.',
      'HO also checked the relevant security logs, which indicated that the SU was not present at the hotel. The last recorded signature was on {lastDate} at {lastTime}. No prior notification had been provided regarding the SU’s absence.',
      'HO informed the taxi driver, following which the driver departed the premises at approximately {time2}.',
    ],
    actions: [
      'Informed the line management and concerned department about the SU’s FTT.',
      'HO will remind the SU that accommodation is non-choice-based and advise them to contact Migrant Help upon their return to the hotel.',
    ],
    warning: 'N/A',
  },
  {
    id: 'missing', group: G_MOVE, label: 'Missing SU', sub: 'reported to police',
    note: null, police: true,
    fields: ['days', 'su', 'sinceDate', 'belongings', 'policeForce', 'ref', 'safeguarding', 'markerDetails'],
    lead: 'SU has been absent for over {days} days with no contact and has been reported missing to the Police',
    bullets: [
      'SU {su} has been absent from the accommodation since {sinceDate}.',
      'The HO has made multiple attempts to contact the SU by telephone to establish their whereabouts; however, there has been no response.',
      'Room check was conducted. Staff noticed that personal belongings of the SU {belongings}.',
      'There are no next-of-kin or emergency contact details available on record that could assist in establishing their whereabouts.',
      'Due to the continued absence and inability to contact the SU, a missing person report has been submitted online to the {policeForce}. The reference number is ({ref}).',
      (v) => (v.safeguarding === 'present'
        ? 'The SU has the following safeguarding marker(s) on record: {markerDetails}.'
        : 'There are no safeguarding markers on the SU.'),
    ],
    actions: ['Multiple attempts to contact the SU were unsuccessful; the case has been escalated to the {policeForce} as a missing person report.'],
    warning: 'N/A',
  },
  {
    id: 'underage', group: G_MOVE, label: 'SU assessed as underage', sub: '',
    note: null,
    fields: [['time', { label: 'Time council / social services attended' }], 'site', 'referral', 'address'],
    lead: 'Service User has been assessed to be underage by local authority and taken away from the site.',
    bullets: [
      'At approximately {time}, council/social services staff attended {site} regarding above mentioned SU following {referral}.',
      'Following the assessment, council staff confirmed the SU is underage and subsequently moved to {address}.',
    ],
    actions: ['Staff notified Service Centre by email.', 'Engaged with the council team.'],
    warning: 'N/A',
  },

  {
    id: 'fire_present', group: G_ROOM, label: 'Fire alarm covered', sub: 'SU present',
    note: NOTE_AGGRESSIVE,
    fields: [['time', { label: 'Time of check' }], 'checkType', 'ho', 'material', 'su'],
    lead: 'Fire alarm covered with {material}',
    bullets: [FIRE_B1, 'HO gave a verbal warning and reiterated the housing policy.'],
    actions: ['Removed {material|the} from the fire alarm.', 'Fire Safety rules explained.', 'Verbal warning was issued to the SU.'],
    warning: 'Requesting',
  },
  {
    id: 'fire_absent', group: G_ROOM, label: 'Fire alarm covered', sub: 'SU not present',
    note: null,
    fields: [['time', { label: 'Time of check' }], 'checkType', 'ho', 'material', 'su'],
    lead: 'Fire alarm covered with {material}',
    bullets: [FIRE_B1, 'SU was not present in the room at the time of the check.'],
    actions: ['Removed {material|the} from the fire alarm.', WELFARE_RETURN],
    warning: 'Requesting',
  },
  {
    id: 'cig_present', group: G_ROOM, label: 'Cigarette butts in room', sub: 'SU present',
    note: NOTE_AGGRESSIVE,
    fields: [['time', { label: 'Time of check' }], 'checkType', 'ho', 'location', 'su'],
    lead: 'Evidence of smoking in the room as cigarette butts were found',
    bullets: [CIG_B1, 'HO reiterated the housing rules to the SU and a verbal warning was given.'],
    actions: ['Verbal warning given.', 'Explained housing rules to the SU.'],
    warning: 'Please issue',
  },
  {
    id: 'cig_absent', group: G_ROOM, label: 'Cigarette butts in room', sub: 'SU not present',
    note: null,
    fields: [['time', { label: 'Time of check' }], 'checkType', 'ho', 'location', 'su'],
    lead: 'Evidence of smoking in the room as cigarette butts were found',
    bullets: [CIG_B1, 'SU was not present in the room at the time of the check.'],
    actions: [WELFARE_RETURN],
    warning: 'Please issue',
  },
  {
    id: 'appl_present', group: G_ROOM, label: 'Prohibited appliance', sub: 'SU present',
    note: NOTE_APPLIANCE,
    fields: [['time', { label: 'Time of check' }], 'checkType', 'applianceType', 'appliance', 'su'],
    lead: '{applianceType|cap} identified in SU’s room',
    bullets: [
      `${APPL_B1}. (Pictures attached for reference on the body of the email).`,
      'SU was asked to hand over the {appliance} for storage due to safety reasons until their departure, and the SU handed the appliance over to the HO.',
    ],
    actions: ['HO explained the rules and regulations of the hotel.', 'A verbal warning has been given to the SU.'],
    warning: 'Requesting',
  },
  {
    id: 'appl_absent', group: G_ROOM, label: 'Prohibited appliance', sub: 'SU not present',
    note: null,
    fields: [['time', { label: 'Time of check' }], 'checkType', 'applianceType', 'appliance', 'room', 'su'],
    lead: '{applianceType|cap} identified in SU’s room',
    bullets: [
      `${APPL_B1} (Room {room}). (Pictures attached for reference on the body of the email).`,
      'SU was not present in the room at the time of the check, and HO removed the {appliance} due to the fire safety risk.',
    ],
    actions: [WELFARE_RETURN],
    warning: 'Requesting',
  },
  {
    id: 'cooking', group: G_ROOM, label: 'SU cooking in room', sub: '',
    note: null,
    fields: [['time', { label: 'Time odour detected' }], 'detectedBy', 'su'],
    lead: 'SU Cooking in Room; Items Removed for Safety',
    bullets: [
      'At approximately {time}, {detectedBy} detected a strong cooking odour coming from the room of SU {su}. (Please see attached photo on the email for reference).',
      'Housing team investigated and found the SU cooking in the room.',
      'SU was reminded of housing rules and due to fire safety requirements, all the cooking items were removed from the room and kept in storage until SU’s departure.',
    ],
    actions: ['Housing rules explained to SU.', 'Verbal warning given.'],
    warning: 'Requesting',
  },
  {
    id: 'window', group: G_ROOM, label: 'Window restrictor', sub: 'opened / damaged',
    note: NOTE_WINDOW,
    fields: [['time', { label: 'Time of welfare check' }], 'state'],
    lead: '{state|cap} window restrictor.',
    bullets: [
      'At {time} HO was on welfare checks and noticed that the window restrictor was {state}. (Pictures attached for reference on the body of the email).',
      'SU had previously been advised not to open the restrictor and to report any damage.',
      'Staff have a signed document confirming that the restrictors had been installed and were working.',
    ],
    actions: ['Verbal warning given.', 'Advised SU not to open the restrictor and to report any damage.'],
    warning: 'Requesting',
  },

  {
    id: 'visitor', group: G_DRAFT, draft: true, label: 'Unauthorised visitor', sub: 'in SU room',
    note: 'If the visitor refuses to leave, becomes aggressive, or the police are called, send the report for review before submission.',
    fields: [['time', { label: 'Time of check' }], 'checkType', 'ho', 'su', 'visitor', ['time2', { label: 'Time the visitor left' }]],
    lead: 'Unauthorised visitor found in SU’s room',
    bullets: [
      'At approximately {time}, during routine {checkType} checks, Housing Officer {ho} found an unauthorised visitor ({visitor}) in the room of SU {su}.',
      'HO reminded the SU that visitors are not permitted in the accommodation, and the visitor was asked to leave the premises.',
      'The visitor left the premises at approximately {time2}.',
    ],
    actions: ['Visitor asked to leave the premises.', 'Housing rules explained to the SU.', 'Verbal warning given.'],
    warning: 'Requesting',
  },
  {
    id: 'altercation', group: G_DRAFT, draft: true, label: 'Altercation between SUs', sub: 'verbal only',
    note: 'Use this only for verbal altercations. If there was any physical contact, injury, weapon or police involvement, write the report in your own words and send it for review.',
    fields: [['time', { label: 'Time of altercation' }], 'where', 'su', 'su2', 'cause', 'ho'],
    lead: 'Verbal altercation between SUs',
    bullets: [
      'At approximately {time}, a verbal altercation took place {where} between SU {su} and SU {su2}.',
      'The altercation was reported to be about {cause}.',
      'Housing Officer {ho} and security intervened, separated the SUs and de-escalated the situation.',
      'No physical contact or injuries were reported.',
    ],
    actions: ['Both SUs were spoken to separately and reminded of the housing rules.', 'Verbal warning given to both SUs.'],
    warning: 'Requesting',
  },
  {
    id: 'ambulance', group: G_DRAFT, draft: true, label: 'Medical emergency', sub: 'ambulance called',
    note: 'If there is any safeguarding concern, inform the safeguarding team and send the report for review before submission.',
    offenders: 'na', ambulance: true,
    fields: [['time', { label: 'Time staff were informed' }], 'su', 'ho', 'symptoms', 'outcome'],
    lead: 'Ambulance called for SU',
    bullets: [
      'At approximately {time}, Housing Officer {ho} was informed that SU {su} required medical attention ({symptoms}).',
      'An ambulance was called, and staff stayed with the SU until the paramedics arrived.',
      'Following assessment, the SU {outcome}.',
    ],
    actions: ['Ambulance called and staff supported the SU until the paramedics arrived.', 'Line management informed.', 'HO will conduct a welfare check on the SU.'],
    warning: 'N/A',
  },
  {
    id: 'policevisit', group: G_DRAFT, draft: true, label: 'Police attended site', sub: '',
    note: null, police: true,
    fields: [['time', { label: 'Time police arrived' }], 'su', 'policeReason', 'ho', 'policeOutcome'],
    lead: 'Police attendance at site',
    bullets: [
      'At approximately {time}, police officers attended the site regarding SU {su}.',
      'The reason for the attendance was {policeReason}.',
      'Housing Officer {ho} assisted the officers as required.',
      'Outcome: {policeOutcome}.',
    ],
    actions: ['Line management informed.', 'CAD/reference number recorded.'],
    warning: 'N/A',
  },
  {
    id: 'damage', group: G_DRAFT, draft: true, label: 'Damage to hotel property', sub: 'by resident SU',
    note: NOTE_AGGRESSIVE,
    fields: [['time', { label: 'Time of check' }], 'checkType', 'ho', 'su', 'damage', 'admitted'],
    lead: 'Damage to hotel property in SU’s room',
    bullets: [
      'At approximately {time}, during routine {checkType} checks, Housing Officer {ho} identified damage in the room of SU {su}: {damage}. (Pictures attached for reference on the body of the email).',
      '{admitted}.',
      'The damage has been reported to the GM and Maintenance team.',
    ],
    actions: ['Damage recorded and reported to the GM and Maintenance team.', 'Housing rules explained to the SU.', 'Verbal warning given.'],
    warning: 'Requesting',
  },

  {
    id: 'roomcheck', group: G_OTHER, label: 'Damage / missing items', sub: 'after SU departure',
    note: null,
    fields: [['time', { label: 'Time of room check' }], 'su', 'ho', 'dmg', 'details'],
    lead: '{dmg|cap} items in the room following SU’s departure.',
    bullets: [
      'At approximately {time}, following the departure of SU {su} from the accommodation, HO {ho} carried out a check of the room.',
      'During the check, HO identified the following: {details}.',
      'Photographs of the damage/missing items were taken for reference. (Please attach photos on the email.)',
    ],
    actions: ['HO conducted a room check after the SU departed.', 'Details of the damage/missing items recorded and reported to the GM and Maintenance team.'],
    warning: 'N/A',
  },
  {
    id: 'blank', group: G_OTHER, label: 'Blank', sub: 'write your own',
    note: 'Write the incident description and action taken in your own words below – state only facts.',
    fields: [],
    lead: '',
    bullets: [''],
    actions: [''],
    warning: 'N/A',
  },
];

export const WARNING_OPTIONS = ['N/A', 'Requesting', 'Please issue', 'Yes', 'No'];

export interface AuthRow {
  key: 'safe' | 'police' | 'amb' | 'fire';
  label: string;
  whoLabel: string;
  ph: string;
}
export const AUTH_ROWS: AuthRow[] = [
  { key: 'safe', label: 'Safeguarding Informed?', whoLabel: 'Who?', ph: '[Insert name / team informed]' },
  { key: 'police', label: 'Police Involved?', whoLabel: 'CAD Ref', ph: '[Insert CAD or reference number]' },
  { key: 'amb', label: 'Ambulance Involved?', whoLabel: 'CAD Ref', ph: '[Insert CAD or reference number]' },
  { key: 'fire', label: 'Fire Service Involved?', whoLabel: 'CAD Ref', ph: '[Insert CAD or reference number]' },
];

/** [property number, site name] */
export const SITES: [string, string][] = [
  ['519', 'Brit Hotel'],
  ['712', 'Leigham Court Hotel'],
  ['483', 'Maida Vale Aparthotel'],
  ['640', 'Clapham South Dudley Hotel'],
  ['443', 'Holiday Inn Lambeth'],
  ['632', 'Stansted Hotel (Ibis Budget Bishop’s Stortford)'],
  ['449', 'Holiday Inn Old Street'],
  ['546', 'Holiday Inn Swiss Cottage'],
  ['715', 'Ibis Cardiff City Centre'],
  ['665', 'Hilton Hampton - Ealing'],
  ['562', 'Ibis Styles - Seven Kings'],
  ['741', 'Clacton Pier Avenue'],
  ['776', 'Lea Halls'],
  ['820', 'Mercure Heathrow Hotel'],
  ['545', 'Parmiter PDA'],
];
export const siteText = (s: [string, string]): string => `${s[0]} (${s[1]})`;

export const CST_EMAIL = 'CST@Clearsprings.co.uk';

export const EMAIL_TYPES: [string, string, string][] = [
  ['standard', 'Standard IR', ''],
  ['warning', 'Warning letter request', 'WARNING LETTER '],
  ['review', 'Before submission (for review)', '(For Review) '],
  ['updated', 'Updated IR', 'UPDATED '],
  ['hpn', 'HPN IR', 'HPN '],
];
