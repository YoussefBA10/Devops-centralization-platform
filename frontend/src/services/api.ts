import axios from 'axios';
import { showPermissionError } from '../components/ui/Toast';

const getBaseURL = () => {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:8880/api';
  return url.endsWith('/api') ? url : `${url}/api`;
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor for Bearer token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if it's a network error (no response) or a 503 maintenance status
    const isMaintenance = !error.response || error.response.status === 503;
    const isAlreadyOnMaintenance = window.location.pathname === '/maintenance';

    if (isMaintenance && !isAlreadyOnMaintenance) {
      window.location.href = '/maintenance';
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else if (error.response?.status === 403) {
      const message = error.response?.data?.message || 'You do not have permission to perform this action.';
      showPermissionError(message);
    }
    return Promise.reject(error);
  }
);

export const initializeSetup = (data: { vmpipeIp: string; vmpipeHostname?: string; environmentName?: string; sshUser?: string; osFamily?: string }) => 
  api.post('/setup/initialize', data);

export const getEnvironmentStats = () => api.get('/environments/stats');
export const getGlobalStability = () => api.get('/infrastructure/global/stability');
export const getGlobalInfrastructureStats = () => api.get('/infrastructure/global');
export const getInfrastructureTopology = (envId: number) => api.get('/infrastructure/global/topology', { params: { environmentId: envId } });
export const getAllInfrastructureTopology = () => api.get('/infrastructure/global/topology/all');
export const getEnvironmentResources = (id: number) => api.get(`/environments/${id}/resources`);
export const getEnvironmentNodes = (id: number) => api.get(`/environments/${id}/nodes`);
export const getDeploymentStatus = (envId: number, targetIp: string) => 
  api.get(`/environments/deployments/status`, { params: { environmentId: envId, targetIp } });

// Application Endpoints
export const getApplications = (envId: number) => api.get('/applications', { params: { environmentId: envId } });
export const deployApplication = (data: any) => api.post('/applications/deploy', data);
export const restartApplication = (appId: number) => api.post(`/applications/${appId}/restart`);
export const getApplicationLogs = (appId: number) => api.get(`/applications/${appId}/logs`);
export const getApplicationStatus = (appId: number) => api.get(`/applications/${appId}/status`);
export const redeployApplication = (appId: number) => api.post(`/applications/${appId}/redeploy`);
export const deleteApplicationRecord = (appId: number) => api.delete(`/applications/${appId}`);
export const promoteApplication = (envId: number, appId: number) => 
  api.post(`/applications/${appId}/promote`, null, { params: { environmentId: envId } });

export const restartContainer = (targetIp: string, containerName: string) => 
  api.post('/infrastructure/restart-container', { targetIp, containerName });

// Elasticsearch System Logs
export const getSystemLogs = (appId: number, params: { q?: string, severity?: string, from?: string, to?: string, size?: number, page?: number }) => 
  api.get(`/apps/${appId}/logs/search`, { params });
export const exportSystemLogs = (appId: number, params: { q?: string, severity?: string, from?: string, to?: string }) => 
  api.get(`/apps/${appId}/logs/export`, { params, responseType: 'blob' });
export const clearSystemLogs = (appId: number) => 
  api.post(`/apps/${appId}/logs/clear`);

export const updateEnvironment = (id: number, data: any) => api.put(`/environments/${id}`, data);
export const deleteEnvironment = (id: number) => api.delete(`/environments/${id}`);

// GitHub Integration
export const getGitHubInstallUrl = (appId: number) => api.get('/github/install', { params: { appId } });
export const disconnectGitHub = (appId: number) => api.post(`/github/apps/${appId}/disconnect`);

// Notifications
export const getNotifications = () => api.get('/notifications');
export const getUnreadCount = () => api.get('/notifications/unread-count');
export const markNotificationAsRead = (id: number) => api.post(`/notifications/${id}/read`);
export const markAllNotificationsAsRead = () => api.post('/notifications/read-all');

export default api;
