import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Server, 
  CheckCircle2,
  AlertCircle,
  Activity,
  Globe,
  Database,
  X
} from 'lucide-react';
import api, { getEnvironmentStats, getEnvironmentResources, getEnvironmentNodes, getDeploymentStatus } from '../services/api';
import type { Environment } from '../types/index';
import { useEnvironment } from '../context/EnvironmentContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button, Input } from '../components/ui/Input';
import EnvironmentCard from '../components/environment/EnvironmentCard';
import DeployNodeModal from '../components/environment/DeployNodeModal';

interface EnvStats {
  totalEnvironments: number;
  totalActiveNodes: number;
  avgStability: number;
}

interface EnvResources {
  cpuUsage: number;
  ramUsagePercent: number;
  diskUsagePercent: number;
  nodeCount: number;
}



const EnvironmentsPage: React.FC = () => {
  const { environments, refreshEnvironments, createEnvironment, loading: envLoading } = useEnvironment();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNodesModal, setShowNodesModal] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null);
  
  // Monitoring Data State
  const [stats, setStats] = useState<EnvStats | null>(null);
  const [resources, setResources] = useState<Record<number, EnvResources>>({});
  const [nodes, setNodes] = useState<any[]>([]);
  const [nodesLoading, setNodesLoading] = useState(false);

  // Form States
  const [newEnv, setNewEnv] = useState({ name: '', description: '', prometheusLabel: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deploymentLoading, setDeploymentLoading] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  const [activeDeployments, setActiveDeployments] = useState<{envId: number, targetIp: string}[]>([]);
  const [deploymentStatuses, setDeploymentStatuses] = useState<Record<number, 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | null>>({});

  const fetchData = useCallback(async () => {
    try {
      const statsRes = await getEnvironmentStats();
      setStats(statsRes.data);

      const resourcePromises = environments.map(async (env) => {
        try {
          const res = await getEnvironmentResources(env.id);
          return { id: env.id, data: res.data };
        } catch (e) {
          return { id: env.id, data: { cpuUsage: 0, ramUsagePercent: 0, diskUsagePercent: 0, nodeCount: 0 } };
        }
      });

      const resourceResults = await Promise.all(resourcePromises);
      const newResources: Record<number, EnvResources> = {};
      resourceResults.forEach(res => {
        newResources[res.id] = res.data;
      });
      setResources(newResources);
    } catch (error) {
      console.error('Failed to fetch monitoring data', error);
    }
  }, [environments]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleFetchNodes = async (env: Environment) => {
    setSelectedEnv(env);
    setShowNodesModal(true);
    setNodesLoading(true);
    setNodes([]);
    try {
      const response = await getEnvironmentNodes(env.id);
      setNodes(response.data);
    } catch (error) {
      console.error('Failed to fetch nodes', error);
    } finally {
      setNodesLoading(false);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (activeDeployments.length > 0) {
      interval = setInterval(async () => {
        for (const dep of activeDeployments) {
          try {
            const res = await getDeploymentStatus(dep.envId, dep.targetIp);
            if (res.data.status !== 'IN_PROGRESS') {
              setDeploymentStatuses(prev => ({ ...prev, [dep.envId]: res.data.status }));
              setActiveDeployments(prev => prev.filter(d => d.envId !== dep.envId || d.targetIp !== dep.targetIp));
              if (res.data.status === 'SUCCESS') fetchData();
              
              // Clear status after 5 seconds to remove success/fail overlay
              setTimeout(() => {
                setDeploymentStatuses(prev => ({ ...prev, [dep.envId]: null }));
              }, 5000);
            }
          } catch(e) { /* ignore checking errors if not found yet */ }
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeDeployments, fetchData]);

  const handleDeployAgent = async (targetIp: string, sshUser: string, sshPassword: string) => {
    if (!selectedEnv) return;
    setDeploymentLoading(true);
    setDeploymentError(null);
    try {
      await api.post(`/environments/${selectedEnv.id}/deploy-agent`, { targetIp, sshUser, sshPassword });
      setDeploymentStatuses(prev => ({ ...prev, [selectedEnv.id]: 'IN_PROGRESS' }));
      setActiveDeployments(prev => [...prev, { envId: selectedEnv.id, targetIp }]);
      setShowDeployModal(false);
    } catch (error: any) {
      setDeploymentError(error.response?.data?.message || 'Deployment failed to start');
    } finally {
      setDeploymentLoading(false);
    }
  };

  const filteredEnvs = environments.filter(env => 
    env.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    env.prometheusLabel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 text-primary">
            <Globe className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">Global Network</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Environments</h1>
          <p className="text-muted-foreground mt-2 text-lg">Real-time status of your distributed observability infrastructure.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search environments..." 
              className="w-64 pl-10 h-11 bg-card/30 border-white/5"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button className="h-11 px-6 shadow-lg shadow-primary/20" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create New
          </Button>
          <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => { refreshEnvironments(); fetchData(); }} loading={envLoading}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Dynamic Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Globe className="w-24 h-24" />
          </div>
          <CardContent className="p-6 flex items-center gap-4 relative">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Database className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Environments</p>
              <p className="text-3xl font-bold">{stats?.totalEnvironments ?? environments.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Server className="w-24 h-24" />
          </div>
          <CardContent className="p-6 flex items-center gap-4 relative">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Agents</p>
              <p className="text-3xl font-bold">{stats?.totalActiveNodes ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Activity className="w-24 h-24" />
          </div>
          <CardContent className="p-6 flex items-center gap-4 relative">
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <Activity className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Stability</p>
              <p className="text-3xl font-bold">{stats?.avgStability?.toFixed(1) ?? '0.0'}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Environments Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredEnvs.map((env) => {
          const res = resources[env.id] || { cpuUsage: 0, ramUsagePercent: 0, diskUsagePercent: 0, nodeCount: 0 };
          const status = deploymentStatuses[env.id] || null;
          return (
            <EnvironmentCard
              key={env.id}
              env={env}
              resources={res}
              deploymentStatus={status as 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | null}
              onNodesClick={() => handleFetchNodes(env)}
              onDeployClick={() => {
                setSelectedEnv(env);
                setShowDeployModal(true);
              }}
            />
          );
        })}
      </div>

      {/* Nodes Detail Modal */}
      {showNodesModal && selectedEnv && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/90 backdrop-blur-md" onClick={() => setShowNodesModal(false)}></div>
          <Card className="w-full max-w-4xl relative z-10 shadow-3xl border-white/10 bg-[#0c0c0e] animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-emerald-500"></div>
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-6">
              <div>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Server className="w-5 h-5 text-primary" />
                  </div>
                  Node Inventory: {selectedEnv.name}
                </CardTitle>
                <CardDescription className="mt-1">Active observation agents reporting to Prometheus.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setShowNodesModal(false)}>
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
              {nodesLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-4">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-muted-foreground animate-pulse">Scanning infrastructure...</p>
                </div>
              ) : nodes.length > 0 ? (
                <table className="w-full text-left">
                  <thead className="bg-white/5 text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Instance / IP</th>
                      <th className="px-6 py-4">Job</th>
                      <th className="px-6 py-4 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {nodes.map((node, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${node.value === "1" ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-destructive'}`}></div>
                            <span className="text-xs font-bold uppercase tracking-wider">
                              {node.value === "1" ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-sm font-mono font-bold text-primary">{node.metric.instance}</span>
                            <span className="text-[10px] text-muted-foreground">{node.metric.environment || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-xs py-1 px-2.5 bg-secondary rounded-lg border border-white/5">
                            {node.metric.job}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right font-mono text-sm text-muted-foreground">
                          {node.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-20 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-muted/10 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-muted-foreground opacity-30" />
                  </div>
                  <h3 className="text-xl font-bold">No Records Found</h3>
                  <p className="text-muted-foreground max-w-xs mt-2">Prometheus has no heartbeats from this environment yet.</p>
                </div>
              )}
            </CardContent>
            <div className="p-6 bg-[#08080a] border-t border-white/5 flex justify-end">
              <Button onClick={() => { setShowNodesModal(false); setShowDeployModal(true); }}>
                Deploy New Node
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Deploy Modal */}
      {showDeployModal && selectedEnv && (
        <DeployNodeModal
          envName={selectedEnv.name}
          onClose={() => setShowDeployModal(false)}
          onDeploy={handleDeployAgent}
          loading={deploymentLoading}
          error={deploymentError}
        />
      )}

      {/* Create Environment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/95 backdrop-blur-xl" onClick={() => setShowCreateModal(false)}></div>
          <Card className="w-full max-w-lg relative z-10 shadow-3xl border-white/10 overflow-hidden">
             <CardHeader className="pb-8">
              <CardTitle className="text-2xl">Initialize Environment</CardTitle>
              <CardDescription>Create a new logical infrastructure container.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setCreateLoading(true);
                try {
                  await createEnvironment(newEnv);
                  setShowCreateModal(false);
                  setNewEnv({ name: '', description: '', prometheusLabel: '' });
                } catch (err: any) {
                  setCreateError(err.response?.data?.message || 'Creation failed');
                } finally {
                  setCreateLoading(false);
                }
              }} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Name</label>
                  <Input value={newEnv.name} onChange={e => setNewEnv({...newEnv, name: e.target.value})} placeholder="e.g. Staging VPC" required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</label>
                  <Input value={newEnv.description} onChange={e => setNewEnv({...newEnv, description: e.target.value})} placeholder="Short description..." required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Prometheus Label</label>
                  <Input value={newEnv.prometheusLabel} onChange={e => setNewEnv({...newEnv, prometheusLabel: e.target.value})} placeholder="e.g. staging" required />
                </div>
                {createError && <p className="text-xs text-destructive bg-destructive/5 p-3 rounded-lg border border-destructive/10">{createError}</p>}
                <div className="flex gap-4 pt-4">
                  <Button variant="ghost" className="flex-1" type="button" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                  <Button className="flex-1" type="submit" loading={createLoading}>Confirm Setup</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};



export default EnvironmentsPage;

