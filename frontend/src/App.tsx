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
import { useEnvironment } from './context/EnvironmentContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const { initialized, loading: envLoading } = useEnvironment();
  const location = useLocation();
  
  const loading = authLoading || envLoading;

  if (!isAuthenticated && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  // If authenticated but system not initialized, force /setup
  if (isAuthenticated && isAdmin && !initialized && !loading && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  // If already initialized, don't allow /setup
  if (isAuthenticated && initialized && location.pathname === '/setup') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function App() {
  useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
                    <Route path="/operational" element={<OperationalIntelligence />} />
                    <Route path="/infrastructure" element={<InfrastructureTopologyPage />} />
                    <Route path="/logs" element={<LogsPage />} />
                    <Route path="/tickets" element={<TicketsPage />} />
                    <Route path="/chat" element={<ChatPage />} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </main>
              </div>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
