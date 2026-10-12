/**
 * IncidentBuilderPreview — live preview of the Clearsprings Incident Report
 * (same layout as the Word template). Red text = a placeholder still to be completed.
 */

import React from 'react';
import { Copy, Download, Loader2 } from 'lucide-react';
import { countPlaceholders, parseRich, type Report } from './incidentEngine';

export interface DownloadGuard {
  /** id of the button that has been clicked once while placeholders remain */
  armed: string | null;
  busy: boolean;
  click: (id: string) => void;
}

export const Rich: React.FC<{ text: string }> = ({ text }) => (
  <>
    {parseRich(text).map((s, i) => {
      const lines = s.s.split('\n');
      const inner = lines.map((l, j) => (
        <React.Fragment key={j}>{j > 0 ? <br /> : null}{l}</React.Fragment>
      ));
      if (s.k === 'ph') return <span key={i} className="irb-ph">{inner}</span>;
      if (s.k === 'it') return <em key={i}>{inner}</em>;
      return <React.Fragment key={i}>{inner}</React.Fragment>;
    })}
  </>
);

export const DownloadWordButton: React.FC<{
  id: string;
  guard: DownloadGuard;
  placeholders: number;
  className?: string;
}> = ({ id, guard, placeholders, className }) => {
  const armed = guard.armed === id;
  return (
    <button
      type="button"
      onClick={() => guard.click(id)}
      disabled={guard.busy}
      className={
        className ||
        `flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-xs shadow-xs transition-colors cursor-pointer disabled:opacity-60 ${
          armed ? 'bg-[#d97706] hover:bg-[#b45309] text-white' : 'bg-[#0078d4] hover:bg-[#106ebe] text-white'
        }`
      }
    >
      {guard.busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
      <span>
        {guard.busy
          ? 'Preparing…'
          : armed
            ? `${placeholders} still in red – click again to download anyway`
            : 'Download Word (.docx)'}
      </span>
    </button>
  );
};

interface PreviewProps {
  report: Report;
  fileName: string;
  guard: DownloadGuard;
  onCopyText: () => void;
}

export const IncidentBuilderPreview: React.FC<PreviewProps> = ({ report: r, fileName, guard, onCopyText }) => {
  const n = countPlaceholders(r);

  return (
    <div className="flex flex-col h-full min-h-0 bg-white border border-[#cbd5e1] rounded-xs shadow-xs">
      <style>{`
        .irb-paper{background:#fff;color:#111;border:1px solid #d5d9de;border-radius:4px;padding:18px 20px 16px;box-shadow:0 1px 3px rgba(0,0,0,.08);font-family:Calibri,"Segoe UI",Arial,sans-serif;font-size:12.5px}
        .irb-paper .irb-head{display:flex;justify-content:flex-end;min-height:38px}
        .irb-paper .irb-head img{height:44px}
        .irb-paper .irb-title{text-align:center;font-size:19px;font-weight:700;margin:-22px 0 6px}
        .irb-paper .irb-sub{text-align:center;font-size:11.5px;margin-bottom:10px}
        .irb-paper .irb-sub u{color:#0563C1}
        .irb-paper table.irb-rep{width:100%;border-collapse:collapse;table-layout:fixed}
        .irb-paper table.irb-rep td{border:1px solid #222;padding:5px 7px;vertical-align:middle;word-wrap:break-word}
        .irb-paper td.k{font-weight:700;text-align:center;font-size:13px}
        .irb-paper td.v{text-align:center}
        .irb-paper td.t{text-align:left;vertical-align:top}
        .irb-paper tr.hd td{background:#BFBFBF;font-weight:700;text-align:center;font-size:13px}
        .irb-paper p.lead{text-align:center;font-weight:700;margin:2px 0 6px;padding:0 14px}
        .irb-paper ul{margin:2px 0;padding-left:20px;list-style:disc}
        .irb-paper li{margin:0 0 5px;text-align:justify}
        .irb-ph{color:#C4231A;font-weight:700}
        .irb-paper em{font-style:italic}
        .irb-paper .irb-note{text-align:center;font-style:italic;font-size:10.5px;margin:10px 0 8px;font-family:"Century Gothic",Arial,sans-serif}
        .irb-paper .irb-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}
        .irb-paper .irb-foot img{height:38px}
        .irb-paper .irb-addr{font-size:8.5px;text-align:right;line-height:1.35}
      `}</style>

      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-[#e2e8f0] bg-[#fafafa] space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex-1 min-w-0 truncate text-[11px] text-[#64748b]" title={fileName}>{fileName}</span>
          <button
            type="button"
            onClick={onCopyText}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#cbd5e1] rounded-xs transition-colors cursor-pointer"
          >
            <Copy className="w-3 h-3" />
            <span>Copy text</span>
          </button>
          <DownloadWordButton id="preview" guard={guard} placeholders={n} />
        </div>
        <div
          className={`text-[11px] font-semibold px-2 py-1 rounded-xs border ${
            n ? 'bg-[#fffbeb] text-[#92400e] border-[#fde68a]' : 'bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]'
          }`}
        >
          {n
            ? `⚠ ${n} red placeholder${n > 1 ? 's' : ''} still to complete – you can download now and finish them in Word.`
            : '✓ Nothing left to fill in – ready to send.'}
        </div>
      </div>

      {/* Paper */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 bg-[#f1f5f9]">
        <div className="irb-paper" id="irb-paper">
          <div className="irb-head"><img alt="Ready Homes" src="/templates/incident/image1.png" /></div>
          <h2 className="irb-title">Incident Report</h2>
          <p className="irb-sub">
            Please complete with as much detail as possible, stating only facts. Please email <u>CST@Clearsprings.co.uk</u> who will review and send it to UKVI where appropriate.
          </p>
          <table className="irb-rep">
            <colgroup>
              <col style={{ width: '35%' }} /><col style={{ width: '21.7%' }} /><col style={{ width: '17.3%' }} /><col style={{ width: '26%' }} />
            </colgroup>
            <tbody>
              {([
                ['Property ID', r.propertyId],
                ['Person Reporting', r.reporter],
                ['Date of Incident', r.date],
                ['Offenders (Name/Port)', r.offenders],
                ['Victims (Name/Port)', r.victims],
                ['Witnesses (SUs) (Name/Port)', r.witnesses],
              ] as [string, string][]).map(([label, val]) => (
                <tr key={label}>
                  <td className="k">{label}</td>
                  <td className="v" colSpan={3}><Rich text={val} /></td>
                </tr>
              ))}
              <tr>
                <td className="k">Incident Description</td>
                <td className="t" colSpan={3}>
                  {r.lead ? <p className="lead"><Rich text={r.lead} /></p> : null}
                  {r.bullets.length ? <ul>{r.bullets.map((b, i) => <li key={i}><Rich text={b} /></li>)}</ul> : ' '}
                </td>
              </tr>
              <tr>
                <td className="k">Action Taken</td>
                <td className="t" colSpan={3}>
                  {r.actions.length ? <ul>{r.actions.map((a, i) => <li key={i}><Rich text={a} /></li>)}</ul> : ' '}
                </td>
              </tr>
              <tr>
                <td className="k">Warning Letter Issued?</td>
                <td className="v"><Rich text={r.warningIssued} /></td>
                <td className="k">To Whom?</td>
                <td className="v"><Rich text={r.warningWhom} /></td>
              </tr>
              <tr className="hd"><td colSpan={4}>Reported Authorities</td></tr>
              {r.auth.map(a => (
                <tr key={a.label}>
                  <td className="k">{a.label}</td>
                  <td className="v"><Rich text={a.inv} /></td>
                  <td className="k">{a.whoLabel}</td>
                  <td className="v"><Rich text={a.txt} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="irb-note">Please attach photos of any evidence where possible when submitting to CST.</p>
          <div className="irb-foot">
            <img alt="Clearsprings Group" src="/templates/incident/image2.gif" />
            <div className="irb-addr">
              A Clearsprings Group company<br />Clearsprings Ready Homes Limited<br />Registered office address:<br />26 Brook Road, Rayleigh SS6 7XJ<br />Registered in England and Wales 7921508
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
