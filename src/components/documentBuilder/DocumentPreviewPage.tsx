/**
 * DocumentPreviewPage — Dynamic A4 page renderer
 *
 * Renders an A4 document page with flow-based dynamic content,
 * supporting multi-page expansions for Incident Reports and standard templates.
 */

import React from 'react';
import type { HeaderConfig, FooterConfig, TemplateFieldDefinition, SectionLayout } from '../../types/documentBuilder';
import type { ComputedPage, PageBlock } from './documentFlowEngine';

interface SectionWithFields extends SectionLayout {
  fields: TemplateFieldDefinition[];
}

interface DocumentPreviewPageProps {
  pageNumber: number;
  totalPages: number;
  title: string;
  documentNumber: string;
  site: string;
  templateName: string;
  sections?: SectionWithFields[];
  fieldValues: Record<string, any>;
  computedPage?: ComputedPage;
  headerConfig?: HeaderConfig;
  footerConfig?: FooterConfig;
  zoom: number;
  isFirstPage: boolean;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return new Date().toLocaleDateString('en-GB');
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export const DocumentPreviewPage: React.FC<DocumentPreviewPageProps> = ({
  pageNumber,
  totalPages,
  title,
  documentNumber,
  site,
  templateName,
  sections = [],
  fieldValues,
  computedPage,
  headerConfig,
  footerConfig,
  zoom,
  isFirstPage,
}) => {
  const hc: Partial<HeaderConfig> = headerConfig || {};
  const fc: Partial<FooterConfig> = footerConfig || {};
  const scale = zoom / 100;

  const isIncidentReport =
    templateName === 'Incident Report' ||
    title.toLowerCase().includes('incident') ||
    sections.some((s) => s.fields?.some((f) => f.name === 'propertyId' || f.name === 'personReporting')) ||
    !!computedPage;

  const clean = (val: any) => {
    if (val === undefined || val === null || val === 'N/A' || val === 'n/a' || val === 'None') return '';
    return String(val);
  };

  const renderBulletList = (lines: string[] = []) => {
    if (!lines || lines.length === 0) {
      return (
        <div className="flex items-start">
          <span className="font-bold text-black text-[11px] leading-tight">•</span>
        </div>
      );
    }
    return (
      <div className="space-y-1">
        {lines.map((line, idx) => {
          const cleanLine = line.startsWith('•') ? line.replace(/^[•\-\*]\s*/, '') : line;
          return (
            <div key={idx} className="flex items-start gap-1.5">
              <span className="font-bold text-black text-[10px] leading-tight select-none shrink-0">•</span>
              <div className="leading-tight text-left">{cleanLine}</div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderIncidentBlock = (block: PageBlock, blockIdx: number) => {
    switch (block.type) {
      case 'metadata_table': {
        const { propertyId, personReporting, dateOfIncident } = block.data;
        return (
          <React.Fragment key={blockIdx}>
            {/* Row 1: Property ID */}
            <tr className="border-b border-black">
              <td className="font-bold text-center border-r border-black py-1 px-2 bg-white">
                Property ID
              </td>
              <td colSpan={3} className="py-1 px-2.5 text-left">
                {clean(propertyId)}
              </td>
            </tr>

            {/* Row 2: Person Reporting */}
            <tr className="border-b border-black">
              <td className="font-bold text-center border-r border-black py-1 px-2 bg-white">
                Person Reporting
              </td>
              <td colSpan={3} className="py-1 px-2.5 text-left">
                {clean(personReporting)}
              </td>
            </tr>

            {/* Row 3: Date of Incident */}
            <tr className="border-b border-black">
              <td className="font-bold text-center border-r border-black py-1 px-2 bg-white">
                Date of Incident
              </td>
              <td colSpan={3} className="py-1 px-2.5 text-left">
                {clean(dateOfIncident)}
              </td>
            </tr>
          </React.Fragment>
        );
      }

      case 'offenders_rows':
      case 'victims_rows':
      case 'witnesses_rows': {
        const { people, totalInGroup } = block.data;
        return (
          <React.Fragment key={blockIdx}>
            {people.map((person: any, pIdx: number) => {
              const isFirstRowOfGroup = pIdx === 0 && !block.isContinued;
              const hasName = person && clean(person.name);
              const label = isFirstRowOfGroup
                ? block.title
                : `${block.title} ${totalInGroup > 1 ? `(${block.data.startIndex + pIdx + 1})` : '(cont.)'}`;

              return (
                <tr key={pIdx} className="border-b border-black">
                  <td className="font-bold text-center border-r border-black py-1 px-2 bg-white text-[8.5px]">
                    {label}
                  </td>
                  <td colSpan={3} className="py-1 px-2.5 text-left">
                    {hasName ? (
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-black">{person.name}</span>
                        {clean(person.portRef) && (
                          <span className="text-gray-600 text-[8px] bg-gray-100 px-1 py-0.5 rounded-xs">
                            Port: {person.portRef}
                          </span>
                        )}
                      </div>
                    ) : (
                      ''
                    )}
                  </td>
                </tr>
              );
            })}
          </React.Fragment>
        );
      }

      case 'incident_description': {
        const { lines } = block.data;
        const label = block.isContinued ? 'Incident Description (cont.)' : (block.title || 'Incident Description');
        return (
          <tr key={blockIdx} className="border-b border-black">
            <td className="font-bold text-center border-r border-black py-2 px-2 bg-white align-middle">
              {label}
            </td>
            <td colSpan={3} className="py-2 px-2.5 align-top text-left" style={{ minHeight: '60px' }}>
              {renderBulletList(lines)}
            </td>
          </tr>
        );
      }

      case 'action_taken': {
        const { lines } = block.data;
        const label = block.isContinued ? 'Action Taken (cont.)' : (block.title || 'Action Taken');
        return (
          <tr key={blockIdx} className="border-b border-black">
            <td className="font-bold text-center border-r border-black py-2 px-2 bg-white align-middle">
              {label}
            </td>
            <td colSpan={3} className="py-2 px-2.5 align-top text-left" style={{ minHeight: '48px' }}>
              {renderBulletList(lines)}
            </td>
          </tr>
        );
      }

      case 'authorities_table': {
        const d = block.data;
        return (
          <React.Fragment key={blockIdx}>
            {/* Warning Letter */}
            <tr className="border-b border-black">
              <td className="font-bold text-center border-r border-black py-1 px-2 bg-white">
                Warning Letter Issued?
              </td>
              <td className="border-r border-black py-1 px-2 text-center">
                {clean(d.warningLetterIssued)}
              </td>
              <td className="border-r border-black py-1 px-2 text-center">
                {clean(d.warningLetterToWhom)}
              </td>
              <td className="py-1 px-2 text-center">
                {clean(d.warningLetterNotes)}
              </td>
            </tr>

            {/* Divider Bar (Full Grey Row) */}
            <tr className="border-b border-black">
              <td colSpan={4} className="h-3.5 bg-[#bfbfbf]"></td>
            </tr>

            {/* Safeguarding */}
            <tr className="border-b border-black">
              <td className="font-bold text-center border-r border-black py-1 px-2 bg-white">
                Safeguarding Informed?
              </td>
              <td className="border-r border-black py-1 px-2 text-center">
                {clean(d.safeguardingInformed)}
              </td>
              <td className="border-r border-black py-1 px-2 text-center">
                {clean(d.safeguardingWho)}
              </td>
              <td className="py-1 px-2 text-center">
                {clean(d.safeguardingNotes)}
              </td>
            </tr>

            {/* Police */}
            <tr className="border-b border-black">
              <td className="font-bold text-center border-r border-black py-1 px-2 bg-white">
                Police Involved?
              </td>
              <td className="border-r border-black py-1 px-2 text-center">
                {clean(d.policeInvolved)}
              </td>
              <td className="border-r border-black py-1 px-2 text-center">
                {clean(d.policeCadRef)}
              </td>
              <td className="py-1 px-2 text-center">
                {clean(d.policeNotes)}
              </td>
            </tr>

            {/* Ambulance */}
            <tr className="border-b border-black">
              <td className="font-bold text-center border-r border-black py-1 px-2 bg-white">
                Ambulance Involved?
              </td>
              <td className="border-r border-black py-1 px-2 text-center">
                {clean(d.ambulanceInvolved)}
              </td>
              <td className="border-r border-black py-1 px-2 text-center">
                {clean(d.ambulanceCadRef)}
              </td>
              <td className="py-1 px-2 text-center">
                {clean(d.ambulanceNotes)}
              </td>
            </tr>

            {/* Fire Service */}
            <tr>
              <td className="font-bold text-center border-r border-black py-1 px-2 bg-white">
                Fire Service Involved?
              </td>
              <td className="border-r border-black py-1 px-2 text-center">
                {clean(d.fireServiceInvolved)}
              </td>
              <td className="border-r border-black py-1 px-2 text-center">
                {clean(d.fireCadRef)}
              </td>
              <td className="py-1 px-2 text-center">
                {clean(d.fireNotes)}
              </td>
            </tr>
          </React.Fragment>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div
      id={`document-page-${pageNumber}`}
      className="bg-white shadow-xl border border-gray-300 transition-all duration-200"
      style={{
        width: `${595 * scale}px`,
        height: `${842 * scale}px`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '595px',
          height: '842px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          padding: isFirstPage ? '28px 36px 20px 36px' : '20px 36px 20px 36px',
          fontFamily: 'Calibri, Arial, "Segoe UI", sans-serif',
        }}
        className="flex flex-col justify-between"
      >
        {isIncidentReport ? (
          <div className="flex-1 flex flex-col justify-between h-full">
            <div>
              {/* PAGE 1 HEADER */}
              {isFirstPage ? (
                <div>
                  <div className="flex justify-end mb-1">
                    <img
                      src="/templates/incident/image1.png"
                      alt="Ready Homes"
                      className="h-14 object-contain"
                    />
                  </div>

                  <div className="text-center mb-2.5">
                    <h1 className="text-[15px] font-bold text-black mb-1">Incident Report</h1>
                    <p className="text-[8.5px] text-black leading-tight max-w-[490px] mx-auto">
                      Please complete with as much detail as possible, stating only facts. Please email{' '}
                      <a href="mailto:CST@Clearsprings.co.uk" className="text-blue-600 underline font-medium">
                        CST@Clearsprings.co.uk
                      </a>{' '}
                      who will review and send it to UKVI where appropriate.
                    </p>
                  </div>
                </div>
              ) : (
                /* PAGE 2+ RUNNING HEADER */
                <div className="flex justify-between items-center pb-2 mb-3 border-b border-black text-[8px] text-[#4b5563]">
                  <div>
                    <span className="font-bold text-black tracking-wide">INCIDENT REPORT</span>
                    <span className="italic ml-1">(Continuation)</span>
                    {documentNumber && <span className="ml-2 font-mono text-[#0f766e]">[{documentNumber}]</span>}
                  </div>
                  <div>
                    Property ID: <span className="font-bold text-black">{fieldValues.propertyId || site || '—'}</span>
                  </div>
                  <div className="font-semibold text-black">Page {pageNumber} of {totalPages}</div>
                </div>
              )}

              {/* TABLE OF FLOW BLOCKS FOR THIS PAGE */}
              {computedPage && computedPage.blocks.some(b => b.type !== 'evidence_instruction' && b.type !== 'evidence_gallery') && (
                <table className="w-full border-collapse border border-black text-[9px] text-black">
                  <colgroup>
                    <col style={{ width: '35.02%' }} />
                    <col style={{ width: '21.66%' }} />
                    <col style={{ width: '17.29%' }} />
                    <col style={{ width: '26.03%' }} />
                  </colgroup>
                  <tbody>
                    {computedPage.blocks.map((block, idx) => renderIncidentBlock(block, idx))}
                  </tbody>
                </table>
              )}

              {/* Sub-table instruction (renders on the page containing authorities or instructions) */}
              {computedPage && computedPage.blocks.some(b => b.type === 'evidence_instruction') && (
                <p className="text-center italic text-[8.5px] text-black pt-2.5">
                  Please attach photos of any evidence where possible when submitting to CST.
                </p>
              )}

              {/* Evidence Photos Gallery (if present on this page) */}
              {computedPage && computedPage.blocks.some(b => b.type === 'evidence_gallery') && (
                <div className="mt-3 p-2.5 border border-black rounded-xs bg-[#fafaf9]">
                  <div className="text-[9px] font-bold text-black mb-2 uppercase tracking-wide flex items-center justify-between border-b border-black pb-1">
                    <span>Evidence Photographs & Attachments</span>
                    <span className="text-[7.5px] font-normal italic text-gray-600">UKVI / Clearsprings Documentation</span>
                  </div>
                  {computedPage.blocks
                    .filter(b => b.type === 'evidence_gallery')
                    .map((block, bIdx) => (
                      <div key={bIdx} className="grid grid-cols-2 gap-3">
                        {block.data.photos.map((photo: any, pIdx: number) => (
                          <div key={photo.id || pIdx} className="border border-gray-300 rounded-xs p-1.5 bg-white flex flex-col items-center">
                            <img
                              src={photo.url || '/templates/incident/image1.png'}
                              alt={photo.name}
                              className="h-28 w-full object-cover rounded-xs mb-1"
                            />
                            <div className="text-[8px] font-medium text-center text-gray-800">{photo.caption || photo.name}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Bottom Official Footer on EVERY page */}
            <div className="flex justify-between items-end pb-1 pt-3 border-t border-transparent">
              <div>
                <img
                  src="/templates/incident/image2.png"
                  alt="Clearsprings Group"
                  className="h-8 object-contain"
                />
              </div>
              <div className="text-center text-[7.5px] text-[#6b7280] font-sans">
                Page {pageNumber} of {totalPages}
              </div>
              <div className="text-right text-[6.5px] text-[#4b5563] leading-[1.25] font-sans">
                <div>A Clearsprings Group company</div>
                <div className="font-medium text-[#111827]">Ready Homes Limited</div>
                <div>Registered office address:</div>
                <div>26 Brook Road, Rayleigh SS6 7XJ</div>
                <div>Registered in England and Wales 7921508</div>
              </div>
            </div>
          </div>
        ) : (
          /* STANDARD TEMPLATE LAYOUT */
          <>
            {isFirstPage && (
              <div className="mb-4">
                {hc.showCompanyName !== false && (
                  <div className="flex items-center gap-2 mb-1">
                    <div className="relative flex items-center justify-center w-7 h-7 text-[9px] font-black rounded-xs">
                      <div
                        className="absolute inset-0 bg-[#0d9488] text-white flex items-center justify-center rounded-xs"
                        style={{ clipPath: 'polygon(0 0, 70% 0, 40% 100%, 0 100%)' }}
                      >
                        S
                      </div>
                      <div
                        className="absolute inset-0 bg-[#115e59] text-white flex items-center justify-center rounded-xs pl-1"
                        style={{ clipPath: 'polygon(70% 0, 100% 0, 100% 100%, 40% 100%)' }}
                      >
                        D
                      </div>
                      <span className="relative z-10 text-white">SD</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-black text-[#115e59] text-[11px] tracking-wider">SD</span>
                        <span className="font-bold text-[#0d9488] text-[10px] tracking-widest uppercase">COMMERCIAL</span>
                      </div>
                      <span className="text-[7px] text-[#a19f9d] font-medium tracking-wide">
                        Operations & Compliance Portal
                      </span>
                    </div>
                  </div>
                )}
                {hc.subtitle && <p className="text-[8px] italic text-[#8a8886] mb-1">{hc.subtitle}</p>}
                <div className="h-[1.5px] bg-[#0d9488] mb-3" />
              </div>
            )}

            {isFirstPage && (
              <div className="mb-4">
                <h1 className="text-[16px] font-bold text-[#242424] leading-tight mb-2">
                  {title || 'Untitled Document'}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[7px] text-[#605e5c] pb-2 border-b border-[#edebe9]">
                  {documentNumber && (
                    <span>
                      <span className="font-semibold">Document No:</span>{' '}
                      <span className="font-mono text-[#0f766e]">{documentNumber}</span>
                    </span>
                  )}
                  <span><span className="font-semibold">Site:</span> {site || '—'}</span>
                  {hc.showDate !== false && (
                    <span><span className="font-semibold">Date:</span> {formatDate()}</span>
                  )}
                  {hc.confidentialityLevel && (
                    <span className="px-1.5 py-0.5 rounded text-[6px] font-bold uppercase bg-[#fef2f2] text-[#dc2626] border border-[#fca5a5]">
                      {hc.confidentialityLevel}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1">
              {sections.map(section => (
                <div key={section.id} className="mb-4">
                  <div className="mb-2">
                    <h2 className="text-[11px] font-bold text-[#115e59] uppercase tracking-wide">
                      {section.title}
                    </h2>
                    <div className="h-[1px] bg-[#0d9488] w-[35%] mt-0.5" />
                  </div>
                  <div className={`gap-x-4 gap-y-2 ${
                    (section.columns || 1) > 1 ? 'grid grid-cols-2' : 'space-y-2'
                  }`}>
                    {section.fields.map(field => {
                      const value = fieldValues[field.name];
                      const hasValue = value !== undefined && value !== null && value !== '';
                      const displayValue = hasValue ? (Array.isArray(value) ? `${value.length} items` : String(value)) : '—';
                      const isFullWidth = field.width === 'full' || field.type === 'textarea';

                      return (
                        <div
                          key={field.id}
                          className={`${isFullWidth && (section.columns || 1) > 1 ? 'col-span-2' : ''}`}
                        >
                          <div className="text-[7px] font-semibold text-[#605e5c] uppercase tracking-wide mb-0.5">
                            {field.label}
                            {field.required && <span className="text-[#dc2626] ml-0.5">*</span>}
                          </div>
                          <div
                            className={`text-[9px] leading-snug ${
                              hasValue ? 'text-[#242424]' : 'text-[#c8c6c4] italic'
                            } ${
                              field.type === 'textarea'
                                ? 'min-h-[32px] p-1.5 border border-dashed border-[#edebe9] rounded-xs bg-[#faf9f8]'
                                : 'pb-1 border-b border-dotted border-[#edebe9]'
                            }`}
                          >
                            {displayValue}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-3 border-t border-[#edebe9]">
              <div className="flex items-center justify-between text-[6px] text-[#a19f9d]">
                <span>{fc.customText || 'SD Commercial — Document'}</span>
                {fc.showPageNumbers !== false && (
                  <span>Page {pageNumber} of {totalPages}</span>
                )}
              </div>
              {fc.showGeneratedTimestamp !== false && (
                <div className="text-right text-[5px] text-[#c8c6c4] italic mt-0.5">
                  Preview generated: {new Date().toLocaleString('en-GB')}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
