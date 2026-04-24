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
  updateEnvironment: (id: number, env: Partial<Environment>) => Promise<void>;
  deleteEnvironment: (id: number) => Promise<void>;
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
      const data = response.data as Environment[];
      setEnvironments(data);
      
      const storedId = localStorage.getItem('selectedEnvironmentId');
      if (data.length > 0) {
        if (storedId) {
          const storedEnv = data.find(e => e.id === parseInt(storedId));
          if (storedEnv) {
            setSelectedEnvironment(storedEnv);
          } else {
            setSelectedEnvironment(data[0]);
            localStorage.setItem('selectedEnvironmentId', data[0].id.toString());
          }
        } else if (!selectedEnvironment) {
          setSelectedEnvironment(data[0]);
          localStorage.setItem('selectedEnvironmentId', data[0].id.toString());
        }
      }
    } catch (error) {
      console.error('Failed to fetch environments', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetSelectedEnvironment = (env: Environment) => {
    setSelectedEnvironment(env);
    localStorage.setItem('selectedEnvironmentId', env.id.toString());
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

  const updateEnvironment = async (id: number, env: Partial<Environment>) => {
    try {
      await api.put(`/environments/${id}`, env);
      await refreshEnvironments();
    } catch (error) {
      console.error('Failed to update environment', error);
      throw error;
    }
  };

  const deleteEnvironment = async (id: number) => {
    try {
      await api.delete(`/environments/${id}`);
      await refreshEnvironments();
    } catch (error) {
      console.error('Failed to delete environment', error);
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
        setSelectedEnvironment: handleSetSelectedEnvironment, 
        loading, 
        initialized: environments.length > 0,
        refreshEnvironments,
        createEnvironment,
        updateEnvironment,
        deleteEnvironment
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
