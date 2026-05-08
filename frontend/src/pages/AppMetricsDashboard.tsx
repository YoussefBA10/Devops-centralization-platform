import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, BarChart, Bar
} from 'recharts';
import { 
  ArrowLeft, RefreshCw, Activity, Zap, Cpu, Clock, HardDrive, 
  Network, AlertTriangle, CheckCircle2, XCircle, ChevronDown, 
  ChevronUp, Gauge, Filter
} from 'lucide-react';
import { format, subHours } from 'date-fns';

import api from '../services/api';
import * as prometheus from '../services/prometheusService';
import { QUERIES } from '../constants/queries';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button, Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

// --- Constants ---

const REFRESH_INTERVALS = [
  { label: 'Off', value: 0 },
  { label: '15s', value: 15000 },
  { label: '30s', value: 30000 },
  { label: '1m', value: 60000 },
  { label: '5m', value: 300000 },
];

const TIME_PRESETS = [
  { label: 'Last 15m', value: 15 },
  { label: 'Last 30m', value: 30 },
  { label: 'Last 1h', value: 60 },
  { label: 'Last 3h', value: 180 },
  { label: 'Last 6h', value: 360 },
  { label: 'Last 12h', value: 720 },
  { label: 'Last 24h', value: 1440 },
  { label: 'Last 7d', value: 10080 },
];

// --- Types ---

interface TimeRange {
  start: number; // Unix timestamp
  end: number;   // Unix timestamp
  preset?: number; // minutes
}

interface DashboardAlert {
  id: string;
  metric: string;
  value: string | number;
  threshold: string | number;
  severity: 'CRITICAL' | 'WARNING';
  icon: React.ReactNode;
}

// --- Components ---

