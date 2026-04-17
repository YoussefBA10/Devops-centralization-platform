import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEnvironment } from '../context/EnvironmentContext';
import { getApplications, deployApplication, getApplicationLogs, getApplicationStatus, deleteApplicationRecord } from '../services/api';
import { Search, Plus, GitBranch, RefreshCw, Terminal, Activity, Cpu, Server, Box, X, AlertTriangle, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { Button, Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import DeployApplicationModal from '../components/applications/DeployApplicationModal';

const ApplicationsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { selectedEnvironment } = useEnvironment();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Log viewer state
  const [logModal, setLogModal] = useState<{ appId: number; appName: string } | null>(null);
  const [logData, setLogData] = useState<{ log: string; status: string; executedAt: string } | null>(null);
  const [logLoading, setLogLoading] = useState(false);

  // Polling refs for DEPLOYING apps
  const pollingRefs = useRef<Record<number, ReturnType<typeof setInterval>>>({});

  // Simulation state for resource bars
  const [resourceSim, setResourceSim] = useState<Record<number, { cpu: number; ram: number }>>({});

  const fetchApps = useCallback(async () => {
    if (!selectedEnvironment) return;
    setLoading(true);
    try {
      const res = await getApplications(selectedEnvironment.id);
      setApplications(res.data);

      // Initialize resource sim
      const sim: Record<number, { cpu: number; ram: number }> = {};
      res.data.forEach((app: any) => {
        if (app.status === 'RUNNING') {
          sim[app.id] = { cpu: Math.floor(Math.random() * 30) + 5, ram: Math.floor(Math.random() * 40) + 20 };
        } else {
          sim[app.id] = { cpu: 0, ram: 0 };
        }
      });
      setResourceSim(sim);
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
              // Refresh the full list to get the updated state
              fetchApps();
            }
          } catch (e) {
            clearInterval(pollingRefs.current[app.id]);
            delete pollingRefs.current[app.id];
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

  // Live resource fluctuation simulation
  useEffect(() => {
    const simInterval = setInterval(() => {
      setResourceSim((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          const id = parseInt(key);
          if (next[id].cpu > 0) {
            next[id] = {
              cpu: Math.max(1, Math.min(100, next[id].cpu + (Math.random() * 10 - 5))),
              ram: Math.max(1, Math.min(100, next[id].ram + (Math.random() * 4 - 2))),
            };
          }
        });
        return next;
      });
    }, 3000);
    return () => clearInterval(simInterval);
  }, []);

  const handleDeploy = async (payload: any) => {
    await deployApplication(payload);
    await fetchApps();
  };

  const handleViewLogs = async (app: any) => {
    setLogModal({ appId: app.id, appName: app.name });
    setLogData(null);
    setLogLoading(true);
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
    if (!confirm('Remove this application record? This does not stop the running container.')) return;
    try {
      await deleteApplicationRecord(appId);
      setApplications((prev) => prev.filter((a) => a.id !== appId));
    } catch (e) {
      console.error('Failed to delete', e);
    }
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
      case 'FAILED': return 'red';
      default: return 'slate';
    }
  };

  const getProgressColor = (val: number) => {
    if (val < 70) return 'bg-blue-500';
    if (val < 85) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage and deploy services for <span className="font-bold text-primary">{selectedEnvironment?.name || '...'}</span>
            </p>
          </div>
          {isAdmin && (
            <Button
              onClick={() => setIsDeployModalOpen(true)}
              className="bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all h-11 px-6"
            >
              <Plus className="w-5 h-5 mr-2" />
              Deploy New Application
            </Button>
          )}
        </div>

        {/* Filters */}
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

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredApps.map((app) => {
            const statusColor = getStatusColor(app.status);
            const cpu = resourceSim[app.id]?.cpu || 0;
            const ram = resourceSim[app.id]?.ram || 0;

            return (
              <div key={app.id} className="group relative pt-6">
                {/* Target Node Badge */}
                <div className="absolute top-2 right-4 px-3 py-1 bg-primary border border-primary/50 shadow-[0_0_15px_rgba(59,130,246,0.4)] rounded-full z-10 flex items-center gap-1.5">
                  <Server className="w-3 h-3 text-white" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                    {app.targetNode || 'Auto'}
                  </span>
                </div>

                <div className={`p-5 rounded-xl border flex flex-col bg-[#0c0c0e]/80 backdrop-blur-md shadow-2xl transition-all duration-300 hover:-translate-y-1 ${
                  app.status === 'RUNNING'
                    ? 'border-emerald-500/20 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                    : app.status === 'DEPLOYING'
                    ? 'border-amber-500/30 hover:border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                    : 'border-red-500/40 hover:border-red-500/70'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4 mt-2">
                    <div className="min-w-0 pr-4">
                      <h3 className="text-lg font-bold text-white truncate">{app.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 font-bold uppercase tracking-widest text-muted-foreground">
                          {app.type}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{app.appLanguage}</span>
                      </div>
                    </div>
                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(app.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all"
                      title="Remove record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <a
                    href={app.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-primary transition-colors mb-4 truncate group/repo"
                  >
                    <GitBranch className="w-3.5 h-3.5 group-hover/repo:scale-110 transition-transform" />
                    {app.repoUrl?.replace('https://github.com/', '') || 'No Repository'}
                  </a>

                  <div className="space-y-4 mb-5">
                    {/* CPU Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Cpu className="w-3 h-3" />
                          CPU Load
                        </span>
                        <span className={`font-bold ${cpu > 85 ? 'text-red-500' : 'text-foreground'}`}>{cpu.toFixed(1)}%</span>
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${getProgressColor(cpu)}`} style={{ width: `${cpu}%` }} />
                      </div>
                    </div>

                    {/* RAM Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Activity className="w-3 h-3" />
                          Memory
                        </span>
                        <span className={`font-bold ${ram > 85 ? 'text-red-500' : 'text-foreground'}`}>{ram.toFixed(1)}%</span>
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${getProgressColor(ram)}`} style={{ width: `${ram}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto border-t border-white/5 pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full bg-${statusColor}-500 ${app.status === 'DEPLOYING' ? 'animate-ping' : ''}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-widest text-${statusColor}-500`}>
                          {app.status}
                        </span>
                      </div>
                      {app.lastDeployedAt && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(app.lastDeployedAt).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`flex-1 h-8 text-[11px] bg-black/20 border-white/5 hover:border-white/20 ${
                          app.status === 'FAILED' ? 'border-red-500/30 hover:border-red-500/60 text-red-400' : ''
                        }`}
                        onClick={() => handleViewLogs(app)}
                      >
                        {app.status === 'FAILED'
                          ? <><AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> View Error</>
                          : <><Terminal className="w-3.5 h-3.5 mr-1.5" /> Logs</>
                        }
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-[11px] bg-black/20 border-white/5 hover:border-white/20"
                        disabled={app.status === 'DEPLOYING'}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${app.status === 'DEPLOYING' ? 'animate-spin' : ''}`} />
                        {app.status === 'DEPLOYING' ? 'Deploying...' : 'Restart'}
                      </Button>
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
              {isAdmin && (
                <Button onClick={() => setIsDeployModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Deploy Application
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <DeployApplicationModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        onDeploy={handleDeploy}
      />

      {/* Deployment Log Viewer Modal */}
      {logModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-3xl bg-[#080809] border-white/10 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
            {/* Top accent line */}
            <div className={`h-0.5 w-full ${logData?.status === 'FAILED' ? 'bg-gradient-to-r from-red-500 to-rose-500' : logData?.status === 'SUCCESS' ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-amber-500 to-yellow-400'}`} />
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-5 pt-5">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${logData?.status === 'FAILED' ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                  <Terminal className={`w-5 h-5 ${logData?.status === 'FAILED' ? 'text-red-400' : 'text-primary'}`} />
                </div>
                <div>
                  <CardTitle className="text-lg">Deployment Log</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-bold text-white">{logModal.appName}</span>
                    {logData?.executedAt && ` · ${new Date(logData.executedAt).toLocaleString()}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {logData && (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    logData.status === 'FAILED' ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : logData.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {logData.status === 'FAILED'
                      ? <AlertTriangle className="w-3 h-3" />
                      : logData.status === 'SUCCESS'
                      ? <CheckCircle2 className="w-3 h-3" />
                      : <Loader2 className="w-3 h-3 animate-spin" />}
                    {logData.status}
                  </div>
                )}
                <button onClick={() => setLogModal(null)} className="p-1.5 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {logLoading ? (
                <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm">Fetching deployment log...</span>
                </div>
              ) : (
                <pre className="p-5 text-[11px] font-mono text-green-300/80 leading-relaxed overflow-auto max-h-[60vh] bg-black/60 whitespace-pre-wrap break-words">
                  {logData?.log || 'No output captured.'}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ApplicationsPage;
