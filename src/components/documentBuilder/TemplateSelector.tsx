/**
 * TemplateSelector — Card-based template chooser with Search, Categories, and Creation shortcuts
 *
 * Displays approved templates with category filters, field counts,
 * and direct actions to Create Own Template or Import DOCX/PDF.
 */

import React, { useState } from 'react';
import {
  FileText,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  ClipboardList,
  Plus,
  UploadCloud,
  Search,
  CheckCircle2,
  Sparkles,
  Edit2,
  Trash2,
} from 'lucide-react';
import type { TemplateWithVersion } from '../../types/documentBuilder';
import { useApp } from '../../context/AppContext';

interface TemplateSelectorProps {
  templates: TemplateWithVersion[];
  loading: boolean;
  onSelect: (template: TemplateWithVersion) => void;
  onCreateTemplate?: () => void;
  onImportTemplate?: () => void;
  onEditTemplate?: (template: TemplateWithVersion) => void;
  onDeleteTemplate?: (id: string) => void;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Safeguarding: ShieldCheck,
  Operations: AlertTriangle,
  General: ClipboardList,
  Welfare: ClipboardList,
  Facilities: AlertTriangle,
  Clinical: ShieldCheck,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; iconColor: string }> = {
  Safeguarding: { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200', iconColor: 'text-teal-600' },
  Operations: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', iconColor: 'text-amber-600' },
  General: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', iconColor: 'text-blue-600' },
  Welfare: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', iconColor: 'text-emerald-600' },
  Facilities: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', iconColor: 'text-orange-600' },
  Clinical: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200', iconColor: 'text-indigo-600' },
};

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  templates,
  loading,
  onSelect,
  onCreateTemplate,
  onImportTemplate,
  onEditTemplate,
  onDeleteTemplate,
}) => {
  const { currentUserRole } = useApp();
  const isAdminOrManager = ['Super Admin', 'Admin', 'Regional Manager', 'Operations Manager'].includes(currentUserRole);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(templates.map(t => t.category).filter(Boolean)))];

  const filteredTemplates = templates.filter(t => {
    if (selectedCategory !== 'All' && t.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (t.name || '').toLowerCase().includes(q);
      const matchDesc = (t.description || '').toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#605e5c]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0d9488] mb-3" />
        <p className="text-sm font-semibold">Loading document templates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Notification and Quick Create Actions */}
      <div className="bg-[#f0fdfa] border border-[#99f6e4] rounded-xs px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#0d9488] shrink-0" />
          <div>
            <p className="text-xs font-bold text-[#0f766e]">
              {isAdminOrManager ? 'Report Templates & Form Administration' : 'Report Generator — Choose a Report Type'}
            </p>
            <p className="text-[11px] text-[#0d9488]">
              {isAdminOrManager
                ? 'Select a template below to generate a report, or customize master forms. Staff can choose templates to generate and download reports.'
                : 'Select an approved template below to generate your report with real-time live preview and instant DOCX/PDF downloads.'}
            </p>
          </div>
        </div>

        {isAdminOrManager && (
          <div className="flex items-center gap-2">
            {onCreateTemplate && (
              <button
                type="button"
                onClick={onCreateTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Own Template</span>
              </button>
            )}

            {onImportTemplate && (
              <button
                type="button"
                onClick={onImportTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white hover:bg-[#f1f5f9] text-[#0f766e] border border-[#99f6e4] rounded-xs shadow-xs transition-colors cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Import DOCX / PDF</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#0d9488] text-white'
                  : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#cbd5e1] rounded-xs bg-white focus:outline-none focus:border-[#0d9488]"
          />
        </div>
      </div>

      {/* Template Cards Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-[#e2e8f0] rounded-xs text-[#605e5c]">
          <FileText className="w-10 h-10 text-neutral-300 mb-3" />
          <p className="text-sm font-semibold text-[#242424]">No matching templates found</p>
          <p className="text-xs text-[#94a3b8] mt-1 mb-4">
            Create a new template using our modular builder or import one from Word / PDF.
          </p>
          <div className="flex gap-2">
            {onCreateTemplate && (
              <button
                onClick={onCreateTemplate}
                className="px-3 py-1.5 bg-[#0d9488] text-white text-xs font-bold rounded-xs"
              >
                + Create Template Now
              </button>
            )}
            {onImportTemplate && (
              <button
                onClick={onImportTemplate}
                className="px-3 py-1.5 bg-[#f1f5f9] border border-[#cbd5e1] text-[#334155] text-xs font-bold rounded-xs"
              >
                Import from DOCX/PDF
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTemplates.map(template => {
            const catColors = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.General;
            const CatIcon = CATEGORY_ICONS[template.category] || FileText;
            const fieldCount = template.currentVersion?.fieldDefinitions?.length || 0;
            const sectionCount = template.currentVersion?.layoutConfig?.sections?.length || 0;

            return (
              <div
                key={template.id}
                className="group relative bg-white border border-[#e1dfdd] rounded-xs p-4 text-left hover:border-[#0d9488] hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div
                  onClick={() => onSelect(template)}
                  className="cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xs ${catColors.bg} ${catColors.border} border shrink-0`}>
                      <CatIcon className={`w-5 h-5 ${catColors.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <h3 className="text-sm font-bold text-[#242424] group-hover:text-[#0d9488] transition-colors truncate">
                        {template.name}
                      </h3>
                      <p className="text-xs text-[#605e5c] mt-1 line-clamp-2">
                        {template.description || 'Approved SD Commercial operational document template.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#edebe9]">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${catColors.bg} ${catColors.text}`}>
                      {template.category}
                    </span>
                    <span className="text-[10px] text-[#8a8886]">
                      {fieldCount} fields • {sectionCount} sections
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isAdminOrManager && onEditTemplate && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTemplate(template);
                        }}
                        className="p-1 text-[#94a3b8] hover:text-[#0d9488] rounded-xs"
                        title="Edit Template"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isAdminOrManager && onDeleteTemplate && !template.id.startsWith('tmpl-risk') && !template.id.startsWith('tmpl-incident') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete template "${template.name}"?`)) {
                            onDeleteTemplate(template.id);
                          }
                        }}
                        className="p-1 text-[#94a3b8] hover:text-red-600 rounded-xs"
                        title="Delete Template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelect(template)}
                      className="px-2.5 py-1 text-xs font-bold text-white bg-[#0d9488] hover:bg-[#0f766e] rounded-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>Generate Report</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
