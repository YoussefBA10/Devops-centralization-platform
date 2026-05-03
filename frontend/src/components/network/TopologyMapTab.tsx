import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  MiniMap,
  Controls,
  Background,
  Handle,
  Position,
  getBezierPath,
  BaseEdge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { useEnvironment } from '../../context/EnvironmentContext';
import { useCluster } from '../../context/ClusterContext';
import { getTopology } from '../../services/api';
import { Server, Database, Network, Plus } from 'lucide-react';
import AddLinkModal from './AddLinkModal';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 200;
const nodeHeight = 80;

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'LR') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
    return newNode;
  });

  return { nodes: newNodes, edges };
};

// Custom Node
const CustomVmNode = ({ data }: any) => {
  const isHealthy = data.status === 'HEALTHY';
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-white/5 border-2 ${isHealthy ? 'border-emerald-500/50' : 'border-amber-500/50'} min-w-[200px]`}>
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-muted-foreground" />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {data.role === 'db' ? <Database className="w-5 h-5 mr-2 text-purple-400" /> :
           data.role === 'frontend' ? <Network className="w-5 h-5 mr-2 text-teal-400" /> :
           <Server className="w-5 h-5 mr-2 text-blue-400" />}
          <div>
            <div className="font-bold text-sm text-white">{data.label as React.ReactNode}</div>
            <div className="text-xs text-muted-foreground">{data.ip as React.ReactNode}</div>
          </div>
        </div>
        {typeof data.alertCount === 'number' && data.alertCount > 0 && (
          <div className="flex items-center justify-center bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full">
            {data.alertCount}
          </div>
        )}
      </div>
      
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-muted-foreground" />
    </div>
  );
};

// Custom Edge
const CustomLinkEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: any) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isUp = data?.status === 'UP';
  const color = isUp ? '#10b981' : data?.status === 'DOWN' ? '#ef4444' : '#f59e0b';
  
  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: isUp ? 2 : 3, stroke: color, strokeDasharray: !isUp ? '5,5' : 'none' }} />
      <foreignObject
        width={80}
        height={30}
        x={labelX - 40}
        y={labelY - 15}
        className="edgebutton-foreignobject pointer-events-none"
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <div className="flex items-center justify-center">
          <div className="px-2 py-1 bg-background/80 border border-white/10 rounded text-[10px] text-white">
            {data?.latencyMs ? `${(data.latencyMs as number).toFixed(0)} ms` : 'N/A'}
          </div>
        </div>
      </foreignObject>
    </>
  );
};

const nodeTypes = {
  vmNode: CustomVmNode,
};

const edgeTypes = {
  linkEdge: CustomLinkEdge,
};

const TopologyMapTab: React.FC = () => {
  const { selectedEnvironment } = useEnvironment();
  const { selectedCluster } = useCluster();
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const clusterId = selectedCluster?.id.toString();
    try {
      // Fetch for the entire cluster to show all environments together
      const res = await getTopology(clusterId, undefined);
      const rawNodes = res.data.nodes.map((n: any) => ({
        id: n.id,
        type: 'vmNode',
        data: n,
        position: { x: 0, y: 0 } // initial position before layout
      }));
      
      const rawEdges = res.data.edges.map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'linkEdge',
        data: e,
        animated: e.status === 'DOWN'
      }));

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rawNodes, rawEdges);
      
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load topology graph');
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment, selectedCluster, setNodes, setEdges]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && nodes.length === 0) return <div className="p-4 text-muted-foreground">Loading topology...</div>;
  if (error) return <div className="p-4 text-red-400">{error}</div>;

  return (
    <div className="h-full w-full relative flex flex-col">
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button onClick={fetchData} className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded text-sm text-primary transition-colors">
          Refresh Map
        </button>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-3 py-1.5 bg-primary hover:bg-primary/90 border border-primary/50 rounded text-sm text-white transition-colors flex items-center"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Link
        </button>
        <div className="flex items-center px-3 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-muted-foreground">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      </div>
      
      <div className="flex-1 border border-white/10 rounded-lg overflow-hidden bg-black/20">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="#aaa" gap={16} />
          <Controls />
          <MiniMap 
            nodeColor={(n: any) => n.data?.status === 'HEALTHY' ? '#10b981' : '#f59e0b'}
            maskColor="rgba(0,0,0,0.2)" 
          />
        </ReactFlow>
      </div>

      <AddLinkModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
        clusterId={selectedCluster?.id.toString()}
      />
    </div>
  );
};

export default TopologyMapTab;
