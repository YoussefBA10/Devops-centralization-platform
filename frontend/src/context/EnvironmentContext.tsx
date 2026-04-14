import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Environment } from '../types/index';
import api from '../services/api';
import { useAuth } from './AuthContext';

interface EnvironmentContextType {
  environments: Environment[];
  selectedEnvironment: Environment | null;
  setSelectedEnvironment: (env: Environment) => void;
  loading: boolean;
  initialized: boolean;
  refreshEnvironments: () => Promise<void>;
  createEnvironment: (env: Partial<Environment>) => Promise<void>;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<Environment | null>(null);
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(isAuthenticated);

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
  
  const createEnvironment = async (env: Partial<Environment>) => {
    try {
      await api.post('/environments', env);
      await refreshEnvironments();
    } catch (error) {
      console.error('Failed to create environment', error);
      throw error;
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
        initialized: environments.length > 0,
        refreshEnvironments,
        createEnvironment
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
