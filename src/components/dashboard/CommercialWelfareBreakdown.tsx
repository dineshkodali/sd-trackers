import React from 'react';
import { 
  Soup, 
  Shirt, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ArrowUpRight, 
  ThermometerSnowflake, 
  Flame
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface CommercialWelfareBreakdownProps {
  onNavigate: (page: string) => void;
}

export const CommercialWelfareBreakdown: React.FC<CommercialWelfareBreakdownProps> = ({ 
  onNavigate 
}) => {
  const { foodRecords, laundryRecords } = useApp();

  // Food Metrics
  const totalMeals = foodRecords.length;
  const compliantTemps = foodRecords.filter(f => f.tempCheckedCelsius >= 63).length;
  const nonCompliantTemps = totalMeals - compliantTemps;
  const foodComplianceRate = totalMeals > 0 ? Math.round((compliantTemps / totalMeals) * 100) : 100;

  // Dietary requirements breakdown
  const halalCount = foodRecords.filter(f => typeof f.dietaryRequirement === 'string' && f.dietaryRequirement.toLowerCase().includes('halal')).length;
  const vegetarianCount = foodRecords.filter(f => typeof f.dietaryRequirement === 'string' && f.dietaryRequirement.toLowerCase().includes('veg')).length;
  const diabeticCount = foodRecords.filter(f => typeof f.dietaryRequirement === 'string' && f.dietaryRequirement.toLowerCase().includes('diabetic')).length;
  const standardCount = totalMeals - (halalCount + vegetarianCount + diabeticCount);

  // Laundry Metrics
  const totalBags = laundryRecords.reduce((sum, l) => sum + (l.bagCount || 1), 0);
  const washingCount = laundryRecords.filter(l => l.status === 'Washing').length;
  const dryingCount = laundryRecords.filter(l => l.status === 'Drying').length;
  const readyCount = laundryRecords.filter(l => l.status === 'Ready for Collection' || l.status === 'Collected').length;
  const queuedCount = laundryRecords.filter(l => l.status === 'Queued').length;
  const totalTokens = laundryRecords.reduce((sum, l) => sum + (l.tokensIssued || 0), 0);

  return (
    <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-4 space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#edebe9] gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-xs">
            <Soup className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#242424] flex items-center gap-2">
              Commercial Service Delivery Breakdown: Meals &amp; Laundry
              <span className="text-[10px] px-2 py-0.5 font-normal bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                Welfare Standards
              </span>
            </h3>
            <p className="text-xs text-[#605e5c] mt-0.5">
              Daily food safety probe temperatures, dietary fulfillment, and accommodation laundry wash-cycle turnover.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigate('food')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xs transition-colors"
          >
            <Soup className="w-3.5 h-3.5" />
            <span>Food Tracker</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>

          <button
            onClick={() => onNavigate('laundry')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xs transition-colors"
          >
            <Shirt className="w-3.5 h-3.5" />
            <span>Laundry Tracker</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Two-Column Welfare Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Column 1: Food & Nutrition Delivery */}
        <div className="border border-[#e1dfdd] rounded-xs p-3.5 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-orange-100 text-[#d83b01] rounded">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-[#242424]">Hot Meals &amp; Temperature Hygiene</h4>
                <p className="text-[10px] text-[#605e5c]">UK Statutory Food Hygiene Target: ≥ 63°C</p>
              </div>
            </div>
            <span className="text-sm font-mono font-bold text-[#107c10] bg-[#f1faf0] px-2 py-0.5 rounded border border-[#cbe8cb]">
              {foodComplianceRate}% Compliant
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#faf9f8] p-2 rounded border border-[#edebe9]">
              <span className="text-[10px] text-[#605e5c] block">Total Deliveries</span>
              <span className="text-lg font-bold text-[#242424] font-mono">{totalMeals}</span>
            </div>
            <div className="bg-[#f1faf0] p-2 rounded border border-[#cbe8cb]">
              <span className="text-[10px] text-[#107c10] font-medium block">Compliant (≥63°C)</span>
              <span className="text-lg font-bold text-[#107c10] font-mono">{compliantTemps}</span>
            </div>
            <div className="bg-red-50 p-2 rounded border border-red-200">
              <span className="text-[10px] text-[#a4262c] font-medium block">Flagged (&lt;63°C)</span>
              <span className="text-lg font-bold text-[#a4262c] font-mono">{nonCompliantTemps}</span>
            </div>
          </div>

          {/* Dietary Breakdown */}
          <div className="pt-2 border-t border-[#edebe9] space-y-1.5">
            <span className="text-[11px] font-semibold text-[#605e5c] block uppercase tracking-wider">
              Dietary Profiles Fulfilled
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
              <div className="p-1.5 bg-[#f3f8fd] rounded text-center">
                <span className="text-[10px] text-[#0f766e] block">Halal Certified</span>
                <strong className="text-[#0f766e] font-mono">{halalCount}</strong>
              </div>
              <div className="p-1.5 bg-emerald-50 rounded text-center">
                <span className="text-[10px] text-emerald-800 block">Vegetarian</span>
                <strong className="text-emerald-800 font-mono">{vegetarianCount}</strong>
              </div>
              <div className="p-1.5 bg-purple-50 rounded text-center">
                <span className="text-[10px] text-purple-800 block">Diabetic Spec</span>
                <strong className="text-purple-800 font-mono">{diabeticCount}</strong>
              </div>
              <div className="p-1.5 bg-neutral-100 rounded text-center">
                <span className="text-[10px] text-neutral-700 block">Standard</span>
                <strong className="text-neutral-800 font-mono">{Math.max(0, standardCount)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Laundry Turnaround */}
        <div className="border border-[#e1dfdd] rounded-xs p-3.5 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-100 text-slate-700 rounded">
                <Shirt className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-[#242424]">Laundry Facility Turnover</h4>
                <p className="text-[10px] text-[#605e5c]">Wash token issuance &amp; collection schedule</p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
              {totalTokens} Tokens Issued
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-amber-50 p-2 rounded border border-amber-200">
              <span className="text-[10px] text-amber-800 font-medium block">Queued</span>
              <span className="text-base font-bold text-amber-900 font-mono">{queuedCount}</span>
            </div>
            <div className="bg-sky-50 p-2 rounded border border-sky-200">
              <span className="text-[10px] text-sky-800 font-medium block">Washing</span>
              <span className="text-base font-bold text-sky-900 font-mono">{washingCount}</span>
            </div>
            <div className="bg-purple-50 p-2 rounded border border-purple-200">
              <span className="text-[10px] text-purple-800 font-medium block">Drying</span>
              <span className="text-base font-bold text-purple-900 font-mono">{dryingCount}</span>
            </div>
            <div className="bg-[#f1faf0] p-2 rounded border border-[#cbe8cb]">
              <span className="text-[10px] text-[#107c10] font-medium block">Ready</span>
              <span className="text-base font-bold text-[#107c10] font-mono">{readyCount}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#edebe9] flex items-center justify-between text-xs text-[#605e5c]">
            <span>Total Intake Volume: <strong className="text-[#242424] font-mono">{totalBags} Laundry Bags</strong></span>
            <span className="text-[#107c10] font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#107c10]" />
              Same-day collection active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
