import React from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Layers,
  FileText,
  Activity,
  Server,
  Terminal,
  ChevronRight,
  Flame,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { useEnvironment } from '../context/EnvironmentContext';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Input';
import { Link } from 'react-router-dom';
import api from '../services/api';
import type { DashboardOverview } from '../types/index';

const DashboardPage: React.FC = () => {
  const { environments } = useEnvironment();
  const { user } = useAuth();

  const [overview, setOverview] = React.useState<DashboardOverview | null>(null);
  const [incidents, setIncidents] = React.useState<any[]>([]);

  React.useEffect(() => {
    const fetchOverview = async () => {
      try {
        const response = await api.get('/dashboard/overview');
        setOverview(response.data);
      } catch (error) {
        console.error('Failed to fetch dashboard overview', error);
      }
    };
    const fetchIncidents = async () => {
      try {
        const response = await api.get('/tickets?clusters=all&status=open,acknowledged');
        setIncidents(response.data);
      } catch (error) {
        console.error('Failed to fetch incidents', error);
      }
    };
    fetchOverview();
    fetchIncidents();
    const interval = setInterval(() => {
      fetchOverview();
      fetchIncidents();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { name: 'Active Environments', value: environments.length, icon: Layers, trend: 'Stable', trendUp: true, color: 'text-primary' },
    { name: 'Total Nodes', value: overview?.totalNodes || 0, icon: Server, trend: 'Live', trendUp: true, color: 'text-emerald-500' },
    { name: 'Stability Index', value: `${overview?.stabilityIndex?.toFixed(1) || '0.0'}%`, icon: Activity, trend: 'Baseline', trendUp: (overview?.stabilityIndex || 0) > 95, color: 'text-amber-500' },
    { name: 'Open Tickets', value: overview?.openTickets || 0, icon: FileText, trend: 'Pending', trendUp: (overview?.openTickets || 0) === 0, color: 'text-primary' },
  ];

  const recentActivity = overview?.recentActivity || [];
  const healthStream = overview?.healthStream || ['> Waiting for telemetry...'];
  const systemLoad = overview?.systemLoad || [0, 0, 0, 0, 0, 0, 0];

  return (
    <div className="p-8 space-y-8 min-h-full">
      {/* Welcome Header */}
      <div className="flex items-end justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h1 className="text-4xl font-bold tracking-tight">System Overview</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Welcome back, <span className="text-foreground font-semibold">{user?.username}</span>. Here is what's happening today.
          </p>
        </motion.div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <BarChart3 className="w-4 h-4" />
            Full Report
          </Button>
          <Link to="/environments">
            <Button>
              <Plus className="w-4 h-4" />
              New Environment
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="hover:border-primary/30 transition-all cursor-default">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 rounded-lg bg-secondary ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-bold ${stat.trendUp ? 'text-emerald-500' : 'text-destructive'}`}>
                    {stat.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {stat.trend}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
                  <p className="text-3xl font-bold mt-1 tracking-tight">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Dashboard Visuals */}
        <div className="xl:col-span-2 space-y-8">
          <Card className="h-[400px] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50"></div>
            <CardContent className="h-full flex flex-col items-center justify-center text-center p-12 relative">
              <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <BarChart3 className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3 tracking-tight">Performance Deep Dive</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
                Generate predictive analytics for your distributed network nodes and identify latency bottlenecks before they impact users.
              </p>
              <Link to="/operational">
                <Button size="lg">
                  Launch Intelligence Hub
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-emerald-950/10 border-emerald-500/10">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Terminal className="w-5 h-5 text-emerald-500" />
                  </div>
                  <span className="font-bold text-sm tracking-widest uppercase">Health Stream</span>
                </div>
                <div className="space-y-3 font-mono text-[11px] text-emerald-500/60 leading-relaxed overflow-y-auto max-h-[120px]">
                  {healthStream.map((log, i) => (
                    <p key={i} className={log.includes('CRITICAL') ? 'text-destructive' : log.includes('WARNING') ? 'text-amber-500' : 'text-emerald-500'}>
                      {log}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-bold text-sm tracking-widest uppercase">System Load</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Top Nodes CPU %</span>
                </div>
                <div className="flex items-end gap-2 h-20">
                  {systemLoad.map((h, i) => (
                    <div key={i} className="flex-1 bg-primary/20 rounded-t-sm hover:bg-primary/40 transition-colors relative group" style={{ height: `${Math.max(h, 5)}%` }}>
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-background border border-border px-1 py-0.5 rounded shadow-lg pointer-events-none z-10">
                        {h.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cross-Cluster Incidents */}
          <Card className="bg-[#0c0c0e] border-white/5">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3 text-sm uppercase tracking-[0.2em] font-black text-muted-foreground">
                <Flame className="w-5 h-5 text-destructive" />
                Cross-Cluster Active Incidents
              </div>
              <span className="text-[10px] font-mono font-black text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20 uppercase">
                {incidents.length} Active
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[300px] overflow-y-auto">
                {incidents.length > 0 ? (
                  <div className="divide-y divide-white/5">
                    {incidents.map((incident, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        className="p-4 hover:bg-white/[0.02] transition-colors group relative"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-4">
                            <div className={`p-2 rounded-xl ${incident.status === 'OPEN' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-500'} border border-current/20`}>
                              <ShieldAlert className="w-4 h-4" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-sm font-bold tracking-tight flex items-center gap-2 text-white">
                                {incident.title}
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full border ${incident.status === 'OPEN' ? 'border-destructive/30 text-destructive' : 'border-amber-500/30 text-amber-500'}`}>
                                  {incident.status}
                                </span>
                              </h4>
                              <p className="text-xs text-muted-foreground font-medium leading-relaxed max-w-xl truncate">
                                {incident.description}
                              </p>
                              <div className="flex items-center gap-4 pt-1">
                                 <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/40">
                                    <Clock className="w-3 h-3" />
                                    {new Date(incident.createdAt).toLocaleString()}
                                 </div>
                                 {incident.environment && (
                                   <div className="flex items-center gap-1.5 text-[10px] font-mono text-primary/70">
                                      <Server className="w-3 h-3" />
                                      {incident.environment.name}
                                   </div>
                                 )}
                              </div>
                            </div>
                          </div>
                          <Link to="/tickets">
                            <Button variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-all rounded-xl h-8 px-3 gap-2 border-white/10 hover:bg-white/5 text-[10px]">
                               View
                            </Button>
                          </Link>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                     <ShieldAlert className="w-8 h-8 text-emerald-500 mb-3" />
                     <p className="text-[10px] font-black uppercase tracking-[0.2em]">Zero Active Incidents</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Sidebar */}
        <div className="space-y-8">
          <Card className="h-full">
            <CardContent className="p-8">
              <h3 className="text-xl font-bold mb-6 tracking-tight">Pulse Feed</h3>
              <div className="space-y-6">
                {recentActivity.map((act, i) => (
                  <div key={i} className="flex gap-4 group cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-3 h-3 rounded-full border-2 border-background ${act.type === 'incident' ? 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-primary'}`}></div>
                      {i !== recentActivity.length - 1 && <div className="w-px flex-1 bg-border group-hover:bg-primary/30 transition-colors"></div>}
                    </div>
                    <div className="pb-6">
                      <p className="text-sm font-semibold group-hover:text-primary transition-colors">{act.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono">{act.env}</span>
                        <span>•</span>
                        <span>{new Date(act.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/audit-log">
                <Button variant="ghost" className="w-full mt-4 text-muted-foreground group">
                  View Audit Log
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
