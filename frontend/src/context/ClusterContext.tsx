import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Cluster } from '../types/index';
import api from '../services/api';
import { useAuth } from './AuthContext';

interface ClusterContextType {
  clusters: Cluster[];
  selectedCluster: Cluster | null;
  setSelectedCluster: (cluster: Cluster | null) => void;
  loading: boolean;
  refreshClusters: () => Promise<void>;
  createCluster: (cluster: Partial<Cluster>) => Promise<void>;
  updateCluster: (id: number, cluster: Partial<Cluster>) => Promise<void>;
  deleteCluster: (id: number) => Promise<void>;
}

const ClusterContext = createContext<ClusterContextType | undefined>(undefined);

export const ClusterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(isAuthenticated);

  const refreshClusters = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const response = await api.get('/clusters');
      const data = (Array.isArray(response.data) ? response.data : []) as Cluster[];
      setClusters(data);
      
      const storedId = localStorage.getItem('selectedClusterId');
      if (data.length > 0) {
        if (storedId) {
          const storedCluster = data.find(c => c.id === parseInt(storedId));
          if (storedCluster) {
            setSelectedCluster(storedCluster);
          } else {
             // Fallback to null if stored cluster no longer exists
             setSelectedCluster(null);
          }
        }
      } else {
        setSelectedCluster(null);
      }
    } catch (error) {
      console.error('Failed to fetch clusters', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetSelectedCluster = (cluster: Cluster | null) => {
    setSelectedCluster(cluster);
    if (cluster) {
      localStorage.setItem('selectedClusterId', cluster.id.toString());
    } else {
      localStorage.removeItem('selectedClusterId');
    }
  };

  const createCluster = async (cluster: Partial<Cluster>) => {
    try {
      await api.post('/clusters', cluster);
      await refreshClusters();
    } catch (error) {
      console.error('Failed to create cluster', error);
      throw error;
    }
  };

  const updateCluster = async (id: number, cluster: Partial<Cluster>) => {
    try {
      await api.put(`/clusters/${id}`, cluster);
      await refreshClusters();
    } catch (error) {
      console.error('Failed to update cluster', error);
      throw error;
    }
  };

  const deleteCluster = async (id: number) => {
    try {
      await api.delete(`/clusters/${id}`);
      await refreshClusters();
    } catch (error) {
      console.error('Failed to delete cluster', error);
      throw error;
    }
  };

  useEffect(() => {
    refreshClusters();
  }, [isAuthenticated]);

  return (
    <ClusterContext.Provider 
      value={{ 
        clusters, 
        selectedCluster, 
        setSelectedCluster: handleSetSelectedCluster, 
        loading,
        refreshClusters,
        createCluster,
        updateCluster,
        deleteCluster
      }}
    >
      {children}
    </ClusterContext.Provider>
  );
};

export const useCluster = () => {
  const context = useContext(ClusterContext);
  if (context === undefined) {
    throw new Error('useCluster must be used within a ClusterProvider');
  }
  return context;
};
