import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Handle,
  Position,
  type Node as FlowNode,
  type Edge as FlowEdge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Server,
  Database,
  Cpu,
  Shield,
  RefreshCw,
  Search,
  Activity,
  HardDrive,
  Layers,
  Network,
  Box,
  Maximize2,
  XCircle
} from 'lucide-react';
import { getAllInfrastructureTopology, getGlobalInfrastructureStats } from '../services/api';
import type { Node as TopologyNode, ClusterGroup } from '../types/index';
import { Card } from '../components/ui/Card';
import { Button, Input } from '../components/ui/Input';

// --- Custom Progress Bar ---
const MetricProgress: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => {
  const getProgressColor = (val: number) => {
    if (val < 70) return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]';
    if (val < 85) return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]';
    return 'bg-destructive shadow-[0_0_10px_rgba(239,68,68,0.3)]';
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[8px] uppercase tracking-widest font-bold">
        <span className="flex items-center gap-1 text-muted-foreground">{icon}{label}</span>
        <span className={value > 85 ? 'text-destructive' : 'text-foreground'}>{value}%</span>
      </div>
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${getProgressColor(value)}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        ></div>
      </div>
    </div>
  );
};

// --- Custom Node Components ---

const ClusterGroupNode = ({ data }: any) => (
  <div className="w-full h-full border-2 border-dashed border-primary/20 bg-primary/5 rounded-[2.5rem] p-8 backdrop-blur-xl pointer-events-none">
    <div className="flex items-center gap-4 mb-4 opacity-100">
      <Layers className="w-8 h-8 text-primary" />
      <span className="text-2xl font-black uppercase tracking-[0.4em] text-white">{data.label}</span>
    </div>
  </div>
);

const EnvironmentGroupNode = ({ data }: any) => (
  <div className="w-full h-full border-2 border-white/5 bg-white/[0.02] rounded-[2rem] p-6 backdrop-blur-md pointer-events-none">
    <div className="flex items-center gap-3 mb-3 opacity-100">
      <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></div>
      <span className="text-sm font-bold uppercase tracking-[0.2em] text-white">{data.label}</span>
    </div>
  </div>
);

const ServerNode = ({ data }: { data: TopologyNode }) => {
  const isHealthy = data.status === 'HEALTHY';
  
  return (
    <div className={`p-5 shadow-2xl rounded-[1.5rem] border-2 transition-all duration-300 w-72 bg-[#0c0c0e]/95 backdrop-blur-xl ${
      isHealthy 
      ? 'border-emerald-500/20 hover:border-emerald-500/50 hover:shadow-[0_0_40px_rgba(16,185,129,0.15)]' 
      : 'border-destructive/40 hover:border-destructive shadow-[0_0_40px_rgba(239,68,68,0.15)]'
    }`}>
      <Handle type="target" position={Position.Top} className="!bg-primary/50" />
      
      <div className="flex items-center gap-4 mb-5">
        <div className={`p-2.5 rounded-xl ${isHealthy ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
          {data.type === 'db-server' ? <Database className="w-6 h-6" /> : <Server className="w-6 h-6" />}
        </div>
        <div className="min-w-0">
          <p className="text-base font-black truncate tracking-tight">{data.label}</p>
          <p className="text-[10px] font-mono text-muted-foreground/60 tracking-wider uppercase">{data.ip}</p>
        </div>
      </div>

      <div className="space-y-4">
        <MetricProgress label="Compute" value={data.cpu || 0} icon={<Cpu className="w-3 h-3" />} />
        <MetricProgress label="Memory" value={data.ram || 0} icon={<Activity className="w-3 h-3" />} />
        <MetricProgress label="Storage" value={data.disk || 0} icon={<HardDrive className="w-3 h-3" />} />
      </div>

      <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 opacity-30 grayscale group">
          <Shield className="w-3 h-3 group-hover:text-primary transition-colors" />
          <span className="text-[9px] font-bold uppercase tracking-widest">Secured</span>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest ${isHealthy ? 'text-emerald-500' : 'text-destructive animate-pulse'}`}>
          {data.status}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-primary/50" />
    </div>
  );
};

const nodeTypes = {
  cluster: ClusterGroupNode,
  environment: EnvironmentGroupNode,
  server: ServerNode,
};

