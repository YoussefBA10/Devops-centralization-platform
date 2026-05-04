import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEnvironment } from '../context/EnvironmentContext';
import { getApplications, deployApplication, restartApplication, getApplicationLogs, getApplicationStatus, deleteApplicationRecord, undeployApplication, redeployApplication /*, getGitHubInstallUrl, disconnectGitHub */ } from '../services/api';
import { Search, Plus, GitBranch, RefreshCw, Terminal, Server, Box, X, AlertTriangle, Trash2, CheckCircle2, Loader2, Settings2, Zap, Globe, ExternalLink } from 'lucide-react';
import { Button, Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import DeployApplicationModal from '../components/applications/DeployApplicationModal';
import ConfirmationModal from '../components/ConfirmationModal';
import MetricsConfigModal from '../components/applications/MetricsConfigModal';

const ApplicationsPage: React.FC = () => {
  const { isAdmin, permissions } = useAuth();
  const canCreate = isAdmin || permissions?.appDeployment?.create;
  const canEdit = isAdmin || permissions?.appDeployment?.edit;
  const canDelete = isAdmin || permissions?.appDeployment?.delete;
  const { environments, selectedEnvironment, setSelectedEnvironment } = useEnvironment();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<any>(null);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [postDeployApp, setPostDeployApp] = useState<any>(null);
  const [configModalApp, setConfigModalApp] = useState<any>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    loading?: boolean;
    requiresConfirmationText?: string;
    confirmationPlaceholder?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {},
    requiresConfirmationText: undefined,
    confirmationPlaceholder: undefined
  });

  // Log viewer state
  const [logModal, setLogModal] = useState<{ appId: number; appName: string } | null>(null);
  const [logData, setLogData] = useState<{ log: string; status: string; executedAt: string; shortError?: string } | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [showTechnicalLogs, setShowTechnicalLogs] = useState(false);

  // Polling refs for DEPLOYING apps
  const pollingRefs = useRef<Record<number, ReturnType<typeof setInterval>>>({});
  const newlyDeployedAppIds = useRef<Set<number>>(new Set());

  const fetchApps = useCallback(async () => {
    if (!selectedEnvironment) return;
    setLoading(true);
    try {
      const res = await getApplications(selectedEnvironment.id);
      setApplications(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment]);

  useEffect(() => {
    fetchApps();
    const interval = setInterval(fetchApps, 15000);
    return () => clearInterval(interval);
  }, [fetchApps]);

  // Per-app status polling while DEPLOYING
  useEffect(() => {
    applications.forEach((app) => {
      if (app.status === 'DEPLOYING' && !pollingRefs.current[app.id]) {
        pollingRefs.current[app.id] = setInterval(async () => {
          try {
            const res = await getApplicationStatus(app.id);
            const newStatus = res.data.status;
            if (newStatus !== 'DEPLOYING') {
              clearInterval(pollingRefs.current[app.id]);
              delete pollingRefs.current[app.id];
              
              if (newStatus === 'RUNNING' && newlyDeployedAppIds.current.has(app.id)) {
                newlyDeployedAppIds.current.delete(app.id);
                // Fetch the updated app object to ensure we have latest data for the modal
                getApplicationStatus(app.id).then(res => {
                   setPostDeployApp(res.data);
                });
              }
              
              fetchApps();
            }
            } catch (e: any) {
              // If the application was deleted (atomic cleanup on failure), stop polling
              if (e.response?.status === 404) {
                clearInterval(pollingRefs.current[app.id]);
                delete pollingRefs.current[app.id];
                fetchApps();
              }
            }
        }, 3000);
      } else if (app.status !== 'DEPLOYING' && pollingRefs.current[app.id]) {
        clearInterval(pollingRefs.current[app.id]);
        delete pollingRefs.current[app.id];
      }
    });

    return () => {
      Object.values(pollingRefs.current).forEach(clearInterval);
    };
  }, [applications, fetchApps]);

  const handleDeploy = async (payload: any) => {
    try {
      const res = await deployApplication(payload);
      const isNew = !editingApp;
      setEditingApp(null);
      setIsDeployModalOpen(false);
      await fetchApps();
      
      if (isNew && res.data) {
        newlyDeployedAppIds.current.add(res.data.id);
      }
    } catch (e: any) {
      throw e;
    }
  };

  /*
  const handleGithubConnect = async (appId: number) => {
    try {
      const res = await getGitHubInstallUrl(appId);
      if (res.data.url) {
        window.open(res.data.url, '_blank', 'width=800,height=600');
      }
    } catch (e) {
      console.error('Failed to initiate GitHub install', e);
    }
  };

  const handleGithubDisconnect = async (appId: number) => {
    try {
      if (confirm('Are you sure you want to disconnect this repository?')) {
        await disconnectGitHub(appId);
        fetchApps();
      }
    } catch (e) {
      console.error('Failed to disconnect GitHub', e);
    }
  };
  */

  const handleRestart = async (appId: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Restart Application',
      message: 'Are you sure you want to trigger a remote restart for this application? The service will be briefly unavailable while the container reboots.',
      type: 'warning',
      onConfirm: async () => {
        try {
          setConfirmModal(prev => ({ ...prev, loading: true }));
          await restartApplication(appId);
          setConfirmModal(prev => ({ ...prev, isOpen: false, loading: false }));
          fetchApps();
        } catch (e: any) {
          setConfirmModal(prev => ({ ...prev, isOpen: false, loading: false }));
          throw e;
        }
      }
    });
  };

  const handleEditApp = (app: any) => {
    setEditingApp(app);
    setIsDeployModalOpen(true);
  };

  const handleViewLogs = async (app: any) => {
    setLogModal({ appId: app.id, appName: app.name });
    setLogData(null);
    setLogLoading(true);
    setShowTechnicalLogs(false);
    try {
      const res = await getApplicationLogs(app.id);
      setLogData(res.data);
    } catch (e) {
      setLogData({ log: 'Failed to fetch deployment logs. Backend may be unreachable.', status: 'ERROR', executedAt: '' });
    } finally {
      setLogLoading(false);
    }
  };

  const handleDelete = async (appId: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Record Only',
      message: 'This will only remove the application record from the database. It will NOT stop or delete the running container on the remote node. Use this if you have manually undeployed or just want to clean up the dashboard. Continue?',
      type: 'warning',
      onConfirm: async () => {
        try {
          setConfirmModal(prev => ({ ...prev, loading: true }));
          await deleteApplicationRecord(appId);
          setConfirmModal(prev => ({ ...prev, isOpen: false, loading: false }));
          fetchApps();
        } catch (e) {
          setConfirmModal(prev => ({ ...prev, isOpen: false, loading: false }));
          throw e;
        }
      }
    });
  };

  const handleUndeploy = async (app: any) => {
    setConfirmModal({
      isOpen: true,
      title: 'Undeploy & Delete',
      message: `This will trigger a remote undeployment of '${app.name}'. The container will be stopped and removed from the host. Once finished, the database record will also be deleted. This action is destructive and cannot be undone.`,
      type: 'danger',
      requiresConfirmationText: app.name,
      confirmationPlaceholder: 'Enter app name to confirm...',
      onConfirm: async () => {
        try {
          setConfirmModal(prev => ({ ...prev, loading: true }));
          await undeployApplication(app.id);
          setConfirmModal(prev => ({ ...prev, isOpen: false, loading: false }));
          setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: 'DELETING' } : a));
          fetchApps();
        } catch (e) {
          setConfirmModal(prev => ({ ...prev, isOpen: false, loading: false }));
          throw e;
        }
      }
    });
  };

  const handleRedeploy = async (app: any) => {
    setConfirmModal({
      isOpen: true,
      title: 'Full Redeployment',
      message: `This will perform a full redeployment of '${app.name}'. The existing container and image will be deleted, fresh code will be pulled from Git, and the application will be rebuilt using its saved parameters and environment variables. Continue?`,
      type: 'warning',
      onConfirm: async () => {
        try {
          setConfirmModal(prev => ({ ...prev, loading: true }));
          await redeployApplication(app.id);
          setConfirmModal(prev => ({ ...prev, isOpen: false, loading: false }));
          setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: 'DEPLOYING' } : a));
          fetchApps();
        } catch (e) {
          setConfirmModal(prev => ({ ...prev, isOpen: false, loading: false }));
          throw e;
        }
      }
    });
  };

  const filteredApps = applications.filter((app) => {
    if (filter !== 'ALL') {
      if (filter === 'RUNNING' || filter === 'FAILED') {
        if (app.status !== filter) return false;
      } else {
        if (app.type !== filter) return false;
      }
    }
    if (search && !app.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'emerald';
      case 'DEPLOYING': return 'amber';
      case 'DELETING': return 'rose';
      case 'FAILED': return 'red';
      default: return 'slate';
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Environment Segmented Control */}
        <div className="flex gap-2 p-1 bg-[#0c0c0e] border border-white/5 rounded-xl w-fit">
          {environments.map((env) => (
            <button
              key={env.id}
              onClick={() => setSelectedEnvironment(env)}
              className={`px-6 py-2 rounded-lg text-sm font-black uppercase tracking-widest transition-all ${
                selectedEnvironment?.id === env.id 
                  ? 'bg-primary/20 text-primary border border-primary/30' 
                  : 'text-muted-foreground hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              {env.name}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage and deploy services for <span className="font-bold text-primary">{selectedEnvironment?.name || '...'}</span>
            </p>
          </div>
          {canCreate && (
            <Button
              onClick={() => setIsDeployModalOpen(true)}
              className="bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all h-11 px-6"
            >
              <Plus className="w-5 h-5 mr-2" />
              Deploy New Application
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 p-4 bg-card border border-border shadow-md rounded-xl">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search applications..."
                className="pl-10 bg-black/20 border-white/5 focus:border-primary/50"
              />
            </div>
            <div className="flex items-center gap-2 p-1 bg-black/20 rounded-lg">
              {['ALL', 'BACKEND', 'FRONTEND', 'RUNNING', 'FAILED'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                    filter === f ? 'bg-white/10 text-white shadow-sm' : 'text-muted-foreground hover:text-white hover:bg-white/5'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchApps} loading={loading} className="border-white/10">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredApps.map((app) => {
            const statusColor = getStatusColor(app.status);
            return (
              <div key={app.id} className="group relative pt-6">
                <div className="absolute top-2 right-4 px-3 py-1 bg-primary border border-primary/50 shadow-[0_0_15px_rgba(59,130,246,0.4)] rounded-full z-10 flex items-center gap-1.5">
                  <Server className="w-3 h-3 text-white" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white">{app.targetNode || 'Auto'}</span>
                </div>

                <div className={`p-5 rounded-xl border flex flex-col bg-[#0c0c0e]/80 backdrop-blur-md shadow-2xl transition-all duration-300 hover:-translate-y-1 ${
                  app.status === 'RUNNING' ? 'border-emerald-500/20 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                  : app.status === 'DEPLOYING' ? 'border-amber-500/30 hover:border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                  : 'border-red-500/40 hover:border-red-500/70'
                }`}>
                  <div className="flex justify-between items-start mb-4 mt-2">
                    <div className="min-w-0 pr-4">
                      <h3 className="text-lg font-bold text-white truncate">{app.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 font-bold uppercase tracking-widest text-muted-foreground">{app.type}</span>
                        <span className="text-[10px] text-muted-foreground">{app.appLanguage}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {canDelete && <button onClick={() => handleDelete(app.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-all" title="Delete Record (DB only)"><Trash2 className="w-3.5 h-3.5" /></button>}
                      {canDelete && <button onClick={() => handleUndeploy(app)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all" title="Undeploy & Delete"><X className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>

                  <a href={app.repoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-primary transition-colors mb-4 truncate group/repo">
                    <GitBranch className="w-3.5 h-3.5 group-hover/repo:scale-110 transition-transform" />
                    {app.repoUrl?.replace('https://github.com/', '') || 'No Repository'}
                  </a>

                  <div className="space-y-4 mb-5">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground"><span>Endpoint</span><Globe className="w-3 h-3" /></div>
                      <div className="flex items-center justify-between">
                        <a href={`http://${app.targetNode}:${app.port}`} target="_blank" rel="noreferrer" className={`text-xs font-mono transition-colors ${app.status === 'RUNNING' ? 'text-primary hover:text-primary/80 underline underline-offset-4' : 'text-muted-foreground cursor-not-allowed pointer-events-none'}`}>http://{app.targetNode}:{app.port}</a>
                        {app.status === 'RUNNING' && <ExternalLink className="w-3 h-3 text-primary/50" />}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Monitoring</span>
                        {app.metricsTestStatus === 'SUCCESS' ? (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" /> ACTIVE
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400">
                            <AlertTriangle className="w-3 h-3" /> UNCONFIGURED
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => setConfigModalApp(app)}
                        className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                        title="Configure Metrics"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {app.isCanary && <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20"><Zap className="w-3 h-3 text-amber-500 animate-pulse" /><span className="text-[10px] font-bold text-amber-500 uppercase tracking-tighter">Canary active on port {app.canaryPort}</span></div>}
                  </div>

                  <div className="mt-auto border-t border-white/5 pt-4">
                    <div className="flex flex-col gap-2 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full bg-${statusColor}-500 ${app.status === 'DEPLOYING' ? 'animate-ping' : ''}`} />
                          <span className={`text-[10px] font-bold uppercase tracking-widest text-${statusColor}-500`}>{app.status}</span>
                        </div>
                        {app.lastDeployedAt && <span className="text-[10px] text-muted-foreground">{new Date(app.lastDeployedAt).toLocaleString()}</span>}
                      </div>
                      {app.status === 'FAILED' && app.lastErrorMessage && <div className="flex items-center gap-1.5 text-red-400 font-medium text-[10px] bg-red-500/5 px-2 py-1 rounded border border-red-500/10"><AlertTriangle className="w-3 h-3 shrink-0" /><span className="truncate">{app.lastErrorMessage}</span></div>}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className={`h-8 text-[11px] bg-black/20 border-white/5 hover:border-white/20 ${app.status === 'FAILED' ? 'border-red-500/30 hover:border-red-500/60 text-red-400' : ''}`} onClick={() => handleViewLogs(app)}>{app.status === 'FAILED' ? <><AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> View Error</> : <><Terminal className="w-3.5 h-3.5 mr-1.5" /> Logs</>}</Button>
                      {canEdit && <Button variant="outline" size="sm" className="h-8 text-[11px] bg-black/20 border-white/5 hover:border-white/20" onClick={() => handleEditApp(app)}><Settings2 className="w-3.5 h-3.5 mr-1.5" /> Edit</Button>}
                      {canEdit && <Button variant="outline" size="sm" className="h-8 text-[11px] bg-black/20 border-white/5 hover:border-white/20" disabled={app.status === 'DEPLOYING' || app.status === 'DELETING'} onClick={() => handleRedeploy(app)}><RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${app.status === 'DEPLOYING' || app.status === 'DELETING' ? 'animate-spin' : ''}`} /> Redeploy</Button>}
                      {canEdit && <Button variant="outline" size="sm" className="h-8 text-[11px] bg-black/20 border-white/5 hover:border-white/20" disabled={app.status === 'DEPLOYING' || app.status === 'DELETING'} onClick={() => handleRestart(app.id)}><Zap className={`w-3.5 h-3.5 mr-1.5 ${app.status === 'DEPLOYING' || app.status === 'DELETING' ? 'animate-spin' : ''}`} /> Restart</Button>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredApps.length === 0 && !loading && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl bg-black/20">
              <Box className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-bold text-muted-foreground">No Applications Found</h3>
              <p className="text-sm text-muted-foreground/70 mb-6">Deploy a new application to get started.</p>
              {canCreate && <Button onClick={() => setIsDeployModalOpen(true)}><Plus className="w-4 h-4 mr-2" /> Deploy Application</Button>}
            </div>
          )}
        </div>
      </div>

      <DeployApplicationModal
        isOpen={isDeployModalOpen}
        initialData={editingApp}
        onClose={() => {
          setIsDeployModalOpen(false);
          setEditingApp(null);
        }}
        onDeploy={handleDeploy}
      />

      {logModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-3xl bg-[#080809] border-white/10 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className={`h-0.5 w-full ${logData?.status === 'FAILED' ? 'bg-gradient-to-r from-red-500 to-rose-500' : logData?.status === 'SUCCESS' ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-amber-500 to-yellow-400'}`} />
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-5 pt-5">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${logData?.status === 'FAILED' ? 'bg-red-500/10' : 'bg-primary/10'}`}><Terminal className={`w-5 h-5 ${logData?.status === 'FAILED' ? 'text-red-400' : 'text-primary'}`} /></div>
                <div>
                  <CardTitle className="text-lg">Deployment Log</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5"><span className="font-bold text-white">{logModal.appName}</span>{logData?.executedAt && ` · ${new Date(logData.executedAt).toLocaleString()}`}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {logData && <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${logData.status === 'FAILED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : logData.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>{logData.status === 'FAILED' ? <AlertTriangle className="w-3 h-3" /> : logData.status === 'SUCCESS' ? <CheckCircle2 className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}{logData.status}</div>}
                <button onClick={() => setLogModal(null)} className="p-1.5 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-white transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {logLoading ? (
                <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin text-primary" /><span className="text-sm">Fetching deployment log...</span></div>
              ) : (
                <div className="flex flex-col">
                  {logData?.status === 'FAILED' && (
                    <div className="p-5 bg-red-500/5 border-b border-white/5">
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5" />Failure Summary</h4>
                      <p className="text-sm text-red-200/90 font-medium leading-relaxed">{logData.shortError || 'Deployment failed. See technical logs below.'}</p>
                      <div className="mt-4 flex items-center justify-between"><p className="text-[10px] text-red-400/60 italic font-mono max-w-[70%]">Technical logs analyzed for root cause.</p><Button variant="outline" size="sm" onClick={() => setShowTechnicalLogs(!showTechnicalLogs)} className="h-7 text-[10px] bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-red-400">{showTechnicalLogs ? 'Hide Technical Logs' : 'View Technical Logs'}</Button></div>
                    </div>
                  )}
                  {(logData?.status !== 'FAILED' || showTechnicalLogs) && <pre className="p-5 text-[11px] font-mono text-green-300/80 leading-relaxed overflow-auto max-h-[60vh] bg-black/60 whitespace-pre-wrap break-words">{logData?.log || 'No output.'}</pre>}
                  {logData?.status === 'FAILED' && !showTechnicalLogs && (
                    <div className="py-12 flex flex-col items-center justify-center text-muted-foreground/40 italic"><Terminal className="w-8 h-8 mb-2 opacity-20" /><p className="text-xs">Technical logs hidden.</p><button onClick={() => setShowTechnicalLogs(true)} className="text-[10px] mt-2 underline hover:text-muted-foreground/60">Show logs</button></div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type as any}
        loading={confirmModal.loading}
        requiresConfirmationText={confirmModal.requiresConfirmationText}
        confirmationPlaceholder={confirmModal.confirmationPlaceholder}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
      />

      <ConfirmationModal
        isOpen={!!postDeployApp}
        title="Deployment Successful"
        message={`The application "${postDeployApp?.name}" is now running. Would you like to configure Application Observability metrics (Golden Signals) for this service now?`}
        type="info"
        onClose={() => setPostDeployApp(null)}
        onConfirm={() => {
          setConfigModalApp(postDeployApp);
          setPostDeployApp(null);
        }}
      />

      {configModalApp && (
        <MetricsConfigModal
          app={configModalApp}
          onClose={() => setConfigModalApp(null)}
          onSuccess={() => {
            setConfigModalApp(null);
            fetchApps();
          }}
        />
      )}
    </div>
  );
};

export default ApplicationsPage;
