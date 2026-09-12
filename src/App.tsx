/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { ConfirmationModal } from './components/common/ConfirmationModal';
import { SessionLockModal } from './components/common/SessionLockModal';
import { DashboardView } from './components/dashboard/DashboardView';
import { ReferralsView } from './components/referrals/ReferralsView';
import { VulnerableView } from './components/vulnerable/VulnerableView';
import { ChallengingView } from './components/challenging/ChallengingView';
import { LaundryView } from './components/laundry/LaundryView';
import { FoodView } from './components/food/FoodView';
import { EscalationsView } from './components/escalations/EscalationsView';
import { DocumentsView } from './components/documents/DocumentsView';
import { ReportsView } from './components/reports/ReportsView';
import { AuditView } from './components/audit/AuditView';
import { RolesView } from './components/roles/RolesView';
import { SettingsView } from './components/settings/SettingsView';
import { PropertiesView } from './components/properties/PropertiesView';
import { UsersView } from './components/users/UsersView';
import { MaintenanceTrackerView } from './components/maintenance/MaintenanceTrackerView';
import { SPCDTrackerView } from './components/spcd/SPCDTrackerView';
import { PublicTransportTrackerView } from './components/transport/PublicTransportTrackerView';
import { SDComplianceTrackerView } from './components/compliance/SDComplianceTrackerView';
import { GPAppointmentsView } from './components/gp/GPAppointmentsView';
import { RFAWelfareChecksView } from './components/welfare/RFAWelfareChecksView';
import { DispersalSheetView } from './components/dispersal/DispersalSheetView';
import { BookletCollectionView } from './components/booklets/BookletCollectionView';
import { SDVCSDirectoryView } from './components/vcs/SDVCSDirectoryView';
import { RequestsApprovalsView } from './components/requests/RequestsApprovalsView';
import { FieldOptionsSetupView } from './components/setup/FieldOptionsSetupView';
import { NotificationsManagementView } from './components/notifications/NotificationsManagementView';
import { LoginView } from './components/auth/LoginView';
import { QuickJumpModal } from './components/common/QuickJumpModal';
import { AuthenticationBlockedView } from './components/auth/AuthenticationBlockedView';
import { DiagnosticInspectorModal } from './components/auth/DiagnosticInspectorModal';
import { LiveDataBanner } from './components/common/LiveDataBanner';
import { AccessDeniedView } from './components/common/AccessDeniedView';

