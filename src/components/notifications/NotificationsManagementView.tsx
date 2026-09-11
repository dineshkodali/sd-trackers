import React, { useState, useMemo, useEffect } from 'react';
import { 
  BellRing, 
  Mail, 
  Send, 
  RefreshCw, 
  SlidersHorizontal, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldAlert, 
  Search, 
  RotateCcw, 
  Server, 
  Settings, 
  ExternalLink,
  ChevronRight,
  Info,
  Clock,
  Edit3,
  Flame,
  Shield,
  Wrench,
  Bus,
  HeartPulse,
  Building2,
  FileCheck2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { 
  NotificationRule, 
  NotificationModule, 
  NotificationSeverityThreshold, 
  RoleType, 
  EmailNotificationLog 
} from '../../types';
import { emailNotificationService } from '../../services/emailNotificationService';

const MODULE_ICONS: Record<NotificationModule, React.ReactNode> = {
  'Safeguarding': <Shield className="w-4 h-4 text-emerald-600" />,
  'Compliance': <FileCheck2 className="w-4 h-4 text-blue-600" />,
  'Maintenance': <Wrench className="w-4 h-4 text-amber-600" />,
  'Transport': <Bus className="w-4 h-4 text-indigo-600" />,
  'Health & Welfare': <HeartPulse className="w-4 h-4 text-rose-600" />,
  'Operations': <Building2 className="w-4 h-4 text-cyan-600" />,
  'Governance': <Settings className="w-4 h-4 text-purple-600" />
};

const MODULE_COLORS: Record<NotificationModule, { bg: string; text: string; border: string }> = {
  'Safeguarding': { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  'Compliance': { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  'Maintenance': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  'Transport': { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  'Health & Welfare': { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
  'Operations': { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' },
  'Governance': { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' }
};

const AVAILABLE_ROLES: RoleType[] = ['Super Admin', 'Admin', 'Regional Manager', 'Site Manager', 'Staff'];

export const NotificationsManagementView: React.FC = () => {
  const { 
    notificationRules, 
    emailNotificationLogs, 
    updateNotificationRule, 
    toggleNotificationRule, 
    resetNotificationRules, 
    refreshNotificationData 
  } = useApp();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'rules' | 'logs' | 'smtp'>('rules');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  // Edit Modal State
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<NotificationRule>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Test Dispatch Modal & Notification Toast
  const [testModalRule, setTestModalRule] = useState<NotificationRule | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // SMTP Diagnostics State
  const [smtpStatus, setSmtpStatus] = useState<{
    configured: boolean;
    host: string | null;
    port: string | number;
    from: string | null;
    user: string | null;
  } | null>(null);
  const [isLoadingSmtp, setIsLoadingSmtp] = useState(false);
  const [smtpTestRecipient, setSmtpTestRecipient] = useState('');
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Log inspect modal
  const [inspectingLog, setInspectingLog] = useState<EmailNotificationLog | null>(null);

  // Load SMTP Status
  useEffect(() => {
    loadSmtpStatus();
  }, []);

  const loadSmtpStatus = async () => {
    setIsLoadingSmtp(true);
    try {
      const status = await emailNotificationService.getStatus();
      setSmtpStatus(status);
      if (status.user) {
        setSmtpTestRecipient(status.user);
        setTestEmailAddress(status.user);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingSmtp(false);
    }
  };

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return notificationRules.filter(rule => {
      if (selectedModule !== 'all' && rule.module !== selectedModule) return false;
      if (selectedStatus === 'enabled' && !rule.enabled) return false;
      if (selectedStatus === 'disabled' && rule.enabled) return false;
      if (selectedSeverity !== 'all' && rule.minSeverity !== selectedSeverity) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = rule.title.toLowerCase().includes(query);
        const matchesCode = rule.eventCode.toLowerCase().includes(query);
        const matchesDesc = rule.description.toLowerCase().includes(query);
        const matchesSubject = rule.subjectTemplate.toLowerCase().includes(query);
        if (!matchesTitle && !matchesCode && !matchesDesc && !matchesSubject) return false;
      }

      return true;
    });
  }, [notificationRules, selectedModule, selectedStatus, selectedSeverity, searchQuery]);

  // Counts
  const totalRulesCount = notificationRules.length;
  const activeRulesCount = notificationRules.filter(r => r.enabled).length;
  const totalLogsCount = emailNotificationLogs.length;

  // Open Edit Modal
  const handleOpenEdit = (rule: NotificationRule) => {
    setEditingRule(rule);
    setEditFormData({
      enabled: rule.enabled,
      minSeverity: rule.minSeverity,
      recipientRoles: [...rule.recipientRoles],
      customRecipients: [...rule.customRecipients],
      customCc: [...rule.customCc],
      subjectTemplate: rule.subjectTemplate,
      includeMetadata: rule.includeMetadata
    });
  };

  // Save Edit Modal
  const handleSaveEdit = async () => {
    if (!editingRule) return;
    setIsSaving(true);
    try {
      await updateNotificationRule(editingRule.id, editFormData);
      setEditingRule(null);
    } catch (err: any) {
      alert('Failed to save notification rule: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Execute Quick Test Dispatch
  const handleExecuteTestRule = async () => {
    if (!testModalRule || !testEmailAddress) return;
    setIsTesting(true);
    setTestFeedback(null);
    try {
      const res = await emailNotificationService.testRule(testModalRule.id, testEmailAddress);
      if (res.success) {
        setTestFeedback({
          type: 'success',
          message: res.message || 'Test email dispatched successfully.'
        });
        refreshNotificationData();
      } else {
        setTestFeedback({
          type: 'error',
          message: res.error || 'Failed to dispatch test email.'
        });
      }
    } catch (err: any) {
      setTestFeedback({
        type: 'error',
        message: err.message || 'Error occurred while testing.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Execute SMTP Diagnostics Test
  const handleRunSmtpTest = async () => {
    if (!smtpTestRecipient) return;
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const result = await emailNotificationService.testConnection(smtpTestRecipient);
      setSmtpTestResult(result);
    } catch (err: any) {
      setSmtpTestResult({ success: false, message: err.message });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* 1. Header Section with Fluent UI styling */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xs bg-[#f0fdfa] border border-[#ccfbf1] flex items-center justify-center text-[#0d9488]">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#242424] tracking-tight">Email Notifications Management</h1>
                <span className="bg-[#f0fdfa] text-[#0f766e] text-xs font-semibold px-2 py-0.5 rounded-xs border border-[#ccfbf1]">
                  {activeRulesCount} of {totalRulesCount} Active
                </span>
                {smtpStatus?.configured ? (
                  <span className="bg-emerald-50 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-xs border border-emerald-300 flex items-center gap-1 shadow-xs">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Production SMTP Live
                  </span>
                ) : (
                  <span className="bg-rose-50 text-rose-800 text-[11px] font-medium px-2 py-0.5 rounded-xs border border-rose-200 flex items-center gap-1">
                    <Info className="w-3 h-3 text-rose-600" />
                    Production SMTP Offline
                  </span>
                )}
              </div>
              <p className="text-xs text-[#605e5c] mt-0.5">
                Configure automated email dispatches, target distribution roles, custom recipients, and alert thresholds across all operational modules.
              </p>
            </div>
          </div>
        </div>

        {/* Global Header Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => refreshNotificationData()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#323130] bg-[#faf9f8] hover:bg-[#f3f2f1] border border-[#d2d0ce] rounded-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to reset all notification rules to system factory defaults?')) {
                resetNotificationRules();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xs transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('smtp');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0d9488] hover:bg-[#0f766e] rounded-xs shadow-xs transition-colors"
          >
            <Server className="w-3.5 h-3.5" />
            <span>SMTP Server Status</span>
          </button>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex border-b border-[#e1dfdd] bg-white px-3 rounded-xs shadow-xs">
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'rules'
              ? 'border-[#0d9488] text-[#0d9488]'
              : 'border-transparent text-[#605e5c] hover:text-[#242424]'
          }`}
        >
          <BellRing className="w-4 h-4" />
          <span>Notification Rules</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-xs font-bold ${
            activeTab === 'rules' ? 'bg-[#0d9488] text-white' : 'bg-[#edebe9] text-[#323130]'
          }`}>
            {totalRulesCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'logs'
              ? 'border-[#0d9488] text-[#0d9488]'
              : 'border-transparent text-[#605e5c] hover:text-[#242424]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Delivery Audit Logs</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-xs font-bold ${
            activeTab === 'logs' ? 'bg-[#0d9488] text-white' : 'bg-[#edebe9] text-[#323130]'
          }`}>
            {totalLogsCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('smtp')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'smtp'
              ? 'border-[#0d9488] text-[#0d9488]'
              : 'border-transparent text-[#605e5c] hover:text-[#242424]'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>SMTP Configuration &amp; Diagnostics</span>
          {smtpStatus?.configured ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          )}
        </button>
      </div>

      {/* 3. TAB 1: NOTIFICATION RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="bg-white border border-[#e1dfdd] rounded-xs p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 w-full md:w-auto flex-1 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a8886]" />
                <input
                  type="text"
                  placeholder="Filter rules by title, code, keyword..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#faf9f8] border border-[#d2d0ce] rounded-xs focus:bg-white focus:outline-hidden focus:border-[#0d9488]"
                />
              </div>

              {/* Module Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[#605e5c] font-medium shrink-0">Module:</span>
                <select
                  value={selectedModule}
                  onChange={e => setSelectedModule(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-[#faf9f8] border border-[#d2d0ce] rounded-xs focus:bg-white focus:border-[#0d9488]"
                >
                  <option value="all">All Modules ({totalRulesCount})</option>
                  <option value="Safeguarding">Safeguarding</option>
                  <option value="Compliance">Compliance &amp; Safety</option>
                  <option value="Maintenance">Maintenance &amp; Repairs</option>
                  <option value="Transport">Public Transport</option>
                  <option value="Health & Welfare">Health &amp; Welfare</option>
                  <option value="Operations">Operations &amp; Dispersal</option>
                  <option value="Governance">Governance &amp; Security</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[#605e5c] font-medium shrink-0">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs bg-[#faf9f8] border border-[#d2d0ce] rounded-xs focus:bg-white focus:border-[#0d9488]"
                >
                  <option value="all">All Status</option>
                  <option value="enabled">Enabled Only ({activeRulesCount})</option>
                  <option value="disabled">Disabled Only ({totalRulesCount - activeRulesCount})</option>
                </select>
              </div>

              {/* Severity Threshold Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[#605e5c] font-medium shrink-0">Severity:</span>
                <select
                  value={selectedSeverity}
                  onChange={e => setSelectedSeverity(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-[#faf9f8] border border-[#d2d0ce] rounded-xs focus:bg-white focus:border-[#0d9488]"
                >
                  <option value="all">All Thresholds</option>
                  <option value="Critical">Critical Only</option>
                  <option value="High">High &amp; Above</option>
                  <option value="Medium">Medium &amp; Above</option>
                  <option value="Low">Low &amp; Above</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-[#605e5c] font-medium shrink-0">
              Showing <span className="font-bold text-[#242424]">{filteredRules.length}</span> of {totalRulesCount} rules
            </div>
          </div>

          {/* Rules Table */}
          <div className="bg-white border border-[#e1dfdd] rounded-xs overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold">
                    <th className="py-2.5 px-3.5 w-14 text-center">Status</th>
                    <th className="py-2.5 px-3.5">Module &amp; Event Trigger</th>
                    <th className="py-2.5 px-3.5">Min Severity</th>
                    <th className="py-2.5 px-3.5">Target Audience &amp; Roles</th>
                    <th className="py-2.5 px-3.5">Dispatches</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edebe9]">
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#8a8886]">
                        No notification rules match your search and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRules.map(rule => {
                      const modStyle = MODULE_COLORS[rule.module] || { bg: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-200' };
                      return (
                        <tr key={rule.id} className="hover:bg-[#fbfbfa] transition-colors group">
                          {/* Toggle Column */}
                          <td className="py-3 px-3.5 text-center">
                            <button
                              onClick={() => toggleNotificationRule(rule.id)}
                              title={rule.enabled ? 'Rule is Enabled (Click to disable)' : 'Rule is Disabled (Click to enable)'}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                                rule.enabled ? 'bg-[#0d9488]' : 'bg-[#d2d0ce]'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  rule.enabled ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>

                          {/* Module & Event */}
                          <td className="py-3 px-3.5">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-xs border ${modStyle.bg} ${modStyle.text} ${modStyle.border}`}>
                                  {MODULE_ICONS[rule.module]}
                                  {rule.module}
                                </span>
                                <span className="font-semibold text-[#242424] text-xs group-hover:text-[#0d9488] transition-colors">
                                  {rule.title}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#605e5c] max-w-xl line-clamp-1">
                                {rule.description}
                              </p>
                              <div className="flex items-center gap-2 pt-0.5">
                                <span className="font-mono text-[10px] text-[#8a8886] bg-[#f3f2f1] px-1.5 py-0.2 rounded-xs">
                                  {rule.eventCode}
                                </span>
                                <span className="text-[11px] text-[#605e5c] truncate max-w-md">
                                  Subject: <span className="font-medium text-[#323130]">{rule.subjectTemplate}</span>
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Severity */}
                          <td className="py-3 px-3.5">
                            <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-xs ${
                              rule.minSeverity === 'Critical' ? 'bg-red-100 text-red-800' :
                              rule.minSeverity === 'High' ? 'bg-amber-100 text-amber-800' :
                              rule.minSeverity === 'Medium' ? 'bg-blue-100 text-blue-800' :
                              rule.minSeverity === 'Low' ? 'bg-teal-100 text-teal-800' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {rule.minSeverity}
                            </span>
                          </td>

                          {/* Recipients */}
                          <td className="py-3 px-3.5">
                            <div className="space-y-1 max-w-xs">
                              <div className="flex flex-wrap gap-1">
                                {rule.recipientRoles.map(role => (
                                  <span key={role} className="text-[10px] bg-[#f3f2f1] text-[#323130] font-medium px-1.5 py-0.2 rounded-xs border border-[#e1dfdd]">
                                    {role}
                                  </span>
                                ))}
                              </div>
                              {rule.customRecipients && rule.customRecipients.length > 0 && (
                                <div className="text-[10px] text-[#0d9488] font-medium">
                                  +{rule.customRecipients.length} custom email{rule.customRecipients.length > 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Dispatches */}
                          <td className="py-3 px-3.5 text-[#605e5c]">
                            <div className="space-y-0.5">
                              <div className="text-xs font-semibold text-[#242424]">
                                {rule.dispatchCount || 0} sent
                              </div>
                              <div className="text-[10px] text-[#8a8886]">
                                {rule.lastDispatchedAt ? new Date(rule.lastDispatchedAt).toLocaleDateString('en-GB') : 'Never'}
                              </div>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3.5 text-right space-x-1.5">
                            <button
                              onClick={() => {
                                setTestModalRule(rule);
                                setTestFeedback(null);
                              }}
                              className="px-2.5 py-1 text-xs text-[#0d9488] hover:bg-[#f0fdfa] border border-[#ccfbf1] rounded-xs transition-colors inline-flex items-center gap-1 font-medium"
                              title="Send test email for this event"
                            >
                              <Send className="w-3 h-3" />
                              <span>Test</span>
                            </button>

                            <button
                              onClick={() => handleOpenEdit(rule)}
                              className="px-2.5 py-1 text-xs text-[#323130] hover:bg-[#f3f2f1] border border-[#d2d0ce] rounded-xs transition-colors inline-flex items-center gap-1 font-medium"
                            >
                              <Edit3 className="w-3 h-3 text-[#605e5c]" />
                              <span>Configure</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 2: DELIVERY AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#e1dfdd] rounded-xs p-3 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#605e5c]">Recorded Dispatches:</span>
              <span className="text-xs font-bold text-[#242424]">{totalLogsCount} total</span>
            </div>
            <button
              onClick={() => refreshNotificationData()}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#323130] bg-[#faf9f8] hover:bg-[#f3f2f1] border border-[#d2d0ce] rounded-xs"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh Log</span>
            </button>
          </div>

          <div className="bg-white border border-[#e1dfdd] rounded-xs overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold">
                    <th className="py-2.5 px-3.5">Timestamp</th>
                    <th className="py-2.5 px-3.5">Status</th>
                    <th className="py-2.5 px-3.5">Module &amp; Event</th>
                    <th className="py-2.5 px-3.5">Subject</th>
                    <th className="py-2.5 px-3.5">Recipients</th>
                    <th className="py-2.5 px-3.5">Site / Ref</th>
                    <th className="py-2.5 px-3.5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edebe9]">
                  {emailNotificationLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#8a8886]">
                        <Mail className="w-8 h-8 mx-auto text-[#c8c6c4] mb-2" />
                        <p className="font-semibold text-xs text-[#323130]">No email dispatches recorded yet</p>
                        <p className="text-[11px] text-[#8a8886]">Dispatched notifications will appear here automatically with delivery receipts.</p>
                      </td>
                    </tr>
                  ) : (
                    emailNotificationLogs.map(log => (
                      <tr key={log.id} className="hover:bg-[#fbfbfa] transition-colors">
                        <td className="py-2.5 px-3.5 font-mono text-[11px] text-[#605e5c] whitespace-nowrap">
                          {new Date(log.dispatchedAt).toLocaleString('en-GB')}
                        </td>
                        <td className="py-2.5 px-3.5">
                          {log.status === 'delivered' ? (
                            <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-xs border border-emerald-200 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Delivered
                            </span>
                          ) : log.status === 'simulated' ? (
                            <span className="bg-slate-50 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-xs border border-slate-200 inline-flex items-center gap-1">
                              <Info className="w-3 h-3 text-slate-500" />
                              Recorded
                            </span>
                          ) : (
                            <span className="bg-rose-50 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-xs border border-rose-200 inline-flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="font-semibold text-[#242424] text-[11px]">{log.module}</div>
                          <div className="font-mono text-[10px] text-[#8a8886]">{log.eventCode}</div>
                        </td>
                        <td className="py-2.5 px-3.5 max-w-sm">
                          <div className="font-medium text-[#242424] truncate" title={log.subject}>
                            {log.subject}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="text-[11px] text-[#605e5c] max-w-xs truncate" title={log.recipients.join(', ')}>
                            {log.recipients.join(', ')}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-[#605e5c]">
                          <div>{log.site || 'All Sites'}</div>
                          {log.entityId && <div className="font-mono text-[10px] text-[#8a8886]">{log.entityId}</div>}
                        </td>
                        <td className="py-2.5 px-3.5 text-right">
                          <button
                            onClick={() => setInspectingLog(log)}
                            className="px-2 py-0.5 text-xs text-[#0d9488] hover:underline"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 3: SMTP CONFIGURATION & DIAGNOSTICS */}
      {activeTab === 'smtp' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Server Config Status */}
          <div className="bg-white border border-[#e1dfdd] rounded-xs p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#edebe9] pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#0d9488]" />
                <h3 className="font-bold text-sm text-[#242424]">SMTP Mail Transport Status</h3>
              </div>
              <button
                onClick={loadSmtpStatus}
                className="text-xs text-[#0d9488] hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#f3f2f1]">
                <span className="text-[#605e5c] font-medium">Connection State:</span>
                {smtpStatus?.configured ? (
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Production Relay Active
                  </span>
                ) : (
                  <span className="font-bold text-rose-700 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> Offline (Credentials Required in root .env)
                  </span>
                )}
              </div>

              <div className="flex justify-between py-1.5 border-b border-[#f3f2f1]">
                <span className="text-[#605e5c] font-medium">Operating Mode:</span>
                <span className="font-bold text-[#0f766e] bg-[#f0fdfa] px-2 py-0.5 rounded-xs border border-[#ccfbf1]">
                  Strict Production Mode
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-[#f3f2f1]">
                <span className="text-[#605e5c] font-medium">SMTP Server Host:</span>
                <span className="font-mono text-[#242424] font-semibold">{smtpStatus?.host || 'smtp.gmail.com'}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-[#f3f2f1]">
                <span className="text-[#605e5c] font-medium">SMTP Port:</span>
                <span className="font-mono text-[#242424] font-semibold">{smtpStatus?.port || '587'} (STARTTLS)</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-[#f3f2f1]">
                <span className="text-[#605e5c] font-medium">Sender Email Address (From):</span>
                <span className="font-mono text-[#242424] font-semibold">{smtpStatus?.from || 'SD Trackers <dineshkodali16@gmail.com>'}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-[#f3f2f1]">
                <span className="text-[#605e5c] font-medium">Authenticated Account:</span>
                <span className="font-mono text-[#242424] font-semibold">{smtpStatus?.user || 'dineshkodali16@gmail.com'}</span>
              </div>
            </div>

            <div className="bg-[#f0fdf4] border border-[#bbf7d0] p-3 rounded-xs text-xs text-[#166534] space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-[#15803d]">
                <Mail className="w-3.5 h-3.5 text-[#16a34a]" />
                Production Mail Relay Active
              </div>
              <p className="text-[11px] leading-relaxed text-[#14532d]">
                Operating in <strong>Production Mode</strong> using server credentials configured in the root <code>.env</code> file. System triggers, urgent alerts, and escalation notices are dispatched directly to designated operational staff via secure TLS transmission.
              </p>
            </div>
          </div>

          {/* Card 2: Live Connection Verification */}
          <div className="bg-white border border-[#e1dfdd] rounded-xs p-5 shadow-xs space-y-4">
            <div className="border-b border-[#edebe9] pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-[#0d9488]" />
                <h3 className="font-bold text-sm text-[#242424]">Verify Live Dispatch Connection</h3>
              </div>
              <p className="text-[11px] text-[#605e5c] mt-0.5">
                Send a real-time probe notification to verify that the server connects to the mail relay.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#323130] mb-1">
                  Recipient Test Email:
                </label>
                <input
                  type="email"
                  value={smtpTestRecipient}
                  onChange={e => setSmtpTestRecipient(e.target.value)}
                  placeholder="name@sdcommercial.co.uk"
                  className="w-full px-3 py-2 text-xs border border-[#d2d0ce] rounded-xs focus:border-[#0d9488] focus:outline-hidden"
                />
              </div>

              <button
                onClick={handleRunSmtpTest}
                disabled={isTestingSmtp || !smtpTestRecipient}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold text-white bg-[#0d9488] hover:bg-[#0f766e] disabled:opacity-50 rounded-xs shadow-xs transition-colors"
              >
                {isTestingSmtp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Testing SMTP Server Connection...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Verification Probe Email</span>
                  </>
                )}
              </button>

              {smtpTestResult && (
                <div className={`p-3 rounded-xs text-xs border ${
                  smtpTestResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div className="font-bold mb-0.5 flex items-center gap-1.5">
                    {smtpTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                    {smtpTestResult.success ? 'Verification Succeeded' : 'Verification Failed'}
                  </div>
                  <p className="text-[11px]">{smtpTestResult.message}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: EDIT NOTIFICATION RULE CONFIGURATION */}
      {editingRule && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-[#faf9f8] border-b border-[#edebe9] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-xs bg-[#0d9488]/10 text-[#0d9488]">
                    {editingRule.module}
                  </span>
                  <h3 className="font-bold text-base text-[#242424]">
                    Configure Notification: {editingRule.title}
                  </h3>
                </div>
                <p className="text-xs text-[#605e5c] mt-0.5">
                  Event Code: <span className="font-mono">{editingRule.eventCode}</span>
                </p>
              </div>
              <button
                onClick={() => setEditingRule(null)}
                className="text-[#605e5c] hover:text-[#242424] text-lg font-bold p-1"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Enabled Switch */}
              <div className="flex items-center justify-between p-3 bg-[#faf9f8] border border-[#edebe9] rounded-xs">
                <div>
                  <div className="font-bold text-[#242424]">Rule Active Status</div>
                  <div className="text-[11px] text-[#605e5c]">When disabled, system actions matching this event will skip email delivery.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditFormData(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    editFormData.enabled ? 'bg-[#0d9488]' : 'bg-[#d2d0ce]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      editFormData.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Minimum Severity Threshold */}
              <div>
                <label className="block font-semibold text-[#323130] mb-1">
                  Minimum Severity / Risk Threshold:
                </label>
                <select
                  value={editFormData.minSeverity}
                  onChange={e => setEditFormData(prev => ({ ...prev, minSeverity: e.target.value as NotificationSeverityThreshold }))}
                  className="w-full px-3 py-2 border border-[#d2d0ce] rounded-xs bg-[#faf9f8] focus:bg-white focus:border-[#0d9488]"
                >
                  <option value="All">All Severity Levels (Log and send for every event)</option>
                  <option value="Low">Low &amp; Above</option>
                  <option value="Medium">Medium &amp; Above</option>
                  <option value="High">High &amp; Above (Recommended for Alerts)</option>
                  <option value="Critical">Critical Only (Highest Priority Emergencies)</option>
                </select>
              </div>

              {/* Target Recipient Roles */}
              <div>
                <label className="block font-semibold text-[#323130] mb-1.5">
                  Target Audience Roles (Delivered to all active staff in these roles):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#faf9f8] border border-[#edebe9] p-3 rounded-xs">
                  {AVAILABLE_ROLES.map(role => {
                    const isChecked = (editFormData.recipientRoles || []).includes(role);
                    return (
                      <label key={role} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const current = editFormData.recipientRoles || [];
                            if (e.target.checked) {
                              setEditFormData(prev => ({ ...prev, recipientRoles: [...current, role] }));
                            } else {
                              setEditFormData(prev => ({ ...prev, recipientRoles: current.filter(r => r !== role) }));
                            }
                          }}
                          className="rounded-xs text-[#0d9488] focus:ring-[#0d9488]"
                        />
                        <span className="text-xs text-[#323130]">{role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Custom Recipients List */}
              <div>
                <label className="block font-semibold text-[#323130] mb-1">
                  Additional Email Recipients (Comma-separated):
                </label>
                <input
                  type="text"
                  placeholder="manager@domain.com, safety-officer@domain.com"
                  value={(editFormData.customRecipients || []).join(', ')}
                  onChange={e => {
                    const emails = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    setEditFormData(prev => ({ ...prev, customRecipients: emails }));
                  }}
                  className="w-full px-3 py-2 border border-[#d2d0ce] rounded-xs focus:border-[#0d9488] focus:outline-hidden"
                />
              </div>

              {/* Subject Template */}
              <div>
                <label className="block font-semibold text-[#323130] mb-1">
                  Subject Line Template:
                </label>
                <input
                  type="text"
                  value={editFormData.subjectTemplate || ''}
                  onChange={e => setEditFormData(prev => ({ ...prev, subjectTemplate: e.target.value }))}
                  className="w-full px-3 py-2 font-mono text-xs border border-[#d2d0ce] rounded-xs focus:border-[#0d9488] focus:outline-hidden"
                />
                <div className="text-[11px] text-[#605e5c] mt-1">
                  Available tokens: <code className="bg-[#f3f2f1] px-1 py-0.5 rounded-xs">{'{{suName}}'}</code>, <code className="bg-[#f3f2f1] px-1 py-0.5 rounded-xs">{'{{site}}'}</code>, <code className="bg-[#f3f2f1] px-1 py-0.5 rounded-xs">{'{{roomNo}}'}</code>, <code className="bg-[#f3f2f1] px-1 py-0.5 rounded-xs">{'{{urgency}}'}</code>, <code className="bg-[#f3f2f1] px-1 py-0.5 rounded-xs">{'{{priority}}'}</code>, <code className="bg-[#f3f2f1] px-1 py-0.5 rounded-xs">{'{{defectType}}'}</code>, <code className="bg-[#f3f2f1] px-1 py-0.5 rounded-xs">{'{{complianceType}}'}</code>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#faf9f8] border-t border-[#edebe9] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="px-4 py-2 text-xs font-semibold text-[#323130] hover:bg-[#edebe9] border border-[#d2d0ce] rounded-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] disabled:opacity-50 rounded-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Save Notification Rule</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: TEST TRIGGER DISPATCH */}
      {testModalRule && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-[#faf9f8] border-b border-[#edebe9] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-[#0d9488]" />
                <h3 className="font-bold text-sm text-[#242424]">
                  Test Notification Trigger
                </h3>
              </div>
              <button onClick={() => setTestModalRule(null)} className="text-[#605e5c] text-lg font-bold p-1">
                &times;
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-[#323130]">
                Dispatches a formatted sample message for <strong>"{testModalRule.title}"</strong> to verify formatting, tokens, and delivery.
              </p>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">
                  Deliver Test To Email:
                </label>
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={e => setTestEmailAddress(e.target.value)}
                  placeholder="your.email@sdcommercial.co.uk"
                  className="w-full px-3 py-2 text-xs border border-[#d2d0ce] rounded-xs focus:border-[#0d9488] focus:outline-hidden"
                />
              </div>

              {testFeedback && (
                <div className={`p-3 rounded-xs border ${
                  testFeedback.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <p className="font-semibold">{testFeedback.message}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-[#faf9f8] border-t border-[#edebe9] flex items-center justify-end gap-2">
              <button
                onClick={() => setTestModalRule(null)}
                className="px-3 py-1.5 text-xs text-[#323130] hover:bg-[#edebe9] border border-[#d2d0ce] rounded-xs"
              >
                Close
              </button>
              <button
                onClick={handleExecuteTestRule}
                disabled={isTesting || !testEmailAddress}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#0d9488] hover:bg-[#0f766e] disabled:opacity-50 rounded-xs shadow-xs flex items-center gap-1.5"
              >
                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send Test Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: LOG INSPECT */}
      {inspectingLog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-[#faf9f8] border-b border-[#edebe9] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#242424]">Email Dispatch Receipt</h3>
              <button onClick={() => setInspectingLog(null)} className="text-[#605e5c] text-lg font-bold p-1">
                &times;
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs overflow-y-auto max-h-[70vh]">
              <div className="space-y-1">
                <span className="text-[#8a8886] font-semibold">Subject Line:</span>
                <div className="p-2 bg-[#faf9f8] border border-[#edebe9] rounded-xs font-semibold text-[#242424]">
                  {inspectingLog.subject}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[#8a8886] font-semibold">Module:</span>
                  <div className="text-[#242424] font-medium">{inspectingLog.module}</div>
                </div>
                <div>
                  <span className="text-[#8a8886] font-semibold">Event:</span>
                  <div className="font-mono text-[#242424]">{inspectingLog.eventCode}</div>
                </div>
                <div>
                  <span className="text-[#8a8886] font-semibold">Status:</span>
                  <div className="font-bold text-[#0d9488] capitalize">{inspectingLog.status}</div>
                </div>
                <div>
                  <span className="text-[#8a8886] font-semibold">Dispatched:</span>
                  <div className="text-[#242424]">{new Date(inspectingLog.dispatchedAt).toLocaleString('en-GB')}</div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[#8a8886] font-semibold">Target Mailbox Addresses:</span>
                <div className="p-2 bg-[#faf9f8] border border-[#edebe9] rounded-xs text-[#242424] font-mono text-[11px]">
                  {inspectingLog.recipients.join(', ')}
                </div>
              </div>

              {inspectingLog.errorMessage && (
                <div className="space-y-1">
                  <span className="text-rose-700 font-semibold">Delivery Diagnostics:</span>
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-xs text-rose-800 text-[11px]">
                    {inspectingLog.errorMessage}
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 bg-[#faf9f8] border-t border-[#edebe9] text-right">
              <button
                onClick={() => setInspectingLog(null)}
                className="px-4 py-1.5 text-xs font-medium text-[#323130] bg-white border border-[#d2d0ce] rounded-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
