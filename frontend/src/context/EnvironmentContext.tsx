import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Environment } from '../types/index';
import api from '../services/api';
import { useAuth } from './AuthContext';

interface EnvironmentContextType {
  environments: Environment[];
  selectedEnvironment: Environment | null;
  setSelectedEnvironment: (env: Environment) => void;
  loading: boolean;
  refreshEnvironments: () => Promise<void>;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<Environment | null>(null);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuth();

  const refreshEnvironments = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const response = await api.get('/environments');
      const data = response.data;
      setEnvironments(data);
      if (data.length > 0 && !selectedEnvironment) {
        setSelectedEnvironment(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch environments', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshEnvironments();
  }, [isAuthenticated]);

  return (
    <EnvironmentContext.Provider 
      value={{ 
        environments, 
        selectedEnvironment, 
        setSelectedEnvironment, 
        loading, 
        refreshEnvironments 
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
};

export const useEnvironment = () => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider');
  }
  return context;
};
