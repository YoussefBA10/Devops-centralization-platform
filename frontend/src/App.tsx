import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';

import DashboardPage from './pages/DashboardPage';
import EnvironmentsPage from './pages/EnvironmentsPage';
import OperationalIntelligence from './pages/OperationalIntelligence';
import InfrastructureTopologyPage from './pages/InfrastructureTopologyPage';
import LogsPage from './pages/LogsPage';
import TicketsPage from './pages/TicketsPage';
import ChatPage from './pages/ChatPage';
import LoginPage from './pages/LoginPage';
import SetupWizard from './pages/SetupWizard';
import ApplicationsPage from './pages/ApplicationsPage';
import ApplicationObservabilityPage from './pages/ApplicationObservabilityPage';
import AppMetricsDashboard from './pages/AppMetricsDashboard';
import AuditLogPage from './pages/AuditLogPage';
import UserManagementPage from './pages/UserManagementPage';
import AccessDeniedPage from './pages/AccessDeniedPage';
import DocumentationPage from './pages/DocumentationPage';
<<<<<<< HEAD
import ServiceUnavailablePage from './pages/ServiceUnavailablePage';
=======
import MaintenancePage from './pages/MaintenancePage';
>>>>>>> 4345ee2a6c552c01f7065aa214602f381994a67f
import ChatWidget from './components/layout/ChatWidget';
import NetworkMonitor from './pages/NetworkMonitor';
import { useEnvironment } from './context/EnvironmentContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const { initialized, loading: envLoading } = useEnvironment();
  const location = useLocation();
  
  const loading = authLoading || envLoading;

  // Wait for auth and environment states to be determined
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If already authenticated and trying to access /login, redirect to home
  if (isAuthenticated && location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  // Gate 1: Authentication
  if (!isAuthenticated && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  // Gate 2: Platform Initialization (Only for Admins)
  if (isAuthenticated && isAdmin && !initialized && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  // Gate 3: Setup Access Control (Only Admins can see /setup)
  if (isAuthenticated && !isAdmin && location.pathname === '/setup') {
    return <Navigate to="/" replace />;
  }

  // Gate 4: Prevent /setup if already initialized
  if (isAuthenticated && initialized && location.pathname === '/setup') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Admin-only route wrapper
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return <AccessDeniedPage title="Admin Only" message="This section is restricted to administrators. Contact your system administrator if you believe you should have access." />;
  }
  return <>{children}</>;
};

function App() {
  useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
<<<<<<< HEAD
      <Route path="/service-unavailable" element={<ServiceUnavailablePage />} />
=======
      <Route path="/maintenance" element={<MaintenancePage />} />
>>>>>>> 4345ee2a6c552c01f7065aa214602f381994a67f
      <Route path="/setup" element={
        <ProtectedRoute>
          <SetupWizard />
        </ProtectedRoute>
      } />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="flex h-screen bg-background overflow-hidden">
              <Sidebar />
              <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <main className="flex-1 overflow-y-auto scroll-smooth">
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/environments" element={<EnvironmentsPage />} />
                    <Route path="/applications" element={<ApplicationsPage />} />
                    <Route path="/observability/apps" element={<ApplicationObservabilityPage />} />
                    <Route path="/observability/apps/:appId/dashboard" element={<AppMetricsDashboard />} />
                    <Route path="/operational" element={<OperationalIntelligence />} />
                    <Route path="/network-monitor" element={<NetworkMonitor />} />
                    <Route path="/network-monitor/vm/:vmId" element={<NetworkMonitor />} />
                    <Route path="/infrastructure" element={<InfrastructureTopologyPage />} />
                    <Route path="/logs" element={<LogsPage />} />
                    <Route path="/tickets" element={<TicketsPage />} />
                    <Route path="/audit-log" element={<AuditLogPage />} />
                    <Route path="/chat" element={<ChatPage />} />
                    <Route path="/documentation" element={<DocumentationPage />} />
                    <Route path="/settings" element={<AdminRoute><UserManagementPage /></AdminRoute>} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </main>
              </div>
              <ChatWidget />
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
