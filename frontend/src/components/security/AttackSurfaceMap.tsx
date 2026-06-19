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
import type { AttackSurfaceData } from '../../types/security';

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
    <div className={`px-3 py-2 rounded-lg bg-card/90 border-2 ${isHost ? 'min-w-[200px]' : 'min-w-[180px]'} ${statusBorder[status] || statusBorder.HEALTHY}`}>
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

function layoutDockerTopology(data: AttackSurfaceData): { nodes: Node[]; edges: Edge[] } {
  const gateway = data.nodes.find((n) => n.id === 'gateway' || n.type === 'API');
  const hosts = data.nodes.filter((n) => n.type === 'DOCKER_HOST');
  const containers = data.nodes.filter((n) => n.type === 'CONTAINER' || n.type === 'DATABASE');
  const legacy = data.nodes.filter((n) =>
    n.type === 'SERVICE' && !hosts.length
  );

  const flowNodes: Node[] = [];
  let hostY = 0;
  const HOST_X = 280;
  const CONTAINER_X = 560;
  const ROW_H = 72;

  if (gateway) {
    flowNodes.push({
      id: gateway.id,
      type: 'security',
      data: { ...gateway },
      position: { x: 0, y: Math.max(0, (hosts.length * 120) / 2 - 40) },
    });
  }

  hosts.forEach((host) => {
    const hostContainers = containers.filter((c) => c.parentId === host.id || c.dockerHost === host.dockerHost);
    const blockHeight = Math.max(1, hostContainers.length) * ROW_H;

    flowNodes.push({
      id: host.id,
      type: 'security',
      data: { ...host },
      position: { x: HOST_X, y: hostY },
    });

    hostContainers.forEach((ctr, idx) => {
      flowNodes.push({
        id: ctr.id,
        type: 'security',
        data: { ...ctr },
        position: { x: CONTAINER_X, y: hostY + idx * ROW_H },
      });
    });

    hostY += blockHeight + 40;
  });

  if (!hosts.length) {
    data.nodes.forEach((n, idx) => {
      if (n.id === gateway?.id) return;
      flowNodes.push({
        id: n.id,
        type: 'security',
        data: { ...n },
        position: { x: 200 + (idx % 3) * 200, y: Math.floor(idx / 3) * 90 },
      });
    });
  }

  legacy.forEach((n, idx) => {
    flowNodes.push({
      id: n.id,
      type: 'security',
      data: { ...n },
      position: { x: HOST_X, y: hostY + idx * ROW_H },
    });
  });

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

  return { nodes: flowNodes, edges: flowEdges };
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
    return <div className="h-[400px] flex items-center justify-center text-muted-foreground">Loading attack surface...</div>;
  }

  if (!nodes.length) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
        No Docker containers detected in this cluster.
      </div>
    );
  }

  const vulnerableCount = data?.nodes.filter((n) => n.status !== 'HEALTHY').length ?? 0;
  const hostCount = data?.nodes.filter((n) => n.type === 'DOCKER_HOST').length ?? 0;
  const containerCount = data?.nodes.filter((n) => n.type === 'CONTAINER' || n.type === 'DATABASE').length ?? 0;

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
      <div className="h-[400px] rounded-lg border border-border overflow-hidden bg-background/50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.35}
          maxZoom={1.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} color="#ffffff08" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        Docker topology: External Traffic → Docker Hosts → Containers (red edges = vulnerable path)
      </p>
    </div>
  );
};

export default AttackSurfaceMap;
