/**
 * DocumentPreview — Live A4 document preview container
 *
 * Renders a scrollable preview area with A4-proportioned pages,
 * zoom controls, page navigation, and flow-based real-time pagination.
 */

import React, { useState, useMemo, useRef } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, Eye, ChevronLeft, ChevronRight, FileText, Pin } from 'lucide-react';
import { DocumentPreviewPage } from './DocumentPreviewPage';
import { normalizeIncidentData, computeIncidentPages, ComputedPage } from './documentFlowEngine';
import type {
  TemplateFieldDefinition,
  LayoutConfig,
  HeaderConfig,
  FooterConfig,
} from '../../types/documentBuilder';

interface DocumentPreviewProps {
  title: string;
  documentNumber: string;
  site: string;
  templateName: string;
  fieldDefinitions: TemplateFieldDefinition[];
  layoutConfig?: LayoutConfig;
  headerConfig?: HeaderConfig;
  footerConfig?: FooterConfig;
  fieldValues: Record<string, any>;
}

const ZOOM_LEVELS = [40, 50, 60, 70, 80, 90, 100, 110, 120];

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  title,
  documentNumber,
  site,
  templateName,
  fieldDefinitions,
  layoutConfig,
  headerConfig,
  footerConfig,
  fieldValues,
}) => {
  const [zoom, setZoom] = useState(70);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isIncidentReport =
    templateName === 'Incident Report' ||
    title.toLowerCase().includes('incident') ||
    fieldDefinitions.some((f) => f.name === 'propertyId' || f.name === 'personReporting');

  const zoomIn = () => {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    if (idx < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[idx + 1]);
  };

  const zoomOut = () => {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    if (idx > 0) setZoom(ZOOM_LEVELS[idx - 1]);
  };

  const fitWidth = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 48;
      const pageWidthPx = 595;
      const fitZoom = Math.floor((containerWidth / pageWidthPx) * 100);
      const clamped = Math.max(40, Math.min(120, fitZoom));
      const closest = ZOOM_LEVELS.reduce((prev, curr) =>
        Math.abs(curr - clamped) < Math.abs(prev - clamped) ? curr : prev
      );
      setZoom(closest);
    }
  };

  const fitPage = () => {
    if (containerRef.current) {
      const containerHeight = containerRef.current.clientHeight - 48;
      const pageHeightPx = 842;
      const fitZoom = Math.floor((containerHeight / pageHeightPx) * 100);
      const clamped = Math.max(40, Math.min(120, fitZoom));
      const closest = ZOOM_LEVELS.reduce((prev, curr) =>
        Math.abs(curr - clamped) < Math.abs(prev - clamped) ? curr : prev
      );
      setZoom(closest);
    }
  };

  const toggleFullscreen = () => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // 1. DYNAMIC INCIDENT REPORT FLOW PAGES
  const incidentPages: ComputedPage[] = useMemo(() => {
    if (!isIncidentReport) return [];
    const normalized = normalizeIncidentData(fieldValues, site);
    return computeIncidentPages(normalized);
  }, [isIncidentReport, fieldValues, site]);

  // 2. STANDARD TEMPLATE SECTIONS & PAGES
  const sections = useMemo(() => {
    const secs = layoutConfig?.sections
      ? [...layoutConfig.sections].sort((a, b) => a.order - b.order)
      : [{ id: 'default', title: 'Document Content', order: 1, columns: 1 as const }];

    return secs.map((sec) => ({
      ...sec,
      fields: fieldDefinitions
        .filter((f) => f.section === sec.id)
        .sort((a, b) => a.order - b.order),
    }));
  }, [layoutConfig, fieldDefinitions]);

  const standardPages = useMemo(() => {
    if (isIncidentReport) return [];
    const maxFieldsPerPage = 12;
    const pagesList: typeof sections[] = [];
    let currentPage: typeof sections = [];
    let fieldCount = 4; // header + metadata

    for (const section of sections) {
      const sectionFieldCount = section.fields.length;
      if (fieldCount + sectionFieldCount + 1 > maxFieldsPerPage && currentPage.length > 0) {
        pagesList.push(currentPage);
        currentPage = [];
        fieldCount = 0;
      }
      currentPage.push(section);
      fieldCount += sectionFieldCount + 1;
    }

    if (currentPage.length > 0) pagesList.push(currentPage);
    return pagesList.length > 0 ? pagesList : [sections];
  }, [isIncidentReport, sections]);

  const totalPages = isIncidentReport ? incidentPages.length : standardPages.length;

  // Scroll to page
  const scrollToPage = (idx: number) => {
    const targetIdx = Math.max(0, Math.min(totalPages - 1, idx));
    setCurrentPageIndex(targetIdx);
    const pageEl = document.getElementById(`document-page-${targetIdx + 1}`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const completedFields = fieldDefinitions.filter((f) => {
    const val = fieldValues[f.name];
    if (val === undefined || val === null || val === '') return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  }).length;
  const totalFields = fieldDefinitions.length;
  const completionPct = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;

  return (
    <div
      ref={wrapperRef}
      className={`bg-white border border-[#e1dfdd] rounded-xs shadow-xs flex flex-col h-full ${
        isFullscreen ? 'p-4 bg-[#f1f5f9]' : ''
      }`}
    >
      {/* Top Preview Toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#e1dfdd] px-3 py-2 flex items-center justify-between gap-2 select-none">
        {/* Left: Info */}
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#0d9488]" />
          <span className="text-xs font-bold text-[#242424]">Live Preview</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f0fdfa] text-[#0f766e] font-semibold border border-[#99f6e4]">
            {completionPct}%
          </span>
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-[#64748b]">
            <FileText className="w-3 h-3 text-[#0d9488]" />
            <span className="font-semibold text-[#0f766e]">{totalPages} {totalPages === 1 ? 'Page' : 'Pages'}</span>
            <span>(Auto-flowing)</span>
          </div>
          <span className="hidden md:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] font-semibold border border-[#bfdbfe]" title="Preview is pinned in view while form scrolls">
            <Pin className="w-2.5 h-2.5 text-[#2563eb]" />
            Sticky
          </span>
        </div>

        {/* Center: Page Stepper */}
        <div className="flex items-center gap-1 bg-[#f8fafc] px-2 py-0.5 rounded border border-[#e2e8f0]">
          <button
            onClick={() => scrollToPage(currentPageIndex - 1)}
            disabled={currentPageIndex <= 0}
            className="p-1 hover:bg-[#e2e8f0] rounded text-[#475569] disabled:opacity-30 transition-colors"
            title="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-medium text-[#1e293b] px-1 min-w-[75px] text-center">
            Page {currentPageIndex + 1} / {totalPages}
          </span>
          <button
            onClick={() => scrollToPage(currentPageIndex + 1)}
            disabled={currentPageIndex >= totalPages - 1}
            className="p-1 hover:bg-[#e2e8f0] rounded text-[#475569] disabled:opacity-30 transition-colors"
            title="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Zoom & Layout Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={zoom <= ZOOM_LEVELS[0]}
            className="p-1 hover:bg-[#f1f5f9] rounded text-[#475569] disabled:opacity-30 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-[#475569] w-8 text-center">{zoom}%</span>
          <button
            onClick={zoomIn}
            disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            className="p-1 hover:bg-[#f1f5f9] rounded text-[#475569] disabled:opacity-30 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-[1px] bg-[#cbd5e1] mx-0.5" />

          <button
            onClick={fitWidth}
            className="px-1.5 py-1 text-[10px] font-medium hover:bg-[#f1f5f9] rounded text-[#475569] transition-colors"
            title="Fit to width"
          >
            Fit Width
          </button>
          <button
            onClick={fitPage}
            className="px-1.5 py-1 text-[10px] font-medium hover:bg-[#f1f5f9] rounded text-[#475569] transition-colors"
            title="Fit to page"
          >
            Fit Page
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1 hover:bg-[#f1f5f9] rounded text-[#475569] transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Preview Pages Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-[#e5e7eb] p-6 custom-scrollbar"
      >
        <div className="flex flex-col items-center gap-6">
          {isIncidentReport ? (
            incidentPages.map((page, idx) => (
              <DocumentPreviewPage
                key={`page-${page.pageNumber}`}
                pageNumber={page.pageNumber}
                totalPages={totalPages}
                title={title}
                documentNumber={documentNumber}
                site={site}
                templateName={templateName}
                fieldValues={fieldValues}
                computedPage={page}
                headerConfig={headerConfig}
                footerConfig={footerConfig}
                zoom={zoom}
                isFirstPage={page.isFirstPage}
              />
            ))
          ) : (
            standardPages.map((pageSections, pageIndex) => (
              <DocumentPreviewPage
                key={`std-page-${pageIndex}`}
                pageNumber={pageIndex + 1}
                totalPages={totalPages}
                title={title}
                documentNumber={documentNumber}
                site={site}
                templateName={templateName}
                sections={pageSections}
                fieldValues={fieldValues}
                headerConfig={headerConfig}
                footerConfig={footerConfig}
                zoom={zoom}
                isFirstPage={pageIndex === 0}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
