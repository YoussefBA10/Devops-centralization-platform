import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { Server, Database, Box, Globe, AlertTriangle } from 'lucide-react';
import type { AttackSurfaceData } from '../../types/security';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));
const NODE_W = 200;
const NODE_H = 80;

const statusBorder: Record<string, string> = {
  CRITICAL: 'border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]',
  VULNERABLE: 'border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]',
  HEALTHY: 'border-emerald-500/40',
};

const typeIcon: Record<string, React.ReactNode> = {
  SERVICE: <Server className="w-4 h-4 text-blue-400" />,
  CONTAINER: <Box className="w-4 h-4 text-cyan-400" />,
  DATABASE: <Database className="w-4 h-4 text-purple-400" />,
  API: <Globe className="w-4 h-4 text-teal-400" />,
};

const SecurityNode = ({ data }: { data: Record<string, unknown> }) => {
  const status = (data.status as string) || 'HEALTHY';
  const type = (data.type as string) || 'SERVICE';
  const critical = (data.criticalVulns as number) || 0;
  const high = (data.highVulns as number) || 0;
  const falco = (data.falcoEvents24h as number) || 0;
  const hasIssue = critical + high > 0 || falco > 0;

  return (
    <div className={`px-3 py-2 rounded-lg bg-card/90 border-2 min-w-[180px] ${statusBorder[status] || statusBorder.HEALTHY}`}>
      <Handle type="target" position={Position.Left} className="w-2 h-2" />
      <div className="flex items-start gap-2">
        {typeIcon[type]}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-white truncate">{data.label as string}</div>
          <div className="text-[9px] text-muted-foreground uppercase">{type}</div>
          {hasIssue && (
            <div className="flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[9px] text-amber-300">
                {critical > 0 && `${critical}C `}
                {high > 0 && `${high}H `}
                {falco > 0 && `${falco} Falco`}
              </span>
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2" />
    </div>
  );
};

const nodeTypes = { security: SecurityNode };

function layoutElements(nodes: Node[], edges: Edge[]) {
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 120 });
  nodes.forEach((n) => dagreGraph.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => dagreGraph.setEdge(e.source, e.target));
  dagre.layout(dagreGraph);
  return nodes.map((node) => {
    const pos = dagreGraph.node(node.id);
    return {
      ...node,
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    };
  });
}

interface Props {
  data: AttackSurfaceData | null;
  loading?: boolean;
}

const AttackSurfaceMap: React.FC<Props> = ({ data, loading }) => {
  const { nodes, edges } = useMemo(() => {
    if (!data?.nodes?.length) return { nodes: [], edges: [] };

    const flowNodes: Node[] = data.nodes.map((n) => ({
      id: n.id,
      type: 'security',
      data: { ...n },
      position: { x: 0, y: 0 },
    }));

    const flowEdges: Edge[] = data.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: e.vulnerable,
      style: {
        stroke: e.vulnerable ? '#ef4444' : '#64748b',
        strokeWidth: e.vulnerable ? 2 : 1.5,
        opacity: e.vulnerable ? 1 : 0.6,
      },
    }));

    return { nodes: layoutElements(flowNodes, flowEdges), edges: flowEdges };
  }, [data]);

  if (loading) {
    return <div className="h-[360px] flex items-center justify-center text-muted-foreground">Loading attack surface...</div>;
  }

  if (!nodes.length) {
    return (
      <div className="h-[360px] flex items-center justify-center text-muted-foreground">
        No infrastructure assets found for this environment.
      </div>
    );
  }

  const vulnerableCount = data?.nodes.filter((n) => n.status !== 'HEALTHY').length ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-emerald-500/40" /> Healthy</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-amber-500" /> Vulnerable</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-red-500" /> Critical</span>
        <span className="ml-auto text-amber-400 font-medium">{vulnerableCount} at-risk assets</span>
      </div>
      <div className="h-[360px] rounded-lg border border-border overflow-hidden bg-background/50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.4}
          maxZoom={1.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} color="#ffffff08" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        Simplified view: Gateway → Applications → Containers / Databases (at-risk assets only)
      </p>
    </div>
  );
};

export default AttackSurfaceMap;
