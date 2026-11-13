/** Fictional sample data for the mock-ups. Nothing here is real: names, references, phones and properties are invented. */

function rng(seed) {
  let h = 2166136261;
  for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}
const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];

const NAMES = ['Amara Okafor', 'Daniel Kovac', 'Leila Haddad', 'Tomas Eriksen', 'Priya Nair', 'Samuel Adeyemi', 'Mina Tanaka', 'Idris Bello', 'Sofia Marin', 'Yusuf Demir', 'Hana Novak', 'Ravi Menon', 'Elena Petrova', 'Kwame Boateng'];
const STAFF = ['Jordan Ellis', 'Morgan Blake', 'Casey Rowan', 'Alex Hartley', 'Sam Whitlock', 'Riley Chandra'];
const SITES = ['Riverside Court', 'Harbour View Hotel', 'Elm Park Lodge', 'Northgate Suites', 'Willow House', 'Kingsway Inn'];
const COUNCILS = ['Northvale Council', 'Eastmere Borough', 'Westbrook Council', 'Southfield Council'];
const NATION = ['Eritrean', 'Syrian', 'Afghan', 'Sudanese', 'Iranian', 'Ukrainian'];
const LANG = ['Tigrinya', 'Arabic', 'Pashto', 'Farsi', 'Ukrainian', 'Amharic'];
const VENDORS = ['Greenfield Supplies Ltd', 'Brightway Linen Co', 'Northern Catering Group', 'SafeServe Maintenance', 'Clearwater Services'];
const SENTENCES = [
  'Follow-up booked for next week; no further concerns raised.',
  'Resident engaged well and agreed the plan.',
  'Awaiting response from the local authority.',
  'Issue reported by night staff and checked on site.',
  'Reviewed with the manager; action closed.',
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateStr = (r, back = 30) => { const d = new Date(Date.UTC(2026, 10, 9) - Math.floor(r() * back) * 86400000); return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} 2026`; };
const futureStr = (r, fwd = 40) => { const d = new Date(Date.UTC(2026, 10, 9) + (3 + Math.floor(r() * fwd)) * 86400000); return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} 2026`; };
const dobStr = r => `${String(1 + Math.floor(r() * 27)).padStart(2, '0')} ${pick(r, MONTHS)} ${1962 + Math.floor(r() * 45)}`;

/** Value for a field label. options (if the web app defines them) win. */
function valueFor(label, r, ctx = {}) {
  const l = label.toLowerCase();
  if (ctx.options && ctx.options.length) return pick(r, ctx.options);
  if (/status|stage/.test(l) && ctx.statuses) return pick(r, ctx.statuses);
  if (/e-?mail/.test(l)) return `${pick(r, STAFF).split(' ')[0].toLowerCase()}@example.org`;
  if (/phone|contact (no|number)|mobile|\btel\b/.test(l)) return `07700 900${String(100 + Math.floor(r() * 899))}`;
  if (/(service user|resident|su|client|payee|subject|name).*name|^name$|full name|user name|resident$|officer name|raised by|submitted by|recorded by|inspected by|inspecting officer|logged by|duty|worker|created by|approved by|received by|done by|cardholder|house officer|lead|key contact|officer|agent$/.test(l)) {
    return /officer|worker|raised by|submitted|recorded|inspected|inspecting|logged by|duty|created by|approved|received by|done by|house|lead|cardholder|agent|key contact/.test(l) ? pick(r, STAFF) : pick(r, NAMES);
  }
  if (/\brole\b/.test(l)) return pick(r, ['Staff', 'Area Manager', 'General Manager', 'Regional Manager']);
  if (/city|area\b|town/.test(l) && !/site/.test(l)) return pick(r, ['Northvale', 'Eastmere', 'Westbrook', 'Southfield']);
  if (/hotel|site|property|location|accommodation/.test(l)) return pick(r, SITES);
  if (/council|authority/.test(l)) return pick(r, COUNCILS);
  if (/vendor|supplier|merchant|contractor|courier|organisation|agency/.test(l)) return pick(r, VENDORS);
  if (/nationality|country/.test(l)) return pick(r, NATION);
  if (/language/.test(l)) return pick(r, LANG);
  if (/gender/.test(l)) return pick(r, ['Female', 'Male']);
  if (/date of birth|dob|d\.o\.b/.test(l)) return dobStr(r);
  if (/due|expiry|next review|review date|follow/.test(l) && /date|by|due|expiry|review/.test(l)) return futureStr(r);
  if (/date|day|received|issued|from|until|since|timestamp/.test(l)) return dateStr(r);
  if (/time/.test(l)) return `${String(8 + Math.floor(r() * 10)).padStart(2, '0')}:${pick(r, ['00', '15', '30', '45'])}`;
  if (/amount|total|subtotal|£|value|payable|cost|price/.test(l)) return `£${(80 + Math.floor(r() * 2400)).toLocaleString('en-GB')}.00`;
  if (/vat|tax/.test(l)) return `£${(10 + Math.floor(r() * 300))}.00`;
  if (/port|nass|ref|urn|mosaic|ticket|reference|po\b|id$|code|number|#/.test(l)) return `${pick(r, ['PR', 'HO', 'SG', 'NA'])}-${10000 + Math.floor(r() * 89999)}`;
  if (/room|flat|unit|wing|house/.test(l)) return String(100 + Math.floor(r() * 320));
  if (/floor/.test(l)) return pick(r, ['Ground', '1', '2', '3']);
  if (/quantity|count|number of|no\. of|no of|capacity|occupan|bags|batches|weight|miles|stock|distance|collected|distributed|received|target|total/.test(l)) return String(2 + Math.floor(r() * 60));
  if (/\byes\b|required|registered|issued|wants|family|individual|vulnerable|void|available|acknowledg|reported|change|submitted to|sign-off|wl\b/.test(l)) return pick(r, ['Yes', 'No']);
  if (/risk|priority|urgency|level|rating|score|grade/.test(l)) return pick(r, ['Low', 'Medium', 'High']);
  if (/type|category|group|reason|method|mode|kind|class/.test(l)) return pick(r, ['Routine', 'Urgent', 'Follow-up', 'Information']);
  if (/description|summary|details|notes|comments|remarks|action|update|justification|response|outcome|remedies|advice|issue|vulnerability|services|address/.test(l)) {
    return /address/.test(l) ? `${12 + Math.floor(r() * 80)} Meadow Lane, Northvale` : pick(r, SENTENCES);
  }
  return pick(r, ['Confirmed', 'Recorded', 'Yes', 'Standard']);
}

module.exports = { rng, pick, valueFor, NAMES, STAFF, SITES, SENTENCES, dateStr, futureStr };
