import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Copy, 
  Check, 
  Download, 
  TrendingUp, 
  ArrowUpRight, 
  ShieldAlert, 
  Calendar 
} from 'lucide-react';
import { INCIDENT_CATEGORIES } from './DashboardAnalytics';
import { exportTableToCsv } from '../../utils/csvExport';
import { formatDataAsExcelClipboardTsv } from '../../utils/workbookExport';

interface MonthlyIncidentsTableProps {
  monthlyData: Array<{
    monthKey: string;
    month: string;
    'Medical Emergency': number;
    'Behavioral & Conflict': number;
    'Safeguarding & Welfare': number;
    'Curfew & Non-Compliance': number;
    'Property Damage & Hazard': number;
    'Substance Misuse': number;
    total: number;
  }>;
  onNavigate?: (page: string) => void;
}

export const MonthlyIncidentsTable: React.FC<MonthlyIncidentsTableProps> = ({ 
  monthlyData,
  onNavigate 
}) => {
  const [copied, setCopied] = useState(false);

  // Compute category column totals across all months
  const categoryTotals = INCIDENT_CATEGORIES.map(cat => ({
    key: cat.key,
    label: cat.label,
    shortName: cat.shortName,
    color: cat.color,
    total: monthlyData.reduce((sum, row) => sum + ((row as any)[cat.key] || 0), 0)
  }));

  const grandTotal = monthlyData.reduce((sum, row) => sum + (row.total || 0), 0);

  // Copy tabular data to clipboard formatted for direct paste into Excel / SharePoint
  const handleCopyToClipboard = () => {
    const headers = ['Month', ...INCIDENT_CATEGORIES.map(c => c.label), 'Total Incidents'];
    const rows = monthlyData.map(row => [
      row.month,
      ...INCIDENT_CATEGORIES.map(c => (row as any)[c.key] || 0),
      row.total
    ]);
    // Add summary row
    rows.push([
      'Grand Total',
      ...categoryTotals.map(c => c.total),
      grandTotal
    ]);

    const tsvText = formatDataAsExcelClipboardTsv(headers, rows);
    navigator.clipboard.writeText(tsvText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Month Key', 'Month Label', ...INCIDENT_CATEGORIES.map(c => c.label), 'Total Volume'];
    const rows = monthlyData.map(row => [
      row.monthKey,
      row.month,
      ...INCIDENT_CATEGORIES.map(c => (row as any)[c.key] || 0),
      row.total
    ]);

    exportTableToCsv({
      filename: `Monthly_Incident_Types_Breakdown_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    });
  };

  return (
    <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-4 space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#edebe9] gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-red-100 text-[#a4262c] rounded-xs">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#242424] flex items-center gap-2">
              Monthly Incident Types Breakdown Matrix
              <span className="text-[10px] px-2 py-0.5 font-normal bg-[#f3f8fd] text-[#0f766e] border border-[#5eead4] rounded">
                Cross-Tabular Audit
              </span>
            </h3>
            <p className="text-xs text-[#605e5c] mt-0.5">
              Detailed chronological matrix of all logged behavioral, medical, and property incidents across accommodation sites.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyToClipboard}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-white border border-[#8a8886] hover:bg-[#edebe9] text-[#323130] rounded-xs transition-colors shadow-2xs"
            title="Copy table to clipboard for pasting into SharePoint / Excel"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#107c10]" />
                <span className="text-[#107c10]">Copied for Excel!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#0d9488]" />
                <span>Copy for Excel</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-[#f3f8fd] hover:bg-[#f0fdfa] text-[#0d9488] border border-[#99f6e4] rounded-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate('escalations')}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xs transition-colors"
            >
              <span>Escalations Log</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Cross-Tabular Matrix Table */}
      <div className="overflow-x-auto border border-[#edebe9] rounded-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold">
              <th className="p-2.5 w-28">Month Period</th>
              {INCIDENT_CATEGORIES.map(cat => (
                <th key={cat.key} className="p-2.5 text-center font-medium">
                  <div className="flex items-center justify-center gap-1">
                    <span 
                      className="w-2 h-2 rounded-full inline-block shrink-0" 
                      style={{ backgroundColor: cat.color }} 
                    />
                    <span className="truncate max-w-[110px]" title={cat.label}>{cat.shortName}</span>
                  </div>
                </th>
              ))}
              <th className="p-2.5 text-right font-bold text-[#242424] w-24">
                Total Month
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edebe9]">
            {monthlyData.map((row, idx) => {
              const isPeak = row.total > 0 && row.total === Math.max(...monthlyData.map(m => m.total));
              return (
                <tr key={row.monthKey} className="hover:bg-[#f3f8fd] transition-colors">
                  <td className="p-2.5 font-semibold text-[#242424] flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-[#0d9488]" />
                    <span>{row.month}</span>
                    {isPeak && (
                      <span className="text-[9px] px-1 py-0.2 bg-red-100 text-red-800 rounded font-bold">
                        Peak
                      </span>
                    )}
                  </td>
                  {INCIDENT_CATEGORIES.map(cat => {
                    const count = (row as any)[cat.key] || 0;
                    return (
                      <td 
                        key={cat.key} 
                        className={`p-2.5 text-center font-mono ${
                          count > 0 ? 'text-[#242424] font-semibold' : 'text-neutral-300'
                        }`}
                      >
                        {count > 0 ? count : '—'}
                      </td>
                    );
                  })}
                  <td className="p-2.5 text-right font-bold text-[#242424] font-mono">
                    <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-800">
                      {row.total}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#faf9f8] border-t-2 border-[#edebe9] font-bold text-[#242424]">
              <td className="p-2.5 text-xs uppercase tracking-wider text-[#605e5c]">
                Grand Totals
              </td>
              {categoryTotals.map(cat => (
                <td key={cat.key} className="p-2.5 text-center font-mono text-xs">
                  <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                    {cat.total}
                  </span>
                </td>
              ))}
              <td className="p-2.5 text-right font-mono text-sm text-[#0d9488]">
                {grandTotal}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#605e5c]">
        <span>
          Includes verified incident logs from Police CAD dispatch, 999 paramedic callouts, warning notices, and staff logs.
        </span>
        <span className="font-semibold text-neutral-700">
          6-Month Cumulative Total: <strong className="text-red-700">{grandTotal} Incidents</strong>
        </span>
      </div>
    </div>
  );
};
