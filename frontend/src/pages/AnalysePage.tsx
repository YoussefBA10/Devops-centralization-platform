import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Cpu, 
  Globe, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Brain,
  Zap,
  Ticket as TicketIcon,
  AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import type { Ticket } from '../types/index';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler,
  type ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';
import { useEnvironment } from '../context/EnvironmentContext';
import { useCluster } from '../context/ClusterContext';
import { getAnalyticsDashboard } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface AnalyticsData {
  summaryCards: any[];
  trafficCorrelation: any;
  resourceUsage: any;
  probeSuccess: any;
  topErrors: any[];
  resourcePressure: any[];
  rootCauseChain: any[];
  liveLogs: any[];
  availableServices: string[];
}

const AnalysePage: React.FC = () => {
  const { selectedEnvironment, setSelectedEnvironment } = useEnvironment();
  const { selectedCluster } = useCluster();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const serviceContext = searchParams.get('service') || undefined;
  const nodeContext = searchParams.get('node') || undefined;
  const ticketContext = searchParams.get('ticket') || undefined;
  
  const [timeRange, setTimeRange] = useState('6h');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [logTab, setLogTab] = useState('All');
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  // Find the currently selected ticket object for display
  const selectedTicket = useMemo(() => {
    if (!ticketContext) return null;
    return tickets.find(t => t.id === parseInt(ticketContext)) || null;
  }, [ticketContext, tickets]);

  const incidentWindow = useMemo(() => {
    if (!selectedTicket?.createdAt) return null;
    const end = new Date(selectedTicket.createdAt);
    const rangeHours: Record<string, number> = { '1h': 1, '6h': 6, '24h': 24, '7d': 168 };
    const hours = rangeHours[timeRange] ?? 6;
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    return { start, end };
  }, [selectedTicket, timeRange]);

  const filteredLogs = useMemo(() => {
    if (!data?.liveLogs) return [];
    let logs = data.liveLogs;
    
    if (logTab !== 'All') {
      const severityMap: Record<string, string> = {
        'Errors': 'ERROR',
        'Warnings': 'WARN',
        'Info': 'INFO'
      };
      logs = logs.filter((log: any) => log.severity === severityMap[logTab]);
    }
    
    return logs;
  }, [data?.liveLogs, logTab]);

  const analyticsEnvironmentId = selectedTicket?.environment?.id ?? selectedEnvironment?.id;

  useEffect(() => {
    if (!ticketContext || !tickets.length || !selectedTicket?.environment) return;
    if (selectedEnvironment?.id !== selectedTicket.environment.id) {
      setSelectedEnvironment(selectedTicket.environment);
    }
  }, [ticketContext, tickets, selectedTicket, selectedEnvironment?.id, setSelectedEnvironment]);

  const fetchData = async () => {
    if (!analyticsEnvironmentId) return;
    setLoading(true);
    try {
      const response = await getAnalyticsDashboard(
        analyticsEnvironmentId, 
        timeRange, 
        serviceContext, 
        nodeContext, 
        ticketContext ? parseInt(ticketContext) : undefined
      );
      setData(response.data);
      setLastFetchedAt(new Date());
    } catch (error) {
      console.error('Failed to fetch analytics data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // When a ticket is selected, we are doing historical root cause analysis — do NOT poll.
    // Live polling would be misleading; the data is frozen up to incident creation.
    if (ticketContext) {
      return; // No interval, no auto-refresh
    }
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [analyticsEnvironmentId, timeRange, serviceContext, nodeContext, ticketContext]);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        // When "All Clusters" is selected (selectedCluster === null), load tickets
        // from every environment so the incident dropdown is complete.
        const url = selectedCluster === null
          ? '/tickets?clusters=all'
          : selectedEnvironment
            ? `/tickets?environmentId=${selectedEnvironment.id}`
            : '/tickets?clusters=all';
        const response = await api.get<Ticket[]>(url);
        setTickets(response.data);
      } catch (err) {
        console.error('Failed to fetch tickets', err);
      }
    };
    fetchTickets();
  }, [selectedEnvironment, selectedCluster]);

  const handleTicketSelect = (ticketId: string) => {
    if (!ticketId) {
      navigate('/analyse');
      return;
    }
    const ticket = tickets.find(t => t.id === parseInt(ticketId));
    if (ticket) {
      const service = ticket.application?.serviceNameKeyword || ticket.application?.name;
      const node = ticket.node;
      let url = `/analyse?ticket=${ticketId}`;
      if (service) url += `&service=${service}`;
      if (node) url += `&node=${node}`;
      navigate(url);
    }
  };
  const handleServiceSelect = (serviceName: string) => {
    const params = new URLSearchParams(searchParams);
    if (!serviceName) {
      params.delete('service');
    } else {
      params.set('service', serviceName);
    }
    navigate(`/analyse?${params.toString()}`);
  };
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#1a1a1b',
        titleColor: '#94a3b8',
        bodyColor: '#f8fafc',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#64748b',
          font: { size: 10 }
        }
      },
      y: {
        grid: {
          color: 'rgba(255,255,255,0.05)',
        },
        ticks: {
          color: '#64748b',
          font: { size: 10 }
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'danger': return 'text-destructive';
      case 'warning': return 'text-amber-500';
      default: return 'text-primary';
    }
  };

  const ERROR_SERIES_COLOR = '#ef4444';

  const isErrorSeriesLabel = (label: string) =>
    /errors?\/min/i.test(label) || /error\s*rate/i.test(label);

  const resolveSeriesColor = (ds: { label: string; color: string }) =>
    isErrorSeriesLabel(ds.label) ? ERROR_SERIES_COLOR : ds.color;

  const mapChartDatasets = (datasets: any[]) =>
    datasets.map((ds: any) => {
      const color = resolveSeriesColor(ds);
      return {
        ...ds,
        borderColor: color,
        backgroundColor: ds.fill ? `${color}20` : 'transparent',
        borderDash: ds.dashed ? [5, 5] : [],
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      };
    });


  if (!analyticsEnvironmentId) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Select an environment to view analytics</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-20">
      {/* 0. Context Bar (if active) */}
      {nodeContext && data && filteredLogs.length === 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm text-muted-foreground">
            No application logs for this node in the selected window. Charts and resource pressure still use Prometheus host metrics where available.
          </p>
        </div>
      )}

      {(serviceContext || nodeContext) && (
        <div className="flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-bold text-foreground">Active Incident Context</p>
              <p className="text-xs text-muted-foreground">
                Filtering analytics for service: <span className="font-mono text-primary font-bold">{serviceContext || 'Any'}</span> 
                {nodeContext && <span> on node: <span className="font-mono text-primary font-bold">{nodeContext}</span></span>}
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/analyse')}
            className="border-primary/20 hover:bg-primary/10"
          >
            Clear Context
          </Button>
        </div>
      )}

      {/* 1. Filter Bar */}
      <div className="sticky top-0 z-20 flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-background/80 backdrop-blur-md border border-border rounded-2xl shadow-xl">
        <div className="flex items-center gap-2">
          {['1h', '6h', '24h', '7d'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeRange === range 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-secondary'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
        
        <div className="flex-1 max-w-md relative group">
          <div className="absolute -top-6 left-0 flex items-center gap-1.5">
            <TicketIcon className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Ticket for Root Cause Analysis</span>
          </div>
          <TicketIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <select 
            onChange={(e) => handleTicketSelect(e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer"
            value={ticketContext || ""}
          >
            <option value="" disabled>Choose an incident to start analysis...</option>
            <option value="">Clear Filter (Global View)</option>
            {tickets.map(ticket => (
              <option key={ticket.id} value={ticket.id}>
                {ticket.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 max-w-md relative group">
          <div className="absolute -top-6 left-0 flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Service for Isolation</span>
          </div>
          <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <select 
            onChange={(e) => handleServiceSelect(e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer"
            value={serviceContext || ""}
          >
            <option value="">All Microservices (Full Stack)</option>
            {data?.availableServices?.map(service => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {ticketContext ? 'Snapshot Taken' : 'Last Updated'}
            </p>
            <p className="text-xs font-mono font-black">
              {lastFetchedAt ? lastFetchedAt.toLocaleTimeString() : '—'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="h-10 rounded-xl gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {ticketContext ? 'Re-analyze' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* 2. Signal Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {data?.summaryCards.map((card, i) => (
          <Card key={i} className="bg-secondary/20 border-border group hover:border-primary/30 transition-all">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{card.label}</span>
                <Badge variant="outline" className="text-[9px] uppercase tracking-tighter opacity-60">{card.source}</Badge>
              </div>
              <div className="flex items-end justify-between gap-2">
                <span className={`text-2xl font-black tracking-tight ${
                  card.label === 'Error rate' ? 'text-destructive' : getStatusColor(card.status)
                }`}>{card.value}</span>
                <div className={`flex items-center gap-1 text-[10px] font-bold ${card.delta.startsWith('+') ? 'text-emerald-500' : 'text-destructive'}`}>
                  {card.delta.startsWith('+') ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {card.delta}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pre-Incident Analysis Banner */}
      {ticketContext && selectedTicket && (
        <div className="flex items-start gap-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
          <div className="mt-0.5 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-amber-500 uppercase tracking-widest">Historical Pre-Incident Snapshot</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              All metrics below show the selected range <span className="font-bold text-foreground">ending at incident creation</span> (nothing after).
              Auto-refresh is disabled.
            </p>
            {incidentWindow && (
              <p className="text-[10px] font-mono text-amber-500/70 mt-1.5">
                Window: {incidentWindow.start.toLocaleString()} → {incidentWindow.end.toLocaleString()} (incident created)
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* 3. Traffic & Error Correlation Chart */}
        <div className="xl:col-span-2 space-y-8">
          <Card className="bg-background border-border overflow-hidden">
            <CardHeader className="border-b border-border bg-secondary/10">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black tracking-tight">Traffic & Error Correlation</CardTitle>
                  <CardDescription className="text-xs">
                    {ticketContext
                      ? `Historical data — ${timeRange} before incident creation`
                      : 'Correlating req/s with log error rates and resource usage'}
                  </CardDescription>
                </div>
                {ticketContext
                  ? <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">HISTORICAL</Badge>
                  : <Badge className="bg-primary/10 text-primary border-primary/20">LIVE</Badge>
                }
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[300px] w-full">
                {data && (
                  <Line 
                    data={{
                      labels: data.trafficCorrelation.labels,
                      datasets: mapChartDatasets(data.trafficCorrelation.datasets),
                    }} 
                    options={chartOptions} 
                  />
                )}
              </div>
              <div className="mt-6 flex flex-wrap gap-6 justify-center">
                {data?.trafficCorrelation.datasets.map((ds: any, i: number) => {
                  const color = resolveSeriesColor(ds);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }}></div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${
                        isErrorSeriesLabel(ds.label) ? 'text-destructive' : 'text-muted-foreground'
                      }`}>{ds.label}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Resource usage: CPU, memory, disk */}
          <Card className="bg-background border-border overflow-hidden">
            <CardHeader className="border-b border-border bg-secondary/10">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-primary" />
                    Resource Usage
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {ticketContext
                      ? 'CPU, memory, and disk utilization before the incident'
                      : 'Container CPU, memory, and disk utilization over time'}
                  </CardDescription>
                </div>
                {ticketContext
                  ? <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">HISTORICAL</Badge>
                  : <Badge className="bg-primary/10 text-primary border-primary/20">LIVE</Badge>
                }
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[300px] w-full">
                {data?.resourceUsage && (
                  <Line
                    data={{
                      labels: data.resourceUsage.labels,
                      datasets: mapChartDatasets(data.resourceUsage.datasets),
                    }}
                    options={{
                      ...chartOptions,
                      scales: {
                        ...chartOptions.scales,
                        y: {
                          ...chartOptions.scales?.y,
                          min: 0,
                          max: 100,
                        },
                      },
                    }}
                  />
                )}
              </div>
              <div className="mt-6 flex flex-wrap gap-6 justify-center">
                {data?.resourceUsage?.datasets.map((ds: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: ds.color }}></div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{ds.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 4. Blackbox Probe Success Chart */}
          <Card className="bg-background border-border overflow-hidden">
            <CardHeader className="border-b border-border bg-secondary/10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                  <Globe className="w-5 h-5 text-teal-500" />
                  Endpoint Reachability (SLO)
                </CardTitle>
                {ticketContext
                  ? <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px]">PRE-INCIDENT</Badge>
                  : <Badge className="bg-teal-500/10 text-teal-500 border-teal-500/20 text-[9px]">LIVE</Badge>
                }
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[180px] w-full">
                {data && (
                  <Line 
                    data={{
                      labels: data.probeSuccess.labels,
                      datasets: data.probeSuccess.datasets.map((ds: any) => ({
                        ...ds,
                        borderColor: ds.color,
                        backgroundColor: `${ds.color}10`,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                      }))
                    }} 
                    options={{
                      ...chartOptions,
                      scales: {
                        ...chartOptions.scales,
                        y: {
                          ...chartOptions.scales?.y,
                          min: 0,
                          max: 100,
                        }
                      }
                    }} 
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* 7. Automated Root Cause Chain */}
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                Root Cause Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <AnimatePresence>
                {data?.rootCauseChain.map((rule, i) => (
                  rule.type === 'no_ticket' ? (
                    <motion.div
                      key={rule.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3"
                    >
                      <p className="text-sm font-black text-amber-500 uppercase tracking-widest">{rule.title}</p>
                      <p className="text-sm text-foreground font-medium">{rule.description}</p>
                      {rule.evidence?.map((ev: string, ei: number) => (
                        <p key={ei} className="text-xs text-muted-foreground">{ev}</p>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div 
                      key={rule.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`p-4 rounded-xl border space-y-3 transition-all ${
                        i === 0 ? "bg-primary/[0.03] border-primary/30 shadow-[0_0_15px_rgba(0,123,255,0.05)]" : "bg-background border-border opacity-80"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {i === 0 && (
                            <Badge className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 uppercase font-black tracking-widest text-[10px]">
                              Primary Cause
                            </Badge>
                          )}
                          
                          {rule.probability !== undefined && (
                            <Badge variant="secondary" className="text-[10px] font-black bg-primary/10 text-primary border-primary/20">
                              {Math.round(rule.probability)}% PROBABILITY
                            </Badge>
                          )}

                          <Badge variant="outline" className={`text-[9px] uppercase ${
                            rule.confidence === 'high' ? 'border-emerald-500 text-emerald-500 bg-emerald-500/5' :
                            rule.confidence === 'medium' ? 'border-amber-500 text-amber-500 bg-amber-500/5' :
                            'border-muted-foreground text-muted-foreground'
                          }`}>
                            {rule.confidence} Confidence
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {rule.sources.map((s: string) => (
                            <span key={s} className="text-[8px] uppercase tracking-tighter opacity-50 px-1.5 py-0.5 border border-border rounded-md">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-3 pt-1">
                        <h4 className="text-base font-black text-foreground tracking-tight">{rule.title}</h4>
                        
                        {rule.evidence && rule.evidence.length > 0 && (
                          <div className="bg-black/20 rounded-lg p-3 border border-white/5 space-y-2">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                              <Brain className="w-3 h-3" /> Diagnostics Evidence
                            </p>
                            {rule.evidence.map((ev: string, ei: number) => (
                              <div key={ei} className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-sm bg-primary/60 mt-1 shrink-0" />
                                <p className="text-xs font-mono text-foreground/80 leading-relaxed">{ev}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <Button variant="outline" size="sm" className="w-full text-[10px] font-black uppercase h-8 gap-2 hover:bg-primary hover:text-primary-foreground transition-colors mt-2">
                        Remediation Plan <ExternalLink className="w-3 h-3" />
                      </Button>
                    </motion.div>
                  )
                ))}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* 6. Container Resource Pressure */}
          <Card className="border-border">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                <Cpu className="w-5 h-5 text-primary" />
                Resource Pressure
              </CardTitle>
              <CardDescription className="text-xs">
                {ticketContext
                  ? '2-min average CPU, memory, and disk for services tied to this incident'
                  : serviceContext
                    ? `2-min average for ${serviceContext} and related services`
                    : '2-min average CPU, memory, and disk across environment services'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-6">
              {data?.resourcePressure.map((container, i) => (
                <div key={i} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest">{container.containerName}</span>
                    {container.callout && (
                      <Badge variant="destructive" className="text-[9px] uppercase h-5 font-bold shadow-[0_0_10px_rgba(220,38,38,0.3)]">
                        {container.callout}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-mono text-muted-foreground uppercase">
                        <span>CPU</span>
                        <span>{container.cpuUsage.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${container.cpuUsage > 80 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${Math.min(100, container.cpuUsage)}%` }} />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-mono text-muted-foreground uppercase">
                        <span>MEM</span>
                        <span>{container.memoryUsage.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${container.memoryUsage > 85 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${Math.min(100, container.memoryUsage)}%` }} />
                      </div>
                    </div>

                    {container.diskUsage !== undefined && container.diskUsage > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-mono text-muted-foreground uppercase">
                          <span>DISK</span>
                          <span>{container.diskUsage.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-1000 ${container.diskUsage > 85 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${Math.min(100, container.diskUsage)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 5. Top Errors by Endpoint */}
      <Card className="border-border">
        <CardHeader className="border-b border-border bg-secondary/5 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-black tracking-tight">Top Errors by Endpoint</CardTitle>
            <CardDescription className="text-xs">
              {ticketContext
                ? `Error patterns from ${timeRange} before incident creation`
                : 'Aggregated error patterns ranked by frequency'}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            Ask AI Assistant <Brain className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-secondary/10 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Endpoint</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pattern</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Trend</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.topErrors.map((error, i) => (
                  <tr key={i} className="hover:bg-secondary/5 transition-colors group cursor-pointer">
                    <td className="px-6 py-4">
                      <code className="text-xs font-mono font-bold text-primary">{error.endpoint}</code>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-foreground font-medium truncate max-w-xs">{error.messageExcerpt}</p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1">
                        Seen: {error.firstSeen} → {error.lastSeen}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={error.statusCode >= 500 ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-500'}>
                        {error.statusCode}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {error.sparkline.map((val: number, si: number) => (
                          <div 
                            key={si} 
                            className="w-1.5 bg-destructive/40 rounded-full" 
                            style={{ height: `${(val / Math.max(...error.sparkline)) * 20 + 2}px` }}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-lg font-black text-destructive">{error.count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 8. Live Log Stream */}
      <Card className="border-border overflow-hidden">
        <CardHeader className="border-b border-border bg-secondary/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary fill-primary" />
                {ticketContext ? 'Pre-Incident Log Stream' : 'Live Log Stream'}
              </CardTitle>
              <CardDescription className="text-xs">
                {ticketContext
                  ? `Logs from ${timeRange} before incident creation`
                  : 'Real-time event synthesis from all services'}
              </CardDescription>
            </div>
            <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl border border-border">
              {['All', 'Errors', 'Warnings', 'Info'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setLogTab(tab)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    logTab === tab 
                      ? 'bg-background text-primary shadow-sm border border-border' 
                      : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[400px] overflow-y-auto font-mono text-[11px] divide-y divide-border">
             {filteredLogs.length > 0 ? (
               filteredLogs.map((log: any, i: number) => (
                 <div key={i} className={`p-3 hover:bg-secondary/5 flex gap-4 transition-colors ${
                   log.severity === 'ERROR' ? 'bg-destructive/5 border-l-2 border-destructive' : 
                   log.severity === 'WARN' ? 'bg-amber-500/5 border-l-2 border-amber-500' : ''
                 }`}>
                    <span className="text-muted-foreground opacity-50">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <Badge variant="outline" className="h-fit py-0 text-[8px]">{log.service}</Badge>
                    <span className={`font-bold ${
                      log.severity === 'ERROR' ? 'text-destructive' : 
                      log.severity === 'WARN' ? 'text-amber-500' : 'text-primary'
                    }`}>{log.severity}</span>
                    <span className="flex-1 truncate">{log.rawMessage}</span>
                 </div>
               ))
             ) : (
               <div className="p-8 text-center text-muted-foreground">
                 No logs found for the selected filters.
               </div>
             )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalysePage;
