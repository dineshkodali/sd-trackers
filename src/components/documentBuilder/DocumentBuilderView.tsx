/**
 * DocumentBuilderView — Main Page Component (Compact & Streamlined)
 *
 * Provides:
 * 1. Fast Home Forms (Template Selector) & Saved Documents view
 * 2. Dedicated "Exit to Home Forms" button from any active form
 * 3. Compact, clutter-free live builder with movable split pane & sticky preview
 * 4. In-place field additions, removals, and label editing
 * 5. Direct Upload modal for "Create Own Template"
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  FilePlus,
  Download,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  UploadCloud,
  History,
  Layers,
  Sparkles,
  GripVertical,
  Sliders,
  ArrowLeft,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TemplateSelector } from './TemplateSelector';
import { DocumentInputForm } from './DocumentInputForm';
import { DocumentPreview } from './DocumentPreview';
import { CreateOwnUploadModal } from './CreateOwnUploadModal';
import { DocumentImportModal } from './DocumentImportModal';
import { DocumentsListView } from './DocumentsListView';
import type {
  TemplateWithVersion,
  DocumentBuilderRecord,
  TemplateFieldDefinition,
} from '../../types/documentBuilder';
import {
  fetchTemplates,
  fetchTemplateFields,
  saveDocumentDraft,
  updateDocumentDraft,
  generateDocument,
  downloadBlob,
  deleteTemplate,
  createTemplate,
  updateTemplate,
} from '../../services/documentBuilderService';

type ToastType = 'success' | 'error' | 'info';
interface Toast {
  message: string;
  type: ToastType;
}

type MainTab = 'generator' | 'documents';

export const DocumentBuilderView: React.FC = () => {
  const { assignedSite, allowedSites, canAccessAllSites, currentUserRole } = useApp();
  const isAdmin = ['Super Admin', 'Admin', 'Regional Manager', 'Operations Manager'].includes(currentUserRole);
  const isSuperAdmin = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';

  // Navigation tab
  const [activeTab, setActiveTab] = useState<MainTab>('generator');

  // Modals state
  const [showCreateOwnModal, setShowCreateOwnModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<TemplateWithVersion[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithVersion | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Document state
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [documentTitle, setDocumentTitle] = useState('');
  const [selectedSite, setSelectedSite] = useState(assignedSite || allowedSites[0] || 'Site A');
  const [currentRecord, setCurrentRecord] = useState<DocumentBuilderRecord | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState<'docx' | 'pdf' | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Movable split pane & Sticky Preview state
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(42); // 42% form, 58% preview
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const isDraggingSplitter = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSplitter.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingSplitter.current) return;
      const container = document.getElementById('builder-split-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        const offsetX = moveEvent.clientX - rect.left;
        const newPct = (offsetX / rect.width) * 100;
        setLeftPanelWidth(Math.max(25, Math.min(75, Math.round(newPct))));
      }
    };

    const onMouseUp = () => {
      isDraggingSplitter.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  // Unsaved changes warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    const res = await fetchTemplates();
    if (res.success && res.data) {
      setTemplates(res.data);
    }
    setLoadingTemplates(false);
  };

  const handleSelectTemplate = useCallback(async (template: TemplateWithVersion) => {
    if (isDirty && !window.confirm('You have unsaved changes. Switch template?')) return;

    setSelectedTemplate(template);
    setFieldValues({});
    setCurrentRecord(null);
    setIsDirty(false);
    setIsCustomizing(false);
    setDocumentTitle(`${template.name} — ${new Date().toLocaleDateString('en-GB')}`);

    if (!template.currentVersion?.fieldDefinitions?.length) {
      const res = await fetchTemplateFields(template.id);
      if (res.success && res.data) {
        setSelectedTemplate({ ...template, currentVersion: res.data as any });
      }
    }
  }, [isDirty]);

  const handleCustomizeTemplate = useCallback(async (template: TemplateWithVersion) => {
    if (isDirty && !window.confirm('You have unsaved changes. Switch to template customization?')) return;

    setSelectedTemplate(template);
    setFieldValues({});
    setCurrentRecord(null);
    setIsDirty(false);
    setIsCustomizing(true);
    setDocumentTitle(`${template.name} (Template Schema)`);

    if (!template.currentVersion?.fieldDefinitions?.length) {
      const res = await fetchTemplateFields(template.id);
      if (res.success && res.data) {
        setSelectedTemplate({ ...template, currentVersion: res.data as any });
      }
    }
  }, [isDirty]);

  // Dedicated Exit to Home Forms handler
  const handleExitToHome = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Exit to Forms Home?')) return;
    setSelectedTemplate(null);
    setFieldValues({});
    setCurrentRecord(null);
    setIsDirty(false);
    setIsCustomizing(false);
    setDocumentTitle('');
    setActiveTab('generator');
  };

  const handleFieldChange = useCallback((name: string, value: any) => {
    setFieldValues(prev => ({ ...prev, [name]: value }));
    setIsDirty(true);
  }, []);

  const handleSaveDraft = async (status: 'draft' | 'final' = 'draft'): Promise<DocumentBuilderRecord | null> => {
    if (!selectedTemplate) return null;
    const currentDefs = selectedTemplate.currentVersion?.fieldDefinitions || [];
    const currentLayout = selectedTemplate.currentVersion?.layoutConfig;
    const currentHeader = selectedTemplate.currentVersion?.headerConfig;
    const currentFooter = selectedTemplate.currentVersion?.footerConfig;

    setSaving(true);
    try {
      if (currentRecord) {
        const res = await updateDocumentDraft(currentRecord.id, {
          title: documentTitle,
          fieldValues,
          site: selectedSite,
          status,
          fieldDefinitions: currentDefs,
          layoutConfig: currentLayout,
          headerConfig: currentHeader,
          footerConfig: currentFooter,
        });
        if (res.success) {
          showToast(status === 'final' ? 'Document finalized and saved' : 'Draft saved');
          setIsDirty(false);
          const updated: DocumentBuilderRecord = {
            ...currentRecord,
            title: documentTitle,
            fieldValues,
            status,
            site: selectedSite,
            fieldDefinitions: currentDefs,
            layoutConfig: currentLayout,
            headerConfig: currentHeader,
            footerConfig: currentFooter,
          };
          setCurrentRecord(updated);
          return updated;
        } else {
          showToast(res.error || 'Failed to save', 'error');
          return currentRecord;
        }
      } else {
        const res = await saveDocumentDraft({
          templateId: selectedTemplate.id,
          templateVersionId: selectedTemplate.currentVersion?.id || '',
          site: selectedSite,
          title: documentTitle,
          fieldValues,
          status,
          fieldDefinitions: currentDefs,
          layoutConfig: currentLayout,
          headerConfig: currentHeader,
          footerConfig: currentFooter,
        });
        if (res.success && res.data) {
          setCurrentRecord(res.data);
          showToast(status === 'final' ? 'Document created and finalized' : 'Draft saved');
          setIsDirty(false);
          return res.data;
        } else {
          showToast(res.error || 'Failed to save draft', 'error');
          return null;
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async (format: 'docx' | 'pdf') => {
    if (generating) return;

    let activeRecord = currentRecord;
    if (!activeRecord || isDirty) {
      activeRecord = await handleSaveDraft('draft');
    }

    const recordId = activeRecord?.id || currentRecord?.id || 'direct';

    setGenerating(format);
    try {
      const liveData = {
        title: documentTitle,
        site: selectedSite,
        documentNumber: activeRecord?.documentNumber || currentRecord?.documentNumber || '',
        fieldValues,
        templateId: selectedTemplate?.id,
        templateName: selectedTemplate?.name,
        fieldDefinitions: fieldDefs,
        layoutConfig,
        headerConfig,
        footerConfig,
      };

      const res = await generateDocument(recordId, format, liveData);
      if (res.success && res.blob) {
        downloadBlob(res.blob, res.filename || `document.${format}`);
        showToast(`${format.toUpperCase()} downloaded`);
      } else {
        showToast(res.error || `Failed to generate ${format.toUpperCase()}`, 'error');
      }
    } finally {
      setGenerating(null);
    }
  };

  const handleClear = () => {
    if (isDirty && !window.confirm('Clear all fields?')) return;
    setFieldValues({});
    setIsDirty(false);
  };

  const handleEditSavedRecord = async (record: DocumentBuilderRecord) => {
    let tmpl = templates.find(t => t.id === record.templateId);
    if (!tmpl) {
      tmpl = {
        id: record.templateId,
        name: record.title.split('—')[0]?.trim() || 'Document',
        description: '',
        category: 'General',
        isActive: true,
        createdBy: record.createdBy,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };
    }

    // Restore the exact template structure/fields that were saved with this document snapshot
    const effectiveFieldDefs = record.fieldDefinitions || tmpl.currentVersion?.fieldDefinitions || [];
    const effectiveLayout = record.layoutConfig || tmpl.currentVersion?.layoutConfig;
    const effectiveHeader = record.headerConfig || tmpl.currentVersion?.headerConfig;
    const effectiveFooter = record.footerConfig || tmpl.currentVersion?.footerConfig;

    setSelectedTemplate({
      ...tmpl,
      currentVersion: {
        id: record.templateVersionId || tmpl.currentVersion?.id || `tver-${record.id}`,
        templateId: record.templateId,
        version: tmpl.currentVersion?.version || 1,
        isCurrent: true,
        fieldDefinitions: effectiveFieldDefs,
        layoutConfig: effectiveLayout,
        headerConfig: effectiveHeader,
        footerConfig: effectiveFooter,
        createdBy: record.createdBy,
        createdAt: record.createdAt,
      },
    });

    setFieldValues(record.fieldValues || {});
    setDocumentTitle(record.title);
    setSelectedSite(record.site);
    setCurrentRecord(record);
    setIsDirty(false);
    setIsCustomizing(false);
    setActiveTab('generator');
    showToast(`Loaded "${record.title}"`);
  };

  // Callback when a user uploads or creates a custom template
  const handleCreateOwnTemplateReady = (newTemplate: TemplateWithVersion) => {
    setTemplates(prev => [newTemplate, ...prev.filter(t => t.id !== newTemplate.id)]);
    setSelectedTemplate(newTemplate);
    setFieldValues({});
    setCurrentRecord(null);
    setIsDirty(false);
    setIsCustomizing(true);
    setDocumentTitle(`${newTemplate.name} — ${new Date().toLocaleDateString('en-GB')}`);
    setActiveTab('generator');
    showToast(`Template ready! Customize fields on left, preview updates on right.`, 'info');
  };

  // Customization Handlers: Add, Remove, Update fields and sections
  const handleAddField = useCallback((sectionId: string, type: TemplateFieldDefinition['type'] = 'text') => {
    if (!selectedTemplate) return;

    setSelectedTemplate(prev => {
      if (!prev) return prev;
      const currentDefs = prev.currentVersion?.fieldDefinitions || [];
      const currentCount = currentDefs.length + 1;
      const fieldId = `field-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const fieldName = `customField_${currentCount}_${Date.now().toString().slice(-4)}`;

      let defaultLabel = `Custom Field ${currentCount}`;
      if (type === 'repeating_group') defaultLabel = 'Persons Involved';
      if (type === 'attachment') defaultLabel = 'Evidence Photos';
      if (type === 'textarea') defaultLabel = 'Details / Narrative';
      if (type === 'date') defaultLabel = 'Event Date';
      if (type === 'select') defaultLabel = 'Dropdown Choice';
      if (type === 'checkbox') defaultLabel = 'Confirmation';

      const newField: TemplateFieldDefinition = {
        id: fieldId,
        name: fieldName,
        label: defaultLabel,
        type,
        section: sectionId,
        required: false,
        placeholder: type === 'textarea' ? 'Enter details...' : '',
        order: currentDefs.length + 1,
        width: type === 'textarea' ? 'full' : 'half',
        options: type === 'select' ? ['Option A', 'Option B', 'Option C'] : undefined,
      };

      return {
        ...prev,
        currentVersion: {
          ...prev.currentVersion!,
          fieldDefinitions: [...currentDefs, newField],
        },
      };
    });
    setIsDirty(true);
    showToast('Field added');
  }, [selectedTemplate, showToast]);

  const handleRemoveField = useCallback((fieldId: string) => {
    if (!selectedTemplate) return;

    setSelectedTemplate(prev => {
      if (!prev) return prev;
      const currentDefs = prev.currentVersion?.fieldDefinitions || [];
      const target = currentDefs.find(f => f.id === fieldId);
      if (target) {
        setFieldValues(v => {
          const copy = { ...v };
          delete copy[target.name];
          return copy;
        });
      }

      return {
        ...prev,
        currentVersion: {
          ...prev.currentVersion!,
          fieldDefinitions: currentDefs.filter(f => f.id !== fieldId),
        },
      };
    });
    setIsDirty(true);
    showToast('Field removed');
  }, [selectedTemplate, showToast]);

  const handleUpdateField = useCallback((fieldId: string, updates: Partial<TemplateFieldDefinition>) => {
    if (!selectedTemplate) return;

    setSelectedTemplate(prev => {
      if (!prev) return prev;
      const currentDefs = prev.currentVersion?.fieldDefinitions || [];
      const updatedDefs = currentDefs.map(f => (f.id === fieldId ? { ...f, ...updates } : f));

      return {
        ...prev,
        currentVersion: {
          ...prev.currentVersion!,
          fieldDefinitions: updatedDefs,
        },
      };
    });
    setIsDirty(true);
  }, [selectedTemplate]);

  const handleAddSection = useCallback(() => {
    if (!selectedTemplate) return;

    setSelectedTemplate(prev => {
      if (!prev) return prev;
      const sections = prev.currentVersion?.layoutConfig?.sections || [];
      const newSecId = `sec-${Date.now()}`;
      const newSec = {
        id: newSecId,
        title: `Section ${sections.length + 1}`,
        order: sections.length + 1,
        columns: 2 as const,
      };

      return {
        ...prev,
        currentVersion: {
          ...prev.currentVersion!,
          layoutConfig: {
            ...prev.currentVersion?.layoutConfig,
            sections: [...sections, newSec],
          },
        },
      };
    });
    setIsDirty(true);
    showToast('Section added');
  }, [selectedTemplate, showToast]);

  const handleRemoveSection = useCallback((sectionId: string) => {
    if (!selectedTemplate) return;

    setSelectedTemplate(prev => {
      if (!prev) return prev;
      const sections = (prev.currentVersion?.layoutConfig?.sections || []).filter(s => s.id !== sectionId);
      const fieldDefs = (prev.currentVersion?.fieldDefinitions || []).filter(f => f.section !== sectionId);

      return {
        ...prev,
        currentVersion: {
          ...prev.currentVersion!,
          fieldDefinitions: fieldDefs,
          layoutConfig: {
            ...prev.currentVersion?.layoutConfig,
            sections,
          },
        },
      };
    });
    setIsDirty(true);
    showToast('Section removed');
  }, [selectedTemplate, showToast]);

  const handleUpdateSection = useCallback((sectionId: string, title: string) => {
    if (!selectedTemplate) return;

    setSelectedTemplate(prev => {
      if (!prev) return prev;
      const sections = (prev.currentVersion?.layoutConfig?.sections || []).map(s => {
        if (s.id === sectionId) return { ...s, title };
        return s;
      });

      return {
        ...prev,
        currentVersion: {
          ...prev.currentVersion!,
          layoutConfig: {
            ...prev.currentVersion?.layoutConfig,
            sections,
          },
        },
      };
    });
    setIsDirty(true);
  }, [selectedTemplate]);

  const handleSaveAsTemplate = async () => {
    if (!selectedTemplate) return;
    if (!isSuperAdmin) {
      showToast('Only Super Admin can update master templates', 'error');
      return;
    }
    setSaving(true);
    try {
      const templatePayload = {
        name: selectedTemplate.name,
        category: selectedTemplate.category || 'Operations',
        description: selectedTemplate.description || 'Approved SD Commercial template',
        isActive: true,
      };
      const versionPayload = {
        version: selectedTemplate.currentVersion?.version || 1,
        isCurrent: true,
        fieldDefinitions: selectedTemplate.currentVersion?.fieldDefinitions || [],
        layoutConfig: selectedTemplate.currentVersion?.layoutConfig,
        headerConfig: selectedTemplate.currentVersion?.headerConfig,
        footerConfig: selectedTemplate.currentVersion?.footerConfig,
      };

      let res;
      if (selectedTemplate.id && !selectedTemplate.id.startsWith('tmpl-custom-')) {
        res = await updateTemplate(selectedTemplate.id, templatePayload, versionPayload);
      } else {
        res = await createTemplate(templatePayload, versionPayload);
      }

      if (res.success && res.data) {
        setSelectedTemplate(res.data as any);
        showToast(`Master template "${selectedTemplate.name}" updated in database!`);
        await loadTemplates();
        setIsDirty(false);
      } else {
        setTemplates(prev => {
          const idx = prev.findIndex(t => t.id === selectedTemplate.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = selectedTemplate;
            return copy;
          }
          return [selectedTemplate, ...prev];
        });
        showToast(res.error ? `Updated locally: ${res.error}` : `Master template updated!`);
        setIsDirty(false);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const res = await deleteTemplate(id);
    if (res.success) {
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
      }
      showToast('Template deactivated');
    } else {
      showToast(res.error || 'Failed to delete template', 'error');
    }
  };

  const fieldDefs = selectedTemplate?.currentVersion?.fieldDefinitions || [];
  const layoutConfig = selectedTemplate?.currentVersion?.layoutConfig;
  const headerConfig = selectedTemplate?.currentVersion?.headerConfig;
  const footerConfig = selectedTemplate?.currentVersion?.footerConfig;

  return (
    <div className="space-y-2.5">
      {/* Sleek, Compact Unified Navigation Bar */}
      <div className="bg-white border border-[#e2e8f0] rounded-xs px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs">
        {/* Left: Exit button & Context */}
        <div className="flex items-center gap-2">
          {selectedTemplate ? (
            <>
              <button
                type="button"
                onClick={handleExitToHome}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#475569] hover:text-[#0d9488] bg-[#f8fafc] hover:bg-[#f0fdfa] border border-[#cbd5e1] hover:border-[#0d9488] rounded-xs transition-colors cursor-pointer"
                title="Exit current document and return to all report templates"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Exit to Templates</span>
              </button>

              <div className="h-4 w-px bg-[#cbd5e1] mx-0.5" />

              <span className="text-xs font-bold text-[#1e293b] max-w-[260px] truncate" title={selectedTemplate.name}>
                {isCustomizing ? `HO Report Designer: ${selectedTemplate.name}` : `HO Report Generator: ${selectedTemplate.name}`}
              </span>

              {isCustomizing ? (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-[#fef3c7] text-[#92400e] border border-[#fde68a] rounded-xs flex items-center gap-1">
                  <Sliders className="w-2.5 h-2.5" />
                  <span>Master Template Mode</span>
                </span>
              ) : null}
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <FilePlus className="w-4 h-4 text-[#0d9488]" />
              <span className="text-xs font-bold text-[#1e293b]">HO Report Generator</span>

              {/* Tabs */}
              <div className="flex items-center gap-1 ml-2 bg-[#f1f5f9] p-0.5 rounded-xs text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveTab('generator')}
                  className={`px-2 py-0.5 rounded-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'generator'
                      ? 'bg-white text-[#0d9488] shadow-xs'
                      : 'text-[#64748b] hover:text-[#1e293b]'
                  }`}
                >
                  Generate Report
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('documents')}
                  className={`px-2 py-0.5 rounded-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'documents'
                      ? 'bg-white text-[#0d9488] shadow-xs'
                      : 'text-[#64748b] hover:text-[#1e293b]'
                  }`}
                >
                  Saved HO Reports & Downloads
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {!selectedTemplate ? (
            isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowCreateOwnModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Own Template</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white hover:bg-[#f8fafc] text-[#475569] border border-[#cbd5e1] rounded-xs transition-colors cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Import</span>
                </button>
              </>
            ) : null
          ) : (
            <>
              {isCustomizing ? (
                /* TEMPLATE DESIGNER ACTIONS (Save to Master Template) */
                <>
                  <button
                    type="button"
                    onClick={handleSaveAsTemplate}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors cursor-pointer"
                    title="Save customized fields and sections to master template in database"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Template</span>
                  </button>
                </>
              ) : (
                /* REPORT GENERATOR ACTIONS (Fill Data, Save Draft, Finalize, Export) */
                <>

                  {/* Save Draft */}
                  <button
                    type="button"
                    onClick={() => handleSaveDraft('draft')}
                    disabled={saving || !documentTitle}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#cbd5e1] rounded-xs transition-colors cursor-pointer disabled:opacity-50"
                    title="Save current progress as a draft report"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    <span>Draft</span>
                  </button>

                  {/* Finalize */}
                  <button
                    type="button"
                    onClick={() => handleSaveDraft('final')}
                    disabled={saving || !documentTitle}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    title="Finalize report and freeze snapshot"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Finalize</span>
                  </button>

                  {/* Export DOCX & PDF */}
                  <div className="flex items-center border border-[#cbd5e1] rounded-xs overflow-hidden">
                    <button
                      type="button"
                      onClick={() => handleGenerate('docx')}
                      disabled={!!generating || !documentTitle}
                      className="px-2 py-1 text-[11px] font-bold bg-[#0078d4] hover:bg-[#106ebe] text-white transition-colors cursor-pointer disabled:opacity-50"
                      title="Download DOCX"
                    >
                      {generating === 'docx' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'DOCX'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerate('pdf')}
                      disabled={!!generating || !documentTitle}
                      className="px-2 py-1 text-[11px] font-bold bg-[#dc2626] hover:bg-[#b91c1c] text-white transition-colors cursor-pointer disabled:opacity-50 border-l border-white/20"
                      title="Download PDF"
                    >
                      {generating === 'pdf' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'PDF'}
                    </button>
                  </div>

                  {/* Clear */}
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1 text-[#64748b] hover:text-[#ef4444] hover:bg-[#fee2e2] rounded-xs transition-colors cursor-pointer"
                    title="Clear all field inputs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xs text-xs font-semibold shadow-sm transition-all ${
            toast.type === 'success'
              ? 'bg-[#f0fdf4] text-[#059669] border border-[#86efac]'
              : toast.type === 'error'
              ? 'bg-[#fef2f2] text-[#dc2626] border border-[#fca5a5]'
              : 'bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main View Area */}
      {activeTab === 'generator' && (
        <>
          {!selectedTemplate ? (
            <TemplateSelector
              templates={templates}
              loading={loadingTemplates}
              onSelect={handleSelectTemplate}
              onEditTemplate={handleCustomizeTemplate}
              onCreateTemplate={() => setShowCreateOwnModal(true)}
              onImportTemplate={() => setShowImportModal(true)}
              onDeleteTemplate={handleDeleteTemplate}
            />
          ) : (
            <div id="builder-split-container" className="flex flex-col lg:flex-row items-start gap-1 min-h-[calc(100vh-170px)] relative">
              {/* Left Panel — Form Input */}
              <div
                className="w-full flex flex-col min-w-0"
                style={isDesktop ? { flex: `0 0 ${leftPanelWidth}%`, maxWidth: `${leftPanelWidth}%` } : undefined}
              >
                <div className="bg-white border border-[#cbd5e1] rounded-xs shadow-xs flex-1">
                  {/* Header Row: Template Metadata (Customize Mode) vs Report Details (Generate Mode) */}
                  {isCustomizing ? (
                    <div className="px-3 py-2.5 border-b border-[#99f6e4] bg-[#f0fdfa] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#0f766e] flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-[#0d9488]" />
                          Master Template Configuration
                        </span>
                        <span className="text-[10px] text-[#0d9488] font-semibold bg-white px-2 py-0.5 border border-[#99f6e4] rounded-xs">
                          Template Designer Mode
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-[#475569] uppercase mb-0.5">
                            Template Name *
                          </label>
                          <input
                            type="text"
                            value={selectedTemplate.name}
                            onChange={e => {
                              const newName = e.target.value;
                              setSelectedTemplate(prev => prev ? { ...prev, name: newName } : prev);
                              setIsDirty(true);
                            }}
                            placeholder="Template name..."
                            className="w-full px-2.5 py-1 text-xs border border-[#cbd5e1] rounded-xs bg-white text-[#1e293b] focus:outline-none focus:border-[#0d9488]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#475569] uppercase mb-0.5">
                            Category *
                          </label>
                          <select
                            value={selectedTemplate.category || 'Operations'}
                            onChange={e => {
                              const newCat = e.target.value;
                              setSelectedTemplate(prev => prev ? { ...prev, category: newCat } : prev);
                              setIsDirty(true);
                            }}
                            className="w-full px-2 py-1 text-xs border border-[#cbd5e1] rounded-xs bg-white text-[#1e293b]"
                          >
                            <option value="Operations">Operations</option>
                            <option value="Security">Security</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Health & Safety">Health & Safety</option>
                            <option value="Compliance">Compliance</option>
                            <option value="General">General</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-[#475569] uppercase mb-0.5">
                          Template Description
                        </label>
                        <input
                          type="text"
                          value={selectedTemplate.description || ''}
                          onChange={e => {
                            const newDesc = e.target.value;
                            setSelectedTemplate(prev => prev ? { ...prev, description: newDesc } : prev);
                            setIsDirty(true);
                          }}
                          placeholder="Brief description of template purpose..."
                          className="w-full px-2.5 py-1 text-xs border border-[#cbd5e1] rounded-xs bg-white text-[#1e293b] focus:outline-none focus:border-[#0d9488]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="px-3 py-2 border-b border-[#e2e8f0] bg-[#fafafa]">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-[#475569] uppercase mb-0.5">
                            Document Title *
                          </label>
                          <input
                            type="text"
                            value={documentTitle}
                            onChange={e => {
                              setDocumentTitle(e.target.value);
                              setIsDirty(true);
                            }}
                            placeholder="Document title..."
                            className="w-full px-2.5 py-1 text-xs border border-[#cbd5e1] rounded-xs bg-white text-[#1e293b] focus:outline-none focus:border-[#0d9488]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#475569] uppercase mb-0.5">
                            Hotel / Site *
                          </label>
                          <select
                            value={selectedSite}
                            onChange={e => {
                              setSelectedSite(e.target.value);
                              setIsDirty(true);
                            }}
                            disabled={!canAccessAllSites()}
                            className="w-full px-2 py-1 text-xs border border-[#cbd5e1] rounded-xs bg-white text-[#1e293b]"
                          >
                            {allowedSites.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Compact Form Fields with In-Place Additions and Removals */}
                  <DocumentInputForm
                    fieldDefinitions={fieldDefs}
                    layoutConfig={layoutConfig}
                    fieldValues={fieldValues}
                    onFieldChange={handleFieldChange}
                    isCustomizing={isCustomizing}
                    onAddField={handleAddField}
                    onRemoveField={handleRemoveField}
                    onUpdateField={handleUpdateField}
                    onAddSection={handleAddSection}
                    onRemoveSection={handleRemoveSection}
                    onUpdateSection={handleUpdateSection}
                  />
                </div>
              </div>

              {/* Draggable Divider */}
              <div
                onMouseDown={handleSplitterMouseDown}
                className="hidden lg:flex items-center justify-center w-2 cursor-col-resize group self-stretch select-none z-20 hover:bg-[#0d9488]/10"
                title="Drag to resize form vs preview"
              >
                <div className="w-0.5 h-10 rounded-full bg-[#cbd5e1] group-hover:bg-[#0d9488] transition-colors" />
              </div>

              {/* Right Panel — Sticky Live Preview */}
              <div
                className="w-full flex flex-col min-w-0 lg:sticky lg:top-3 self-start lg:h-[calc(100vh-130px)] z-10"
                style={isDesktop ? { flex: `1 1 ${100 - leftPanelWidth}%`, maxWidth: `${100 - leftPanelWidth}%` } : undefined}
              >
                <DocumentPreview
                  title={isCustomizing ? selectedTemplate.name : documentTitle}
                  documentNumber={isCustomizing ? 'MASTER-TEMPLATE' : (currentRecord?.documentNumber || 'DOC-2026-DRAFT')}
                  site={isCustomizing ? 'All Sites (Master Template)' : selectedSite}
                  templateName={selectedTemplate.name}
                  fieldDefinitions={fieldDefs}
                  layoutConfig={layoutConfig}
                  headerConfig={headerConfig}
                  footerConfig={footerConfig}
                  fieldValues={fieldValues}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Saved Documents & History */}
      {activeTab === 'documents' && (
        <DocumentsListView onEditRecord={handleEditSavedRecord} />
      )}

      {/* Upload-First Modal for Create Own Template */}
      {showCreateOwnModal && (
        <CreateOwnUploadModal
          onClose={() => setShowCreateOwnModal(false)}
          onTemplateReady={handleCreateOwnTemplateReady}
        />
      )}

      {/* DOCX / PDF Template Importer */}
      {showImportModal && (
        <DocumentImportModal
          onClose={() => setShowImportModal(false)}
          onImportSuccess={imported => {
            setTemplates(prev => [imported, ...prev]);
            setShowImportModal(false);
            showToast(`Imported "${imported.name}"`);
          }}
          onOpenInBuilder={handleCreateOwnTemplateReady}
        />
      )}
    </div>
  );
};
