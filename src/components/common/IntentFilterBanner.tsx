import React from 'react';
import { IconFilter as Filter, IconX as X } from '@tabler/icons-react';

/**
 * Shown on a page that was opened from a link with an extra filter that the page has no control for
 * (for example "open defects" or "expired by expiry date"). Says what is applied and lets the user remove it.
 */
export const IntentFilterBanner: React.FC<{ label: string; onClear: () => void }> = ({ label, onClear }) => (
  <div role="status" className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#f0fdfa] border border-[#99f6e4] rounded-xs text-xs text-[#0f766e]">
    <span className="inline-flex items-center gap-1.5 font-medium">
      <Filter className="w-3.5 h-3.5" aria-hidden="true" />
      {label}
    </span>
    <button type="button" onClick={onClear} className="inline-flex items-center gap-1 font-semibold hover:underline">
      <X className="w-3 h-3" aria-hidden="true" />
      Clear
    </button>
  </div>
);
