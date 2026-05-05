import axios from 'axios';
import { showPermissionError } from '../components/ui/Toast';

const getBaseURL = () => {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:8880/api/v1';
  return url.endsWith('/api/v1') ? url : (url.endsWith('/api') ? `${url}/v1` : `${url}/api/v1`);
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
    if (!error.response) {
      // Network error or backend down
      if (window.location.pathname !== '/service-unavailable') {
        window.location.href = '/service-unavailable';
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else if (error.response?.status === 403) {
      const message = error.response?.data?.message || 'Session expired or insufficient permissions. Please login again.';
      showPermissionError(message);
      // Force logout and redirect on 403 as well, to ensure user is redirected if token expired/invalidated
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000); // Give time for the toast to be seen
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

// Operational Intelligence
export const getOperationalStability = (envId: number) => api.get(`/operational/stability`, { params: { environmentId: envId } });
export const getOperationalDigest = (envId: number) => api.get(`/operational/digest`, { params: { environmentId: envId } });
export const getOperationalHeatmap = (envId: number) => api.get(`/operational/heatmap`, { params: { environmentId: envId } });
export const getOperationalAnomalies = (envId: number) => api.get(`/operational/anomalies`, { params: { environmentId: envId } });
export const getOperationalResources = (envId: number) => api.get(`/operational/resources`, { params: { environmentId: envId } });

// Application Endpoints
export const getApplications = (envId: number) => api.get('/applications', { params: { environmentId: envId } });
export const deployApplication = (data: any) => api.post('/applications/deploy', data);
export const checkRunning = (data: { targetIp: string; appName: string; port: string }) => api.post('/applications/check-running', data);
export const restartApplication = (appId: number) => api.post(`/applications/${appId}/restart`);
export const getApplicationLogs = (appId: number) => api.get(`/applications/${appId}/logs`);
export const getApplicationStatus = (appId: number) => api.get(`/applications/${appId}/status`);
export const undeployApplication = (appId: number) => api.post(`/applications/${appId}/undeploy`);
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

// Network Monitoring
export const getNetworkNodes = (clusterId?: string, envId?: string) => api.get(`/network/vms`, { params: { clusterId, envId } });
export const getExporterStatus = (id: string) => api.get(`/network/vms/${id}/exporter-status`);

export const getNetworkLinks = (clusterId?: string, envId?: string) => api.get(`/network/links`, { params: { clusterId, envId } });
export const addNetworkLink = (data: any) => api.post(`/network/links`, data);
export const updateNetworkLink = (id: string, data: any) => api.put(`/network/links/${id}`, data);
export const deleteNetworkLink = (id: string) => api.delete(`/network/links/${id}`);

export const getTopology = (clusterId?: string, envId?: string) => api.get(`/network/topology`, { params: { clusterId, envId } });

export const getLinkMetrics = (linkId: string, range?: string) => api.get(`/network/metrics/link/${linkId}`, { params: { range } });
export const getVmNetworkMetrics = (nodeId: string, range?: string) => api.get(`/network/metrics/vm/${nodeId}`, { params: { range } });
export const getVmContainerMetrics = (nodeId: string, range?: string) => api.get(`/network/metrics/vm/${nodeId}/containers`, { params: { range } });
export const getNetworkHealthSummary = (clusterId?: string, envId?: string) => api.get(`/network/metrics/health-summary`, { params: { clusterId, envId } });

export const getNetworkLogs = (params: any) => api.get(`/network/logs`, { params });

export const getActiveAlerts = () => api.get(`/network/alerts/active`);
export const silenceAlert = (id: string) => api.post(`/network/alerts/${id}/silence`);
export const getAlertRules = () => api.get(`/network/alert-rules`);
export const addAlertRule = (data: any) => api.post(`/network/alert-rules`, data);
export const deleteAlertRule = (id: string) => api.delete(`/network/alert-rules/${id}`);

// CI/CD Deployment tracking
export const getDeploymentEvents = (appId?: number, env?: string, page = 0, size = 20) =>
  api.get(`/deployments`, { params: { appId, env, page, size } });
export const triggerPipeline = (data: { jobName: string; appId: string; env: string; gitBranch?: string }) =>
  api.post(`/cicd/trigger`, data);

export default api;
