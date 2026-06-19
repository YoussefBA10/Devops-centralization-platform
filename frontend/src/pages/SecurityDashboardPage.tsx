import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, AlertTriangle, TrendingUp, TrendingDown, Minus,
  RefreshCw, Bug, Activity, Radar, Search, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { useCluster } from '../context/ClusterContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Input';
import AttackSurfaceMap from '../components/security/AttackSurfaceMap';
import SecurityLoadingScreen from '../components/security/SecurityLoadingScreen';
import {
  getSecuritySummary, getClusterVulnerabilities,
  getFalcoEvents, getFalcoSummary, getClusterSecurityTrends, getClusterAttackSurface,
  updateVulnerabilityStatus,
} from '../services/api';
import type {
  SecurityDashboardSummary, Vulnerability, FalcoEvent, FalcoSummary,
  SecurityTrendPoint, AttackSurfaceData, PaginatedResponse,
} from '../types/security';

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
  INFO: '#6b7280',
};

const TrendBadge: React.FC<{ trend: string }> = ({ trend }) => {
  if (trend === 'IMPROVING') {
    return (
      <span className="flex items-center gap-1 text-emerald-400">
        <TrendingDown className="w-5 h-5" /> IMPROVING
      </span>
    );
  }
  if (trend === 'WORSENING') {
    return (
      <span className="flex items-center gap-1 text-red-400">
        <TrendingUp className="w-5 h-5" /> WORSENING
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-emerald-400">
      <Minus className="w-5 h-5" /> STABLE
    </span>
  );
};

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => (
  <span
    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
    style={{ backgroundColor: `${SEVERITY_COLORS[severity]}22`, color: SEVERITY_COLORS[severity] }}
  >
    {severity}
  </span>
);

const KpiCard: React.FC<{
  label: string; value: number | string; color?: string; sub?: string;
}> = ({ label, value, color = 'text-white', sub }) => (
  <Card>
    <CardContent className="p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </CardContent>
  </Card>
);

const SecurityDashboardPage: React.FC = () => {
  const { selectedCluster } = useCluster();
  const clusterId = selectedCluster?.id ?? undefined;
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [summary, setSummary] = useState<SecurityDashboardSummary | null>(null);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [falcoEvents, setFalcoEvents] = useState<FalcoEvent[]>([]);
  const [falcoSummary, setFalcoSummary] = useState<FalcoSummary | null>(null);
  const [trends, setTrends] = useState<SecurityTrendPoint[]>([]);
  const [attackSurface, setAttackSurface] = useState<AttackSurfaceData | null>(null);

  const [vulnFilter, setVulnFilter] = useState({ severity: '', reportType: '', search: '' });
  const [expandedVuln, setExpandedVuln] = useState<number | null>(null);
  const [vulnTotal, setVulnTotal] = useState(0);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const results = await Promise.allSettled([
        getSecuritySummary(undefined, clusterId),
        getClusterVulnerabilities(clusterId, { size: 200, page: 0 }),
        getFalcoEvents({ size: 50, sort: 'timestamp,desc' }),
        getFalcoSummary(),
        getClusterSecurityTrends(clusterId, 30),
        getClusterAttackSurface(clusterId),
      ]);

      const [summaryRes, vulnRes, falcoRes, falcoSumRes, trendsRes, surfaceRes] = results;

      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data);
      if (vulnRes.status === 'fulfilled') {
        const page = vulnRes.value.data as PaginatedResponse<Vulnerability>;
        setVulnerabilities(page.content || []);
        setVulnTotal(page.totalElements ?? page.content?.length ?? 0);
      }
      if (falcoRes.status === 'fulfilled') {
        setFalcoEvents((falcoRes.value.data as PaginatedResponse<FalcoEvent>).content || []);
      }
      if (falcoSumRes.status === 'fulfilled') setFalcoSummary(falcoSumRes.value.data);
      if (trendsRes.status === 'fulfilled') {
        const raw = trendsRes.value.data;
        setTrends(Array.isArray(raw) ? raw : []);
      } else {
        console.error('Trends API failed', trendsRes);
      }
      if (surfaceRes.status === 'fulfilled') setAttackSurface(surfaceRes.value.data);
      else console.error('Attack surface API failed', surfaceRes);

      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        console.error('Some security API calls failed', failed);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setInitialLoadDone(true);
    }
  }, [clusterId]);

  useEffect(() => {
    setInitialLoadDone(false);
    fetchAll();
    const interval = setInterval(() => fetchAll(true), 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleStatusChange = async (vulnId: number, status: string) => {
    try {
      await updateVulnerabilityStatus(vulnId, status);
      setVulnerabilities((prev) =>
        prev.map((v) => (v.id === vulnId ? { ...v, status: status as Vulnerability['status'] } : v))
      );
    } catch (e) {
      console.error('Failed to update status', e);
    }
  };

  const filteredVulns = vulnerabilities.filter((v) => {
    if (vulnFilter.severity && v.severity !== vulnFilter.severity) return false;
    if (vulnFilter.reportType && v.reportType !== vulnFilter.reportType) return false;
    if (vulnFilter.search) {
      const q = vulnFilter.search.toLowerCase();
      return v.identifier.toLowerCase().includes(q) || v.title.toLowerCase().includes(q)
        || (v.filePath?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  const severityBreakdown = [
    { name: 'Critical', value: summary?.criticalCount ?? 0, color: SEVERITY_COLORS.CRITICAL },
    { name: 'High', value: summary?.highCount ?? 0, color: SEVERITY_COLORS.HIGH },
    { name: 'Medium', value: summary?.mediumCount ?? 0, color: SEVERITY_COLORS.MEDIUM },
    { name: 'Low', value: summary?.lowCount ?? 0, color: SEVERITY_COLORS.LOW },
  ];

  const severityBreakdownWithData = severityBreakdown.filter((s) => s.value > 0);

  const parseTrendDate = (dateStr: string | number[] | unknown) => {
    try {
      if (Array.isArray(dateStr) && dateStr.length >= 3) {
        const [y, m, d] = dateStr;
        return format(new Date(y, m - 1, d), 'MMM d');
      }
      if (typeof dateStr === 'string') {
        return format(parseISO(dateStr), 'MMM d');
      }
      return String(dateStr ?? '').slice(0, 10);
    } catch {
      return String(dateStr ?? '').slice(0, 10);
    }
  };

  const toDaySortKey = (dateStr: string | number[] | unknown): string => {
    if (Array.isArray(dateStr) && dateStr.length >= 3) {
      const [y, m, d] = dateStr;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    if (typeof dateStr === 'string' && dateStr.length >= 10) {
      return dateStr.slice(0, 10);
    }
    return String(dateStr ?? '');
  };

  const buildScanLabel = (t: SecurityTrendPoint) => {
    const day = parseTrendDate(t.date);
    const src = t.reportType === 'DEPENDENCY_CHECK' ? 'OWASP' : 'Sonar';
    const comp = t.component ? ` ${t.component.charAt(0)}` : '';
    const app = t.applicationName ? `${t.applicationName} · ` : '';
    const build = t.buildNumber ? ` #${t.buildNumber}` : '';
    return `${app}${day} · ${src}${comp}${build}`;
  };

  /** One point per calendar day — sums critical/high across deduplicated scans. */
  const dailyTrendChartData = useMemo(() => {
    const byDay = new Map<string, { sortKey: string; label: string; critical: number; high: number }>();
    trends.forEach((t) => {
      const sortKey = toDaySortKey(t.date);
      if (!sortKey) return;
      const label = parseTrendDate(t.date);
      const entry = byDay.get(sortKey) ?? { sortKey, label, critical: 0, high: 0 };
      entry.critical += t.criticalCount ?? 0;
      entry.high += t.highCount ?? 0;
      byDay.set(sortKey, entry);
    });
    return Array.from(byDay.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [trends]);

  /** One bar per deduplicated scan upload. */
  const perScanChartData = useMemo(() => trends.map((t, idx) => ({
    key: `${t.applicationId ?? 'app'}-${toDaySortKey(t.date)}-${t.reportType}-${t.component ?? 'c'}-${idx}`,
    label: buildScanLabel(t),
    total: t.totalIssues ?? ((t.criticalCount ?? 0) + (t.highCount ?? 0) + (t.mediumCount ?? 0) + (t.lowCount ?? 0)),
    critical: t.criticalCount ?? 0,
    high: t.highCount ?? 0,
    type: t.reportType === 'DEPENDENCY_CHECK' ? 'OWASP' : 'SonarQube',
  })).slice(-30), [trends]);

  const falcoPriorityData = falcoSummary
    ? Object.entries(falcoSummary.byPriority).map(([name, value]) => ({ name, value }))
    : [];

  const falcoTimeline = falcoSummary?.hourlyTimeline.map((h) => ({
    hour: h.hour.slice(11, 16),
    events: h.count,
  })) ?? [];

  const postureScore = summary
    ? Math.max(0, Math.min(100, 100 - (summary.criticalCount * 5 + summary.highCount * 2 + (summary.falcoEventsLast24h ?? 0) * 0.5)))
    : 0;

  if (loading && !initialLoadDone) {
    return <SecurityLoadingScreen />;
  }

  const clusterLabel = selectedCluster ? selectedCluster.name : 'All Clusters';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Security Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clusterLabel} — OWASP, SonarQube & Falco runtime intelligence across all applications
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchAll()} disabled={loading || refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* 1. Executive Security Overview */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> Executive Security Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Critical" value={summary?.criticalCount ?? 0} color="text-red-500" />
          <KpiCard label="High" value={summary?.highCount ?? 0} color="text-orange-500" />
          <KpiCard label="Medium" value={summary?.mediumCount ?? 0} color="text-yellow-500" />
          <KpiCard label="Low" value={summary?.lowCount ?? 0} color="text-blue-400" />
          <KpiCard label="Falco (24h)" value={summary?.falcoEventsLast24h ?? 0} color="text-cyan-400" />
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Posture Score</p>
              <p className={`text-3xl font-bold mt-1 ${postureScore >= 70 ? 'text-emerald-400' : postureScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                {Math.round(postureScore)}
              </p>
              <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${postureScore >= 70 ? 'bg-emerald-500' : postureScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${postureScore}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Vulnerability Trend</p>
                <div className="text-lg font-bold mt-1"><TrendBadge trend={summary?.trend ?? 'STABLE'} /></div>
              </div>
              {summary?.latestDependencyScan && (
                <div className="text-right text-[10px] text-muted-foreground">
                  <div>Last OWASP scan</div>
                  <div className="text-white">{format(parseISO(summary.latestDependencyScan), 'MMM d, HH:mm')}</div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">Severity Distribution</p>
              {severityBreakdownWithData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="h-24 w-24 shrink-0 min-h-[96px] min-w-[96px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={severityBreakdownWithData}
                          dataKey="value"
                          cx="50%"
                          cy="50%"
                          innerRadius={22}
                          outerRadius={40}
                          paddingAngle={2}
                        >
                          {severityBreakdownWithData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {severityBreakdown.map((entry) => (
                      <div key={entry.name} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          {entry.name}
                        </span>
                        <span className="font-mono font-bold text-white">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No vulnerability data</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Runtime Threat Level</p>
              <p className={`text-2xl font-bold ${(summary?.falcoEventsLast24h ?? 0) > 20 ? 'text-red-400' : (summary?.falcoEventsLast24h ?? 0) > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {(summary?.falcoEventsLast24h ?? 0) > 20 ? 'ELEVATED' : (summary?.falcoEventsLast24h ?? 0) > 5 ? 'MODERATE' : 'LOW'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Based on {falcoSummary?.totalLast24h ?? 0} Falco events in last 24h
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 2. Security Trends */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Security Trends
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Vulnerability Trend (30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyTrendChartData.length > 0 ? (
                <div className="h-[220px] min-h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrendChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#888' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#888' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 12 }} />
                    <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Critical" />
                    <Line type="monotone" dataKey="high" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="High" />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm text-center px-4">
                  No scan history found for {clusterLabel}. Upload OWASP or SonarQube reports via CI/CD pipeline.
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Issues per Scan</CardTitle>
            </CardHeader>
            <CardContent>
              {perScanChartData.length > 0 ? (
                <div className="h-[220px] min-h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={perScanChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#888' }} interval={0} angle={-25} textAnchor="end" height={56} />
                    <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 12 }} />
                    <Bar dataKey="total" fill="#3b82f6" name="Total Issues" radius={[4, 4, 0, 0]} />
                  </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No scan data available</div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 3. Vulnerability Intelligence */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Bug className="w-4 h-4" /> Vulnerability Intelligence
        </h2>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <CardTitle className="text-sm flex-1">
                OWASP Dependency-Check & SonarQube Findings
                {vulnTotal > 0 && <span className="ml-2 text-muted-foreground font-normal">({vulnTotal} total)</span>}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-secondary/50 w-40"
                    placeholder="Search CVE, file..."
                    value={vulnFilter.search}
                    onChange={(e) => setVulnFilter((f) => ({ ...f, search: e.target.value }))}
                  />
                </div>
                <select
                  className="h-8 px-2 text-xs rounded-lg border border-border bg-secondary/50"
                  value={vulnFilter.severity}
                  onChange={(e) => setVulnFilter((f) => ({ ...f, severity: e.target.value }))}
                >
                  <option value="">All Severities</option>
                  {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  className="h-8 px-2 text-xs rounded-lg border border-border bg-secondary/50"
                  value={vulnFilter.reportType}
                  onChange={(e) => setVulnFilter((f) => ({ ...f, reportType: e.target.value }))}
                >
                  <option value="">All Sources</option>
                  <option value="DEPENDENCY_CHECK">OWASP</option>
                  <option value="SONARQUBE">SonarQube</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[480px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10 shadow-sm">
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="p-3">Severity</th>
                    <th className="p-3">Application</th>
                    <th className="p-3">Identifier</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">File / Component</th>
                    <th className="p-3">CVSS</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVulns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        {vulnerabilities.length === 0
                          ? `No vulnerability records for ${clusterLabel}. Upload OWASP or SonarQube reports via CI/CD.`
                          : 'No vulnerabilities match the current filters'}
                      </td>
                    </tr>
                  ) : (
                    filteredVulns.map((v) => (
                      <React.Fragment key={v.id}>
                        <tr className="border-b border-border/50 hover:bg-white/5 transition-colors">
                          <td className="p-3"><SeverityBadge severity={v.severity} /></td>
                          <td className="p-3 text-xs font-medium">{v.applicationName || '—'}</td>
                          <td className="p-3 font-mono text-xs">{v.identifier}</td>
                          <td className="p-3">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5">
                              {v.reportType === 'DEPENDENCY_CHECK' ? 'OWASP' : v.reportType === 'SONARQUBE' ? 'SonarQube' : '—'}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{v.filePath || '—'}</td>
                          <td className="p-3 font-mono text-xs">{v.cvssScore?.toFixed(1) ?? '—'}</td>
                          <td className="p-3">
                            <select
                              className="text-[10px] bg-secondary/50 border border-border rounded px-1 py-0.5"
                              value={v.status}
                              onChange={(e) => handleStatusChange(v.id, e.target.value)}
                            >
                              {['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE'].map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3">
                            <button onClick={() => setExpandedVuln(expandedVuln === v.id ? null : v.id)}>
                              {expandedVuln === v.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </td>
                        </tr>
                        {expandedVuln === v.id && (
                          <tr className="bg-white/[0.02]">
                            <td colSpan={8} className="p-3 text-xs text-muted-foreground">
                              <strong className="text-white">{v.title}</strong>
                              {v.description && <p className="mt-1">{v.description}</p>}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 4. Runtime Security Monitoring */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Runtime Security Monitoring (Falco)
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Events by Priority</CardTitle></CardHeader>
            <CardContent>
              {falcoPriorityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={falcoPriorityData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#888' }} width={70} />
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 12 }} />
                    <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No Falco events</div>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Event Timeline (24h)</CardTitle></CardHeader>
            <CardContent>
              {falcoTimeline.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={falcoTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#888' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 12 }} />
                    <Line type="monotone" dataKey="events" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="Events" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No timeline data</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top rules + event table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Top Triggered Rules</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(falcoSummary?.topRules ?? []).slice(0, 8).map((r) => (
                <div key={r.ruleName} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1 text-muted-foreground">{r.ruleName}</span>
                  <span className="font-mono font-bold text-cyan-400 ml-2">{r.count}</span>
                </div>
              ))}
              {(!falcoSummary?.topRules?.length) && (
                <p className="text-sm text-muted-foreground">No rules triggered</p>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Falco Events</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                <table className="w-full text-xs table-fixed">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="p-2 w-20">Time</th>
                      <th className="p-2 w-24">Priority</th>
                      <th className="p-2 w-48">Rule</th>
                      <th className="p-2">Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {falcoEvents.length === 0 ? (
                      <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No Falco events recorded</td></tr>
                    ) : (
                      falcoEvents.map((e) => (
                        <tr key={e.id} className="border-b border-border/30 hover:bg-white/5 align-top">
                          <td className="p-2 whitespace-nowrap text-muted-foreground">
                            {format(parseISO(e.timestamp), 'HH:mm:ss')}
                          </td>
                          <td className="p-2">
                            <SeverityBadge severity={['CRITICAL', 'ALERT', 'EMERGENCY'].includes(e.priority) ? 'CRITICAL' : e.priority === 'WARNING' ? 'HIGH' : 'MEDIUM'} />
                          </td>
                          <td className="p-2 font-medium break-words">{e.ruleName}</td>
                          <td className="p-2 text-muted-foreground whitespace-normal break-words leading-relaxed">{e.output}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 5. Attack Surface Mapping */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Radar className="w-4 h-4" /> Attack Surface Mapping
        </h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Infrastructure Attack Surface
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Docker container topology for {clusterLabel} — hosts, containers, and vulnerable paths highlighted in red
            </p>
          </CardHeader>
          <CardContent>
            <AttackSurfaceMap data={attackSurface} loading={false} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default SecurityDashboardPage;
