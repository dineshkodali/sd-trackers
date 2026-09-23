import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DispersalTableSection } from './DispersalTableSection';
import { EvictionTableSection } from './EvictionTableSection';

export const DispersalSheetView: React.FC = () => {
  const { dispersalRecords, evictionRecords } = useApp();
  const [activeTab, setActiveTab] = useState<'dispersal' | 'eviction'>('dispersal');

  return activeTab === 'dispersal' ? (
    <DispersalTableSection
      activeTab={activeTab}
      onTabChange={setActiveTab}
      dispersalCount={dispersalRecords.length}
      evictionCount={evictionRecords.length}
    />
  ) : (
    <EvictionTableSection
      activeTab={activeTab}
      onTabChange={setActiveTab}
      dispersalCount={dispersalRecords.length}
      evictionCount={evictionRecords.length}
    />
  );
};
