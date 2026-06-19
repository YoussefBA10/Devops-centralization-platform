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
import { Server, Database, Box, Globe, AlertTriangle, HardDrive } from 'lucide-react';
import type { AttackSurfaceData, AttackSurfaceNode } from '../../types/security';

const VIEW_W = 920;
const VIEW_H = 440;
const GATEWAY_X = 0;
const HOST_X = 260;
const CONTAINER_X = 520;
const ROW_H = 64;
const COL_W = 210;
const CONTAINER_COLS = 3;
const NODE_W = 190;
const NODE_H = 72;

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
  DOCKER_HOST: <HardDrive className="w-4 h-4 text-slate-300" />,
};

const SecurityNode = ({ data }: { data: Record<string, unknown> }) => {
  const status = (data.status as string) || 'HEALTHY';
  const type = (data.type as string) || 'CONTAINER';
  const critical = (data.criticalVulns as number) || 0;
  const high = (data.highVulns as number) || 0;
  const falco = (data.falcoEvents24h as number) || 0;
  const hasIssue = critical + high > 0 || falco > 0;
  const isHost = type === 'DOCKER_HOST';

  return (
    <div className={`px-3 py-2 rounded-lg bg-card/90 border-2 ${isHost ? 'min-w-[200px]' : 'min-w-[170px] max-w-[200px]'} ${statusBorder[status] || statusBorder.HEALTHY}`}>
      <Handle type="target" position={Position.Left} className="w-2 h-2" />
      <div className="flex items-start gap-2">
        {typeIcon[type]}
        <div className="flex-1 min-w-0">
          <div className={`font-bold text-white truncate ${isHost ? 'text-sm' : 'text-xs'}`}>{data.label as string}</div>
          <div className="text-[9px] text-muted-foreground uppercase">{type.replace('_', ' ')}</div>
          {typeof data.port === 'number' && data.port > 0 ? (
            <div className="text-[9px] text-cyan-300/80">port {data.port}</div>
          ) : null}
          {typeof data.environmentName === 'string' && data.environmentName ? (
            <div className="text-[9px] text-blue-300/80 truncate">{data.environmentName}</div>
          ) : null}
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

function riskScore(n: AttackSurfaceNode): number {
  if (n.status === 'CRITICAL') return 3;
  if (n.status === 'VULNERABLE') return 2;
  return 1;
}

function sortContainers(containers: AttackSurfaceNode[]): AttackSurfaceNode[] {
  return [...containers].sort((a, b) => {
    const diff = riskScore(b) - riskScore(a);
    if (diff !== 0) return diff;
    return a.label.localeCompare(b.label);
  });
}

function centerNodes(nodes: Node[]): Node[] {
  if (nodes.length === 0) return nodes;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  nodes.forEach((n) => {
    minX = Math.min(minX, n.position.x);
    maxX = Math.max(maxX, n.position.x + NODE_W);
    minY = Math.min(minY, n.position.y);
    maxY = Math.max(maxY, n.position.y + NODE_H);
  });
  const graphW = maxX - minX;
  const graphH = maxY - minY;
  const offsetX = Math.max(16, (VIEW_W - graphW) / 2 - minX);
  const offsetY = Math.max(16, (VIEW_H - graphH) / 2 - minY);
  return nodes.map((n) => ({
    ...n,
    position: { x: n.position.x + offsetX, y: n.position.y + offsetY },
  }));
}

function layoutDockerTopology(data: AttackSurfaceData): { nodes: Node[]; edges: Edge[] } {
  const gateway = data.nodes.find((n) => n.id === 'gateway' || (n.type === 'API' && n.id.startsWith('gateway')));
  const hosts = data.nodes.filter((n) => n.type === 'DOCKER_HOST');
  const containers = data.nodes.filter((n) => n.type === 'CONTAINER' || n.type === 'DATABASE');

  const flowNodes: Node[] = [];
  let blockOffsetY = 0;

  hosts.forEach((host) => {
    const hostContainers = sortContainers(
      containers.filter((c) => c.parentId === host.id || c.dockerHost === host.dockerHost)
    );
    const rows = Math.max(1, Math.ceil(hostContainers.length / CONTAINER_COLS));
    const blockHeight = rows * ROW_H;
    const laneCenterY = blockOffsetY + blockHeight / 2;

    if (gateway) {
      const gatewayNode = flowNodes.find((n) => n.id === gateway.id);
      if (!gatewayNode) {
        flowNodes.push({
          id: gateway.id,
          type: 'security',
          data: { ...gateway },
          position: { x: GATEWAY_X, y: laneCenterY - NODE_H / 2 },
        });
      }
    }

    flowNodes.push({
      id: host.id,
      type: 'security',
      data: { ...host },
      position: { x: HOST_X, y: laneCenterY - NODE_H / 2 },
    });

    hostContainers.forEach((ctr, idx) => {
      const col = idx % CONTAINER_COLS;
      const row = Math.floor(idx / CONTAINER_COLS);
      flowNodes.push({
        id: ctr.id,
        type: 'security',
        data: { ...ctr },
        position: {
          x: CONTAINER_X + col * COL_W,
          y: blockOffsetY + row * ROW_H,
        },
      });
    });

    blockOffsetY += blockHeight + 48;
  });

  if (!hosts.length && gateway) {
    flowNodes.push({
      id: gateway.id,
      type: 'security',
      data: { ...gateway },
      position: { x: VIEW_W / 2 - 100, y: VIEW_H / 2 - 36 },
    });
  }

  const flowEdges: Edge[] = data.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: e.vulnerable,
    style: {
      stroke: e.vulnerable ? '#ef4444' : '#64748b',
      strokeWidth: e.vulnerable ? 2.5 : 1.5,
      opacity: e.vulnerable ? 1 : 0.65,
    },
  }));

  return { nodes: centerNodes(flowNodes), edges: flowEdges };
}

