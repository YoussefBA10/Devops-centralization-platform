import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  // For now, bypass for dev speed or check token
  const token = localStorage.getItem('token');
  if (!token && window.location.pathname !== '/login') {
    return <Navigate to="/login" />;
  }
  return <>{children}</>;
};

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
