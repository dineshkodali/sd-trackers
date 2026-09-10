import React, { useState, useMemo } from 'react';
import { 
  HeartHandshake, 
  Search, 
  Download, 
  Building2, 
  Layers, 
  Grid3X3, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Edit3, 
  Phone, 
  Mail, 
  MapPin, 
  CheckCircle2, 
  Utensils, 
  BookOpen, 
  Users, 
  Church, 
  ShieldAlert, 
  Landmark, 
  Heart,
  X,
  Eye
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SDVCSAgency } from '../../types';
import { SD_VCS_HOTEL_NAMES } from '../../data/initialData';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';

export const SDVCSDirectoryView: React.FC = () => {
  const {
    vcsAgencies,
    addVCSAgency,
    updateVCSAgency,
    deleteVCSAgency,
    resetVCSToDefault,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord
  } = useApp();

  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [gridMode, setGridMode] = useState<'table' | 'matrix'>('table');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<SDVCSAgency | null>(null);
  const [viewDetailAgency, setViewDetailAgency] = useState<SDVCSAgency | null>(null);

  const [formData, setFormData] = useState({
    hotelName: SD_VCS_HOTEL_NAMES[0],
    agencyName: '',
    category: 'Charity & Welfare' as SDVCSAgency['category'],
    servicesProvided: '',
    contactPerson: '',
    contactNumber: '',
    email: '',
    address: '',
    notes: ''
  });

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

  const paginatedAgencies = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAgencies.slice(startIndex, startIndex + pageSize);
  }, [filteredAgencies, currentPage, pageSize]);



  // Matrix calculation
  const matrixProperties = useMemo(() => {
    if (selectedProperty === 'all') return SD_VCS_HOTEL_NAMES;
    return [selectedProperty];
  }, [selectedProperty]);

  const groupedByHotel = useMemo(() => {
    const map: Record<string, SDVCSAgency[]> = {};
    matrixProperties.forEach(hotel => {
      map[hotel] = [];
    });
    filteredAgencies.forEach(a => {
      if (map[a.hotelName]) {
        map[a.hotelName].push(a);
      }
    });
    return map;
  }, [filteredAgencies, matrixProperties]);

  const maxAgenciesInHotel = useMemo(() => {
    let max = 0;
    Object.values(groupedByHotel).forEach(list => {
      if (list.length > max) max = list.length;
    });
    return Math.max(max, 5);
  }, [groupedByHotel]);

  const getCategoryBadgeColor = (category?: string) => {
    switch (category) {
      case 'Food & Nutrition':
        return 'bg-[#fffbeb] text-[#b45309] border-[#fde68a]';
      case 'Family & Children':
        return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'ESOL & Education':
        return 'bg-[#f3f8fd] text-[#0078d4] border-[#c7e0f4]';
      case 'Faith & Community':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Advocacy & Legal':
        return 'bg-[#f0fdfa] text-[#0f766e] border-[#99f6e4]';
      case 'Statutory / Council':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-[#f3f2f1] text-[#323130] border-[#e1dfdd]';
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'Food & Nutrition':
        return <Utensils className="w-3 h-3 text-[#b45309]" />;
      case 'Family & Children':
        return <Heart className="w-3 h-3 text-pink-600" />;
      case 'ESOL & Education':
        return <BookOpen className="w-3 h-3 text-[#0078d4]" />;
      case 'Faith & Community':
        return <Church className="w-3 h-3 text-purple-600" />;
      case 'Advocacy & Legal':
        return <ShieldAlert className="w-3 h-3 text-[#0d9488]" />;
      case 'Statutory / Council':
        return <Landmark className="w-3 h-3 text-emerald-600" />;
      default:
        return <Users className="w-3 h-3 text-[#605e5c]" />;
    }
  };

  const handleSaveAgency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agencyName.trim()) return;

    if (editingAgency) {
      updateVCSAgency(editingAgency.id, formData);
      setEditingAgency(null);
    } else {
      addVCSAgency(formData);
      setIsAddModalOpen(false);
    }

    setFormData({
      hotelName: selectedProperty !== 'all' ? selectedProperty : SD_VCS_HOTEL_NAMES[0],
      agencyName: '',
      category: 'Charity & Welfare',
      servicesProvided: '',
      contactPerson: '',
      contactNumber: '',
      email: '',
      address: '',
      notes: ''
    });
  };

  const handleOpenEdit = (agency: SDVCSAgency) => {
    setEditingAgency(agency);
    setFormData({
      hotelName: agency.hotelName,
      agencyName: agency.agencyName,
      category: agency.category || 'Charity & Welfare',
      servicesProvided: agency.servicesProvided || '',
      contactPerson: agency.contactPerson || '',
      contactNumber: agency.contactNumber || '',
      email: agency.email || '',
      address: agency.address || '',
      notes: agency.notes || ''
    });
  };

  const handleExportCsv = () => {
    exportTableToCsv({
      filename: `SD_VCS_Support_Agencies_${selectedProperty === 'all' ? 'All_Properties' : selectedProperty.replace(/\s+/g, '_')}.csv`,
      headers: [
        'Property / Hotel',
        'Support Agency',
        'Category',
        'Services Provided',
        'Contact Person',
        'Contact Number',
        'Email',
        'Address',
        'Notes'
      ],
      rows: filteredAgencies.map(a => [
        a.hotelName,
        a.agencyName,
        a.category || 'General Support',
        a.servicesProvided || '',
        a.contactPerson || '',
        a.contactNumber || '',
        a.email || '',
        a.address || '',
        a.notes || ''
      ])
    });
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
            Voluntary &amp; Community Sector (VCS) support directory, local food banks, charities, faith groups, and statutory assistance mapped across properties.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={resetVCSToDefault}
            title="Reset to verified master agencies"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#605e5c] bg-white border border-[#8a8886] rounded-xs hover:bg-[#edebe9] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#605e5c]" />
            <span>Reset Master</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#605e5c]" />
            <span>Export CSV</span>
          </button>

          {canCreateRecord() && (
            <button
              onClick={() => {
                setEditingAgency(null);
                setFormData({
                  hotelName: selectedProperty !== 'all' ? selectedProperty : SD_VCS_HOTEL_NAMES[0],
                  agencyName: '',
                  category: 'Charity & Welfare',
                  servicesProvided: '',
                  contactPerson: '',
                  contactNumber: '',
                  email: '',
                  address: '',
                  notes: ''
                });
                setIsAddModalOpen(true);
              }}
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

      {/* SINGLE COMBINED DATA CONTAINER (Unified with other pages) */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
        {gridMode === 'table' ? (
          /* Table Grid View */
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse min-w-[1250px]">
              <thead>
                <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                  <th className="p-2.5 text-center w-12">#</th>
                  <th className="p-2.5">Property / Hotel Site</th>
                  <th className="p-2.5">Support Agency Name</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">Services &amp; Resources Provided</th>
                  <th className="p-2.5">Key Contact</th>
                  <th className="p-2.5">Phone &amp; Email</th>
                  <th className="p-2.5 text-center">Status</th>
                  <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edebe9] text-[#323130]">
                {paginatedAgencies.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-[#605e5c]">
                      <HeartHandshake className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                      <p className="font-semibold text-sm text-[#242424]">No support agencies found</p>
                      <p className="text-xs text-[#605e5c] mt-0.5">Try adjusting your property or category filter, or click '+ Add Support Agency'.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedAgencies.map((agency, idx) => (
                    <tr key={agency.id} className="hover:bg-[#f3f8fd] transition-colors">
                      <td className="p-2.5 text-center font-mono font-medium text-[#605e5c]">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="p-2.5 font-semibold text-[#242424] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-[#f3f2f1] border border-[#e1dfdd] text-[11px]">
                          <Building2 className="w-3 h-3 text-[#0d9488]" />
                          {agency.hotelName}
                        </span>
                      </td>
                      <td className="p-2.5 font-bold text-[#242424]">
                        {agency.agencyName}
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-xs border ${getCategoryBadgeColor(agency.category)}`}>
                          {getCategoryIcon(agency.category)}
                          {agency.category || 'General'}
                        </span>
                      </td>
                      <td className="p-2.5 max-w-md text-[#323130] leading-relaxed" title={agency.servicesProvided}>
                        {agency.servicesProvided || 'Community, asylum assistance and resident welfare resources.'}
                      </td>
                      <td className="p-2.5 text-[#605e5c] whitespace-nowrap">
                        {agency.contactPerson ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#242424]">
                            <Users className="w-3 h-3 text-[#8a8886]" />
                            {agency.contactPerson}
                          </span>
                        ) : (
                          <span className="text-[#a19f9d]">—</span>
                        )}
                      </td>
                      <td className="p-2.5 whitespace-nowrap text-[11px]">
                        {agency.contactNumber && (
                          <div className="flex items-center gap-1 font-mono text-[#323130]">
                            <Phone className="w-3 h-3 text-[#8a8886]" />
                            <span>{agency.contactNumber}</span>
                          </div>
                        )}
                        {agency.email && (
                          <div className="flex items-center gap-1 text-[#0078d4]">
                            <Mail className="w-3 h-3 text-[#8a8886]" />
                            <a href={`mailto:${agency.email}`} className="hover:underline truncate max-w-[150px]">{agency.email}</a>
                          </div>
                        )}
                        {!agency.contactNumber && !agency.email && (
                          <span className="text-[#a19f9d]">—</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[10px] font-semibold bg-[#f0fdfa] text-[#0f766e] border border-[#99f6e4]">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </span>
                      </td>
                      <td className="p-2.5 text-right sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewDetailAgency(agency)}
                            title="View Details"
                            className="p-1 text-[#605e5c] hover:text-[#242424] hover:bg-[#edebe9] rounded-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEditRecord() && (
                            <button
                              onClick={() => handleOpenEdit(agency)}
                              title="Edit Agency"
                              className="p-1 text-[#605e5c] hover:text-[#0f766e] hover:bg-[#f0fdfa] rounded-xs"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDeleteRecord() && (
                            <button
                              onClick={() => deleteVCSAgency(agency.id)}
                              title="Remove Agency"
                              className="p-1 text-[#605e5c] hover:text-[#dc2626] hover:bg-[#fdf3f2] rounded-xs"
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
          <div className="overflow-x-auto flex-1 max-h-[650px] custom-scrollbar">
            <div className="p-3 bg-[#faf9f8] border-b border-[#edebe9] flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-[#242424] uppercase tracking-wider">
                  Cross-Property VCS Comparison Matrix
                </span>
                <span className="ml-2 text-[#605e5c]">
                  Showing {matrixProperties.length} {matrixProperties.length === 1 ? 'Property' : 'Properties'}
                </span>
              </div>
              <span className="text-[11px] text-[#605e5c]">
                Horizontal multi-property support columns
              </span>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#242424] text-white z-10">
                <tr>
                  <th className="p-2.5 w-12 text-center border-r border-neutral-700 text-[10px]">Row</th>
                  {matrixProperties.map(hotel => (
                    <th key={hotel} className="p-2.5 min-w-[220px] max-w-[260px] border-r border-neutral-700 font-bold whitespace-nowrap text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#99f6e4]" />
                        <span>{hotel}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edebe9] text-[#323130]">
                {Array.from({ length: maxAgenciesInHotel }).map((_, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-[#faf9f8]'}>
                    <td className="p-2.5 text-center font-mono text-[#605e5c] text-[10px] border-r border-[#edebe9]">
                      {rowIndex + 1}
                    </td>

                    {matrixProperties.map(hotel => {
                      const agency = (groupedByHotel[hotel] || [])[rowIndex];
                      return (
                        <td key={hotel} className="p-2.5 border-r border-[#edebe9] align-top">
                          {agency ? (
                            <div className="space-y-1.5 p-2 bg-white rounded-xs border border-[#e1dfdd] shadow-2xs hover:border-[#0d9488] transition-colors">
                              <div className="flex items-start justify-between gap-1">
                                <p className="font-semibold text-[#242424] text-xs leading-snug">
                                  {agency.agencyName}
                                </p>
                                <button
                                  onClick={() => setViewDetailAgency(agency)}
                                  title="View Details"
                                  className="text-[#605e5c] hover:text-[#0d9488]"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                              </div>

                              {agency.category && (
                                <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.2 rounded-xs border ${getCategoryBadgeColor(agency.category)}`}>
                                  {agency.category}
                                </span>
                              )}

                              {agency.servicesProvided && (
                                <p className="text-[10px] text-[#605e5c] line-clamp-2">
                                  {agency.servicesProvided}
                                </p>
                              )}

                              {agency.contactNumber && (
                                <p className="text-[10px] font-mono text-[#605e5c] flex items-center gap-1">
                                  <Phone className="w-2.5 h-2.5 text-[#8a8886]" />
                                  <span>{agency.contactNumber}</span>
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#a19f9d] text-[11px]">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Unified Bottom Pagination */}
        {gridMode === 'table' && filteredAgencies.length > 0 && (
          <div className="p-2.5 border-t border-[#edebe9] bg-[#faf9f8]">
            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={filteredAgencies.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
            />
          </div>
        )}
      </div>

      {/* Modal: Add / Edit Support Agency */}
      {(isAddModalOpen || editingAgency) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-xl w-full max-w-lg overflow-hidden border border-[#e1dfdd] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e1dfdd] bg-[#faf9f8]">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-sm font-semibold text-[#242424]">
                  {editingAgency ? 'Edit Support Agency' : 'Add Support Agency to Property'}
                </h3>
              </div>
              <button
                onClick={() => { setIsAddModalOpen(false); setEditingAgency(null); }}
                className="text-[#605e5c] hover:text-[#242424]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAgency} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#605e5c] mb-1">Property Cluster *</label>
                  <select
                    value={formData.hotelName}
                    onChange={e => setFormData({ ...formData, hotelName: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  >
                    {SD_VCS_HOTEL_NAMES.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#605e5c] mb-1">Support Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  >
                    <option value="Charity & Welfare">Charity &amp; Welfare</option>
                    <option value="Food & Nutrition">Food &amp; Nutrition</option>
                    <option value="Family & Children">Family &amp; Children</option>
                    <option value="ESOL & Education">ESOL &amp; Education</option>
                    <option value="Faith & Community">Faith &amp; Community</option>
                    <option value="Advocacy & Legal">Advocacy &amp; Legal</option>
                    <option value="Statutory / Council">Statutory / Council</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#605e5c] mb-1">Organization / Charity Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Care4Calais, Happy Baby Community, Local Food Bank..."
                  value={formData.agencyName}
                  onChange={e => setFormData({ ...formData, agencyName: e.target.value })}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#605e5c] mb-1">Services &amp; Resources Provided</label>
                <textarea
                  rows={2}
                  placeholder="Hot meals, clothing packages, baby formula, legal casework, ESOL lessons, recreation..."
                  value={formData.servicesProvided}
                  onChange={e => setFormData({ ...formData, servicesProvided: e.target.value })}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#605e5c] mb-1">Key Contact Person</label>
                  <input
                    type="text"
                    placeholder="Coordinator name"
                    value={formData.contactPerson}
                    onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#605e5c] mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+44 20 ..."
                    value={formData.contactNumber}
                    onChange={e => setFormData({ ...formData, contactNumber: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#605e5c] mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="coordinator@charity.org.uk"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#e1dfdd]">
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setEditingAgency(null); }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#323130] bg-white border border-[#8a8886] rounded-xs hover:bg-[#edebe9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] rounded-xs shadow-xs"
                >
                  {editingAgency ? 'Update Agency' : 'Add Agency'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Details Dossier */}
      {viewDetailAgency && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-xl w-full max-w-md overflow-hidden border border-[#e1dfdd] my-8">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e1dfdd] bg-[#faf9f8]">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-sm font-semibold text-[#242424]">
                  Partner Dossier: {viewDetailAgency.agencyName}
                </h3>
              </div>
              <button
                onClick={() => setViewDetailAgency(null)}
                className="text-[#605e5c] hover:text-[#242424]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-[#323130]">
              <div className="bg-[#faf9f8] p-3 rounded-xs border border-[#e1dfdd] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#605e5c] font-semibold">Assigned Property:</span>
                  <span className="font-semibold text-[#242424] inline-flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-[#0d9488]" />
                    {viewDetailAgency.hotelName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#605e5c] font-semibold">Category:</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.2 rounded-xs border ${getCategoryBadgeColor(viewDetailAgency.category)}`}>
                    {getCategoryIcon(viewDetailAgency.category)}
                    {viewDetailAgency.category}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[#605e5c] font-semibold">Services &amp; Resources Provided:</span>
                <p className="mt-1 p-2.5 bg-[#f3f8fd] border border-[#c7e0f4] rounded-xs text-[#242424] leading-relaxed">
                  {viewDetailAgency.servicesProvided || 'Direct community assistance, essentials, meals, or advice for hotel service users.'}
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                {viewDetailAgency.contactPerson && (
                  <div className="flex items-center justify-between py-1 border-b border-[#edebe9]">
                    <span className="text-[#605e5c]">Key Contact:</span>
                    <span className="font-semibold text-[#242424]">{viewDetailAgency.contactPerson}</span>
                  </div>
                )}
                {viewDetailAgency.contactNumber && (
                  <div className="flex items-center justify-between py-1 border-b border-[#edebe9]">
                    <span className="text-[#605e5c]">Phone Number:</span>
                    <a href={`tel:${viewDetailAgency.contactNumber}`} className="font-mono text-[#0d9488] hover:underline">
                      {viewDetailAgency.contactNumber}
                    </a>
                  </div>
                )}
                {viewDetailAgency.email && (
                  <div className="flex items-center justify-between py-1 border-b border-[#edebe9]">
                    <span className="text-[#605e5c]">Email:</span>
                    <a href={`mailto:${viewDetailAgency.email}`} className="text-[#0078d4] hover:underline">
                      {viewDetailAgency.email}
                    </a>
                  </div>
                )}
                {viewDetailAgency.address && (
                  <div className="flex items-start justify-between py-1">
                    <span className="text-[#605e5c]">Address:</span>
                    <span className="text-right text-[#242424] max-w-[200px]">{viewDetailAgency.address}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-[#e1dfdd]">
                <button
                  onClick={() => setViewDetailAgency(null)}
                  className="px-3.5 py-1.5 bg-[#f3f2f1] hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
