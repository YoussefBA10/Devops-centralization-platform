import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useReactFlow,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Server, Database, Box, Globe, AlertTriangle, HardDrive } from 'lucide-react';
import type { AttackSurfaceData, AttackSurfaceNode } from '../../types/security';

/** Fixed node dimensions — layout uses these constants; badges must not change them. */
const NODE_H = 72;
const HOST_W = 200;
const GATEWAY_W = 175;
const COL_W = 200;
const V_GAP = 14;
const H_GAP = 72;

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
    <div
      className={`h-[72px] w-[188px] box-border px-3 py-2 rounded-lg bg-card/90 border-2 overflow-hidden ${isHost ? '!w-[200px]' : ''} ${statusBorder[status] || statusBorder.HEALTHY}`}
    >
      <Handle type="target" position={Position.Left} className="w-2 h-2" />
      <div className="flex items-start gap-2 h-full">
        {typeIcon[type]}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className={`font-bold text-white truncate ${isHost ? 'text-sm' : 'text-xs'}`}>{data.label as string}</div>
          <div className="text-[9px] text-muted-foreground uppercase">{type.replace('_', ' ')}</div>
          {typeof data.port === 'number' && data.port > 0 ? (
            <div className="text-[9px] text-cyan-300/80">port {data.port}</div>
          ) : null}
          {typeof data.environmentName === 'string' && data.environmentName ? (
            <div className="text-[9px] text-blue-300/80 truncate">{data.environmentName}</div>
          ) : null}
          {hasIssue && (
            <div className="flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[9px] text-amber-300 truncate">
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

/** How many rows fit in one half of the canvas (above or below host). */
function maxRowsPerHalf(canvasH: number): number {
  const halfH = canvasH / 2 - NODE_H - V_GAP * 2;
  return Math.max(2, Math.floor(halfH / (NODE_H + V_GAP)));
}

function layoutSection(
  items: AttackSurfaceNode[],
  baseX: number,
  anchorY: number,
  direction: 'above' | 'below',
  maxRows: number,
): Array<{ node: AttackSurfaceNode; x: number; y: number }> {
  if (items.length === 0) return [];
  return items.map((node, idx) => {
    const col = Math.floor(idx / maxRows);
    const row = idx % maxRows;
    const x = baseX + col * COL_W;
    const y = direction === 'above'
      ? anchorY - V_GAP - NODE_H - row * (NODE_H + V_GAP)
      : anchorY + V_GAP + row * (NODE_H + V_GAP);
    return { node, x, y };
  });
}

/**
 * Hub layout (matches reference diagram):
 *   [Internet] — [Docker Host @ center] — containers above/below on the right
 */
function layoutDockerTopology(
  data: AttackSurfaceData,
  canvasW: number,
  canvasH: number,
): { nodes: Node[]; edges: Edge[] } {
  const gateway = data.nodes.find((n) => n.id === 'gateway' || (n.type === 'API' && n.id.startsWith('gateway')));
  const hosts = data.nodes.filter((n) => n.type === 'DOCKER_HOST');
  const containers = data.nodes.filter((n) => n.type === 'CONTAINER' || n.type === 'DATABASE');

  const centerX = canvasW / 2;
  const centerY = canvasH / 2;
  const hostX = centerX - HOST_W / 2;
  const gatewayX = hostX - H_GAP - GATEWAY_W;
  const containerBaseX = centerX + HOST_W / 2 + H_GAP;

  const flowNodes: Node[] = [];
  const maxRows = maxRowsPerHalf(canvasH);

  if (hosts.length === 0 && gateway) {
    flowNodes.push({
      id: gateway.id,
      type: 'security',
      data: { ...gateway, label: gateway.label || 'External Traffic' },
      position: { x: centerX - GATEWAY_W / 2, y: centerY - NODE_H / 2 },
    });
  } else {
    hosts.forEach((host, hostIdx) => {
      const hostContainers = sortContainers(
        containers.filter((c) => c.parentId === host.id || c.dockerHost === host.dockerHost),
      );

      const hostCenterY = hosts.length === 1
        ? centerY
        : centerY + (hostIdx - (hosts.length - 1) / 2) * (canvasH * 0.6 / hosts.length);

      const splitAt = Math.ceil(hostContainers.length / 2);
      const topContainers = hostContainers.slice(0, splitAt);
      const bottomContainers = hostContainers.slice(splitAt);

      if (gateway && hostIdx === 0) {
        flowNodes.push({
          id: gateway.id,
          type: 'security',
          data: { ...gateway, label: gateway.label || 'External Traffic' },
          position: { x: gatewayX, y: hostCenterY - NODE_H / 2 },
        });
      }

      flowNodes.push({
        id: host.id,
        type: 'security',
        data: { ...host },
        position: { x: hostX, y: hostCenterY - NODE_H / 2 },
      });

      const hostTop = hostCenterY - NODE_H / 2;
      const hostBottom = hostCenterY + NODE_H / 2;

      layoutSection(topContainers, containerBaseX, hostTop, 'above', maxRows).forEach(({ node, x, y }) => {
        flowNodes.push({ id: node.id, type: 'security', data: { ...node }, position: { x, y } });
      });

      layoutSection(bottomContainers, containerBaseX, hostBottom, 'below', maxRows).forEach(({ node, x, y }) => {
        flowNodes.push({ id: node.id, type: 'security', data: { ...node }, position: { x, y } });
      });
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

  return { nodes: flowNodes, edges: flowEdges };
}

function FitViewOnLoad({ dep }: { dep: unknown }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = window.setTimeout(() => {
      fitView({ padding: 0.12, duration: 250, minZoom: 0.4, maxZoom: 1.1 });
    }, 80);
    return () => window.clearTimeout(t);
  }, [dep, fitView]);
  return null;
}

interface Props {
  data: AttackSurfaceData | null;
  loading?: boolean;
}

const AttackSurfaceMap: React.FC<Props> = ({ data, loading }) => {
  const canvasW = 960;
  const canvasH = 480;

  const { nodes, edges } = useMemo(() => {
    if (!data?.nodes?.length) return { nodes: [], edges: [] };
    return layoutDockerTopology(data, canvasW, canvasH);
  }, [data, canvasW, canvasH]);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    window.setTimeout(() => {
      instance.fitView({ padding: 0.12, duration: 200, minZoom: 0.4, maxZoom: 1.1 });
    }, 100);
  }, []);

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
      <div className="h-[480px] w-full rounded-lg border border-border overflow-hidden bg-background/50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={onInit}
          fitView
          fitViewOptions={{ padding: 0.12, minZoom: 0.4, maxZoom: 1.1 }}
          minZoom={0.25}
          maxZoom={1.4}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
        >
          <FitViewOnLoad dep={nodes.length} />
          <Background gap={24} color="#ffffff08" />
          <Controls showInteractive={false} className="!bg-card/90 !border-border !shadow-md" />
        </ReactFlow>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        Hub topology: External Traffic → Docker Host (center) → containers distributed above &amp; below (red edges = vulnerable path)
      </p>
    </div>
  );
};

export default AttackSurfaceMap;