function AppLayout() {
  const { 
    activePage, 
    isAuthenticated, 
    isAuthChecking, 
    authBlockedState, 
    clearAuthBlockedState, 
    diagnosticModalOpen, 
    setDiagnosticModalOpen,
    canManageSettings,
    canManageRoles,
    canManageUsers,
    canManageProperties,
    currentUserRole,
    rolePermissions
  } = useApp();
  const [isQuickJumpOpen, setIsQuickJumpOpen] = useState(false);

  useEffect(() => {
    const handleOpenQuickJump = () => setIsQuickJumpOpen(true);
    window.addEventListener('open-quick-jump', handleOpenQuickJump as EventListener);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickJumpOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('open-quick-jump', handleOpenQuickJump as EventListener);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (isAuthChecking) {
    return (
      <div className="h-screen w-screen bg-[#f3f2f1] flex flex-col items-center justify-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0d9488]"></div>
        <p className="text-xs font-semibold text-[#323130] tracking-wider uppercase">Verifying Supabase Session & Profile...</p>
      </div>
    );
  }

  // Clear UI state for users if authentication is blocked due to missing permissions or session invalidation
  if (authBlockedState) {
    return (
      <>
        <AuthenticationBlockedView
          blockedInfo={authBlockedState}
          onReturnToLogin={() => clearAuthBlockedState()}
        />
        <DiagnosticInspectorModal
          isOpen={diagnosticModalOpen}
          onClose={() => setDiagnosticModalOpen(false)}
        />
      </>
    );
  }

  // Strict tokenized session gate: Users cannot access app without logging in
  if (!isAuthenticated) {
    return (
      <>
        <LoginView />
        <DiagnosticInspectorModal
          isOpen={diagnosticModalOpen}
          onClose={() => setDiagnosticModalOpen(false)}
        />
      </>
    );
  }

  const renderActiveView = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardView />;
      case 'referrals':
        return <ReferralsView isArchive={false} />;
      case 'referralsArchive':
        return <ReferralsView isArchive={true} />;
      case 'vulnerable':
        return <VulnerableView isArchive={false} />;
      case 'vulnerableArchive':
        return <VulnerableView isArchive={true} />;
      case 'challenging':
        return <ChallengingView isArchive={false} />;
      case 'challengingArchive':
        return <ChallengingView isArchive={true} />;
      case 'rfaWelfare':
        return <RFAWelfareChecksView />;
      case 'gpAppointments':
        return <GPAppointmentsView />;
      case 'maintenance':
        return <MaintenanceTrackerView />;
      case 'spcd':
        return <SPCDTrackerView />;
      case 'publicTransport':
        return <PublicTransportTrackerView />;
      case 'dispersal':
        return <DispersalSheetView />;
      case 'booklets':
        return <BookletCollectionView />;
      case 'compliance':
        return <SDComplianceTrackerView />;
      case 'vcsDirectory':
        return <SDVCSDirectoryView />;
      case 'laundry':
        return <LaundryView />;
      case 'food':
        return <FoodView />;
      case 'escalations':
        return <EscalationsView />;
      case 'documents':
        return <DocumentsView />;
      case 'properties':
        return canManageProperties()
          ? <PropertiesView />
          : <AccessDeniedView pageName="Properties Directory" requiredRole="Super Admin or Admin" />;
      case 'users':
        return canManageUsers()
          ? <UsersView />
          : <AccessDeniedView pageName="Staff & User Accounts" requiredRole="Super Admin or Admin" />;
      case 'reports':
        return (rolePermissions[currentUserRole]?.canExportData || canManageSettings())
          ? <ReportsView />
          : <AccessDeniedView pageName="Reports & Compliance" requiredRole="Admin or Regional Manager" />;
      case 'audit':
        return (currentUserRole === 'Super Admin' || currentUserRole === 'Admin')
          ? <AuditView />
          : <AccessDeniedView pageName="Audit Security Trail" requiredRole="Super Admin or Admin" />;
      case 'requests':
        return <RequestsApprovalsView />;
      case 'roles':
        return canManageRoles()
          ? <RolesView />
          : <AccessDeniedView pageName="Roles & Security Permissions" requiredRole="Super Admin" />;
      case 'setupOptions':
        return canManageRoles()
          ? <FieldOptionsSetupView />
          : <AccessDeniedView pageName="Field Options & Setup" requiredRole="Super Admin" />;
      case 'notifications':
        return canManageSettings()
          ? <NotificationsManagementView />
          : <AccessDeniedView pageName="Email Notifications Management" requiredRole="Super Admin or Admin" />;
      case 'settings':
        return canManageSettings()
          ? <SettingsView />
          : <AccessDeniedView pageName="System Settings & Preferences" requiredRole="Super Admin or Admin" />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="h-screen bg-[#f3f2f1] text-[#242424] flex flex-col font-sans antialiased overflow-hidden">
      {/* Top Application Header - Sticky and fixed */}
      <Header />

      {/* Main Container with Sticky/Static Sidebar and Scrollable Content View */}
      <div className="flex flex-1 overflow-hidden relative min-h-0">
        {/* Navigation Sidebar - Static & pinned, will not move or scroll with main content */}
        <Sidebar />

        {/* Viewport Content Area - Dedicated scrolling container */}
        <main className="flex-1 overflow-y-auto p-2.5 sm:p-4 md:p-6 lg:p-8 max-w-[1700px] mx-auto w-full h-full">
          <LiveDataBanner />
          {renderActiveView()}
        </main>
      </div>

      {/* Global CRUD Confirmation Modal */}
      <ConfirmationModal />
      <SessionLockModal />
      <QuickJumpModal isOpen={isQuickJumpOpen} onClose={() => setIsQuickJumpOpen(false)} />
      <DiagnosticInspectorModal isOpen={diagnosticModalOpen} onClose={() => setDiagnosticModalOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}
