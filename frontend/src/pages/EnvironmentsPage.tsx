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
  X,
  Trash2
} from 'lucide-react';
import api, { getEnvironmentStats, getEnvironmentResources, getEnvironmentNodes } from '../services/api';
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteEnvModal, setShowDeleteEnvModal] = useState(false);
  const { environments, refreshEnvironments, createEnvironment, updateEnvironment, deleteEnvironment, loading: envLoading } = useEnvironment();
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
  const [editEnvData, setEditEnvData] = useState({ name: '', description: '', prometheusLabel: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deploymentLoading, setDeploymentLoading] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  // Tracks which environment is currently deploying to which IP
  const [activeDeployments, setActiveDeployments] = useState<Record<number, string>>({});

  const [undeployIp, setUndeployIp] = useState<string | null>(null);
  const [undeployUser, setUndeployUser] = useState('root');
  const [undeployPassword, setUndeployPassword] = useState('');
  const [undeployLoading, setUndeployLoading] = useState(false);

  const handleUndeploy = async () => {
    if (!selectedEnv || !undeployIp) return;
    setUndeployLoading(true);
    try {
      await api.delete(`/environments/${selectedEnv.id}/nodes/${undeployIp}`, { 
        data: { sshUser: undeployUser, sshPassword: undeployPassword } 
      });
      // Optimistically remove from list
      setNodes(prev => prev.filter(n => n.ip !== undeployIp));
      setUndeployIp(null);
      setUndeployUser('root');
      setUndeployPassword('');
    } catch (e) {
      console.error('Failed to undeploy', e);
      alert('Failed to initialize undeployment.');
    } finally {
      setUndeployLoading(false);
    }
  };

  const handleDeleteEnv = async () => {
    if (!selectedEnv) return;
    setCreateLoading(true);
    try {
      await deleteEnvironment(selectedEnv.id);
      setShowDeleteEnvModal(false);
      setSelectedEnv(null);
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Delete failed');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnv) return;
    setCreateLoading(true);
    try {
      await updateEnvironment(selectedEnv.id, editEnvData);
      setShowEditModal(false);
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Update failed');
    } finally {
      setCreateLoading(false);
    }
  };

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

  const handleDeployAgent = async (targetIp: string, sshUser: string, sshPassword: string) => {
    if (!selectedEnv) return;
    setDeploymentLoading(true);
    setDeploymentError(null);
    try {
      await api.post(`/environments/${selectedEnv.id}/deploy-agent`, { targetIp, sshUser, sshPassword });
      
      // Notify the specific card to start its internal polling
      setActiveDeployments(prev => ({ ...prev, [selectedEnv.id]: targetIp }));
      
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
          <Button className="h-11 px-6 shadow-lg shadow-primary/20" onClick={() => {
            setCreateError(null);
            setShowCreateModal(true);
          }}>
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
          return (
            <EnvironmentCard
              key={env.id}
              env={env}
              resources={res}
              activeDeploymentIp={activeDeployments[env.id]}
              onRefresh={fetchData}
              onNodesClick={() => handleFetchNodes(env)}
              onDeployClick={() => {
                setSelectedEnv(env);
                setShowDeployModal(true);
              }}
              onEdit={() => {
                setSelectedEnv(env);
                setEditEnvData({ name: env.name, description: env.description || '', prometheusLabel: env.prometheusLabel || '' });
                setCreateError(null);
                setShowEditModal(true);
              }}
              onDelete={() => {
                setSelectedEnv(env);
                setCreateError(null);
                setShowDeleteEnvModal(true);
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
                  Node Inventory: {selectedEnv.prometheusLabel}
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
                <div className="divide-y divide-white/5">
                  {nodes.map((node: any, i) => (
                    <div key={i} className="flex flex-col">
                      <div className="flex items-center justify-between px-6 py-5 hover:bg-white/[0.02] transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full ${node.status === "Online" ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-destructive'}`}></div>
                          <div className="flex flex-col gap-1">
                            <span className="text-base font-bold text-white flex items-center gap-3">
                              {node.nodeName}
                              <span className="text-sm font-mono text-muted-foreground bg-white/5 px-2 py-0.5 rounded-md">
                                {node.ip}
                              </span>
                              <span className="text-[10px] py-0.5 px-2 bg-primary/10 text-primary rounded-full border border-primary/20 uppercase tracking-widest">
                                Machine
                              </span>
                            </span>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Status: <span className={node.status === "Online" ? 'font-bold text-emerald-500' : 'font-bold text-destructive'}>{node.status}</span></span>
                              <span className="w-1 h-1 rounded-full bg-white/20"></span>
                              <span>Label: <span className="font-mono text-primary/80 px-1 py-0.5 bg-primary/10 rounded">{selectedEnv.prometheusLabel}</span></span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="rounded-lg gap-2"
                            onClick={() => {
                              const detailRow = document.getElementById(`services-${i}`);
                              if (detailRow) detailRow.classList.toggle('hidden');
                            }}
                          >
                            <Activity className="w-4 h-4" />
                            See Services ({node.services?.length || 0})
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-lg text-destructive hover:text-red-400 hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUndeployIp(node.ip);
                            }}
                            title="Undeploy Node"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Services Detail Row */}
                      <div id={`services-${i}`} className="hidden bg-black/40 border-y border-white/5 animate-in slide-in-from-top-2 duration-300">
                        <div className="px-12 py-4">
                          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Node Runtime Services</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {node.services?.map((service: any, si: number) => (
                              <div key={si} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full ${service.status === "Online" ? 'bg-emerald-500' : 'bg-destructive'}`}></div>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-bold">{service.name}</span>
                                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{service.type}</span>
                                  </div>
                                </div>
                                <span className={`text-[10px] font-bold ${service.status === "Online" ? 'text-emerald-500' : 'text-destructive'}`}>
                                  {service.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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

      {/* Edit Environment Modal */}
      {showEditModal && selectedEnv && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/95 backdrop-blur-xl" onClick={() => setShowEditModal(false)}></div>
          <Card className="w-full max-w-lg relative z-10 shadow-3xl border-white/10 overflow-hidden">
             <CardHeader className="pb-8">
              <CardTitle className="text-2xl">Edit Environment</CardTitle>
              <CardDescription>Update logical infrastructure container details.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEditEnv} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Name</label>
                  <Input value={editEnvData.name} onChange={e => setEditEnvData({...editEnvData, name: e.target.value})} placeholder="e.g. Staging VPC" required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</label>
                  <Input value={editEnvData.description} onChange={e => setEditEnvData({...editEnvData, description: e.target.value})} placeholder="Short description..." required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Prometheus Label</label>
                  <Input value={editEnvData.prometheusLabel} onChange={e => setEditEnvData({...editEnvData, prometheusLabel: e.target.value})} placeholder="e.g. staging" required />
                </div>
                {createError && <p className="text-xs text-destructive bg-destructive/5 p-3 rounded-lg border border-destructive/10">{createError}</p>}
                <div className="flex gap-4 pt-4">
                  <Button variant="ghost" className="flex-1" type="button" onClick={() => setShowEditModal(false)}>Cancel</Button>
                  <Button className="flex-1" type="submit" loading={createLoading}>Save Changes</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
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

      {/* Delete Environment Confirmation Modal */}
      {showDeleteEnvModal && selectedEnv && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md bg-black/90 border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-white/5 pb-6">
              <CardTitle className="text-xl flex items-center gap-3 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Delete Environment
              </CardTitle>
              <CardDescription className="mt-2 text-muted-foreground leading-relaxed">
                Are you sure you want to delete <span className="text-white font-bold">{selectedEnv.name}</span>? This will permanently remove all associated metadata, tickets, and application records. 
                <br /><br />
                <span className="text-amber-500 font-semibold text-xs uppercase tracking-wider">Note: Remote agents will not be uninstalled.</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex gap-4">
                <Button variant="ghost" className="flex-1" onClick={() => setShowDeleteEnvModal(false)}>Cancel</Button>
                <Button 
                  className="flex-1 bg-destructive hover:bg-destructive/90 text-white" 
                  onClick={handleDeleteEnv}
                  loading={createLoading}
                >
                  Confirm Delete
                </Button>
              </div>
              {createError && <p className="text-xs text-destructive mt-4">{createError}</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Undeploy Confirmation Modal */}
      {undeployIp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md bg-black/90 border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-white/5 pb-6">
              <CardTitle className="text-xl flex items-center gap-3 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Undeploy Node
              </CardTitle>
              <CardDescription className="mt-2 text-muted-foreground leading-relaxed">
                You are about to sever observability for <span className="font-mono text-white bg-white/10 px-1 rounded">{undeployIp}</span>. This will stop the agents and remove the backend's SSH access key.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Confirm SSH User</label>
                  <p className="text-[10px] text-muted-foreground mb-2">We need the SSH username to connect and run the cleanup playbook.</p>
                  <Input 
                    value={undeployUser} 
                    onChange={e => setUndeployUser(e.target.value)} 
                    placeholder="root" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">SSH Password / Sudo Password</label>
                  <p className="text-[10px] text-muted-foreground mb-2">Required if public key authentication is not configured on the remote node.</p>
                  <Input 
                    type="password"
                    value={undeployPassword} 
                    onChange={e => setUndeployPassword(e.target.value)} 
                    placeholder="••••••••" 
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <Button variant="ghost" className="flex-1" onClick={() => setUndeployIp(null)}>Cancel</Button>
                  <Button 
                    className="flex-1 bg-destructive hover:bg-destructive/90 text-white" 
                    onClick={handleUndeploy} 
                    loading={undeployLoading}
                  >
                    Confirm Undeploy
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};



export default EnvironmentsPage;

