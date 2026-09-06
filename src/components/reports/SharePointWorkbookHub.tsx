import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Cloud, 
  Copy, 
  Check, 
  ExternalLink, 
  Download, 
  RefreshCw, 
  Settings, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight,
  Info,
  Link2,
  Table
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { exportToSharePointExcelWorkbook, formatDataAsExcelClipboardTsv } from '../../utils/workbookExport';

interface SharePointWorkbookHubProps {
  currentReportTitle: string;
  currentReportHeaders: string[];
  currentReportRows: (string | number | boolean | null | undefined)[][];
}

export const SharePointWorkbookHub: React.FC<SharePointWorkbookHubProps> = ({
  currentReportTitle,
  currentReportHeaders,
  currentReportRows
}) => {
  const { 
    settings, 
    updateSettings, 
    syncSharePointNow,
    referrals,
    vulnerableSUs,
    challengingSUs,
    maintenanceRecords,
    spcdRecords,
    foodRecords,
    laundryRecords,
    escalations
  } = useApp();

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [workbookUrl, setWorkbookUrl] = useState(
    settings.sharePointWorkbookUrl || 
    'https://commercialtrackers.sharepoint.com/:x:/r/sites/SD-Operations/Shared%20Documents/SD_Commercial_Trackers_Master.xlsx'
  );
  const [workbookName, setWorkbookName] = useState(
    settings.sharePointWorkbookName || 'SD_Commercial_Trackers_Master.xlsx'
  );
  const [defaultSheet, setDefaultSheet] = useState(
    settings.sharePointDefaultSheet || 'Referrals_Master'
  );
  const [targetFolder, setTargetFolder] = useState(
    settings.sharePointTargetFolder || 'sites/SD-Operations/Shared Documents/Master Workbooks'
  );

  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedCurrent, setCopiedCurrent] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Total records count across all trackers
  const totalRecordsCount = referrals.length + 
    vulnerableSUs.length + 
    challengingSUs.length + 
    maintenanceRecords.length + 
    spcdRecords.length + 
    foodRecords.length + 
    laundryRecords.length + 
    escalations.length;

  // Handle saving new configuration
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      sharePointWorkbookUrl: workbookUrl.trim(),
      sharePointWorkbookName: workbookName.trim(),
      sharePointDefaultSheet: defaultSheet.trim(),
      sharePointTargetFolder: targetFolder.trim()
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setIsConfigOpen(false);
    }, 1500);
  };

  // Copy all web app records formatted for Excel
  const handleCopyAllToClipboard = () => {
    const allData = [
      ['=== SD COMMERCIAL TRACKERS MASTER CONSOLIDATED DATASET ===', '', '', '', ''],
      ['Exported on:', new Date().toLocaleString(), '', '', ''],
      ['Workbook Target:', settings.sharePointWorkbookName || workbookName, '', '', ''],
      ['', '', '', '', ''],
      ['--- REFERRALS (Count: ' + referrals.length + ') ---', '', '', '', ''],
      ['ID', 'Name', 'Port Ref', 'Mosaic ID', 'Date Referred', 'Site', 'Status', 'Referral Type', 'Council'],
      ...referrals.map(r => [r.id, r.suName, r.portRef, r.mosaicId, r.dateReferred, r.site, r.status, r.referralType, r.referralCouncil]),
      ['', '', '', '', ''],
      ['--- VULNERABLE RESIDENTS (Count: ' + vulnerableSUs.length + ') ---', '', '', '', ''],
      ['ID', 'Name', 'Site', 'Room', 'Risk Level', 'Vulnerability', 'Review Date', 'Worker'],
      ...vulnerableSUs.map(v => [v.id, v.suName, v.site, v.roomOrFlatNo, v.riskLevel, v.vulnerability, v.reviewDate, v.allocatedWorker]),
      ['', '', '', '', ''],
      ['--- CHALLENGING BEHAVIOR (Count: ' + challengingSUs.length + ') ---', '', '', '', ''],
      ['ID', 'Name', 'Port Ref', 'Site', 'Incident Date', 'Issue Type', 'Risk Factor', 'Action Taken'],
      ...challengingSUs.map(c => [c.id, c.name, c.portRef, c.site, c.dateOfIncident || c.date, c.typeOfIssue, c.riskFactor, c.actionTaken]),
      ['', '', '', '', ''],
      ['--- MAINTENANCE DEFECTS (Count: ' + maintenanceRecords.length + ') ---', '', '', '', ''],
      ['ID', 'Site', 'Location / Room', 'Priority', 'Scale', 'Status', 'Reported Date', 'Description'],
      ...maintenanceRecords.map(m => [m.id, m.site, m.room || m.location, m.priority, m.priorityTimeScale, m.defectStatus, m.date, m.description])
    ];

    const tsv = allData.map(row => row.map(cell => String(cell || '').replace(/\t/g, ' ')).join('\t')).join('\r\n');
    navigator.clipboard.writeText(tsv).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 3000);
    });
  };

  // Copy current filtered table formatted for Excel
  const handleCopyCurrentTable = () => {
    if (!currentReportHeaders || currentReportHeaders.length === 0) return;
    const tsv = formatDataAsExcelClipboardTsv(currentReportHeaders, currentReportRows);
    navigator.clipboard.writeText(tsv).then(() => {
      setCopiedCurrent(true);
      setTimeout(() => setCopiedCurrent(false), 3000);
    });
  };

  // Download multi-sheet Excel Workbook (.xlsx)
  const handleDownloadWorkbook = () => {
    exportToSharePointExcelWorkbook(
      {
        referrals,
        vulnerableSUs,
        challengingSUs,
        maintenanceRecords,
        spcdRecords,
        foodRecords,
        laundryRecords,
        escalations
      },
      settings.sharePointWorkbookName || 'SD_Commercial_Trackers_Master.xlsx'
    );
  };

  // Trigger live sync
  const handleSync = () => {
    setIsSyncing(true);
    syncSharePointNow();
    setTimeout(() => {
      setIsSyncing(false);
    }, 1500);
  };

  // Open SharePoint Workbook Link
  const handleOpenWorkbookLink = () => {
    const url = settings.sharePointWorkbookUrl || workbookUrl;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="bg-white border border-[#5eead4] rounded-xs shadow-xs p-4 space-y-4 relative overflow-hidden">
      {/* Top Banner & Explanation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#edebe9]">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-[#f0fdfa] text-[#0d9488] rounded-xs shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#242424] uppercase tracking-wider">
                SharePoint &amp; Excel Online Workbook Integration
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-[#f1faf0] text-[#107c10] border border-[#cbe8cb] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Workbook Configured
              </span>
            </div>
            <p className="text-xs text-[#605e5c] mt-0.5 max-w-3xl leading-relaxed">
              <strong>Purpose:</strong> Synchronize and copy tabular records from this web app directly into your designated 
              SharePoint / OneDrive Excel Workbook. Configure your workbook link below to open the workbook or copy records with zero friction.
            </p>
          </div>
        </div>

        {/* Quick Workbook Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleOpenWorkbookLink}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#107c10] hover:bg-[#0e6b0e] text-white rounded-xs transition-colors shadow-2xs"
            title="Open configured master workbook in SharePoint / Excel Online in a new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open SharePoint Workbook</span>
          </button>

          <button
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-[#8a8886] hover:bg-[#edebe9] text-[#323130] rounded-xs transition-colors shadow-2xs"
            title="Configure SharePoint Workbook URL & target worksheet"
          >
            <Settings className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>Configure Link</span>
          </button>
        </div>
      </div>

      {/* Config Drawer / Modal (When opened) */}
      {isConfigOpen && (
        <form onSubmit={handleSaveConfig} className="bg-[#f8fafd] border border-[#5eead4] rounded-xs p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#d2e3f8]">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#0d9488]" />
              <h4 className="text-xs font-bold text-[#0f766e] uppercase tracking-wider">
                Configure SharePoint / OneDrive Workbook Link
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsConfigOpen(false)}
              className="text-xs text-[#605e5c] hover:text-[#242424]"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="md:col-span-2 space-y-1">
              <label className="font-semibold text-[#323130] flex items-center justify-between">
                <span>SharePoint / Excel Online File URL:</span>
                <span className="text-[10px] text-[#605e5c] font-normal">Link directly to the .xlsx file</span>
              </label>
              <input
                type="url"
                required
                value={workbookUrl}
                onChange={e => setWorkbookUrl(e.target.value)}
                placeholder="https://yourtenant.sharepoint.com/:x:/r/sites/.../SD_Commercial_Trackers_Master.xlsx"
                className="w-full px-2.5 py-1.5 border border-[#8a8886] rounded-xs bg-white text-xs font-mono text-[#242424] focus:border-[#0d9488] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#323130]">Workbook File Name:</label>
              <input
                type="text"
                required
                value={workbookName}
                onChange={e => setWorkbookName(e.target.value)}
                placeholder="SD_Commercial_Trackers_Master.xlsx"
                className="w-full px-2.5 py-1.5 border border-[#8a8886] rounded-xs bg-white text-xs text-[#242424] focus:border-[#0d9488] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#323130]">Default Worksheet Tab:</label>
              <input
                type="text"
                value={defaultSheet}
                onChange={e => setDefaultSheet(e.target.value)}
                placeholder="Referrals_Master"
                className="w-full px-2.5 py-1.5 border border-[#8a8886] rounded-xs bg-white text-xs text-[#242424] focus:border-[#0d9488] focus:outline-none"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="font-semibold text-[#323130]">Document Library / Site Folder Path:</label>
              <input
                type="text"
                value={targetFolder}
                onChange={e => setTargetFolder(e.target.value)}
                placeholder="sites/SD-Operations/Shared Documents/Master Workbooks"
                className="w-full px-2.5 py-1.5 border border-[#8a8886] rounded-xs bg-white text-xs font-mono text-[#242424] focus:border-[#0d9488] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#d2e3f8]">
            <span className="text-[11px] text-[#605e5c]">
              Link changes persist automatically in local workspace settings.
            </span>
            <div className="flex items-center gap-2">
              {saveSuccess && (
                <span className="text-xs font-bold text-[#107c10] flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Workbook Link Saved!
                </span>
              )}
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-semibold rounded-xs shadow-xs transition-colors"
              >
                Save Workbook Configuration
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Target Details Strip */}
      <div className="bg-[#faf9f8] border border-[#edebe9] rounded-xs p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#242424]">Target Workbook:</span>
            <span className="font-mono text-[#0d9488] font-semibold bg-white px-2 py-0.5 rounded border border-[#e1dfdd]">
              {settings.sharePointWorkbookName || workbookName}
            </span>
            <span className="text-[11px] text-[#605e5c]">
              Default Tab: <code className="font-semibold text-neutral-800">{settings.sharePointDefaultSheet || defaultSheet}</code>
            </span>
          </div>
          <p className="text-[11px] text-[#605e5c] truncate max-w-xl font-mono">
            URL: {settings.sharePointWorkbookUrl || workbookUrl}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-right">
          <div>
            <span className="text-[10px] text-[#605e5c] block">Last Workbook Sync</span>
            <span className="font-semibold text-[#242424]">
              {new Date(settings.lastSharePointSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs transition-colors disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Workbook Now'}</span>
          </button>
        </div>
      </div>

      {/* Three Action Cards to Copy Data into Workbook */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Action 1: Copy Active Table */}
        <div className="border border-[#e1dfdd] rounded-xs p-3 bg-white space-y-2 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-[#242424] flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-[#0d9488]" />
                <span>Copy Current Table</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-700">
                {currentReportRows.length} Rows
              </span>
            </div>
            <p className="text-[11px] text-[#605e5c] mt-1">
              Copies only the filtered <strong>{currentReportTitle}</strong> table with headers for instant <kbd className="bg-neutral-100 px-1 rounded font-mono">Ctrl+V</kbd> paste.
            </p>
          </div>

          <button
            onClick={handleCopyCurrentTable}
            className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold bg-white border border-[#0d9488] text-[#0d9488] hover:bg-[#f3f8fd] rounded-xs transition-colors"
          >
            {copiedCurrent ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#107c10]" />
                <span className="text-[#107c10]">Table Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Current Report Rows</span>
              </>
            )}
          </button>
        </div>

        {/* Action 2: Copy Consolidated Web App Records */}
        <div className="border border-[#5eead4] rounded-xs p-3 bg-[#f8fafd] space-y-2 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-[#0f766e] flex items-center gap-1.5">
                <Copy className="w-3.5 h-3.5 text-[#0d9488]" />
                <span>Copy All App Records</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-100 text-[#0f766e] font-bold">
                {totalRecordsCount} Total
              </span>
            </div>
            <p className="text-[11px] text-[#605e5c] mt-1">
              Copies consolidated referrals, vulnerable, challenging, and maintenance logs into clipboard formatted for Excel worksheets.
            </p>
          </div>

          <button
            onClick={handleCopyAllToClipboard}
            className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs transition-colors shadow-2xs"
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{totalRecordsCount} Records Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy All Records for Excel</span>
              </>
            )}
          </button>
        </div>

        {/* Action 3: Download Multi-Sheet Excel Workbook */}
        <div className="border border-[#cbe8cb] rounded-xs p-3 bg-[#f1faf0] space-y-2 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-[#107c10] flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-[#107c10]" />
                <span>Export Multi-Sheet .xlsx</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                8 Sheets
              </span>
            </div>
            <p className="text-[11px] text-[#605e5c] mt-1">
              Downloads a complete Excel master workbook (.xlsx) with dedicated tabs for Referrals, Vulnerable, ASB, Maintenance, Food, etc.
            </p>
          </div>

          <button
            onClick={handleDownloadWorkbook}
            className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold bg-[#107c10] hover:bg-[#0e6b0e] text-white rounded-xs transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Master .xlsx</span>
          </button>
        </div>
      </div>

      {/* Copy Toast Alert Helper */}
      {(copiedAll || copiedCurrent) && (
        <div className="p-2.5 bg-emerald-50 border border-[#cbe8cb] rounded-xs text-xs text-emerald-900 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 className="w-4 h-4 text-[#107c10] shrink-0" />
          <span>
            <strong>Data ready on clipboard!</strong> You can now switch to your SharePoint Excel workbook (or click "Open SharePoint Workbook" above) and press <kbd className="bg-white px-1.5 py-0.5 rounded border border-emerald-300 font-mono font-bold">Ctrl + V</kbd> to paste records directly into your worksheet.
          </span>
        </div>
      )}
    </div>
  );
};
