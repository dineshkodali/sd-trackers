import React, { useState, useMemo } from 'react';
import { 
  HeartHandshake, 
  Search, 
  Download, 
  Building2, 
  Layers, 
  Grid3X3, 
  Plus, 
  Trash2, 
  Edit3, 
  Phone, 
  Mail, 
  Eye,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SDVCSAgency } from '../../types';
import { SD_VCS_HOTEL_NAMES } from '../../data/initialData';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { useTableSchema } from '../../hooks/useTableSchema';
import { VCS_AGENCIES_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';

const vcsExportColumns: ExportColumnOption[] = [
  { id: 'hotelName', label: 'Hotel / Site' },
  { id: 'agencyName', label: 'Agency Name' },
  { id: 'category', label: 'Support Category' },
  { id: 'servicesProvided', label: 'Services Provided' },
  { id: 'contactPerson', label: 'Key Contact' },
  { id: 'contactNumber', label: 'Phone Number' },
  { id: 'email', label: 'Email Address' },
  { id: 'address', label: 'Location / Address' },
  { id: 'notes', label: 'Operational Notes' }
];

export const SDVCSDirectoryView: React.FC = () => {
  const {
    vcsAgencies,
    addVCSAgency,
    updateVCSAgency,
    deleteVCSAgency,
    assignedSite,
    allowedSites,
    canAccessAllSites,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole
  } = useApp();

  // Table Schema Hook
  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<SDVCSAgency>('vcsDirectory', VCS_AGENCIES_TABLE_COLUMNS);

  const [selectedProperty, setSelectedProperty] = useState<string>(!canAccessAllSites() ? assignedSite : 'all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [gridMode, setGridMode] = useState<'table' | 'matrix'>('table');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [sortKey, setSortKey] = useState<string>('agencyName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<SDVCSAgency | null>(null);
  const [viewDetailAgency, setViewDetailAgency] = useState<SDVCSAgency | null>(null);

  const categories = [
    'All Categories',
    'Charity & Welfare',
    'Food & Nutrition',
    'Family & Children',
    'ESOL & Education',
    'Faith & Community',
    'Advocacy & Legal',
    'Statutory / Council'
  ];

  const filteredAgencies = useMemo(() => {
    return vcsAgencies.filter(a => {
      const matchesProperty = selectedProperty === 'all' || a.hotelName.toLowerCase() === selectedProperty.toLowerCase();
      const matchesCategory = selectedCategory === 'all' || selectedCategory === 'All Categories' || a.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        a.agencyName.toLowerCase().includes(q) ||
        a.hotelName.toLowerCase().includes(q) ||
        (a.servicesProvided && a.servicesProvided.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q)) ||
        (a.contactPerson && a.contactPerson.toLowerCase().includes(q)) ||
        (a.contactNumber && a.contactNumber.toLowerCase().includes(q)) ||
        (a.email && a.email.toLowerCase().includes(q));

      return matchesProperty && matchesCategory && matchesQuery;
    });
  }, [vcsAgencies, selectedProperty, selectedCategory, searchQuery]);

  const sortedAgencies = useMemo(() => {
    return [...filteredAgencies].sort((a: any, b: any) => {
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
      return sortOrder === 'asc' 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredAgencies, sortKey, sortOrder]);

  const paginatedAgencies = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedAgencies.slice(startIndex, startIndex + pageSize);
  }, [sortedAgencies, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleCreateSubmit = (data: Partial<SDVCSAgency>) => {
    addVCSAgency({
      hotelName: !canAccessAllSites() 
        ? assignedSite 
        : (data.hotelName || (selectedProperty !== 'all' ? selectedProperty : (assignedSite || allowedSites[0]))),
      agencyName: data.agencyName || '',
      category: (data.category as any) || 'Charity & Welfare',
      servicesProvided: data.servicesProvided || '',
      contactPerson: data.contactPerson || '',
      contactNumber: data.contactNumber || '',
      email: data.email || '',
      address: data.address || '',
      notes: data.notes || '',
      ...data
    } as any);
    setIsAddModalOpen(false);
  };

  const handleEditSubmit = (data: Partial<SDVCSAgency>) => {
    if (!editingAgency) return;
    updateVCSAgency(editingAgency.id, {
      ...editingAgency,
      ...data
    });
    setEditingAgency(null);
  };

  // Export Handlers with Custom Download & PDF/CSV Options
  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    let sourceData = vcsAgencies;
    if (scope === 'filtered') sourceData = sortedAgencies;
    else if (scope === 'custom' && startDate && endDate) {
      sourceData = vcsAgencies.filter(a => {
        const d = (a as any).createdAt ? (a as any).createdAt.slice(0, 10) : '';
        return (!startDate || d >= startDate) && (!endDate || d <= endDate);
      });
    }
    return sourceData;
  };

  const calculateDateRangeCount = (startDate: string, endDate: string): number => {
    return vcsAgencies.filter(a => {
      const d = (a as any).createdAt ? (a as any).createdAt.slice(0, 10) : '';
      return (!startDate || d >= startDate) && (!endDate || d <= endDate);
    }).length;
  };

  const getExportPreviewData = ({
    scope,
    startDate,
    endDate,
    selectedColumns
  }: {
    scope: ExportScope;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    orientation: ExportOrientation;
    isCompact: boolean;
  }) => {
    const raw = getExportDataForScope(scope, startDate, endDate).slice(0, 5);
    const cols = selectedColumns && selectedColumns.length > 0
      ? vcsExportColumns.filter(c => selectedColumns.includes(c.id))
      : vcsExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => String((row as any)[c.id] ?? '')));
    return { headers, rows };
  };

  const handlePerformExport = ({
    format,
    scope,
    orientation = 'landscape',
    startDate,
    endDate,
    selectedColumns
  }: {
    format: ExportFormat;
    scope: ExportScope;
    orientation: ExportOrientation;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    isCompact?: boolean;
  }) => {
    const raw = getExportDataForScope(scope, startDate, endDate);
    const cols = selectedColumns && selectedColumns.length > 0
      ? vcsExportColumns.filter(c => selectedColumns.includes(c.id))
      : vcsExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => String((row as any)[c.id] ?? '')));

    if (format === 'csv') {
      exportTableToCsv({ 
        filename: `SD_VCS_Support_Agencies_${selectedProperty === 'all' ? 'All_Properties' : selectedProperty.replace(/\s+/g, '_')}.csv`, 
        headers, 
        rows 
      });
    } else {
      exportTableToPdf({
        filename: `SD_VCS_Support_Agencies_${selectedProperty === 'all' ? 'All_Properties' : selectedProperty.replace(/\s+/g, '_')}.pdf`,
        title: 'SD VCS Support Agencies & Community Partners Directory',
        headers,
        rows,
        orientation
      });
    }
  };

  const getCategoryBadgeColor = (category?: string) => {
    switch (category) {
      case 'Food & Nutrition':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Family & Children':
        return 'bg-pink-50 text-pink-800 border-pink-200';
      case 'ESOL & Education':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Faith & Community':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'Advocacy & Legal':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'Statutory / Council':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const renderColumnCell = (col: TableColumnConfig<SDVCSAgency>, agency: SDVCSAgency) => {
    if (col.renderCell) {
      return col.renderCell((agency as any)[col.key], agency);
    }

    const value = (agency as any)[col.key];

    if (col.key === 'category') {
      return (
        <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-xs border ${getCategoryBadgeColor(value)}`}>
          {value || 'General Support'}
        </span>
      );
    }

    if (col.key === 'hotelName') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-[#f3f2f1] border border-[#e1dfdd] text-[11px] font-semibold text-[#242424]">
          <Building2 className="w-3 h-3 text-[#0d9488]" />
          {value}
        </span>
      );
    }

    if (col.key === 'agencyName') {
      return <span className="font-bold text-[#242424]">{value || '—'}</span>;
    }

    if (col.key === 'contactNumber' && value) {
      return (
        <div className="flex items-center gap-1 font-mono text-[#323130] text-[11px]">
          <Phone className="w-3 h-3 text-[#8a8886]" />
          <span>{value}</span>
        </div>
      );
    }

    if (col.key === 'email' && value) {
      return (
        <div className="flex items-center gap-1 text-[#0078d4] text-[11px] hover:underline">
          <Mail className="w-3 h-3 text-[#8a8886]" />
          <span>{value}</span>
        </div>
      );
    }

    if (value === null || value === undefined || value === '') {
      return <span className="text-[#a19f9d]">—</span>;
    }

    return String(value);
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-[#0d9488]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">SD VCS Support Agencies</h1>
            <span className="text-xs bg-[#f0fdfa] text-[#0f766e] font-semibold px-2 py-0.5 rounded-xs border border-[#99f6e4]">
              {filteredAgencies.length} Partner Organisations
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Voluntary, Community, and Faith Sector partner directory mapped across initial accommodation clusters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentUserRole === 'Super Admin' && (
            <button
              type="button"
              onClick={() => setIsSchemaModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors"
              title="Super Admin: Customize table columns, headers, and fields"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#0078d4]" />
              <span>Customize Table</span>
            </button>
          )}

          <ExportDropdown
            moduleName="VCS Agencies"
            totalRecordCount={vcsAgencies.length}
            filteredRecordCount={filteredAgencies.length}
            defaultOrientation="landscape"
            dateRangeRecordCount={calculateDateRangeCount}
            availableColumns={vcsExportColumns}
            getPreviewData={getExportPreviewData}
            onExport={handlePerformExport}
            buttonVariant="toolbar"
          />

          {canCreateRecord() && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Support Agency</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and View Mode Toolbar */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Choose Property Selector */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Choose Property:</span>
            <select
              value={selectedProperty}
              onChange={e => { setSelectedProperty(e.target.value); setCurrentPage(1); }}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="all">All Properties (16 Clusters)</option>
              {SD_VCS_HOTEL_NAMES.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Category:</span>
            <select
              value={selectedCategory}
              onChange={e => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Grid View Mode Switcher */}
          <div className="inline-flex rounded-xs border border-[#8a8886] p-0.5 bg-[#faf9f8]">
            <button
              onClick={() => setGridMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-xs transition-all ${
                gridMode === 'table' ? 'bg-[#0d9488] text-white shadow-xs' : 'text-[#605e5c] hover:text-[#242424]'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>Table Grid</span>
            </button>
            <button
              onClick={() => setGridMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-xs transition-all ${
                gridMode === 'matrix' ? 'bg-[#0d9488] text-white shadow-xs' : 'text-[#605e5c] hover:text-[#242424]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Matrix Grid</span>
            </button>
          </div>

          {(selectedProperty !== 'all' || selectedCategory !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedProperty('all');
                setSelectedCategory('all');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-xs text-[#0d9488] hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#605e5c]" />
          <input
            type="text"
            placeholder="Search agency, services, contact, notes..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-8 pr-3 py-1.5 border border-[#8a8886] rounded-xs text-[#323130] text-xs bg-white focus:outline-2 focus:outline-[#71afe5]"
          />
        </div>
      </div>

      {/* Main Data Panel */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
        {gridMode === 'table' ? (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse min-w-[1250px]">
              <thead>
                <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                  {visibleColumns.map(col => {
                    const isSorted = sortKey === col.key;
                    return (
                      <th 
                        key={String(col.key)} 
                        className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                        onClick={() => handleSort(String(col.key))}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{col.label}</span>
                          {isSorted ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#0078d4]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#0078d4]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-[#a19f9d]" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edebe9] text-[#323130]">
                {paginatedAgencies.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 1} className="py-12 text-center text-[#605e5c]">
                      <HeartHandshake className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                      <p className="font-semibold text-sm text-[#242424]">No support agencies found</p>
                      <p className="text-xs text-[#605e5c] mt-0.5">Try adjusting your property or category filter, or click '+ Add Support Agency'.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedAgencies.map((agency) => (
                    <tr key={agency.id} className="hover:bg-[#f3f8fd] transition-colors">
                      {visibleColumns.map(col => (
                        <td key={String(col.key)} className="p-2.5">
                          {renderColumnCell(col, agency)}
                        </td>
                      ))}
                      <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewDetailAgency(agency)}
                            className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs transition-colors"
                            title="View Agency Dossier"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEditRecord() && (
                            <button
                              onClick={() => setEditingAgency(agency)}
                              className="p-1 hover:bg-[#f0fdfa] text-[#0d9488] rounded-xs transition-colors"
                              title="Edit Agency Profile"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDeleteRecord() && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete ${agency.agencyName}?`)) {
                                  deleteVCSAgency(agency.id);
                                }
                              }}
                              className="p-1 hover:bg-[#fdf3f4] text-[#a4262c] rounded-xs transition-colors"
                              title="Delete Agency"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Matrix Grid View */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 overflow-y-auto max-h-[680px]">
            {filteredAgencies.map(agency => (
              <div 
                key={agency.id} 
                className="bg-[#faf9f8] border border-[#e1dfdd] hover:border-[#0d9488] rounded-xs p-3.5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xs bg-white border border-[#e1dfdd] text-[#605e5c]">
                      {agency.hotelName}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-xs border ${getCategoryBadgeColor(agency.category)}`}>
                      {agency.category || 'General'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#242424] group-hover:text-[#0d9488] transition-colors line-clamp-1 mb-1.5">
                    {agency.agencyName}
                  </h3>
                  <p className="text-xs text-[#605e5c] line-clamp-2 leading-relaxed mb-3">
                    {agency.servicesProvided || 'Community assistance, resident welfare and local advocacy.'}
                  </p>
                </div>
                <div className="pt-2 border-t border-[#edebe9] flex items-center justify-between text-xs">
                  <span className="text-[#8a8886] text-[11px]">{agency.contactPerson || 'Office Team'}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setViewDetailAgency(agency)}
                      className="px-2 py-1 text-xs text-[#0d9488] hover:bg-[#f0fdfa] rounded-xs font-semibold"
                    >
                      View Details
                    </button>
                    {canEditRecord() && (
                      <button
                        onClick={() => setEditingAgency(agency)}
                        className="p-1 hover:bg-[#f0fdfa] text-[#0d9488] rounded-xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Footer */}
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredAgencies.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>

      {/* Dynamic Create Modal */}
      <DynamicRecordFormModal<SDVCSAgency>
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Partner Agency"
        columns={columns}
        initialValues={{
          hotelName: !canAccessAllSites() ? assignedSite : (selectedProperty !== 'all' ? selectedProperty : (assignedSite || allowedSites[0])),
          agencyName: '',
          category: 'Charity & Welfare',
          servicesProvided: '',
          contactPerson: '',
          contactNumber: '',
          email: '',
          address: '',
          notes: ''
        }}
        onSubmit={handleCreateSubmit}
        submitLabel="Register Agency"
      />

      {/* Dynamic Edit Modal */}
      {editingAgency && (
        <DynamicRecordFormModal<SDVCSAgency>
          isOpen={Boolean(editingAgency)}
          onClose={() => setEditingAgency(null)}
          title={`Edit Agency - ${editingAgency.agencyName}`}
          columns={columns}
          initialValues={editingAgency}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Dynamic View Dossier Modal */}
      {viewDetailAgency && (
        <DynamicRecordViewModal<SDVCSAgency>
          isOpen={Boolean(viewDetailAgency)}
          onClose={() => setViewDetailAgency(null)}
          title={`Agency Dossier - ${viewDetailAgency.agencyName}`}
          columns={columns}
          record={viewDetailAgency}
          onEdit={() => {
            const rec = viewDetailAgency;
            setViewDetailAgency(null);
            setEditingAgency(rec);
          }}
          canEdit={canEditRecord()}
        />
      )}

      {/* Super Admin Table Schema Customizer Modal */}
      <TableSchemaEditorModal<SDVCSAgency>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="SD VCS Support Agencies"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
