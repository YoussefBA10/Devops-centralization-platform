import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Server,
  Database,
  Cpu,
  Zap,
  Shield,
  RefreshCw,
  Search,
  Activity
} from 'lucide-react';
import { getInfrastructureTopology, getAllInfrastructureTopology, getGlobalInfrastructureStats } from '../services/api';
import { useEnvironment } from '../context/EnvironmentContext';
import { useAuth } from '../context/AuthContext';
import type { Node as TopologyNode } from '../types/index';
import { Card } from '../components/ui/Card';
import { Button, Input } from '../components/ui/Input';



// Custom Node Component
const ServerNode = ({ data }: { data: TopologyNode }) => {
  const isHealthy = data.status === 'HEALTHY';

  // Progress Bar Colors: Blue < 70, Orange 70-85, Red > 85
  const getProgressColor = (val: number) => {
    if (val < 70) return 'bg-blue-500';
    if (val < 85) return 'bg-amber-500';
    return 'bg-destructive';
  };

  return (
    <div className={`px-4 py-3 shadow-2xl rounded-xl border-2 transition-all duration-300 w-80 bg-[#0c0c0e]/90 backdrop-blur-md ${isHealthy
      ? 'border-emerald-500/20 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] shadow-[0_0_10px_rgba(16,185,129,0.05)]'
      : data.status === 'WARNING'
        ? 'border-amber-500/30 hover:border-amber-500/60'
        : 'border-destructive/40 hover:border-destructive shadow-destructive/10'
      }`}>
      <Handle type="target" position={Position.Top} className="!bg-primary/50" />

      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${isHealthy ? 'bg-emerald-500/10 text-emerald-500' : data.status === 'WARNING' ? 'bg-amber-500/10 text-amber-500' : 'bg-destructive/10 text-destructive'}`}>
          {data.type === 'db-server' ? <Database className="w-5 h-5" /> : <Server className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold">{data.label}</p>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{data.ip}</p>
            {data.environmentName && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold uppercase">
                {data.environmentName}
              </span>
            )}
          </div>
        </div>
        {isHealthy ? <Zap className="w-4 h-4 text-emerald-500 fill-emerald-500/20" /> : <Activity className="w-4 h-4 text-destructive animate-pulse" />}
      </div>

      <div className="space-y-4">
        {/* CPU Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Cpu className="w-3 h-3" />
              CPU Load
            </span>
            <span className={`font-bold ${data.cpu! > 85 ? 'text-destructive' : 'text-foreground'}`}>{data.cpu}%</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${getProgressColor(data.cpu!)}`}
              style={{ width: `${data.cpu}%` }}
            ></div>
          </div>
        </div>

        {/* RAM Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Activity className="w-3 h-3" />
              Memory
            </span>
            <span className={`font-bold ${data.ram! > 85 ? 'text-destructive' : 'text-foreground'}`}>{data.ram}%</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${getProgressColor(data.ram!)}`}
              style={{ width: `${data.ram}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-3 h-3 text-white/20" />
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Encrypted Layer</span>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isHealthy ? 'text-emerald-500' : data.status === 'WARNING' ? 'text-amber-500' : 'text-destructive'}`}>
          {data.status}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-primary/50" />
    </div>
  );
};

const nodeTypes = {
  serverNode: ServerNode,
};

const InfrastructureTopologyPage: React.FC = () => {
  const { selectedEnvironment } = useEnvironment();
  const { isAdmin } = useAuth();
  const [viewAllEnvs] = useState(isAdmin);
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [loading, setLoading] = useState(false);
  const [globalStats, setGlobalStats] = useState<any>(null);

  const fetchTopology = useCallback(async () => {
    if (!selectedEnvironment && !viewAllEnvs) return;
    setLoading(true);
    try {
      const fetchCall = (viewAllEnvs && isAdmin)
        ? getAllInfrastructureTopology()
        : getInfrastructureTopology(selectedEnvironment!.id);

      const [topoRes, statsRes] = await Promise.all([
        fetchCall,
        getGlobalInfrastructureStats()
      ]);

      const data = topoRes.data;
      setGlobalStats(statsRes.data);

      // Transform backend nodes with spatial grouping by environment
      const envIds = Array.from(new Set(data.nodes.map((n: any) => n.environmentId?.toString())));

      const flowNodes = data.nodes.map((node: any) => {
        const envIdStr = node.environmentId?.toString();
        const envIndex = envIds.indexOf(envIdStr);
        const nodesInEnv = data.nodes.filter((n: any) => n.environmentId?.toString() === envIdStr);


        // Separate central from agents to make a tree layout

        const agents = nodesInEnv.filter((n: any) => !n.id.includes('central'));
        const isCentral = node.id.includes('central');
        
        let localIndex = agents.indexOf(node);
        if (isCentral) localIndex = -1; // Central node gets special treatment

        // Wider spacing per environment (e.g. 700px gap) to prevent bleeding
        const offsetX = (envIndex >= 0 ? envIndex : 0) * 800;
        
        const spacingX = 450; 
        const spacingY = 380; // Calculated for a balanced triangle

        let posX, posY;
        if (isCentral) {
           const numAgentsInRow = Math.min(agents.length, 3);
           const totalRowWidth = (numAgentsInRow - 1) * spacingX;
           
           posX = offsetX + totalRowWidth / 2; 
           // If we have exactly 2 agents, calculate Y for an equilateral-ish feel
           const verticalOffset = agents.length === 2 ? spacingX * 0.866 : spacingY;
           posY = verticalOffset + Math.floor(Math.max(0, agents.length - 1) / 3) * spacingY;
        } else {
           posX = offsetX + (localIndex % 3) * spacingX; 
           posY = Math.floor(localIndex / 3) * spacingY;
        }

        return {
          id: node.id,
          type: 'serverNode',
          data: {
            ...node,
            environmentName: node.environmentName || selectedEnvironment?.name
          },
          position: { x: posX, y: posY },

        };
      });

      // Transform backend edges
      const flowEdges = data.edges.map((edge: any, i: number) => ({
        id: `e-${i}`,
        source: edge.source,
        target: edge.target,
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 1.5, opacity: 0.3 },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (error) {
      console.error('Failed to fetch topology', error);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment, viewAllEnvs, isAdmin, setNodes, setEdges]);

  useEffect(() => {
    fetchTopology();
    const interval = setInterval(fetchTopology, 15000); // 15s refresh for metrics
    return () => clearInterval(interval);
  }, [fetchTopology]);

  return (
    <div className="h-full flex flex-col relative animate-in fade-in duration-700">
      {/* Topology Header Panel */}
      <div className="absolute top-8 left-8 z-10 w-80 space-y-4">
        <Card className="bg-[#0c0c0e]/80 backdrop-blur-xl border-white/5 shadow-3xl">
          <div className="p-6">
            <h1 className="text-2xl font-bold tracking-tight">Cluster Graph</h1>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-[0.2em] font-bold text-primary">
              {viewAllEnvs ? 'Global Infrastructure' : `${selectedEnvironment?.name} Infrastructure`}
            </p>
            <div className="mt-6 space-y-3">
              {/* Toggle removed for admins as Global view is now mandatory default */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Agents</span>
                <span className="font-bold text-white">{globalStats?.activeAgents || nodes.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active Peers</span>
                <span className="font-bold text-white">{edges.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Network Load</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${globalStats?.networkLoad > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                  <span className={`font-bold ${globalStats?.networkLoad > 50 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {globalStats?.networkLoad ? `${globalStats.networkLoad.toFixed(2)} Mbps` : 'Nominal'}
                  </span>
                </div>
              </div>
              <div className="h-px bg-white/5 my-2"></div>
              <Button className="w-full h-10 transition-all hover:shadow-lg hover:shadow-primary/20" size="sm" onClick={fetchTopology} loading={loading}>
                <RefreshCw className="w-3 h-3 mr-2" />
                Rescan Topology
              </Button>
            </div>
          </div>
        </Card>

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input placeholder="Find node by ID or IP..." className="pl-10 bg-[#0c0c0e]/80 backdrop-blur-xl border-white/5 shadow-2xl h-11 focus:border-primary/50 transition-all" />
        </div>
      </div>

      {/* Legend Panel */}
      <Panel position="bottom-left" className="m-8">
        <div className="glass-panel p-4 flex gap-6 text-[10px] font-bold uppercase tracking-widest items-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary rounded-full"></div>
            <span>App Instance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <span>Healthy Data Flow</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-destructive rounded-full animate-pulse"></div>
            <span>Critical Alert</span>
          </div>
        </div>
      </Panel>

      {/* Flow Canvas */}
      <div className="flex-1 bg-[#0a0a0b] bg-[radial-gradient(#1e1e20_1px,transparent_1px)] [background-size:24px_24px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.5 }}
          colorMode="dark"
          suppressHydrationWarning
        >
          <Background color="#1e1e20" gap={24} />
          <Controls className="!bg-card !border-border !fill-foreground" />
        </ReactFlow>
      </div>
    </div>
  );
};

export default InfrastructureTopologyPage;
