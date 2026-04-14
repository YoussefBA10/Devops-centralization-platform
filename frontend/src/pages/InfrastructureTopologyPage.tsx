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
import api from '../services/api';
import { useEnvironment } from '../context/EnvironmentContext';
import type { TopologyData, Node as TopologyNode } from '../types/index';
import { Card } from '../components/ui/Card';
import { Button, Input } from '../components/ui/Input';

// Custom Node Component
const ServerNode = ({ data }: { data: TopologyNode }) => {
  const isHealthy = data.status !== 'CRITICAL' && (data.cpu || 0) < 90;
  
  return (
    <div className={`px-4 py-3 shadow-2xl rounded-xl border-2 transition-all duration-300 w-64 bg-card/80 backdrop-blur-md ${
      isHealthy ? 'border-primary/20 hover:border-primary/50' : 'border-destructive/50 hover:border-destructive shadow-destructive/10'
    }`}>
      <Handle type="target" position={Position.Top} className="!bg-primary/50" />
      
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${isHealthy ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
          {data.type === 'db-server' ? <Database className="w-5 h-5" /> : <Server className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{data.id}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{data.ip}</p>
        </div>
        {isHealthy ? <Zap className="w-4 h-4 text-emerald-500 fill-emerald-500/20" /> : <Activity className="w-4 h-4 text-destructive animate-pulse" />}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Cpu className="w-3 h-3" />
            CPU
          </span>
          <span className={`font-bold ${data.cpu! > 80 ? 'text-destructive' : 'text-foreground'}`}>{data.cpu}%</span>
        </div>
        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${data.cpu! > 80 ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${data.cpu}%` }}
          ></div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
         <div className="flex items-center gap-2">
           <Shield className="w-3 h-3 text-primary/50" />
           <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Encrypted</span>
         </div>
         <span className={`text-[10px] font-bold uppercase ${isHealthy ? 'text-emerald-500/80' : 'text-destructive'}`}>
            {data.status || (isHealthy ? 'Healthy' : 'Error')}
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
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [loading, setLoading] = useState(false);

  const fetchTopology = useCallback(async () => {
    if (!selectedEnvironment) return;
    setLoading(true);
    try {
      const response = await api.get<TopologyData>(`/infrastructure/topology?environmentId=${selectedEnvironment.id}`);
      const data = response.data;

      // Transform backend nodes to React Flow nodes with positioning
      const flowNodes = data.nodes.map((node, i) => ({
        id: node.id,
        type: 'serverNode',
        data: node,
        position: { x: (i % 3) * 350, y: Math.floor(i / 3) * 250 },
      }));

      // Transform backend edges
      const flowEdges = data.edges.map((edge, i) => ({
        id: `e-${i}`,
        source: edge.source,
        target: edge.target,
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2, opacity: 0.5 },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (error) {
      console.error('Failed to fetch topology', error);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment, setNodes, setEdges]);

  useEffect(() => {
    fetchTopology();
    const interval = setInterval(fetchTopology, 15000); // 15s refresh for metrics
    return () => clearInterval(interval);
  }, [fetchTopology]);

  return (
    <div className="h-full flex flex-col relative animate-in fade-in duration-700">
      {/* Topology Header Panel */}
      <div className="absolute top-8 left-8 z-10 w-80 space-y-4">
        <Card className="bg-card/80 backdrop-blur-xl border-white/10 shadow-2xl">
          <div className="p-6">
            <h1 className="text-2xl font-bold tracking-tight">Cluster Graph</h1>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-bold">
              {selectedEnvironment?.name} Infrastructure
            </p>
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Nodes</span>
                <span className="font-bold">{nodes.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active Connections</span>
                <span className="font-bold">{edges.length}</span>
              </div>
              <div className="h-px bg-border my-2"></div>
              <Button className="w-full" size="sm" onClick={fetchTopology} loading={loading}>
                <RefreshCw className="w-3 h-3" />
                Rescan Topology
              </Button>
            </div>
          </div>
        </Card>

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input placeholder="Find node by ID or IP..." className="pl-10 bg-card/80 backdrop-blur-xl border-white/10 shadow-xl h-11" />
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
