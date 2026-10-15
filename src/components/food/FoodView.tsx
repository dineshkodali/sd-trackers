import React, { useState, useEffect } from 'react';
import { Utensils, Inbox, Flame } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FoodVendorBuffetLogSection } from './FoodVendorBuffetLogSection';
import { FoodConsumptionView } from './FoodConsumptionView';

export interface FoodViewProps {
  initialTab?: 'consumption' | 'box_requests' | 'vendor_buffet';
}

export const FoodView: React.FC<FoodViewProps> = ({ initialTab = 'consumption' }) => {
  const { foodConsumptionReports, foodBoxRequests } = useApp();
  const [activeTab, setActiveTab] = useState<'consumption' | 'box_requests' | 'vendor_buffet'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  return (
    <div className="space-y-4">
      {/* Top Tab Switcher Header */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-3 shadow-2xs flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xs border border-[#e2e8f0]">
          <button
            onClick={() => setActiveTab('consumption')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold transition-all ${
              activeTab === 'consumption'
                ? 'bg-white text-[#0d9488] shadow-2xs border border-[#cbd5e1]'
                : 'text-[#64748b] hover:text-[#1e293b]'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            Food Consumption (In & Out) Log
            {foodConsumptionReports.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ml-1 ${
                activeTab === 'consumption' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-slate-200 text-slate-700'
              }`}>
                {foodConsumptionReports.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('box_requests')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold transition-all ${
              activeTab === 'box_requests'
                ? 'bg-white text-[#0d9488] shadow-2xs border border-[#cbd5e1]'
                : 'text-[#64748b] hover:text-[#1e293b]'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            Food Box Requests & Special Diets
            {foodBoxRequests.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ml-1 ${
                activeTab === 'box_requests' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-slate-200 text-slate-700'
              }`}>
                {foodBoxRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('vendor_buffet')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold transition-all ${
              activeTab === 'vendor_buffet'
                ? 'bg-white text-[#0d9488] shadow-2xs border border-[#cbd5e1]'
                : 'text-[#64748b] hover:text-[#1e293b]'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Hot Meals & Buffet Vendor Log
          </button>
        </div>
      </div>

      {/* Render Selected Tab */}
      {activeTab === 'consumption' && (
        <FoodConsumptionView initialTab="daily_report" showInternalTabs={false} />
      )}
      {activeTab === 'box_requests' && (
        <FoodConsumptionView initialTab="box_requests" showInternalTabs={false} />
      )}
      {activeTab === 'vendor_buffet' && (
        <FoodVendorBuffetLogSection />
      )}
    </div>
  );
};
