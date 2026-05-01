export interface ServiceResource {
  serviceName: string;
  nodeName: string;
  containerId: string;
  cpuUsageCores: number;
  cpuUsagePercent: number;
  memoryUsageBytes: number;
  memoryUsagePercent: number;
  diskReadBytesPerSec: number;
  diskWriteBytesPerSec: number;
  networkRxBytesPerSec: number;
  networkTxBytesPerSec: number;
  restartCount: number;
  uptimeSeconds: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  healthReason?: string;
}

export interface User {
  id: number;
  username: string;
  role: 'ADMIN' | 'USER';
  environments?: Environment[];
}

export interface Cluster {
  id: number;
  name: string;
  description: string;
  createdAt: string;
}

export interface Environment {
  id: number;
  name: string;
  description: string;
  prometheusLabel: string;
  cluster?: Cluster;
  lastDeploymentStatus?: string;
  lastDeployedAt?: string;
  createdAt: string;
}

export interface Application {
  id: number;
  name: string;
  serviceNameKeyword: string;
  environmentId: number;
  type: string;
  appLanguage: string;
  repoUrl: string;
  targetNode: string;
  branch: string;
  port: number;
  status: 'RUNNING' | 'DEPLOYING' | 'FAILED' | 'DELETING' | 'STOPPED';
  lastDeployedAt?: string;
  createdAt: string;
  srcPath?: string;
  containerPort?: number;
  isCanary?: boolean;
  canaryPort?: number;
  lastErrorMessage?: string;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  priority?: string;
  node?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  environment?: Environment;
  application?: Application;
  createdAt: string;
  updatedAt: string;
}

export interface StabilityRecord {
  id: number;
  node: string;
  errorCount: number;
  stabilityScore: number;
  windowStart: string;
  windowEnd: string;
}

export interface OperationalDigest {
  id: number;
  summaryText: string;
  businessRisk: string;
  generatedAt: string;
}

export interface Node {
  id: string;
  type: string;
  ip?: string;
  cpu?: number;
  ram?: number;
  riskScore?: number;
  status?: string;
  label?: string;
  environmentName?: string;
}

export interface Edge {
  source: string;
  target: string;
}

export interface TopologyData {
  environmentId: number;
  nodes: Node[];
  edges: Edge[];
}

export interface Anomaly {
  description: string;
  node: string;
  timestamp: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  type: 'RESOURCE' | 'LOG' | 'RESTART' | 'STATUS';
}

export interface ActivityItem {
  title: string;
  type: 'system' | 'incident';
  env: string;
  timestamp: string;
}

export interface DashboardOverview {
  totalNodes: number;
  stabilityIndex: number;
  openTickets: number;
  recentActivity: ActivityItem[];
  healthStream: string[];
  systemLoad: number[];
}

export const _MOD_TYPES = true;