const StatCard: React.FC<{
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
  trend?: { value: number; isUp: boolean };
}> = ({ title, value, unit, icon, color, loading, trend }) => (
  <Card className="bg-surface-dark border-border-dark shadow-xl hover:border-white/10 transition-all">
    <CardContent className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg bg-white/5`} style={{ color }}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] font-bold ${trend.isUp ? 'text-rose-400' : 'text-emerald-400'}`}>
            {trend.isUp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="space-y-0.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</p>
        <div className="flex items-baseline gap-1">
          {loading ? (
            <div className="h-7 w-20 bg-white/5 animate-pulse rounded" />
          ) : (
            <>
              <span className="text-xl font-mono font-bold text-white">{value}</span>
              {unit && <span className="text-xs font-bold text-muted-foreground">{unit}</span>}
            </>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

const MetricPanel: React.FC<{
  title: string;
  query: string;
  timeRange: TimeRange;
  type?: 'area' | 'line' | 'bar';
  unit?: string;
  color?: string;
  thresholds?: { warning: number; critical: number };
}> = ({ title, query, timeRange, type = 'area', unit = '', color = '#3b82f6', thresholds }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await prometheus.queryRange(query, timeRange.start, timeRange.end);
      const formatted = prometheus.formatSeries(results);
      setData(formatted);
      setError(null);
    } catch (e) {
      setError('Failed to fetch metric');
    } finally {
      setLoading(false);
    }
  }, [query, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderChart = () => {
    if (loading) return <div className="h-full flex items-center justify-center"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground/20" /></div>;
    if (error) return <div className="h-full flex items-center justify-center text-xs text-rose-400/50">{error}</div>;
    if (!data.length) return <div className="h-full flex items-center justify-center text-xs text-muted-foreground/30 italic">No data in range</div>;

    const ChartComponent = type === 'line' ? LineChart : type === 'bar' ? BarChart : AreaChart;
    const DataComponent = type === 'line' ? Line : type === 'bar' ? Bar : Area;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
          <XAxis 
            dataKey="timestamp" 
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(ts) => format(ts, 'HH:mm')}
            stroke="rgba(255,255,255,0.2)"
            fontSize={9}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="rgba(255,255,255,0.2)"
            fontSize={9}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `${val}${unit}`}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: '8px', fontSize: '10px' }}
            itemStyle={{ color: '#fff' }}
            labelFormatter={(ts) => format(ts, 'yyyy-MM-dd HH:mm:ss')}
          />
          <DataComponent 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            fill={type === 'area' ? `url(#gradient-${title})` : 'transparent'}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  return (
    <Card className="bg-surface-dark border-border-dark overflow-hidden">
      <CardHeader className="p-4 border-b border-white/5 flex flex-row items-center justify-between">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Activity className="w-3 h-3" style={{ color }} />
          {title}
        </CardTitle>
        {thresholds && data.length > 0 && (
          <div className="flex gap-2">
             <div className={`w-1.5 h-1.5 rounded-full ${data[data.length-1].value > thresholds.critical ? 'bg-critical animate-pulse' : data[data.length-1].value > thresholds.warning ? 'bg-warning' : 'bg-healthy'}`} />
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4 h-48">
        {renderChart()}
      </CardContent>
    </Card>
  );
};

const AppMetricsDashboard: React.FC = () => {
  const { appId: routeAppId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  
  // --- State ---
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appInfo, setAppInfo] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedAppId, setSelectedAppId] = useState(routeAppId || '');
  const [selectedNode, setSelectedNode] = useState('all');
  
  const [timeRange, setTimeRange] = useState<TimeRange>({
    end: Math.floor(Date.now() / 1000),
    start: Math.floor(subHours(Date.now(), 1).getTime() / 1000),
    preset: 60
  });
  const [customRange, setCustomRange] = useState({
    from: format(subHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
    to: format(new Date(), "yyyy-MM-dd'T'HH:mm")
  });
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60000);
  
  const [metrics, setMetrics] = useState<any>({
    summary: {},
    healthScore: 100,
    alerts: [],
    node: {
      cores: 0,
      memTotal: 0,
      memUsed: 0,
      info: {}
    }
  });

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('obs_dashboard_collapsed');
    return saved ? JSON.parse(saved) : {};
  });

  // --- Effects ---

  useEffect(() => {
    localStorage.setItem('obs_dashboard_collapsed', JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchInitialData = async () => {
    if (!selectedAppId) return;

    try {
      // 1. Fetch specific app info first
      const appRes = await api.get(`/applications/${selectedAppId}`);
      setAppInfo(appRes.data);
      
      // 2. Now fetch other apps in the same environment for the selector
      if (appRes.data?.environmentId) {
        const appsRes = await api.get('/applications', { 
          params: { environmentId: appRes.data.environmentId } 
        });
        setApplications(appsRes.data);
      }
    } catch (e) {
      console.error('Failed to fetch initial data', e);
    }
  };

  const fetchAllMetrics = useCallback(async (isAutoRefresh = false) => {
    if (!selectedAppId || !appInfo) return;
    
    if (isAutoRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const appId = selectedAppId;
      const appName = appInfo.name;
      const node = appInfo.targetNode;

      // 1. Fetch Summary Stats (Instant)
      const [uptimeRes, cpuRes, memRes, oomRes, netRxRes, netTxRes, diskRes] = await Promise.all([
        prometheus.queryInstant(QUERIES.CONTAINER_UPTIME(appId, appName)),
        prometheus.queryInstant(QUERIES.CPU_USAGE_STACKED(appId, appName)),
        prometheus.queryInstant(QUERIES.MEMORY_PRESSURE(appId, appName)),
        prometheus.queryInstant(QUERIES.OOM_EVENTS(appId, appName)),
        prometheus.queryInstant(QUERIES.NETWORK_THROUGHPUT(appId, appName).rx),
        prometheus.queryInstant(QUERIES.NETWORK_THROUGHPUT(appId, appName).tx),
        prometheus.queryInstant(QUERIES.DISK_SPACE_USED(node))
      ]);

      const cpuVal = cpuRes[0]?.value[1] ? parseFloat(cpuRes[0].value[1]) : 0;
      const memVal = memRes[0]?.value[1] ? parseFloat(memRes[0].value[1]) : 0;
      const oomVal = oomRes[0]?.value[1] ? parseFloat(oomRes[0].value[1]) : 0;
      const diskVal = diskRes[0]?.value[1] ? parseFloat(diskRes[0].value[1]) * 100 : 0;

      // 5. Node Resources (Instant)
      const [nodeCoresRes, nodeMemTotalRes, nodeMemUsedRes, nodeInfoRes] = await Promise.all([
        prometheus.queryInstant(QUERIES.NODE_RESOURCES(node).cpu_cores),
        prometheus.queryInstant(QUERIES.NODE_RESOURCES(node).memory_total),
        prometheus.queryInstant(QUERIES.NODE_RESOURCES(node).memory_used),
        prometheus.queryInstant(QUERIES.NODE_INFO(node))
      ]);

      const cores = nodeCoresRes[0]?.value[1] ? parseInt(nodeCoresRes[0].value[1]) : 0;
      const memTotal = nodeMemTotalRes[0]?.value[1] ? parseFloat(nodeMemTotalRes[0].value[1]) : 0;
      const memUsed = nodeMemUsedRes[0]?.value[1] ? parseFloat(nodeMemUsedRes[0].value[1]) : 0;
      const nodeInfo = nodeInfoRes[0]?.metric || {};

      // Helper to parse values safely with optional multiplier and precision
      const safeParse = (res: any[], multiplier: number = 1, decimals: number = 1, fallback: string = '0.0') => {
        if (!res || res.length === 0 || !res[0].value || res[0].value.length < 2) return fallback;
        const val = parseFloat(res[0].value[1]) * multiplier;
        return isFinite(val) ? val.toFixed(decimals) : fallback;
      };

      setMetrics((prev: any) => ({
        ...prev,
        summary: {
          uptime: uptimeRes[0]?.value[1] ? formatDuration(parseFloat(uptimeRes[0].value[1])) : 'N/A',
          cpu: safeParse(cpuRes, 1, 2),
          memory: safeParse(memRes, 1, 1),
          oom: safeParse(oomRes, 1, 0, '0'),
          netRx: formatThroughput(parseFloat(netRxRes[0]?.value[1] || '0')),
          netTx: formatThroughput(parseFloat(netTxRes[0]?.value[1] || '0')),
          disk: safeParse(diskRes, 100, 1),
          status: uptimeRes.length > 0 ? 'UP' : 'DOWN'
        },
        node: {
          cores,
          memTotal: (memTotal / (1024**3)).toFixed(1),
          memUsed: (memUsed / (1024**3)).toFixed(1),
          info: nodeInfo
        }
      }));

      calculateHealthScore(cpuVal, memVal, oomVal, diskVal);
      evaluateAlerts(cpuVal, memVal, oomVal, diskVal);

    } catch (e) {
      console.error('Failed to fetch metrics', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedAppId, appInfo, timeRange]);

  useEffect(() => {
    fetchInitialData();
  }, [selectedAppId]);

  useEffect(() => {
    if (appInfo) {
      fetchAllMetrics();
    }
  }, [appInfo, timeRange, fetchAllMetrics]);

  useEffect(() => {
    if (refreshInterval > 0) {
      const timer = setInterval(() => {
        if (timeRange.preset) {
          const now = Math.floor(Date.now() / 1000);
          setTimeRange({
            end: now,
            start: now - (timeRange.preset * 60),
            preset: timeRange.preset
          });
        }
        fetchAllMetrics(true);
      }, refreshInterval);
      return () => clearInterval(timer);
    }
  }, [refreshInterval, timeRange.preset, fetchAllMetrics]);

  // --- Helpers ---

  const formatDuration = (seconds: number) => {
    if (seconds === 0 || !isFinite(seconds)) return '0s';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatThroughput = (bytes: number) => {
    if (bytes === 0 || !isFinite(bytes)) return '0 B/s';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let i = 0;
    let val = bytes;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i++;
    }
    return `${val.toFixed(1)} ${units[i]}`;
  };

  const calculateHealthScore = (cpu: number, mem: number, oom: number, disk: number) => {
    let score = 100;
    if (cpu > 80) score -= 10;
    if (cpu > 95) score -= 15;
    if (mem > 85) score -= 15;
    if (mem > 95) score -= 20;
    if (oom > 0) score -= 40;
    if (disk > 85) score -= 10;
    if (disk > 95) score -= 20;
    setMetrics((prev: any) => ({ ...prev, healthScore: Math.max(0, score) }));
  };

  const evaluateAlerts = (cpu: number, mem: number, oom: number, disk: number) => {
    const newAlerts: DashboardAlert[] = [];
    if (cpu > 90) newAlerts.push({ id: 'cpu-crit', metric: 'CPU Usage', value: `${cpu.toFixed(1)}%`, threshold: '90%', severity: 'CRITICAL', icon: <XCircle className="w-4 h-4 text-critical" /> });
    else if (cpu > 70) newAlerts.push({ id: 'cpu-warn', metric: 'CPU Usage', value: `${cpu.toFixed(1)}%`, threshold: '70%', severity: 'WARNING', icon: <AlertTriangle className="w-4 h-4 text-warning" /> });
    
    if (mem > 90) newAlerts.push({ id: 'mem-crit', metric: 'Memory Pressure', value: `${mem.toFixed(1)}%`, threshold: '90%', severity: 'CRITICAL', icon: <XCircle className="w-4 h-4 text-critical" /> });
    
    if (oom > 0) newAlerts.push({ id: 'oom-crit', metric: 'OOM Events', value: oom, threshold: '0', severity: 'CRITICAL', icon: <XCircle className="w-4 h-4 text-critical" /> });
    
    if (disk > 90) newAlerts.push({ id: 'disk-crit', metric: 'Disk Saturation', value: `${disk.toFixed(1)}%`, threshold: '90%', severity: 'CRITICAL', icon: <XCircle className="w-4 h-4 text-critical" /> });

    setMetrics((prev: any) => ({ ...prev, alerts: newAlerts }));
  };

  const handlePresetChange = (mins: number) => {
    const now = Math.floor(Date.now() / 1000);
    setTimeRange({
      end: now,
      start: now - (mins * 60),
      preset: mins
    });
    setShowCustomRange(false);
  };

  const handleCustomRangeSubmit = () => {
    const start = Math.floor(new Date(customRange.from).getTime() / 1000);
    const end = Math.floor(new Date(customRange.to).getTime() / 1000);
    setTimeRange({ start, end });
  };

  const SectionHeader: React.FC<{ id: string; title: string; icon: React.ReactNode }> = ({ id, title, icon }) => (
    <div 
      className="flex items-center justify-between py-2 border-b border-border-dark cursor-pointer group"
      onClick={() => toggleSection(id)}
    >
      <div className="flex items-center gap-3">
        <div className="text-primary group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/80">{title}</h2>
      </div>
      {collapsedSections[id] ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col bg-bg-dark h-full overflow-hidden font-sans">
      {/* GLOBAL FILTER BAR */}
      <div className="sticky top-0 z-50 bg-surface-dark border-b border-border-dark p-3 shadow-2xl backdrop-blur-md bg-opacity-90">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-1 hover:bg-white/5 rounded-lg"
              onClick={() => navigate('/observability/apps')}
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Button>
            
            <div className="h-6 w-px bg-border-dark" />
            
            <div className="flex items-center gap-2">
              <Select 
                value={selectedAppId} 
                onChange={(e) => setSelectedAppId(e.target.value)}
                className="w-48 bg-black/40 border-white/5 text-xs h-9"
              >
                {applications.map(app => (
                  <option key={app.id} value={app.id}>{app.name}</option>
                ))}
              </Select>
              
              <Select 
                value={selectedNode} 
                onChange={(e) => setSelectedNode(e.target.value)}
                className="w-40 bg-black/40 border-white/5 text-xs h-9"
              >
                <option value="all">All Nodes</option>
                {appInfo && <option value={appInfo.targetNode}>{appInfo.targetNode}</option>}
              </Select>
              
              <div className="flex items-center gap-1.5 px-3 h-9 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-indigo-400">
                <Filter className="w-3 h-3" />
                {appInfo?.environmentName || 'PROD'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-black/40 border border-white/5 rounded-lg p-0.5">
              {TIME_PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => handlePresetChange(p.value)}
                  className={`px-2.5 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                    timeRange.preset === p.value 
                      ? 'bg-primary text-white shadow-lg' 
                      : 'text-muted-foreground hover:text-white hover:bg-white/5'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => setShowCustomRange(!showCustomRange)}
                className={`px-2.5 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                  showCustomRange ? 'bg-primary text-white' : 'text-muted-foreground hover:text-white hover:bg-white/5'
                }`}
              >
                Custom
              </button>
            </div>

            <div className="h-6 w-px bg-border-dark" />

            <div className="flex items-center gap-2">
              <Select 
                value={refreshInterval} 
                onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                className="w-24 bg-black/40 border-white/5 text-[10px] h-9 font-bold"
              >
                {REFRESH_INTERVALS.map(i => (
                  <option key={i.value} value={i.value}>Refresh: {i.label}</option>
                ))}
              </Select>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 w-9 p-0 border-white/10 hover:bg-white/5"
                onClick={() => fetchAllMetrics()}
                loading={refreshing}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {showCustomRange && (
          <div className="absolute top-full right-4 mt-2 bg-surface-dark border border-border-dark p-4 rounded-xl shadow-2xl animate-in slide-in-from-top-2">
            <div className="flex items-end gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground">From</label>
                <Input 
                  type="datetime-local" 
                  value={customRange.from}
                  onChange={e => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground">To</label>
                <Input 
                  type="datetime-local" 
                  value={customRange.to}
                  onChange={e => setCustomRange(prev => ({ ...prev, to: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
              <Button size="sm" className="h-9" onClick={handleCustomRangeSubmit}>Apply</Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12">
          
          {/* SECTION 1 — EXECUTIVE SUMMARY */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-4 glass-panel shadow-2xl overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                <div className="relative mb-4">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64" cy="64" r="58"
                      stroke="currentColor" strokeWidth="12"
                      fill="transparent"
                      className="text-white/5"
                    />
                    <circle
                      cx="64" cy="64" r="58"
                      stroke="currentColor" strokeWidth="12"
                      fill="transparent"
                      strokeDasharray={364}
                      strokeDashoffset={364 - (364 * metrics.healthScore) / 100}
                      className="transition-all duration-1000 ease-out"
                      style={{ 
                        color: metrics.healthScore >= 80 ? 'var(--color-healthy)' : 
                               metrics.healthScore >= 60 ? 'var(--color-warning)' : 'var(--color-critical)' 
                      }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-mono font-black text-white">{metrics.healthScore}</span>
                    <span className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground">SCORE</span>
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 ${
                  metrics.healthScore >= 80 ? 'bg-healthy/10 text-healthy border border-healthy/20' : 
                  metrics.healthScore >= 60 ? 'bg-warning/10 text-warning border border-warning/20' : 'bg-critical/10 text-critical border border-critical/20'
                }`}>
                  {metrics.healthScore >= 80 ? 'HEALTHY' : 
                   metrics.healthScore >= 60 ? 'DEGRADED' : 'CRITICAL'}
                </div>
                <p className="text-xs text-muted-foreground font-medium">Composite score across infrastructure signals</p>
              </CardContent>
            </Card>

            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard title="Uptime" value={metrics.summary.uptime || 'N/A'} icon={<Clock className="w-4 h-4" />} color="var(--color-primary)" loading={loading} />
              <StatCard title="Restarts (1h)" value={metrics.summary.restarts || '0'} icon={<RefreshCw className="w-4 h-4" />} color="var(--color-warning)" loading={loading} />
              <StatCard title="OOM Events" value={metrics.summary.oom || '0'} icon={<AlertTriangle className="w-4 h-4" />} color="var(--color-critical)" loading={loading} />
              <StatCard 
                title="Status" 
                value={metrics.summary.status || 'DOWN'} 
                icon={<Activity className="w-4 h-4" />} 
                color={metrics.summary.status === 'UP' ? 'var(--color-healthy)' : 'var(--color-critical)'} 
                loading={loading} 
              />
              
              <div className="col-span-full grid grid-cols-2 sm:grid-cols-5 gap-4">
                <StatCard title="CPU Avg" value={metrics.summary.cpu || '0'} unit="%" icon={<Cpu className="w-4 h-4" />} color="var(--color-healthy)" loading={loading} />
                <StatCard title="Memory" value={metrics.summary.memory || '0'} unit="%" icon={<Zap className="w-4 h-4" />} color="var(--color-primary)" loading={loading} />
                <StatCard title="Net RX" value={metrics.summary.netRx || '0 B/s'} icon={<Network className="w-4 h-4" />} color="var(--color-primary)" loading={loading} />
                <StatCard title="Net TX" value={metrics.summary.netTx || '0 B/s'} icon={<Network className="w-4 h-4" />} color="var(--color-primary)" loading={loading} />
                <StatCard title="Disk Used" value={metrics.summary.disk || '0'} unit="%" icon={<HardDrive className="w-4 h-4" />} color="var(--color-warning)" loading={loading} />
              </div>
            </div>
          </div>

          {/* SECTION 2 — RESOURCE SATURATION */}
          <div className="space-y-6">
            <SectionHeader id="saturation" title="Resource Saturation" icon={<Cpu className="w-5 h-5" />} />
            {!collapsedSections['saturation'] && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <MetricPanel 
                  title="CPU Usage Trend" 
                  query={QUERIES.CPU_USAGE_STACKED(selectedAppId, appInfo?.name || '')} 
                  timeRange={timeRange} 
                  unit="%" 
                  color="#10b981" 
                />
                <MetricPanel 
                  title="CPU Throttling" 
                  query={QUERIES.CPU_THROTTLING(selectedAppId, appInfo?.name || '')} 
                  timeRange={timeRange} 
                  unit="%" 
                  color="#f59e0b" 
                  type="line"
                  thresholds={{ warning: 25, critical: 50 }}
                />
                <MetricPanel 
                  title="Memory Pressure" 
                  query={QUERIES.MEMORY_PRESSURE(selectedAppId, appInfo?.name || '')} 
                  timeRange={timeRange} 
                  unit="%" 
                  color="#3b82f6" 
                  thresholds={{ warning: 75, critical: 90 }}
                />
                <MetricPanel 
                  title="Load Average Ratio" 
                  query={QUERIES.LOAD_AVERAGE_RATIO(appInfo?.targetNode)} 
                  timeRange={timeRange} 
                  unit="" 
                  color="#8b5cf6" 
                  type="line"
                  thresholds={{ warning: 1, critical: 2 }}
                />
              </div>
            )}
          </div>

          {/* SECTION 3 — CONTAINER LIFECYCLE */}
          <div className="space-y-6">
            <SectionHeader id="lifecycle" title="Container Lifecycle" icon={<RefreshCw className="w-5 h-5" />} />
            {!collapsedSections['lifecycle'] && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                 <MetricPanel 
                  title="Restart Events" 
                  query={QUERIES.CONTAINER_RESTARTS(selectedAppId, appInfo?.name || '')} 
                  timeRange={timeRange} 
                  unit="" 
                  color="#ef4444" 
                  type="bar"
                />
                <MetricPanel 
                  title="OOM Events" 
                  query={QUERIES.OOM_EVENTS(selectedAppId, appInfo?.name || '')} 
                  timeRange={timeRange} 
                  unit="" 
                  color="#f43f5e" 
                  type="bar"
                />
              </div>
            )}
          </div>

          {/* SECTION 4 — NETWORK HEALTH */}
          <div className="space-y-6">
             <SectionHeader id="network" title="Network Health" icon={<Network className="w-5 h-5" />} />
             {!collapsedSections['network'] && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <MetricPanel 
                  title="Throughput RX" 
                  query={QUERIES.NETWORK_THROUGHPUT(selectedAppId, appInfo?.name || '').rx} 
                  timeRange={timeRange} 
                  unit=" B/s" 
                  color="#3b82f6" 
                />
                <MetricPanel 
                  title="Throughput TX" 
                  query={QUERIES.NETWORK_THROUGHPUT(selectedAppId, appInfo?.name || '').tx} 
                  timeRange={timeRange} 
                  unit=" B/s" 
                  color="#10b981" 
                />
                <MetricPanel 
                  title="Packet Drops RX" 
                  query={QUERIES.NETWORK_DROPS(appInfo?.targetNode).rx} 
                  timeRange={timeRange} 
                  unit=" /s" 
                  color="#f59e0b" 
                  type="line"
                />
                <MetricPanel 
                  title="Packet Drops TX" 
                  query={QUERIES.NETWORK_DROPS(appInfo?.targetNode).tx} 
                  timeRange={timeRange} 
                  unit=" /s" 
                  color="#ef4444" 
                  type="line"
                />
              </div>
            )}
          </div>

          {/* SECTION 5 — STORAGE HEALTH */}
          <div className="space-y-6">
            <SectionHeader id="storage" title="Storage Health" icon={<HardDrive className="w-5 h-5" />} />
            {!collapsedSections['storage'] && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <Card className="glass-panel p-6 space-y-4 text-center flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Disk Space Used</p>
                    <span className="text-xs font-mono text-white font-bold">{metrics.summary.disk}%</span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className={`h-full transition-all duration-1000 ${parseFloat(metrics.summary.disk) > 90 ? 'bg-critical shadow-[0_0_10px_rgba(239,68,68,0.5)]' : parseFloat(metrics.summary.disk) > 75 ? 'bg-warning' : 'bg-healthy'}`}
                      style={{ width: `${metrics.summary.disk}%` }}
                    />
                  </div>
                </Card>
                <MetricPanel 
                  title="Inode Usage" 
                  query={QUERIES.INODE_USED(appInfo?.targetNode)} 
                  timeRange={timeRange} 
                  unit="%" 
                  color="#3b82f6" 
                  thresholds={{ warning: 0.85, critical: 0.95 }}
                />
              </div>
            )}
          </div>

          {/* SECTION 6 — NODE INFORMATION */}
          <div className="space-y-6">
            <SectionHeader id="node" title="Node Information" icon={<Gauge className="w-5 h-5" />} />
            {!collapsedSections['node'] && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <Card className="glass-panel p-4 flex flex-col items-center justify-center text-center group">
                  <div className="p-3 rounded-full bg-primary/10 text-primary mb-2 group-hover:scale-110 transition-transform">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground">CPU Cores</p>
                  <p className="text-xl font-mono font-bold text-white">{metrics.node.cores}</p>
                </Card>
                <Card className="glass-panel p-4 flex flex-col items-center justify-center text-center group">
                  <div className="p-3 rounded-full bg-primary/10 text-primary mb-2 group-hover:scale-110 transition-transform">
                    <Zap className="w-6 h-6" />
                  </div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Total RAM</p>
                  <p className="text-xl font-mono font-bold text-white">{metrics.node.memTotal} GB</p>
                </Card>
                <Card className="glass-panel p-4 flex flex-col items-center justify-center text-center col-span-1 md:col-span-2 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-full space-y-2 relative z-10">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Node Kernel / OS</p>
                    </div>
                    <p className="text-[10px] font-mono text-white text-left truncate">{metrics.node.info.release || 'Unknown'} / {metrics.node.info.sysname || 'Unknown'}</p>
                    <p className="text-[8px] font-mono text-muted-foreground text-left truncate uppercase tracking-tight">Architecture: {metrics.node.info.machine || 'Unknown'}</p>
                  </div>
                </Card>
              </div>
            )}
          </div>

          {/* SECTION 7 — ALERTS & SIGNALS */}
          <div className="space-y-6">
            <SectionHeader id="alerts" title="Alerts & Signals" icon={<AlertTriangle className="w-5 h-5 text-warning" />} />
            {!collapsedSections['alerts'] && (
              <Card className="glass-panel overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                <CardContent className="p-0">
                  {metrics.alerts.length > 0 ? (
                    <div className="divide-y divide-white/5">
                      {metrics.alerts.map((alert: any) => (
                        <div key={alert.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className="group-hover:scale-110 transition-transform">
                              {alert.icon}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">{alert.metric}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Severity: {alert.severity}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-mono text-white font-bold">Value: {alert.value}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Threshold: {alert.threshold}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-healthy/10 border border-healthy/20">
                        <CheckCircle2 className="w-8 h-8 text-healthy" />
                      </div>
                      <div>
                        <p className="text-xs text-white font-bold">All Systems Nominal</p>
                        <p className="text-[10px] text-muted-foreground italic tracking-wide">No active threshold breaches detected across 7 infrastructure signals.</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default AppMetricsDashboard;
