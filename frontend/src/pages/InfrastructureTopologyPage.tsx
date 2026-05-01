import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Database,
  Cpu,
  Zap,
  Shield,
  RefreshCw,
  Search,
  Activity,
  HardDrive,
  Layers,
  LayoutGrid,
  Network,
  Box
} from 'lucide-react';
import { getAllInfrastructureTopology, getGlobalInfrastructureStats } from '../services/api';
import type { Node as TopologyNode, ClusterGroup, EnvironmentGroup } from '../types/index';
import { Card } from '../components/ui/Card';
import { Button, Input } from '../components/ui/Input';

// Custom Progress Bar with thresholds
const MetricProgress: React.FC<{ label: string; value: number; icon: React.ReactNode; unit?: string }> = ({ label, value, icon, unit = '%' }) => {
  const getProgressColor = (val: number) => {
    if (val < 70) return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]';
    if (val < 85) return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]';
    return 'bg-destructive shadow-[0_0_10px_rgba(239,68,68,0.3)]';
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.15em] font-bold">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className={value > 85 ? 'text-destructive' : 'text-foreground'}>{value}{unit}</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${getProgressColor(value)}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        ></div>
      </div>
    </div>
  );
};

// Node Card Component
const NodeCard = ({ node }: { node: TopologyNode }) => {
  const isHealthy = node.status === 'HEALTHY';

  return (
    <Card className={`group relative overflow-hidden transition-all duration-300 border-white/5 hover:border-primary/30 bg-[#0c0c0e]/60 backdrop-blur-md ${
      !isHealthy ? 'ring-1 ring-destructive/20' : ''
    }`}>
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isHealthy ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'} group-hover:scale-110 transition-transform`}>
              {node.type === 'db-server' ? <Database className="w-5 h-5" /> : <Server className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold truncate tracking-tight">{node.label}</h4>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest">{node.ip}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
              isHealthy ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 'border-destructive/30 text-destructive bg-destructive/5'
            }`}>
              {node.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 pt-2">
          <MetricProgress label="CPU" value={node.cpu || 0} icon={<Cpu className="w-3 h-3" />} />
          <MetricProgress label="Memory" value={node.ram || 0} icon={<Activity className="w-3 h-3" />} />
          <MetricProgress label="Storage" value={node.disk || 0} icon={<HardDrive className="w-3 h-3" />} />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-[8px] text-muted-foreground uppercase font-bold tracking-tighter">
            <Shield className="w-2.5 h-2.5 opacity-30" />
            VLSecure Layer
          </div>
          <Zap className={`w-3 h-3 ${isHealthy ? 'text-emerald-500 animate-pulse' : 'text-muted-foreground opacity-20'}`} />
        </div>
      </div>
    </Card>
  );
};

// Environment Box
const EnvironmentBox = ({ env }: { env: EnvironmentGroup }) => (
  <div className="space-y-4 p-5 rounded-2xl bg-white/[0.02] border border-white/5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground/80">{env.name}</h3>
      </div>
      <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
        {env.nodes.length} Nodes
      </span>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {env.nodes.map(node => <NodeCard key={node.id} node={node} />)}
    </div>
  </div>
);

// Cluster Box
const ClusterBox = ({ cluster }: { cluster: ClusterGroup }) => (
  <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
    <div className="flex items-center gap-4">
      <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
        <Layers className="w-6 h-6 text-primary" />
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{cluster.name}</h2>
        <p className="text-sm text-muted-foreground italic">{cluster.description}</p>
      </div>
    </div>
    <div className="grid grid-cols-1 gap-8 pl-4 border-l-2 border-primary/10">
      {cluster.environments.map(env => <EnvironmentBox key={env.id} env={env} />)}
    </div>
  </div>
);

const InfrastructureOverview: React.FC = () => {
  const [data, setData] = useState<ClusterGroup[]>([]);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [topoRes, statsRes] = await Promise.all([
        getAllInfrastructureTopology(),
        getGlobalInfrastructureStats()
      ]);
      setData(topoRes.data.clusters || []);
      setGlobalStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch global infrastructure', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 20000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredClusters = data.map(cluster => ({
    ...cluster,
    environments: cluster.environments.filter(env => 
      env.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      env.nodes.some(n => n.label?.toLowerCase().includes(searchQuery.toLowerCase()) || n.ip?.includes(searchQuery))
    )
  })).filter(cluster => cluster.environments.length > 0);

  return (
    <div className="p-8 space-y-12 animate-in fade-in duration-700 min-h-screen bg-[#0a0a0b]">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-primary mb-2">
            <LayoutGrid className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-[0.3em] font-mono">Infrastructure Core</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white">Global Topology</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Hierarchical mapping of distributed compute clusters and micro-environments.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
           <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Filter by environment or IP..." 
              className="w-72 pl-10 h-12 bg-card/30 border-white/5 focus:border-primary/50 transition-all rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-12 px-6 rounded-xl border-white/5 hover:bg-white/5 gap-2" onClick={fetchData} loading={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Global Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Compute Clusters', value: data.length, icon: Layers, color: 'text-primary' },
          { label: 'Active Agents', value: globalStats?.activeAgents || 0, icon: Network, color: 'text-emerald-500' },
          { label: 'System Health', value: globalStats?.avgStability ? `${globalStats.avgStability.toFixed(1)}%` : '99.9%', icon: Shield, color: 'text-blue-500' },
          { label: 'Network Load', value: globalStats?.networkLoad ? `${globalStats.networkLoad.toFixed(1)} Mbps` : 'Nominal', icon: Zap, color: 'text-amber-500' }
        ].map((stat, i) => (
          <Card key={i} className="bg-white/[0.02] border-white/5 overflow-hidden group hover:border-primary/20 transition-all">
            <div className="p-4 flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-white/[0.03] ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{stat.label}</p>
                <p className="text-xl font-bold">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Main Content Area */}
      {loading && data.length === 0 ? (
        <div className="h-[50vh] flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-muted-foreground animate-pulse font-mono uppercase tracking-widest text-xs">Initializing Neural Map...</p>
        </div>
      ) : (
        <div className="space-y-16">
          {filteredClusters.length > 0 ? (
            filteredClusters.map(cluster => <ClusterBox key={cluster.id} cluster={cluster} />)
          ) : (
            <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
              <Box className="w-12 h-12 text-muted-foreground opacity-20 mb-4" />
              <p className="text-muted-foreground font-medium">No infrastructure matches your search criteria.</p>
            </div>
          )}
        </div>
      )}

      {/* Footer Info */}
      <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Monetique Eye Core v4.2.0</span>
        </div>
        <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest">
          <span>Real-time Stream: Active</span>
          <span>Latency: 14ms</span>
          <span>Region: Global</span>
        </div>
      </div>
    </div>
  );
};

export default InfrastructureOverview;
