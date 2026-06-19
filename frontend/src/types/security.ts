export interface SecurityDashboardSummary {
  applicationId?: number;
  applicationName?: string;
  latestDependencyScan?: string;
  latestSonarScan?: string;
  criticalCount: number;
  highCount: number;
  mediumCount?: number;
  lowCount?: number;
  trend: 'STABLE' | 'IMPROVING' | 'WORSENING';
  falcoEventsLast24h: number;
}

export interface Vulnerability {
  id: number;
  reportId: number;
  identifier: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  description?: string;
  filePath?: string;
  cvssScore?: number;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_POSITIVE';
  reportType?: 'DEPENDENCY_CHECK' | 'SONARQUBE';
  component?: 'BACKEND' | 'FRONTEND';
}

export interface FalcoEvent {
  id: number;
  ruleName: string;
  priority: string;
  output: string;
  outputFields?: Record<string, unknown>;
  source?: string;
  tags?: string[];
  timestamp: string;
}

export interface FalcoSummary {
  totalLast24h: number;
  byPriority: Record<string, number>;
  topRules: { ruleName: string; count: number }[];
  hourlyTimeline: { hour: string; count: number }[];
}

export interface SecurityTrendPoint {
  date: string;
  reportType: 'DEPENDENCY_CHECK' | 'SONARQUBE';
  buildNumber?: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalIssues: number;
}

export interface AttackSurfaceNode {
  id: string;
  label: string;
  type: 'SERVICE' | 'CONTAINER' | 'DATABASE' | 'API';
  status: 'HEALTHY' | 'VULNERABLE' | 'CRITICAL';
  criticalVulns?: number;
  highVulns?: number;
  falcoEvents24h?: number;
  applicationId?: number;
  nodeName?: string;
  port?: number;
}

export interface AttackSurfaceEdge {
  id: string;
  source: string;
  target: string;
  type: 'NETWORK' | 'DEPLOYMENT' | 'API_CALL';
  vulnerable: boolean;
}

export interface AttackSurfaceData {
  nodes: AttackSurfaceNode[];
  edges: AttackSurfaceEdge[];
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
