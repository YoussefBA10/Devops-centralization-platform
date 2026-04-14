export interface User {
  id: number;
  username: string;
  role: 'ADMIN' | 'USER';
  environments?: Environment[];
}

export interface Environment {
  id: number;
  name: string;
  description: string;
  prometheusLabel: string;
  lastDeploymentStatus?: string;
  lastDeployedAt?: string;
  createdAt: string;
}

export interface Application {
  id: number;
  name: string;
  serviceNameKeyword: string;
  environmentId: number;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
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

// Ensure this file is always treated as a module by providing a runtime export
export const _MOD_TYPES = true;
