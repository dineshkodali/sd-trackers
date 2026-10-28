import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { TabSwitcher } from '../common/TrackerLayout';
import { FoodVendorBuffetLogSection } from './FoodVendorBuffetLogSection';
import { FoodConsumptionView } from './FoodConsumptionView';
import { SuMealTrackerView } from './SuMealTrackerView';

export interface FoodViewProps {
  initialTab?: 'consumption' | 'box_requests' | 'vendor_buffet' | 'su_meals';
}

export const FoodView: React.FC<FoodViewProps> = ({ initialTab = 'consumption' }) => {
  const { foodConsumptionReports, foodBoxRequests } = useApp();
  const [activeTab, setActiveTab] = useState<'consumption' | 'box_requests' | 'vendor_buffet' | 'su_meals'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const tabSwitcher = (
    <TabSwitcher
      label="Food sections"
      active={activeTab}
      onChange={id => setActiveTab(id as typeof activeTab)}
      tabs={[
        { id: 'consumption', label: `Food Consumption (In & Out) Log${foodConsumptionReports.length ? ` (${foodConsumptionReports.length})` : ''}` },
        { id: 'box_requests', label: `Food Box Requests & Special Diets${foodBoxRequests.length ? ` (${foodBoxRequests.length})` : ''}` },
        { id: 'vendor_buffet', label: 'Hot Meals & Buffet Vendor Log' },
        { id: 'su_meals', label: 'Service User Meals (B / L / D)' }
      ]}
    />
  );

  return (
    <div className="space-y-4">
      {/* Render Selected Tab */}
      {activeTab === 'consumption' && (
        <FoodConsumptionView initialTab="daily_report" showInternalTabs={false} tabSwitcher={tabSwitcher} />
      )}
      {activeTab === 'box_requests' && (
        <FoodConsumptionView initialTab="box_requests" showInternalTabs={false} tabSwitcher={tabSwitcher} />
      )}
      {activeTab === 'vendor_buffet' && (
        <FoodVendorBuffetLogSection tabSwitcher={tabSwitcher} />
      )}
      {activeTab === 'su_meals' && (
        <SuMealTrackerView tabSwitcher={tabSwitcher} />
      )}
    </div>
  );
};