interface Props {
  data: AttackSurfaceData | null;
  loading?: boolean;
}

const AttackSurfaceMap: React.FC<Props> = ({ data, loading }) => {
  const { nodes, edges } = useMemo(() => {
    if (!data?.nodes?.length) return { nodes: [], edges: [] };
    return layoutDockerTopology(data);
  }, [data]);

  if (loading) {
    return <div className="h-[480px] flex items-center justify-center text-muted-foreground">Loading attack surface...</div>;
  }

  if (!nodes.length) {
    return (
      <div className="h-[480px] flex items-center justify-center text-muted-foreground">
        No Docker containers detected in this cluster.
      </div>
    );
  }

  const hostCount = data?.nodes.filter((n) => n.type === 'DOCKER_HOST').length ?? 0;
  const containerCount = data?.nodes.filter((n) => n.type === 'CONTAINER' || n.type === 'DATABASE').length ?? 0;

  if (hostCount === 0 && containerCount === 0) {
    return (
      <div className="h-[480px] flex items-center justify-center text-muted-foreground text-center px-6">
        No Docker hosts or containers mapped for this cluster. Ensure environments are linked to the cluster and Prometheus is scraping cAdvisor.
      </div>
    );
  }

  const vulnerableCount = data?.nodes.filter((n) => n.status !== 'HEALTHY').length ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-emerald-500/40" /> Healthy</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-amber-500" /> Vulnerable</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-red-500" /> Critical</span>
        <span className="ml-auto text-muted-foreground">
          {hostCount} Docker hosts · {containerCount} containers · <span className="text-amber-400">{vulnerableCount} at-risk</span>
        </span>
      </div>
      <div className="h-[480px] rounded-lg border border-border overflow-hidden bg-background/50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2, minZoom: 0.45, maxZoom: 1 }}
          minZoom={0.35}
          maxZoom={1.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} color="#ffffff08" />
          <Controls showInteractive={false} className="!bg-card/90 !border-border !shadow-md" />
        </ReactFlow>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        Docker topology: External Traffic → Docker Hosts → Containers (red edges = vulnerable path). At-risk containers shown first.
      </p>
    </div>
  );
};

export default AttackSurfaceMap;
