import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Environment } from '../types/index';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useCluster } from './ClusterContext';

interface EnvironmentContextType {
  environments: Environment[];
  selectedEnvironment: Environment | null;
  setSelectedEnvironment: (env: Environment) => void;
  loading: boolean;
  initialized: boolean;
  refreshEnvironments: () => Promise<void>;
  createEnvironment: (env: any) => Promise<void>;
  updateEnvironment: (id: number, env: any) => Promise<void>;
  deleteEnvironment: (id: number) => Promise<void>;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<Environment | null>(null);
  const { isAuthenticated } = useAuth();
  const { selectedCluster } = useCluster();
  const [loading, setLoading] = useState(isAuthenticated);

  const refreshEnvironments = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const url = selectedCluster ? `/environments?clusterId=${selectedCluster.id}` : '/environments';
      const response = await api.get(url);
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
        } else if (!selectedEnvironment || !data.find(e => e.id === selectedEnvironment.id)) {
          setSelectedEnvironment(data[0]);
          localStorage.setItem('selectedEnvironmentId', data[0].id.toString());
        }
      } else {
        setSelectedEnvironment(null);
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
  
  
  const createEnvironment = async (env: any) => {
    try {
      await api.post('/environments', env);
      await refreshEnvironments();
    } catch (error) {
      console.error('Failed to create environment', error);
      throw error;
    }
  };

  const updateEnvironment = async (id: number, env: any) => {
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
  }, [isAuthenticated, selectedCluster]);

  return (
    <EnvironmentContext.Provider 
      value={{ 
        environments, 
        selectedEnvironment, 
        setSelectedEnvironment: handleSetSelectedEnvironment, 
        loading, 
        initialized: environments.length > 0 || (selectedCluster !== null),
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