// -----------------------------------------------------------------------
// Inner component — must live INSIDE ReactFlowProvider to use useReactFlow
// -----------------------------------------------------------------------
const InfrastructureGraphInner: React.FC = () => {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [foundNodeId, setFoundNodeId] = useState<string | null>(null);

  const transformToFlow = useCallback((clusters: ClusterGroup[]) => {
    const newNodes: FlowNode[] = [];
    const newEdges: FlowEdge[] = [];

    let currentX = 0;

    clusters.forEach((cluster) => {
      const clusterId = `cluster-${cluster.id}`;
      
      const envCount = cluster.environments.length;
      const clusterWidth = Math.max(1200, envCount * 450 + 100);
      const clusterHeight = 1100;

      newNodes.push({
        id: clusterId,
        type: 'cluster',
        data: { label: cluster.name },
        position: { x: currentX, y: 0 },
        style: { width: clusterWidth, height: clusterHeight },
        selectable: false,
        draggable: true,
      });

      let envX = 50;
      cluster.environments.forEach((env) => {
        const envId = `env-${env.id}`;
        const envWidth = 400;
        const envHeight = 900;

        newNodes.push({
          id: envId,
          parentId: clusterId,
          type: 'environment',
          data: { label: env.name },
          position: { x: envX, y: 100 },
          style: { width: envWidth, height: envHeight },
          extent: 'parent',
          draggable: false,
        });

        env.nodes.forEach((node, nodeIdx) => {
          const nodeId = node.id;
          newNodes.push({
            id: nodeId,
            parentId: envId,
            type: 'server',
            data: { ...node },
            position: { x: 60, y: 80 + nodeIdx * 270 },
            extent: 'parent',
          });

          if (!node.id.includes('central')) {
             const centralNode = env.nodes.find(n => n.id.includes('central'));
             if (centralNode) {
               newEdges.push({
                 id: `e-${node.id}-${centralNode.id}`,
                 source: node.id,
                 target: centralNode.id,
                 animated: true,
                 style: { stroke: '#3b82f6', strokeWidth: 2, opacity: 0.2 },
               });
             }
          }
        });

        envX += envWidth + 50;
      });

      currentX += clusterWidth + 300;
    });

    return { newNodes, newEdges };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [topoRes, statsRes] = await Promise.all([
        getAllInfrastructureTopology(),
        getGlobalInfrastructureStats()
      ]);
      
      const { newNodes, newEdges } = transformToFlow(topoRes.data.clusters || []);
      setNodes(newNodes);
      setEdges(newEdges);
      setGlobalStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch global infrastructure', error);
    } finally {
      setLoading(false);
    }
  }, [transformToFlow, setNodes, setEdges]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); 
    return () => clearInterval(interval);
  }, [fetchData]);

  const onSearch = (query: string) => {
    setSearchQuery(query);
    setNotFound(false);
    if (!query) {
      setFoundNodeId(null);
      setNodes((nds) => nds.map((node) => ({
        ...node,
        selected: false,
        style: { ...node.style, opacity: 1, boxShadow: undefined },
      })));
      return;
    }
    // dim non-matches live as the user types
    setNodes((nds) => nds.map((node) => {
      if (node.type !== 'server') return node;
      const match =
        node.data.label?.toLowerCase().includes(query.toLowerCase()) ||
        node.data.ip?.includes(query);
      return {
        ...node,
        style: { ...node.style, opacity: match ? 1 : 0.2 },
      };
    }));
  };

  // Called on Enter key or clicking the search button
  const onFindNode = () => {
    const q = searchQuery.trim();
    if (!q) return;

    const matched = nodes.find(
      (node) =>
        node.type === 'server' &&
        (node.data.label?.toLowerCase().includes(q.toLowerCase()) ||
          node.data.ip?.includes(q))
    );

    if (!matched) {
      setNotFound(true);
      setFoundNodeId(null);
      return;
    }

    setNotFound(false);
    setFoundNodeId(matched.id);

    // Select the matched node and deselect all others; apply glow ring
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type !== 'server') return node;
        const isTarget = node.id === matched.id;
        return {
          ...node,
          selected: isTarget,
          style: {
            ...node.style,
            opacity: isTarget ? 1 : 0.15,
            outline: isTarget ? '3px solid #3b82f6' : 'none',
            outlineOffset: '4px',
            borderRadius: isTarget ? '1.5rem' : undefined,
            boxShadow: isTarget
              ? '0 0 40px 10px rgba(59,130,246,0.4)'
              : 'none',
          },
        };
      })
    );

    // Fly camera to the found node
    setTimeout(() => {
      fitView({
        nodes: [{ id: matched.id }],
        duration: 800,
        padding: 0.6,
        minZoom: 0.8,
        maxZoom: 1.5,
      });
    }, 50);
  };

  return (
    <div className="h-full flex flex-col relative animate-in fade-in duration-700 bg-[#0a0a0b]">
      {/* Top Overlay UI */}
      <div className="absolute top-8 left-8 z-10 w-96 space-y-4">
        <Card className="bg-[#0c0c0e]/80 backdrop-blur-xl border-white/5 shadow-3xl p-6">
          <div className="flex items-center gap-3 text-primary mb-3">
             <Network className="w-5 h-5" />
             <span className="text-xs font-black uppercase tracking-[0.3em]">Core Topology</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter">Global Graph</h1>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed opacity-60 font-medium">
            Interactive neural map of distributed clusters. Zoom to inspect metrics, drag clusters to re-organize your perspective.
          </p>
          
          <div className="mt-8 grid grid-cols-2 gap-4">
             <div className="space-y-1 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Agents</p>
                <p className="text-2xl font-black">{globalStats?.activeAgents || 0}</p>
             </div>
             <div className="space-y-1 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Avg Health</p>
                <p className="text-2xl font-black text-emerald-500">{globalStats?.avgStability?.toFixed(1) || 99.9}%</p>
             </div>
          </div>

          <div className="mt-6 flex gap-2">
            <div className="relative flex-1 group">
               <button
                 onClick={onFindNode}
                 className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-0 bg-transparent border-none cursor-pointer text-muted-foreground group-focus-within:text-primary hover:text-primary transition-colors"
                 title="Find node"
               >
                 <Search className="w-4 h-4" />
               </button>
               <Input
                 placeholder="Find node by IP or label..."
                 className="pl-10 pr-9 h-12 bg-white/5 border-white/5 focus:border-primary/40 rounded-xl transition-all font-medium"
                 value={searchQuery}
                 onChange={(e) => onSearch(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') onFindNode(); }}
               />
               {searchQuery && (
                 <button
                   onClick={() => onSearch('')}
                   className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                   title="Clear search"
                 >
                   <XCircle className="w-4 h-4" />
                 </button>
               )}
            </div>
            <Button variant="outline" className="h-12 w-12 p-0 border-white/5 rounded-xl hover:bg-white/5" onClick={fetchData}>
               <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Search feedback */}
          {notFound && searchQuery && (
            <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-bold animate-in slide-in-from-top-2 duration-200">
              <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
              No node found matching &ldquo;{searchQuery}&rdquo;
            </div>
          )}
          {foundNodeId && !notFound && searchQuery && (
            <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-bold animate-in slide-in-from-top-2 duration-200">
              <Search className="w-3.5 h-3.5 flex-shrink-0" />
              Node located — camera centered
            </div>
          )}
        </Card>
      </div>

      {/* Legend & Controls Overlay */}
      <Panel position="bottom-right" className="m-8">
        <div className="flex flex-col gap-4">
          <div className="glass-panel p-5 flex gap-8 items-center rounded-2xl shadow-3xl">
            <div className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.2em]">
              <div className="w-3.5 h-3.5 bg-primary rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
              <span>Cluster Core</span>
            </div>
            <div className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.2em]">
              <div className="w-3.5 h-3.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
              <span>Healthy Link</span>
            </div>
            <div className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-destructive">
              <div className="w-3.5 h-3.5 bg-destructive rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
              <span>Critical Node</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Main Graph Canvas */}
      <div className="flex-1 relative overflow-hidden">
        {loading && nodes.length === 0 && (
           <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#0a0a0b]">
              <div className="w-20 h-20 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.6em] text-primary/60 animate-pulse">Synchronizing Neural Infrastructure...</p>
           </div>
        )}
        
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.05}
          maxZoom={2}
          colorMode="dark"
          suppressHydrationWarning
        >
          <Background color="#1e1e20" gap={40} size={1} />
          <Controls className="!bg-card !border-white/10 !fill-white shadow-3xl !rounded-xl overflow-hidden" />
        </ReactFlow>
      </div>

      {/* Status Footer */}
      <div className="absolute bottom-10 left-10 z-10 flex items-center gap-8 opacity-20 hover:opacity-100 transition-all duration-700">
         <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-[11px] font-black uppercase tracking-[0.5em] text-white/60">Monetique Eye Core v4.2.0</span>
         </div>
         <div className="h-6 w-px bg-white/10"></div>
         <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            <span className="flex items-center gap-2"><Maximize2 className="w-4 h-4" /> Scroll to Zoom</span>
            <span className="flex items-center gap-2"><Box className="w-4 h-4" /> Drag Clusters to Organize</span>
         </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------
// Public export — wraps the inner component in ReactFlowProvider so
// useReactFlow() works inside InfrastructureGraphInner
// -----------------------------------------------------------------------
const InfrastructureTopologyPage: React.FC = () => (
  <ReactFlowProvider>
    <InfrastructureGraphInner />
  </ReactFlowProvider>
);

export default InfrastructureTopologyPage;
