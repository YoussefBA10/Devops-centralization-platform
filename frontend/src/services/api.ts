import axios from 'axios';

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
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const initializeSetup = (data: { vmpipeIp: string; vmpipeHostname?: string; environmentName?: string }) => 
  api.post('/setup/initialize', data);

export const getEnvironmentStats = () => api.get('/environments/stats');
export const getEnvironmentResources = (id: number) => api.get(`/environments/${id}/resources`);
export const getEnvironmentNodes = (id: number) => api.get(`/environments/${id}/nodes`);
export const getDeploymentStatus = (envId: number, targetIp: string) => api.get(`/environments/deployments/latest/${envId}/${targetIp}`);

export default api;
