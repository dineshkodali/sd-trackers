import React from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  ShieldCheck, 
  Calculator, 
  Edit3, 
  Layers, 
  FileText
} from 'lucide-react';

export const UserGuideSection: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Banner */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs p-5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-[#0d9488]" />
          <h2 className="text-lg font-semibold text-[#242424]">
            Live Daily Registers — Operating Instructions & User Guide
          </h2>
        </div>
        <p className="text-xs text-[#605e5c] mt-1.5 leading-relaxed">
          Standard Operating Procedures (SOP) for hotel managers, operational staff, and safeguarding teams to ensure compliant, real-time service user occupancy tracking, room allocations, and Home Office / CRH reporting reconciliation.
        </p>
      </div>

      {/* Guide Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Data Entry Standards */}
        <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-[#0d9488]">
            <CheckCircle2 className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-[#242424]">1. Data Entry Standards & Formats</h3>
          </div>
          <ul className="text-xs text-[#323130] space-y-2 list-disc list-inside">
            <li>
              <strong>Port Reference:</strong> Always record the official Port Reference (e.g., <code className="font-mono text-indigo-700">PORT-12345</code>). This serves as the master key across all trackers.
            </li>
            <li>
              <strong>Service User Name:</strong> Enter full official spelling matching Home Office identity documents. Avoid nicknames or abbreviations.
            </li>
            <li>
              <strong>Dates & Timestamps:</strong> Enter dates using standard <span className="font-mono text-neutral-600">YYYY-MM-DD</span> format. Check-in dates and DOBs must be valid past or present dates.
            </li>
            <li>
              <strong>Spelling & Enums:</strong> Use controlled dropdowns for Room Types, Cohorts, and Gender to avoid spelling discrepancies that break reporting.
            </li>
          </ul>
        </div>

        {/* Card 2: Manual vs Calculated Fields */}
        <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-[#4338ca]">
            <Calculator className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-[#242424]">2. Manual vs. Automatically Calculated Fields</h3>
          </div>
          <div className="text-xs space-y-2 text-[#323130]">
            <p>
              The system calculates capacity, availability, and occupancy dynamically to prevent mathematical errors:
            </p>
            <div className="p-2.5 bg-blue-50 border border-blue-100 rounded text-[11px] space-y-1">
              <p><strong>Calculated Fields (Read-Only):</strong></p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-900">
                <li>Total Bedspaces Available = Max Occupancy - Current Occupancy - Void Bedspaces</li>
                <li>Live Register Occupancy Totals & Nationality Percentages</li>
                <li>Language Summary Totals & Unspecified Counts</li>
              </ul>
            </div>
            <div className="p-2.5 bg-teal-50 border border-teal-100 rounded text-[11px] space-y-1">
              <p><strong>Manual Data Entry:</strong></p>
              <ul className="list-disc list-inside space-y-0.5 text-teal-900">
                <li>Bed counts (Single, Double, Bunk, Cot)</li>
                <li>Resident demographics (DOB, Nationality, Language)</li>
                <li>Void flags and Void Reasons (mandatory if Void = Yes)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Card 3: Handling Validation Errors */}
        <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-[#242424]">3. Identifying & Fixing Validation Errors</h3>
          </div>
          <ul className="text-xs text-[#323130] space-y-2 list-disc list-inside">
            <li>
              <strong>Over-Occupancy Alert:</strong> Triggered whenever assigned residents in a room exceed the room's registered Maximum Capacity.
            </li>
            <li>
              <strong>Unassigned / Void Discrepancies:</strong> If a room is marked as <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded">Void</code>, you must enter a specific <em>Void Reason</em> (e.g. Maintenance, Deep Clean, Quarantine).
            </li>
            <li>
              <strong>Bed Inconsistencies:</strong> The sum of Single Bed, Double Bed, and Bunks must physically align with the Room Makeup classification.
            </li>
            <li>
              <strong>Validation Tab:</strong> Review the <em>Validation</em> tab before exporting weekly reports to ensure 100% compliance.
            </li>
          </ul>
        </div>

        {/* Card 4: Daily Register & Arrival Workflow */}
        <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <Layers className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-[#242424]">4. Arrivals, Dispersals & Evictions</h3>
          </div>
          <ul className="text-xs text-[#323130] space-y-2 list-disc list-inside">
            <li>
              <strong>New Arrivals:</strong> Enter arriving residents in the <em>New Arrivals</em> queue. Once room keys and Aspen cards are verified, assign them to a room to reflect on the Daily Register.
            </li>
            <li>
              <strong>Dispersals:</strong> When Home Office disperses a resident, log the departure date. The room automatically becomes available upon completion.
            </li>
            <li>
              <strong>Evictions:</strong> If an eviction notice is executed, mark status as <code className="bg-red-100 text-red-900 px-1 py-0.5 rounded">Evicted</code>. Historical records and audit notes are preserved permanently for statutory compliance.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
