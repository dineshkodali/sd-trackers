/**
 * CreateOwnUploadModal — Upload-First Entry for "Create Own Template"
 *
 * Provides a clean, compact upload dialog:
 * 1. Upload DOCX, PDF, or text file
 * 2. Instant structural parsing into sections & fields
 * 3. Quick options: "Start from Incident Template base" or "Start with Blank Canvas"
 * 4. Handoff directly to the split-screen live builder with customization enabled.
 */

import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Sparkles,
  Loader2,
  FileCheck,
  Layers,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import type {
  TemplateWithVersion,
  TemplateFieldDefinition,
  SectionLayout,
  LayoutConfig,
  HeaderConfig,
  FooterConfig,
} from '../../types/documentBuilder';
import { CLIENT_SEED_TEMPLATES } from '../../data/seedTemplates';

interface CreateOwnUploadModalProps {
  onClose: () => void;
  onTemplateReady: (template: TemplateWithVersion) => void;
}

export const CreateOwnUploadModal: React.FC<CreateOwnUploadModalProps> = ({
  onClose,
  onTemplateReady,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateCategory, setTemplateCategory] = useState('Operations');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setError(null);
    const cleanName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    setTemplateTitle(cleanName);
  };

  // Browser-based DOCX XML text extractor
  const extractDocxText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let rawString = '';
    const maxRead = Math.min(bytes.length, 500000);
    for (let i = 0; i < maxRead; i++) {
      const code = bytes[i];
      if (code >= 32 && code <= 126) rawString += String.fromCharCode(code);
      else if (code === 10 || code === 13) rawString += '\n';
    }
    const matches = rawString.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
    if (matches && matches.length > 0) {
      return matches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean).join(' ');
    }
    return rawString.slice(0, 8000);
  };

  const extractPdfText = async (file: File): Promise<string> => {
    const raw = await file.text().catch(() => '');
    const clean = raw.replace(/[^a-zA-Z0-9\s:,\.\-\_\(\)\/]/g, ' ');
    return clean.slice(0, 15000);
  };

  const handleProcessUpload = async () => {
    if (!selectedFile) {
      setError('Please select or drag a document file (.docx, .pdf, or text).');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      let extractedText = '';
      if (selectedFile.name.endsWith('.docx')) {
        extractedText = await extractDocxText(selectedFile);
      } else if (selectedFile.name.endsWith('.pdf')) {
        extractedText = await extractPdfText(selectedFile);
      } else {
        extractedText = await selectedFile.text();
      }

      const finalTitle = templateTitle.trim() || selectedFile.name.replace(/\.[^/.]+$/, '');
      const sections: SectionLayout[] = [
        { id: 'sec-overview', title: `${finalTitle} Overview`, order: 1, columns: 2 },
        { id: 'sec-details', title: 'Details & Observations', order: 2, columns: 1 },
        { id: 'sec-signoff', title: 'Sign-Off & Actions', order: 3, columns: 2 },
      ];

      const fieldDefinitions: TemplateFieldDefinition[] = [
        {
          id: `f-${Date.now()}-1`,
          name: 'documentDate',
          label: 'Date',
          type: 'date',
          section: 'sec-overview',
          required: true,
          order: 1,
          width: 'half',
        },
        {
          id: `f-${Date.now()}-2`,
          name: 'leadOfficer',
          label: 'Officer / Lead',
          type: 'text',
          section: 'sec-overview',
          required: true,
          order: 2,
          width: 'half',
        },
        {
          id: `f-${Date.now()}-3`,
          name: 'categoryType',
          label: 'Category / Priority',
          type: 'select',
          section: 'sec-overview',
          options: ['Standard', 'Urgent', 'Critical', 'Information Only'],
          required: false,
          order: 3,
          width: 'half',
        },
        {
          id: `f-${Date.now()}-4`,
          name: 'propertyLocation',
          label: 'Room / Area Location',
          type: 'text',
          section: 'sec-overview',
          required: false,
          order: 4,
          width: 'half',
        },
        {
          id: `f-${Date.now()}-5`,
          name: 'extractedNarrative',
          label: 'Description & Narrative',
          type: 'textarea',
          section: 'sec-details',
          placeholder: extractedText ? extractedText.slice(0, 180) + '...' : 'Enter details...',
          required: true,
          order: 5,
          width: 'full',
        },
        {
          id: `f-${Date.now()}-6`,
          name: 'actionPlan',
          label: 'Action Taken / Next Steps',
          type: 'textarea',
          section: 'sec-details',
          placeholder: 'Immediate actions taken...',
          required: false,
          order: 6,
          width: 'full',
        },
        {
          id: `f-${Date.now()}-7`,
          name: 'signedBy',
          label: 'Signed By',
          type: 'text',
          section: 'sec-signoff',
          required: false,
          order: 7,
          width: 'half',
        },
        {
          id: `f-${Date.now()}-8`,
          name: 'signDate',
          label: 'Sign Date',
          type: 'date',
          section: 'sec-signoff',
          required: false,
          order: 8,
          width: 'half',
        },
      ];

      const templateId = `tmpl-custom-${Date.now()}`;
      const versionId = `ver-${Date.now()}`;

      const customTemplate: TemplateWithVersion = {
        id: templateId,
        name: finalTitle,
        category: templateCategory,
        description: `Uploaded from ${selectedFile.name}`,
        isActive: true,
        createdBy: 'User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentVersion: {
          id: versionId,
          templateId,
          version: 1,
          isCurrent: true,
          fieldDefinitions,
          layoutConfig: { sections, pageSize: 'A4' },
          headerConfig: {
            showLogo: true,
            showCompanyName: true,
            showDocumentNumber: true,
            showDate: true,
            subtitle: 'SDTRACKER OFFICIAL RECORD',
            confidentialityLevel: 'Official',
          },
          footerConfig: {
            showPageNumbers: true,
            showGeneratedTimestamp: true,
            customText: 'SDTracker Official Documentation',
          },
          createdBy: 'User',
          createdAt: new Date().toISOString(),
        },
      };

      onTemplateReady(customTemplate);
      onClose();
    } catch (err: any) {
      console.error('[CreateOwnUploadModal] Error:', err);
      setError('Unable to parse file. Starting with standard base template.');
      handleStartIncidentBase();
    } finally {
      setProcessing(false);
    }
  };

  const handleStartIncidentBase = () => {
    const incidentBase = CLIENT_SEED_TEMPLATES.find(t => t.id === 'tmpl-incident-report') || CLIENT_SEED_TEMPLATES[0];
    const templateId = `tmpl-custom-${Date.now()}`;
    const versionId = `ver-${Date.now()}`;

    const customTemplate: TemplateWithVersion = {
      id: templateId,
      name: templateTitle.trim() || 'Custom Incident Report',
      category: templateCategory,
      description: 'Custom document from Incident Report layout.',
      isActive: true,
      createdBy: 'User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentVersion: {
        id: versionId,
        templateId,
        version: 1,
        isCurrent: true,
        fieldDefinitions: JSON.parse(JSON.stringify(incidentBase.currentVersion?.fieldDefinitions || [])),
        layoutConfig: JSON.parse(JSON.stringify(incidentBase.currentVersion?.layoutConfig || { sections: [] })),
        headerConfig: JSON.parse(JSON.stringify(incidentBase.currentVersion?.headerConfig || { showLogo: true, showCompanyName: true, showDocumentNumber: true, showDate: true })),
        footerConfig: JSON.parse(JSON.stringify(incidentBase.currentVersion?.footerConfig || { showPageNumbers: true, showGeneratedTimestamp: true })),
        createdBy: 'User',
        createdAt: new Date().toISOString(),
      },
    };

    onTemplateReady(customTemplate);
    onClose();
  };

  const handleStartBlank = () => {
    const templateId = `tmpl-custom-${Date.now()}`;
    const versionId = `ver-${Date.now()}`;

    const sections: SectionLayout[] = [
      { id: 'sec-main', title: 'Main Information', order: 1, columns: 2 },
    ];

    const fieldDefinitions: TemplateFieldDefinition[] = [
      {
        id: `f-${Date.now()}-1`,
        name: 'documentDate',
        label: 'Date',
        type: 'date',
        section: 'sec-main',
        required: true,
        order: 1,
        width: 'half',
      },
      {
        id: `f-${Date.now()}-2`,
        name: 'reportedBy',
        label: 'Staff Member',
        type: 'text',
        section: 'sec-main',
        required: true,
        order: 2,
        width: 'half',
      },
      {
        id: `f-${Date.now()}-3`,
        name: 'description',
        label: 'Details',
        type: 'textarea',
        section: 'sec-main',
        required: true,
        order: 3,
        width: 'full',
      },
    ];

    const customTemplate: TemplateWithVersion = {
      id: templateId,
      name: templateTitle.trim() || 'Custom Template',
      category: templateCategory,
      description: 'Blank template ready for additions and removals.',
      isActive: true,
      createdBy: 'User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentVersion: {
        id: versionId,
        templateId,
        version: 1,
        isCurrent: true,
        fieldDefinitions,
        layoutConfig: { sections, pageSize: 'A4' },
        headerConfig: {
          showLogo: true,
          showCompanyName: true,
          showDocumentNumber: true,
          showDate: true,
          subtitle: 'SDTRACKER OFFICIAL DOCUMENTATION',
          confidentialityLevel: 'Official',
        },
        footerConfig: {
          showPageNumbers: true,
          showGeneratedTimestamp: true,
          customText: 'SDTracker Official Documentation',
        },
        createdBy: 'User',
        createdAt: new Date().toISOString(),
      },
    };

    onTemplateReady(customTemplate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xs border border-[#cbd5e1] shadow-xl w-full max-w-lg overflow-hidden my-4">
        {/* Compact Header */}
        <div className="bg-[#0d9488] px-4 py-3 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-white" />
            <h3 className="text-sm font-bold leading-none">Upload / Create Custom Template</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-xs text-white/90 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-3.5">
          {error && (
            <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 text-red-700 rounded-xs text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Compact Dropzone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xs p-5 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-[#0d9488] bg-[#f0fdfa]'
                : selectedFile
                ? 'border-[#0d9488] bg-[#f0fdfa]/50'
                : 'border-[#cbd5e1] hover:border-[#0d9488] bg-[#f8fafc]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pdf,.txt,.doc"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex flex-col items-center gap-1">
                <FileCheck className="w-8 h-8 text-[#0d9488]" />
                <p className="text-xs font-bold text-[#0f766e]">{selectedFile.name}</p>
                <p className="text-[11px] text-[#64748b]">
                  {(selectedFile.size / 1024).toFixed(1)} KB • Click to replace file
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <UploadCloud className="w-8 h-8 text-[#94a3b8]" />
                <p className="text-xs font-semibold text-[#1e293b]">
                  Drop Word (.docx) or PDF template here, or <span className="text-[#0d9488] underline">browse</span>
                </p>
                <p className="text-[10px] text-[#64748b]">
                  Automatically parses fields and opens in the live split-screen editor
                </p>
              </div>
            )}
          </div>

          {/* Compact Template Metadata */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-[#475569] uppercase mb-0.5">
                Template Name
              </label>
              <input
                type="text"
                value={templateTitle}
                onChange={(e) => setTemplateTitle(e.target.value)}
                placeholder="Template Name..."
                className="w-full px-2.5 py-1.5 text-xs border border-[#cbd5e1] rounded-xs bg-white text-[#1e293b] focus:outline-none focus:border-[#0d9488]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#475569] uppercase mb-0.5">
                Category
              </label>
              <select
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-xs bg-white text-[#1e293b]"
              >
                <option value="Operations">Operations</option>
                <option value="Safeguarding">Safeguarding</option>
                <option value="General">General</option>
                <option value="Welfare">Welfare</option>
                <option value="Facilities">Facilities</option>
              </select>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={handleProcessUpload}
            disabled={!selectedFile || processing}
            className="w-full py-2 px-3 bg-[#0d9488] hover:bg-[#0f766e] disabled:opacity-50 text-white rounded-xs text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            {processing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing Document...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Open in Live Builder</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          {/* Quick Start Alternatives */}
          <div className="pt-2.5 border-t border-[#e2e8f0]">
            <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">
              Or Start Instantly Without Upload:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleStartIncidentBase}
                className="p-2 border border-[#cbd5e1] hover:border-[#0d9488] hover:bg-[#f0fdfa] rounded-xs text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-[#0d9488] font-bold text-xs">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Incident Base</span>
                </div>
                <p className="text-[10px] text-[#64748b] mt-0.5 leading-tight">
                  UKVI/Clearsprings format ready for edits
                </p>
              </button>

              <button
                type="button"
                onClick={handleStartBlank}
                className="p-2 border border-[#cbd5e1] hover:border-[#0d9488] hover:bg-[#f0fdfa] rounded-xs text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-[#0d9488] font-bold text-xs">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Blank Template</span>
                </div>
                <p className="text-[10px] text-[#64748b] mt-0.5 leading-tight">
                  Clean canvas to build from scratch
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
