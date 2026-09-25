/**
 * TemplateBuilderModal — Drag-and-Drop / Modular Template Builder
 *
 * Allows users to create or edit document templates with:
 * - Block modules (Heading, Text, Textarea, Select, Date, Number, Checkbox, Table, Alert, Signature)
 * - Section organization & visual reordering (Up/Down / Drag-order)
 * - Real-time live preview on the right
 * - Save directly to database with RBAC attribution
 */

import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Copy,
  Settings2,
  FileText,
  Type,
  AlignLeft,
  Calendar,
  ListFilter,
  Hash,
  CheckSquare,
  Table as TableIcon,
  AlertTriangle,
  PenTool,
  Save,
  Loader2,
  Eye,
  Shield,
  Layers,
  Users,
  Camera,
} from 'lucide-react';
import type {
  TemplateWithVersion,
  TemplateFieldDefinition,
  SectionLayout,
  HeaderConfig,
  FooterConfig,
} from '../../types/documentBuilder';
import { createTemplate, updateTemplate } from '../../services/documentBuilderService';
import { DocumentPreview } from './DocumentPreview';

interface TemplateBuilderModalProps {
  initialTemplate?: TemplateWithVersion | null;
  onClose: () => void;
  onSaved: (template: TemplateWithVersion) => void;
}

const CATEGORIES = ['Safeguarding', 'Operations', 'General', 'Welfare', 'Facilities', 'Clinical'];
const CONFIDENTIALITY_LEVELS: Array<'Restricted' | 'Confidential' | 'Official' | 'Internal'> = [
  'Restricted',
  'Confidential',
  'Official',
  'Internal',
];

interface BlockItem {
  id: string;
  sectionId: string;
  name: string;
  label: string;
  type: TemplateFieldDefinition['type'] | 'alert' | 'signature';
  required: boolean;
  placeholder?: string;
  options?: string[];
  width: 'full' | 'half';
  order: number;
  alertText?: string;
  signatureTitle?: string;
  repeatable?: boolean;
  itemLabel?: string;
}

