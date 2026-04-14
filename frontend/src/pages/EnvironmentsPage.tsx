import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Terminal, 
  RefreshCw, 
  Server, 
  ShieldCheck, 
  Cpu, 
  CheckCircle2,
  AlertCircle,
  Activity,
  Globe,
  Settings,
  MoreVertical,
  ArrowUpRight
} from 'lucide-react';
import api from '../services/api';
import type { Environment } from '../types/index';
import { useEnvironment } from '../context/EnvironmentContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button, Input } from '../components/ui/Input';

const EnvironmentsPage: React.FC = () => {
  const { environments, refreshEnvironments, loading } = useEnvironment();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [selectedEnvForDeploy, setSelectedEnvForDeploy] = useState<Environment | null>(null);
  
  // Deployment Form State
  const [targetIp, setTargetIp] = useState('');
  const [sshUser, setSshUser] = useState('root');
  const [deploymentLoading, setDeploymentLoading] = useState(false);
  const [deploymentMessage, setDeploymentMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const filteredEnvs = environments.filter(env => 
    env.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    env.prometheusLabel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeployAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnvForDeploy) return;
    
    setDeploymentLoading(true);
    setDeploymentMessage(null);
    
    try {
      const response = await api.post(`/environments/${selectedEnvForDeploy.id}/deploy-agent`, {
        targetIp,
        sshUser
      });
      setDeploymentMessage({ type: 'success', text: response.data.message });
      refreshEnvironments();
    } catch (error: any) {
      setDeploymentMessage({ type: 'error', text: error.response?.data?.message || 'Deployment failed' });
    } finally {
      setDeploymentLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Environments</h1>
          <p className="text-muted-foreground mt-2 text-lg">Manage and provision your distributed infrastructure environments.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Filter environments..." 
              className="w-64 pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button>
            <Plus className="w-4 h-4" />
            Create New
          </Button>
          <Button variant="outline" size="icon" onClick={refreshEnvironments} loading={loading}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Regions</p>
              <p className="text-2xl font-bold">{environments.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/10">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Agents</p>
              <p className="text-2xl font-bold">14</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/10">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <Activity className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Health Avg</p>
              <p className="text-2xl font-bold">98.2%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Environments Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredEnvs.map((env) => (
          <Card key={env.id} className="group hover:border-primary/50 transition-all overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <Server className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      {env.name}
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider">
                        Production
                      </span>
                    </CardTitle>
                    <CardDescription className="mt-1">{env.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-4 border-y border-border py-4">
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Prometheus Label</p>
                  <p className="text-sm font-mono mt-1 text-primary">{env.prometheusLabel}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Nodes Active</p>
                  <p className="text-sm mt-1">4 Nodes</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Uptime</p>
                  <p className="text-sm mt-1 text-emerald-500">99.99%</p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Security Hardened
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-primary" />
                    Auto-scaling
                  </span>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => {
                    setSelectedEnvForDeploy(env);
                    setShowDeployModal(true);
                  }}
                >
                  Deploy Node
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Deployment Modal (Simplified for the page) */}
      {showDeployModal && selectedEnvForDeploy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowDeployModal(false)}></div>
          <Card className="w-full max-w-lg relative z-10 shadow-2xl border-white/10">
            <CardHeader>
              <CardTitle>Provision Node: {selectedEnvForDeploy.name}</CardTitle>
              <CardDescription>Trigger an Ansible-driven agent deployment to a remote endpoint.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDeployAgent} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Host (IP / Domain)</label>
                  <Input 
                    placeholder="192.168.1.10" 
                    value={targetIp} 
                    onChange={(e) => setTargetIp(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">SSH User</label>
                  <Input 
                    placeholder="root" 
                    value={sshUser} 
                    onChange={(e) => setSshUser(e.target.value)}
                    required
                  />
                </div>

                {deploymentMessage && (
                  <div className={`p-4 rounded-lg flex items-start gap-3 border ${
                    deploymentMessage.type === 'success' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                      : 'bg-destructive/10 border-destructive/20 text-destructive'
                  }`}>
                    {deploymentMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                    <span className="text-sm font-medium">{deploymentMessage.text}</span>
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-4">
                  <Button variant="outline" type="button" onClick={() => setShowDeployModal(false)}>Cancel</Button>
                  <Button type="submit" loading={deploymentLoading}>
                    Start Deployment
                  </Button>
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
