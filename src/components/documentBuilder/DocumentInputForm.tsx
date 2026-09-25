/**
 * DocumentInputForm — Dynamic form renderer with compact layout & in-place customization
 *
 * Renders form fields based on template field definitions, grouped by section.
 * Supports compact field entry and in-place field/section additions and removals.
 */

import React, { useCallback, useRef, useState } from 'react';
import { Trash2, Plus, Sparkles, UploadCloud, Camera, Image as ImageIcon } from 'lucide-react';
import type { TemplateFieldDefinition, LayoutConfig, SectionLayout } from '../../types/documentBuilder';

/**
 * Resizes uploaded image to max 1200px width/height and returns a compact JPEG data URL.
 * Keeps memory lightweight (~100-200KB per image) and renders instantly in preview/print/DOCX.
 */
function resizeImageToDataUrl(file: File, maxDimension = 1200): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface EvidencePhotosFieldProps {
  fieldName: string;
  value: any;
  onChange: (name: string, value: any) => void;
  itemLabel?: string;
}

const EvidencePhotosField: React.FC<EvidencePhotosFieldProps> = ({
  fieldName,
  value,
  onChange,
  itemLabel,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const rawPhotos = Array.isArray(value) ? value : [];
  const photos = rawPhotos.map((p: any, idx: number) => ({
    id: p?.id || `photo-${idx}`,
    name: p?.name || `Evidence Photo ${idx + 1}`,
    url: p?.url || (typeof p === 'string' ? p : ''),
    caption: p?.caption || '',
    sizeBytes: p?.sizeBytes,
  }));

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    try {
      const newItems: any[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const dataUrl = await resizeImageToDataUrl(file);
        newItems.push({
          id: `photo-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          url: dataUrl,
          caption: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          date: new Date().toISOString(),
          sizeBytes: file.size,
        });
      }

      if (newItems.length > 0) {
        onChange(fieldName, [...photos, ...newItems]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (idx: number) => {
    const updated = photos.filter((_, i) => i !== idx);
    onChange(fieldName, updated);
  };

  const handleCaptionChange = (idx: number, caption: string) => {
    const updated = [...photos];
    updated[idx] = { ...updated[idx], caption };
    onChange(fieldName, updated);
  };

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-2">
      {/* Hidden File Input for Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {/* Upload Dropzone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xs p-3 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-[#0d9488] bg-[#f0fdfa]'
            : 'border-[#cbd5e1] hover:border-[#0d9488] bg-[#f8fafc] hover:bg-[#f0fdfa]/40'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 text-xs text-[#0f766e]">
          <div className="flex items-center gap-1.5 font-bold">
            <Camera className="w-4 h-4 text-[#0d9488]" />
            <span>{uploading ? 'Processing Image...' : '+ Upload Evidence Photos'}</span>
          </div>
          <span className="text-[10px] text-[#64748b]">
            (or drop images here • JPG, PNG, WebP)
          </span>
        </div>
      </div>

      {/* Uploaded Photos Gallery List */}
      {photos.length > 0 && (
        <div className="space-y-1.5">
          {photos.map((p, idx) => (
            <div
              key={p.id}
              className="flex items-center gap-2 p-1.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xs"
            >
              <div className="w-11 h-11 bg-[#e2e8f0] rounded-xs overflow-hidden shrink-0 flex items-center justify-center border border-[#cbd5e1]">
                {p.url ? (
                  <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-[#94a3b8]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  placeholder="Photo caption or description..."
                  value={p.caption}
                  onChange={(e) => handleCaptionChange(idx, e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-[#cbd5e1] rounded-xs bg-white text-[#1e293b] focus:outline-none focus:border-[#0d9488]"
                />
                <span className="text-[9px] text-[#64748b] block mt-0.5 truncate">
                  {p.name} {p.sizeBytes ? `(${(p.sizeBytes / 1024).toFixed(0)} KB)` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemovePhoto(idx)}
                className="p-1 text-[#ef4444] hover:bg-[#fee2e2] rounded-xs transition-colors cursor-pointer"
                title="Remove photo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface DocumentInputFormProps {
  fieldDefinitions: TemplateFieldDefinition[];
  layoutConfig?: LayoutConfig;
  fieldValues: Record<string, any>;
  onFieldChange: (name: string, value: any) => void;
  isCustomizing?: boolean;
  onAddField?: (sectionId: string, type?: TemplateFieldDefinition['type']) => void;
  onRemoveField?: (fieldId: string) => void;
  onUpdateField?: (fieldId: string, updates: Partial<TemplateFieldDefinition>) => void;
  onAddSection?: () => void;
  onRemoveSection?: (sectionId: string) => void;
  onUpdateSection?: (sectionId: string, title: string) => void;
}

const inputClass = 'w-full px-2.5 py-1.5 text-xs border border-[#cbd5e1] rounded-xs bg-white text-[#1e293b] focus:outline-none focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors';
const labelClass = 'block text-[11px] font-semibold text-[#475569] mb-1';
const textareaClass = `${inputClass} min-h-[64px] resize-y`;

export const DocumentInputForm: React.FC<DocumentInputFormProps> = ({
  fieldDefinitions,
  layoutConfig,
  fieldValues,
  onFieldChange,
  isCustomizing = false,
  onAddField,
  onRemoveField,
  onUpdateField,
  onAddSection,
  onRemoveSection,
  onUpdateSection,
}) => {
  const sections: SectionLayout[] = layoutConfig?.sections && layoutConfig.sections.length > 0
    ? [...layoutConfig.sections].sort((a, b) => a.order - b.order)
    : [{ id: 'default', title: 'Form Fields', order: 1 }];

  const renderField = useCallback((field: TemplateFieldDefinition) => {
    const value = fieldValues[field.name] ?? field.defaultValue ?? '';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const val = field.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.value;
      onFieldChange(field.name, val);
    };

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            id={`field-${field.name}`}
            value={value}
            onChange={handleChange}
            placeholder={field.placeholder || 'Enter details...'}
            required={field.required}
            className={textareaClass}
            maxLength={field.validation?.maxLength}
            rows={3}
          />
        );

      case 'repeating_group':
      case 'repeating': {
        const rawItems = Array.isArray(value) ? value : [];
        const items = rawItems.map((it: any, idx: number) => {
          if (typeof it === 'string') {
            const parts = it.split(/[/(]/);
            return {
              id: `item-${idx}`,
              name: parts[0]?.trim() || it,
              portRef: parts[1]?.replace(/[)\]]/g, '').trim() || '',
            };
          }
          return {
            id: it?.id || `item-${idx}`,
            name: it?.name || '',
            portRef: it?.portRef || '',
          };
        });

        const handleItemChange = (index: number, subKey: string, subVal: string) => {
          const updated = [...items];
          updated[index] = { ...updated[index], [subKey]: subVal };
          onFieldChange(field.name, updated);
        };

        const handleAddItem = () => {
          const newItem = {
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: '',
            portRef: '',
          };
          onFieldChange(field.name, [...items, newItem]);
        };

        const handleRemoveItem = (index: number) => {
          const updated = items.filter((_, i) => i !== index);
          onFieldChange(field.name, updated);
        };

        return (
          <div className="space-y-1.5">
            {items.map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex items-center gap-1.5 p-1.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xs"
              >
                <span className="text-[10px] font-bold text-[#64748b] w-4 text-center shrink-0">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  placeholder="Full Name / Details"
                  value={item.name}
                  onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                  className="flex-1 px-2 py-1 text-xs border border-[#cbd5e1] rounded-xs bg-white text-[#1e293b] focus:outline-none focus:border-[#0d9488]"
                />
                <input
                  type="text"
                  placeholder="Port / NASS Ref"
                  value={item.portRef || ''}
                  onChange={(e) => handleItemChange(idx, 'portRef', e.target.value)}
                  className="w-28 px-2 py-1 text-xs border border-[#cbd5e1] rounded-xs bg-white text-[#1e293b] focus:outline-none focus:border-[#0d9488]"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveItem(idx)}
                  className="p-1 text-[#ef4444] hover:bg-[#fee2e2] rounded-xs transition-colors cursor-pointer"
                  title="Remove row"
                >
                  <span className="text-xs font-bold leading-none">✕</span>
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-1 px-2 border border-dashed border-[#0d9488] text-[#0d9488] hover:bg-[#f0fdfa] rounded-xs text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <span>+</span>
              <span>{field.itemLabel || `Add ${field.label}`}</span>
            </button>
          </div>
        );
      }

      case 'attachment':
        return (
          <EvidencePhotosField
            fieldName={field.name}
            value={value}
            onChange={onFieldChange}
            itemLabel={field.itemLabel}
          />
        );

      case 'select':
        return (
          <select
            id={`field-${field.name}`}
            value={value}
            onChange={handleChange}
            required={field.required}
            className={inputClass}
          >
            <option value="">— Select —</option>
            {(field.options || []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'date':
        return (
          <input
            id={`field-${field.name}`}
            type="date"
            value={value}
            onChange={handleChange}
            required={field.required}
            className={inputClass}
          />
        );

      case 'time':
        return (
          <input
            id={`field-${field.name}`}
            type="time"
            value={value}
            onChange={handleChange}
            required={field.required}
            className={inputClass}
          />
        );

      case 'datetime':
        return (
          <input
            id={`field-${field.name}`}
            type="datetime-local"
            value={value}
            onChange={handleChange}
            required={field.required}
            className={inputClass}
          />
        );

      case 'number':
        return (
          <input
            id={`field-${field.name}`}
            type="number"
            value={value}
            onChange={handleChange}
            placeholder={field.placeholder || ''}
            required={field.required}
            min={field.validation?.min}
            max={field.validation?.max}
            className={inputClass}
          />
        );

      case 'email':
        return (
          <input
            id={`field-${field.name}`}
            type="email"
            value={value}
            onChange={handleChange}
            placeholder={field.placeholder || ''}
            required={field.required}
            className={inputClass}
          />
        );

      case 'phone':
        return (
          <input
            id={`field-${field.name}`}
            type="tel"
            value={value}
            onChange={handleChange}
            placeholder={field.placeholder || ''}
            required={field.required}
            className={inputClass}
          />
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer py-1">
            <input
              id={`field-${field.name}`}
              type="checkbox"
              checked={!!value}
              onChange={handleChange}
              className="w-3.5 h-3.5 rounded-xs border-[#cbd5e1] text-[#0d9488] focus:ring-[#0d9488]"
            />
            <span className="text-xs text-[#334155]">{field.placeholder || 'Confirmed / Yes'}</span>
          </label>
        );

      default: // text
        return (
          <input
            id={`field-${field.name}`}
            type="text"
            value={value}
            onChange={handleChange}
            placeholder={field.placeholder || ''}
            required={field.required}
            className={inputClass}
          />
        );
    }
  }, [fieldValues, onFieldChange]);

  return (
    <div className="divide-y divide-[#f1f5f9]">
      {sections.map(section => {
        const sectionFields = fieldDefinitions
          .filter(f => f.section === section.id)
          .sort((a, b) => a.order - b.order);

        if (!isCustomizing && sectionFields.length === 0) return null;

        const isGrid = (section.columns || 1) > 1;

        return (
          <div key={section.id} className="px-3.5 py-3">
            {/* Section heading (compact) */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1">
                <div className="w-1 h-3.5 bg-[#0d9488] rounded-full shrink-0" />
                {isCustomizing && onUpdateSection ? (
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => onUpdateSection(section.id, e.target.value)}
                    placeholder="Section Title"
                    className="text-xs font-bold text-[#0f766e] uppercase tracking-wider bg-white border border-[#cbd5e1] rounded-xs px-2 py-0.5 flex-1 focus:border-[#0d9488]"
                  />
                ) : (
                  <h3 className="text-[11px] font-bold text-[#0f766e] uppercase tracking-wider">
                    {section.title}
                  </h3>
                )}
              </div>

              {isCustomizing && sections.length > 1 && onRemoveSection && (
                <button
                  type="button"
                  onClick={() => onRemoveSection(section.id)}
                  className="px-1.5 py-0.5 text-[#ef4444] hover:bg-[#fee2e2] rounded-xs text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Delete Section"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Del Section</span>
                </button>
              )}
            </div>

            {/* Fields grid (compact spacing) */}
            <div className={isGrid ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2' : 'space-y-2'}>
              {sectionFields.map(field => {
                const isFullWidth = field.width === 'full' || field.type === 'textarea';
                return (
                  <div
                    key={field.id}
                    className={isGrid && isFullWidth ? 'sm:col-span-2' : ''}
                  >
                    {isCustomizing ? (
                      /* Compact Customization Card */
                      <div className="p-2 bg-[#f8fafc] border border-[#cbd5e1] rounded-xs space-y-1.5 hover:border-[#0d9488] transition-colors">
                        <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[#e2e8f0] pb-1.5">
                          <div className="flex items-center gap-1 flex-1 min-w-[160px]">
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => onUpdateField?.(field.id, { label: e.target.value })}
                              placeholder="Field Label"
                              className="text-xs font-bold text-[#1e293b] bg-white border border-[#cbd5e1] rounded-xs px-2 py-0.5 flex-1 focus:border-[#0d9488]"
                            />
                            <select
                              value={field.type}
                              onChange={(e) => onUpdateField?.(field.id, { type: e.target.value as any })}
                              className="text-[11px] bg-white border border-[#cbd5e1] rounded-xs px-1.5 py-0.5 text-[#334155]"
                            >
                              <option value="text">Text</option>
                              <option value="textarea">Paragraph</option>
                              <option value="date">Date</option>
                              <option value="select">Dropdown</option>
                              <option value="checkbox">Checkbox</option>
                              <option value="number">Number</option>
                              <option value="repeating_group">People</option>
                              <option value="attachment">Photos</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <label className="flex items-center gap-1 text-[10px] font-semibold text-[#475569] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => onUpdateField?.(field.id, { required: e.target.checked })}
                                className="rounded-xs text-[#0d9488]"
                              />
                              Req
                            </label>

                            <select
                              value={field.width || 'full'}
                              onChange={(e) => onUpdateField?.(field.id, { width: e.target.value as any })}
                              className="text-[10px] bg-white border border-[#cbd5e1] rounded-xs px-1 py-0.5 text-[#475569]"
                            >
                              <option value="full">Full</option>
                              <option value="half">Half</option>
                            </select>

                            {onRemoveField && (
                              <button
                                type="button"
                                onClick={() => onRemoveField(field.id)}
                                className="p-1 text-[#ef4444] hover:bg-[#fee2e2] rounded-xs transition-colors cursor-pointer"
                                title="Delete field"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {field.type === 'select' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-[#64748b] shrink-0">Options:</span>
                            <input
                              type="text"
                              value={(field.options || []).join(', ')}
                              onChange={(e) => {
                                const opts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                onUpdateField?.(field.id, { options: opts });
                              }}
                              placeholder="e.g. Low, Medium, High"
                              className="flex-1 text-[11px] px-2 py-0.5 border border-[#cbd5e1] rounded-xs bg-white text-[#1e293b]"
                            />
                          </div>
                        )}

                        <div>{renderField(field)}</div>
                      </div>
                    ) : (
                      <>
                        <label htmlFor={`field-${field.name}`} className={labelClass}>
                          {field.label}
                          {field.required && <span className="text-[#dc2626] ml-0.5">*</span>}
                        </label>
                        {renderField(field)}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Compact Add Field Buttons */}
            {isCustomizing && onAddField && (
              <div className="mt-2.5 pt-2 border-t border-dashed border-[#e2e8f0] flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-bold text-[#64748b] mr-1 flex items-center gap-0.5">
                  <Plus className="w-3 h-3 text-[#0d9488]" />
                  Add:
                </span>
                <button
                  type="button"
                  onClick={() => onAddField(section.id, 'text')}
                  className="px-2 py-0.5 bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-xs text-[10px] font-semibold text-[#334155] transition-colors cursor-pointer"
                >
                  + Text
                </button>
                <button
                  type="button"
                  onClick={() => onAddField(section.id, 'textarea')}
                  className="px-2 py-0.5 bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-xs text-[10px] font-semibold text-[#334155] transition-colors cursor-pointer"
                >
                  + Paragraph
                </button>
                <button
                  type="button"
                  onClick={() => onAddField(section.id, 'date')}
                  className="px-2 py-0.5 bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-xs text-[10px] font-semibold text-[#334155] transition-colors cursor-pointer"
                >
                  + Date
                </button>
                <button
                  type="button"
                  onClick={() => onAddField(section.id, 'select')}
                  className="px-2 py-0.5 bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-xs text-[10px] font-semibold text-[#334155] transition-colors cursor-pointer"
                >
                  + Dropdown
                </button>
                <button
                  type="button"
                  onClick={() => onAddField(section.id, 'checkbox')}
                  className="px-2 py-0.5 bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-xs text-[10px] font-semibold text-[#334155] transition-colors cursor-pointer"
                >
                  + Checkbox
                </button>
                <button
                  type="button"
                  onClick={() => onAddField(section.id, 'repeating_group')}
                  className="px-2 py-0.5 bg-[#f0fdfa] hover:bg-[#ccfbf1] border border-[#99f6e4] rounded-xs text-[10px] font-bold text-[#0f766e] transition-colors cursor-pointer"
                >
                  + People
                </button>
                <button
                  type="button"
                  onClick={() => onAddField(section.id, 'attachment')}
                  className="px-2 py-0.5 bg-[#fdf2f8] hover:bg-[#fce7f3] border border-[#fbcfe8] rounded-xs text-[10px] font-bold text-[#be185d] transition-colors cursor-pointer"
                >
                  + Photos
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Compact Add Section Button */}
      {isCustomizing && onAddSection && (
        <div className="p-3 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-center">
          <button
            type="button"
            onClick={onAddSection}
            className="px-3 py-1 bg-white hover:bg-[#f0fdfa] border border-dashed border-[#0d9488] text-[#0d9488] rounded-xs text-xs font-bold flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Section
          </button>
        </div>
      )}

      {fieldDefinitions.length === 0 && (
        <div className="px-4 py-8 text-center text-[#605e5c]">
          <p className="text-xs font-semibold text-[#242424]">No fields in this template</p>
          <p className="text-[11px] mt-0.5">
            {isCustomizing ? 'Click "+ Add" to add questions and inputs.' : 'This template is empty.'}
          </p>
        </div>
      )}
    </div>
  );
};