export const TemplateBuilderModal: React.FC<TemplateBuilderModalProps> = ({
  initialTemplate,
  onClose,
  onSaved,
}) => {
  // General Info
  const [templateName, setTemplateName] = useState(initialTemplate?.name || '');
  const [category, setCategory] = useState(initialTemplate?.category || 'General');
  const [description, setDescription] = useState(initialTemplate?.description || '');

  // Header & Footer Config
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>({
    showLogo: initialTemplate?.currentVersion?.headerConfig?.showLogo ?? true,
    showCompanyName: initialTemplate?.currentVersion?.headerConfig?.showCompanyName ?? true,
    showDocumentNumber: initialTemplate?.currentVersion?.headerConfig?.showDocumentNumber ?? true,
    showDate: initialTemplate?.currentVersion?.headerConfig?.showDate ?? true,
    subtitle: initialTemplate?.currentVersion?.headerConfig?.subtitle || '',
    confidentialityLevel: initialTemplate?.currentVersion?.headerConfig?.confidentialityLevel || 'Confidential',
  });

  const [footerConfig, setFooterConfig] = useState<FooterConfig>({
    showPageNumbers: initialTemplate?.currentVersion?.footerConfig?.showPageNumbers ?? true,
    showGeneratedTimestamp: initialTemplate?.currentVersion?.footerConfig?.showGeneratedTimestamp ?? true,
    customText: initialTemplate?.currentVersion?.footerConfig?.customText || 'SD Commercial — Approved Document',
  });

  // Sections
  const [sections, setSections] = useState<SectionLayout[]>(
    initialTemplate?.currentVersion?.layoutConfig?.sections?.length
      ? initialTemplate.currentVersion.layoutConfig.sections
      : [
          { id: 'sec-details', title: 'General Details', order: 1, columns: 2 },
          { id: 'sec-notes', title: 'Notes & Actions', order: 2, columns: 1 },
        ]
  );

  // Blocks/Fields
  const [blocks, setBlocks] = useState<BlockItem[]>(() => {
    if (initialTemplate?.currentVersion?.fieldDefinitions?.length) {
      return initialTemplate.currentVersion.fieldDefinitions.map((f, idx) => ({
        id: f.id || `blk-${idx}`,
        sectionId: f.section,
        name: f.name,
        label: f.label,
        type: f.type,
        required: f.required,
        placeholder: f.placeholder,
        options: f.options,
        width: f.width || 'full',
        order: f.order || idx + 1,
        repeatable: f.repeatable,
        itemLabel: f.itemLabel,
      }));
    }
    return [
      {
        id: 'blk-1',
        sectionId: 'sec-details',
        name: 'documentDate',
        label: 'Date',
        type: 'date',
        required: true,
        width: 'half',
        order: 1,
      },
      {
        id: 'blk-2',
        sectionId: 'sec-details',
        name: 'staffName',
        label: 'Completed By',
        type: 'text',
        required: true,
        placeholder: 'Staff member name',
        width: 'half',
        order: 2,
      },
      {
        id: 'blk-3',
        sectionId: 'sec-notes',
        name: 'summaryNotes',
        label: 'Summary / Observations',
        type: 'textarea',
        required: true,
        placeholder: 'Enter details here...',
        width: 'full',
        order: 1,
      },
    ];
  });

  // Selected block for editing
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'builder' | 'settings'>('builder');
  const [previewTab, setPreviewTab] = useState<'split' | 'fullscreen'>('split');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reconstruct FieldDefinitions for preview & save
  const currentFieldDefinitions: TemplateFieldDefinition[] = blocks.map(b => ({
    id: b.id,
    name: b.name,
    label: b.label,
    type: b.type === 'alert' || b.type === 'signature' ? 'textarea' : b.type,
    section: b.sectionId,
    required: b.required,
    placeholder: b.placeholder,
    options: b.options,
    width: b.width,
    order: b.order,
    repeatable: b.repeatable ?? (b.type === 'repeating_group' || b.type === 'attachment'),
    itemLabel: b.itemLabel || (b.type === 'repeating_group' ? `+ Add ${b.label}` : (b.type === 'attachment' ? '+ Add Attachment' : undefined)),
  }));

  // Reconstruct LayoutConfig
  const currentLayoutConfig = {
    sections,
    pageSize: 'A4' as const,
    margins: { top: 25, right: 20, bottom: 25, left: 20 },
  };

  // Add block to a section
  const handleAddBlock = (type: BlockItem['type'], sectionId: string) => {
    const secBlocks = blocks.filter(b => b.sectionId === sectionId);
    const newId = `blk-${Date.now().toString().slice(-6)}`;
    const count = secBlocks.length + 1;

    let defaultLabel = 'New Field';
    let defaultWidth: 'full' | 'half' = 'full';
    let defaultOptions: string[] | undefined = undefined;

    switch (type) {
      case 'text':
        defaultLabel = `Text Field ${count}`;
        defaultWidth = 'half';
        break;
      case 'textarea':
        defaultLabel = `Notes / Narrative ${count}`;
        defaultWidth = 'full';
        break;
      case 'date':
        defaultLabel = `Date`;
        defaultWidth = 'half';
        break;
      case 'select':
        defaultLabel = `Category / Status`;
        defaultWidth = 'half';
        defaultOptions = ['Option 1', 'Option 2', 'Option 3'];
        break;
      case 'number':
        defaultLabel = `Numeric Value`;
        defaultWidth = 'half';
        break;
      case 'checkbox':
        defaultLabel = `Confirmation / Checklist`;
        defaultWidth = 'full';
        break;
      case 'alert':
        defaultLabel = `Notice / Safeguarding Alert`;
        defaultWidth = 'full';
        break;
      case 'signature':
        defaultLabel = `Signature & Declaration`;
        defaultWidth = 'full';
        break;
      case 'repeating_group':
        defaultLabel = `People / Repeating Group`;
        defaultWidth = 'full';
        break;
      case 'attachment':
        defaultLabel = `Photos / Attachments`;
        defaultWidth = 'full';
        break;
      default:
        defaultLabel = `Field ${count}`;
    }

    const newName = defaultLabel.toLowerCase().replace(/[^a-z0-9]/g, '');

    const newBlock: BlockItem = {
      id: newId,
      sectionId,
      name: `${newName}_${Date.now().toString().slice(-4)}`,
      label: defaultLabel,
      type,
      required: false,
      placeholder: `Enter ${defaultLabel}...`,
      options: defaultOptions,
      width: defaultWidth,
      order: secBlocks.length + 1,
    };

    setBlocks(prev => [...prev, newBlock]);
    setActiveBlockId(newId);
  };

  // Move block up or down within section
  const handleMoveBlock = (blockId: string, direction: 'up' | 'down') => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const secBlocks = blocks
      .filter(b => b.sectionId === block.sectionId)
      .sort((a, b) => a.order - b.order);

    const idx = secBlocks.findIndex(b => b.id === blockId);
    if (direction === 'up' && idx > 0) {
      const prev = secBlocks[idx - 1];
      const prevOrder = prev.order;
      prev.order = block.order;
      block.order = prevOrder;
    } else if (direction === 'down' && idx < secBlocks.length - 1) {
      const next = secBlocks[idx + 1];
      const nextOrder = next.order;
      next.order = block.order;
      block.order = nextOrder;
    }

    setBlocks([...blocks]);
  };

  // Remove block
  const handleDeleteBlock = (blockId: string) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId));
    if (activeBlockId === blockId) setActiveBlockId(null);
  };

  // Duplicate block
  const handleDuplicateBlock = (blockId: string) => {
    const source = blocks.find(b => b.id === blockId);
    if (!source) return;

    const newId = `blk-${Date.now().toString().slice(-6)}`;
    const duplicate: BlockItem = {
      ...source,
      id: newId,
      name: `${source.name}_copy`,
      label: `${source.label} (Copy)`,
      order: source.order + 1,
    };

    setBlocks(prev => [...prev, duplicate]);
    setActiveBlockId(newId);
  };

  // Add new section
  const handleAddSection = () => {
    const newSecId = `sec-${Date.now().toString().slice(-5)}`;
    const newSection: SectionLayout = {
      id: newSecId,
      title: `Section ${sections.length + 1}`,
      order: sections.length + 1,
      columns: 2,
    };
    setSections(prev => [...prev, newSection]);
  };

  // Remove section
  const handleDeleteSection = (secId: string) => {
    if (sections.length <= 1) return;
    setSections(prev => prev.filter(s => s.id !== secId));
    setBlocks(prev => prev.filter(b => b.sectionId !== secId));
  };

  // Update active block
  const handleUpdateActiveBlock = (updates: Partial<BlockItem>) => {
    if (!activeBlockId) return;
    setBlocks(prev =>
      prev.map(b => (b.id === activeBlockId ? { ...b, ...updates } : b))
    );
  };

  // Save template
  const handleSave = async () => {
    if (!templateName.trim()) {
      setError('Please provide a template name.');
      return;
    }

    if (blocks.length === 0) {
      setError('Please add at least one field module to the template.');
      return;
    }

    setSaving(true);
    setError(null);

    const templateData = {
      name: templateName.trim(),
      category,
      description: description.trim(),
      isActive: true,
    };

    const versionData = {
      fieldDefinitions: currentFieldDefinitions,
      layoutConfig: currentLayoutConfig,
      headerConfig,
      footerConfig,
    };

    try {
      let res;
      if (initialTemplate?.id) {
        res = await updateTemplate(initialTemplate.id, {
          ...templateData,
          id: initialTemplate.id,
        });
      } else {
        res = await createTemplate(templateData, versionData);
      }

      if (res.success && res.data) {
        onSaved({
          ...res.data,
          currentVersion: {
            id: `tver-${res.data.id}`,
            templateId: res.data.id,
            version: 1,
            isCurrent: true,
            fieldDefinitions: currentFieldDefinitions,
            layoutConfig: currentLayoutConfig,
            headerConfig,
            footerConfig,
            createdBy: 'user',
            createdAt: new Date().toISOString(),
          },
        });
      } else {
        setError(res.error || 'Failed to save template');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const activeBlock = blocks.find(b => b.id === activeBlockId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xs shadow-2xl border border-[#d1d5db] w-full max-w-[1400px] h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#f8fafc] border-b border-[#e2e8f0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xs bg-[#0d9488]/10 text-[#0d9488] flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1e293b]">
                {initialTemplate ? 'Edit Document Template' : 'Create Custom Document Template'}
              </h2>
              <p className="text-xs text-[#64748b]">
                Modular drag-and-drop builder with live document preview
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#f1f5f9] p-1 rounded-xs border border-[#cbd5e1] text-xs font-semibold">
              <button
                onClick={() => setActiveTab('builder')}
                className={`px-3 py-1 rounded-xs transition-colors ${
                  activeTab === 'builder' ? 'bg-white text-[#0f172a] shadow-xs' : 'text-[#64748b] hover:text-[#0f172a]'
                }`}
              >
                Canvas & Modules
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-3 py-1 rounded-xs transition-colors ${
                  activeTab === 'settings' ? 'bg-white text-[#0f172a] shadow-xs' : 'text-[#64748b] hover:text-[#0f172a]'
                }`}
              >
                Header & Settings
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-bold rounded-xs shadow-sm transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Template
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-[#64748b] hover:text-[#1e293b] hover:bg-[#f1f5f9] rounded-xs transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-b border-red-200 text-red-700 px-6 py-2.5 text-xs font-medium flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Modal Main Body */}
        <div className="flex-1 flex overflow-hidden">
          {activeTab === 'settings' ? (
            /* Settings & Metadata View */
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto space-y-6">
              <div className="bg-white border border-[#e2e8f0] rounded-xs p-6 space-y-4 shadow-xs">
                <h3 className="text-sm font-bold text-[#1e293b] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0d9488]" />
                  Template Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">
                      Template Title *
                    </label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      placeholder="e.g. Resident Safeguarding Review"
                      className="w-full px-3 py-2 text-sm border border-[#cbd5e1] rounded-xs focus:ring-2 focus:ring-[#0d9488]/30 focus:border-[#0d9488]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">
                      Category *
                    </label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[#cbd5e1] rounded-xs"
                    >
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-[#475569] mb-1">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={2}
                      placeholder="Explain what this document is used for..."
                      className="w-full px-3 py-2 text-sm border border-[#cbd5e1] rounded-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Document Header Styling */}
              <div className="bg-white border border-[#e2e8f0] rounded-xs p-6 space-y-4 shadow-xs">
                <h3 className="text-sm font-bold text-[#1e293b] flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#0d9488]" />
                  Header & Security Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">
                      Confidentiality Classification
                    </label>
                    <select
                      value={headerConfig.confidentialityLevel}
                      onChange={e =>
                        setHeaderConfig(prev => ({
                          ...prev,
                          confidentialityLevel: e.target.value as any,
                        }))
                      }
                      className="w-full px-3 py-2 text-sm border border-[#cbd5e1] rounded-xs"
                    >
                      {CONFIDENTIALITY_LEVELS.map(lvl => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">
                      Subtitle / Department
                    </label>
                    <input
                      type="text"
                      value={headerConfig.subtitle || ''}
                      onChange={e =>
                        setHeaderConfig(prev => ({ ...prev, subtitle: e.target.value }))
                      }
                      placeholder="e.g. Accommodation & Welfare Unit"
                      className="w-full px-3 py-2 text-sm border border-[#cbd5e1] rounded-xs"
                    />
                  </div>

                  <div className="md:col-span-2 flex flex-wrap gap-4 pt-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-[#334155] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={headerConfig.showLogo}
                        onChange={e => setHeaderConfig(p => ({ ...p, showLogo: e.target.checked }))}
                        className="rounded-xs text-[#0d9488]"
                      />
                      Show SD Commercial Official Logo
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-[#334155] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={headerConfig.showDocumentNumber}
                        onChange={e => setHeaderConfig(p => ({ ...p, showDocumentNumber: e.target.checked }))}
                        className="rounded-xs text-[#0d9488]"
                      />
                      Include Dynamic Document Reference Number
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-[#334155] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={headerConfig.showDate}
                        onChange={e => setHeaderConfig(p => ({ ...p, showDate: e.target.checked }))}
                        className="rounded-xs text-[#0d9488]"
                      />
                      Display Generation Date
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer Settings */}
              <div className="bg-white border border-[#e2e8f0] rounded-xs p-6 space-y-4 shadow-xs">
                <h3 className="text-sm font-bold text-[#1e293b]">Footer Configuration</h3>
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    Footer Disclaimer / Compliance Text
                  </label>
                  <input
                    type="text"
                    value={footerConfig.customText || ''}
                    onChange={e => setFooterConfig(p => ({ ...p, customText: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#cbd5e1] rounded-xs"
                  />
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium text-[#334155] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={footerConfig.showPageNumbers}
                      onChange={e => setFooterConfig(p => ({ ...p, showPageNumbers: e.target.checked }))}
                      className="rounded-xs text-[#0d9488]"
                    />
                    Include Page Numbers (Page X of Y)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-[#334155] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={footerConfig.showGeneratedTimestamp}
                      onChange={e => setFooterConfig(p => ({ ...p, showGeneratedTimestamp: e.target.checked }))}
                      className="rounded-xs text-[#0d9488]"
                    />
                    Include Generation Timestamp
                  </label>
                </div>
              </div>
            </div>
          ) : (
            /* Builder & Live Preview Split Screen */
            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: Module Palette & Canvas */}
              <div className="w-[50%] flex flex-col border-r border-[#e2e8f0] bg-[#f8fafc] overflow-y-auto custom-scrollbar">
                {/* Module Block Palette */}
                <div className="p-4 bg-white border-b border-[#e2e8f0]">
                  <p className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-[#0d9488]" />
                    Click to Add Module to Active Section
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => handleAddBlock('text', sections[0]?.id || 'sec-1')}
                      className="flex flex-col items-center justify-center p-2.5 bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] rounded-xs text-xs font-semibold text-[#334155] transition-all hover:border-[#0d9488]"
                    >
                      <Type className="w-4 h-4 text-[#0d9488] mb-1" />
                      Text Line
                    </button>
                    <button
                      onClick={() => handleAddBlock('textarea', sections[0]?.id || 'sec-1')}
                      className="flex flex-col items-center justify-center p-2.5 bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] rounded-xs text-xs font-semibold text-[#334155] transition-all hover:border-[#0d9488]"
                    >
                      <AlignLeft className="w-4 h-4 text-[#0284c7] mb-1" />
                      Paragraph
                    </button>
                    <button
                      onClick={() => handleAddBlock('select', sections[0]?.id || 'sec-1')}
                      className="flex flex-col items-center justify-center p-2.5 bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] rounded-xs text-xs font-semibold text-[#334155] transition-all hover:border-[#0d9488]"
                    >
                      <ListFilter className="w-4 h-4 text-[#d97706] mb-1" />
                      Dropdown
                    </button>
                    <button
                      onClick={() => handleAddBlock('date', sections[0]?.id || 'sec-1')}
                      className="flex flex-col items-center justify-center p-2.5 bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] rounded-xs text-xs font-semibold text-[#334155] transition-all hover:border-[#0d9488]"
                    >
                      <Calendar className="w-4 h-4 text-[#8b5cf6] mb-1" />
                      Date Picker
                    </button>
                    <button
                      onClick={() => handleAddBlock('number', sections[0]?.id || 'sec-1')}
                      className="flex flex-col items-center justify-center p-2.5 bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] rounded-xs text-xs font-semibold text-[#334155] transition-all hover:border-[#0d9488]"
                    >
                      <Hash className="w-4 h-4 text-[#64748b] mb-1" />
                      Number
                    </button>
                    <button
                      onClick={() => handleAddBlock('checkbox', sections[0]?.id || 'sec-1')}
                      className="flex flex-col items-center justify-center p-2.5 bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] rounded-xs text-xs font-semibold text-[#334155] transition-all hover:border-[#0d9488]"
                    >
                      <CheckSquare className="w-4 h-4 text-[#059669] mb-1" />
                      Checkbox
                    </button>
                    <button
                      onClick={() => handleAddBlock('alert', sections[0]?.id || 'sec-1')}
                      className="flex flex-col items-center justify-center p-2.5 bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] rounded-xs text-xs font-semibold text-[#334155] transition-all hover:border-[#0d9488]"
                    >
                      <AlertTriangle className="w-4 h-4 text-[#dc2626] mb-1" />
                      Notice Box
                    </button>
                    <button
                      onClick={() => handleAddBlock('signature', sections[0]?.id || 'sec-1')}
                      className="flex flex-col items-center justify-center p-2.5 bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] rounded-xs text-xs font-semibold text-[#334155] transition-all hover:border-[#0d9488]"
                    >
                      <PenTool className="w-4 h-4 text-[#4f46e5] mb-1" />
                      Sign-Off
                    </button>
                    <button
                      onClick={() => handleAddBlock('repeating_group', sections[0]?.id || 'sec-1')}
                      className="flex flex-col items-center justify-center p-2.5 bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] rounded-xs text-xs font-semibold text-[#334155] transition-all hover:border-[#0d9488]"
                    >
                      <Users className="w-4 h-4 text-[#0d9488] mb-1" />
                      People Group
                    </button>
                    <button
                      onClick={() => handleAddBlock('attachment', sections[0]?.id || 'sec-1')}
                      className="flex flex-col items-center justify-center p-2.5 bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] rounded-xs text-xs font-semibold text-[#334155] transition-all hover:border-[#0d9488]"
                    >
                      <Camera className="w-4 h-4 text-[#ec4899] mb-1" />
                      Attachments
                    </button>
                  </div>
                </div>

                {/* Sections & Blocks List */}
                <div className="p-4 space-y-6">
                  {sections.map((section, secIdx) => {
                    const secBlocks = blocks
                      .filter(b => b.sectionId === section.id)
                      .sort((a, b) => a.order - b.order);

                    return (
                      <div
                        key={section.id}
                        className="bg-white border border-[#cbd5e1] rounded-xs shadow-xs overflow-hidden"
                      >
                        {/* Section Header */}
                        <div className="bg-[#f1f5f9] px-4 py-2.5 border-b border-[#cbd5e1] flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 mr-3">
                            <span className="w-5 h-5 rounded-full bg-[#0d9488] text-white text-[10px] font-bold flex items-center justify-center">
                              {secIdx + 1}
                            </span>
                            <input
                              type="text"
                              value={section.title}
                              onChange={e => {
                                const newTitle = e.target.value;
                                setSections(prev =>
                                  prev.map(s => (s.id === section.id ? { ...s, title: newTitle } : s))
                                );
                              }}
                              className="text-xs font-bold text-[#1e293b] bg-transparent border-b border-transparent hover:border-[#94a3b8] focus:border-[#0d9488] focus:outline-none flex-1 py-0.5"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={section.columns || 1}
                              onChange={e => {
                                const cols = Number(e.target.value) as 1 | 2;
                                setSections(prev =>
                                  prev.map(s => (s.id === section.id ? { ...s, columns: cols } : s))
                                );
                              }}
                              className="text-[11px] font-semibold bg-white border border-[#cbd5e1] rounded-xs px-2 py-0.5"
                            >
                              <option value={1}>1 Col</option>
                              <option value={2}>2 Col</option>
                            </select>

                            {sections.length > 1 && (
                              <button
                                onClick={() => handleDeleteSection(section.id)}
                                className="text-[#94a3b8] hover:text-red-600 p-1"
                                title="Delete Section"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Section Content: Block Items */}
                        <div className="p-3 space-y-2">
                          {secBlocks.length === 0 ? (
                            <div className="text-center py-6 border-2 border-dashed border-[#e2e8f0] rounded-xs text-[#94a3b8] text-xs">
                              <p>No modules in this section yet.</p>
                              <button
                                onClick={() => handleAddBlock('text', section.id)}
                                className="mt-2 text-xs font-bold text-[#0d9488] hover:underline"
                              >
                                + Add First Module
                              </button>
                            </div>
                          ) : (
                            secBlocks.map((block, bIdx) => {
                              const isActive = activeBlockId === block.id;

                              return (
                                <div
                                  key={block.id}
                                  className={`border rounded-xs transition-all ${
                                    isActive
                                      ? 'border-[#0d9488] bg-[#f0fdfa]/40 shadow-xs'
                                      : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1]'
                                  }`}
                                >
                                  {/* Block Title Row */}
                                  <div
                                    onClick={() => setActiveBlockId(isActive ? null : block.id)}
                                    className="px-3 py-2 flex items-center justify-between cursor-pointer select-none"
                                  >
                                    <div className="flex items-center gap-2 flex-1">
                                      <span className="text-[10px] font-mono text-[#64748b] bg-[#f1f5f9] px-1.5 py-0.5 rounded-xs">
                                        {block.type.toUpperCase()}
                                      </span>
                                      <span className="text-xs font-semibold text-[#1e293b]">
                                        {block.label}
                                      </span>
                                      {block.required && (
                                        <span className="text-[10px] font-bold text-red-500">*</span>
                                      )}
                                      <span className="text-[10px] text-[#94a3b8] ml-auto mr-2">
                                        {block.width === 'half' ? '½ Width' : 'Full Width'}
                                      </span>
                                    </div>

                                    {/* Action buttons */}
                                    <div
                                      onClick={e => e.stopPropagation()}
                                      className="flex items-center gap-1"
                                    >
                                      <button
                                        onClick={() => handleMoveBlock(block.id, 'up')}
                                        disabled={bIdx === 0}
                                        className="p-1 text-[#94a3b8] hover:text-[#0f172a] disabled:opacity-30"
                                      >
                                        <MoveUp className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handleMoveBlock(block.id, 'down')}
                                        disabled={bIdx === secBlocks.length - 1}
                                        className="p-1 text-[#94a3b8] hover:text-[#0f172a] disabled:opacity-30"
                                      >
                                        <MoveDown className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDuplicateBlock(block.id)}
                                        className="p-1 text-[#94a3b8] hover:text-[#0d9488]"
                                        title="Duplicate"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteBlock(block.id)}
                                        className="p-1 text-[#94a3b8] hover:text-red-600"
                                        title="Delete"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Expanded Inline Block Settings */}
                                  {isActive && (
                                    <div className="p-3 border-t border-[#e2e8f0] bg-white space-y-3 text-xs">
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                                            Field Label
                                          </label>
                                          <input
                                            type="text"
                                            value={block.label}
                                            onChange={e => handleUpdateActiveBlock({ label: e.target.value })}
                                            className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded-xs"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                                            Width
                                          </label>
                                          <select
                                            value={block.width}
                                            onChange={e =>
                                              handleUpdateActiveBlock({ width: e.target.value as 'full' | 'half' })
                                            }
                                            className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded-xs"
                                          >
                                            <option value="half">Half Width (50%)</option>
                                            <option value="full">Full Width (100%)</option>
                                          </select>
                                        </div>
                                      </div>

                                      {block.type === 'select' && (
                                        <div>
                                          <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                                            Dropdown Options (comma separated)
                                          </label>
                                          <input
                                            type="text"
                                            value={(block.options || []).join(', ')}
                                            onChange={e =>
                                              handleUpdateActiveBlock({
                                                options: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                                              })
                                            }
                                            placeholder="Option 1, Option 2, Option 3"
                                            className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded-xs"
                                          />
                                        </div>
                                      )}

                                      <div className="flex items-center justify-between pt-1">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={block.required}
                                            onChange={e => handleUpdateActiveBlock({ required: e.target.checked })}
                                            className="rounded-xs text-[#0d9488]"
                                          />
                                          <span className="font-semibold text-[#334155]">Required Field</span>
                                        </label>

                                        <button
                                          onClick={() => setActiveBlockId(null)}
                                          className="text-[11px] font-bold text-[#0d9488] hover:underline"
                                        >
                                          Done
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <button
                    onClick={handleAddSection}
                    className="w-full py-2.5 border-2 border-dashed border-[#cbd5e1] hover:border-[#0d9488] text-[#0d9488] rounded-xs text-xs font-bold transition-colors flex items-center justify-center gap-2 bg-white"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Document Section
                  </button>
                </div>
              </div>

              {/* Right Column: Live Document Preview */}
              <div className="w-[50%] flex flex-col bg-[#525659] p-4 overflow-y-auto custom-scrollbar">
                <div className="mb-2 flex items-center justify-between text-white text-xs font-semibold px-2">
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-[#2dd4bf]" />
                    Real-Time A4 Document Preview
                  </span>
                  <span className="text-[11px] text-neutral-300">
                    Updates instantly as you add or edit modules
                  </span>
                </div>

                <div className="flex-1">
                  <DocumentPreview
                    title={templateName || 'Preview Document Title'}
                    documentNumber="DOC-2026-PREVIEW"
                    site="All Sites (Preview)"
                    templateName={templateName || 'Custom Template'}
                    fieldDefinitions={currentFieldDefinitions}
                    layoutConfig={currentLayoutConfig}
                    headerConfig={headerConfig}
                    footerConfig={footerConfig}
                    fieldValues={{}}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
