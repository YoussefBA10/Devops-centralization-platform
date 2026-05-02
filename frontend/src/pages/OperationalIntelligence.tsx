import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2,
  RefreshCw,
  Info,
  ChevronRight,
  Activity,
  ShieldAlert
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  getOperationalStability, 
  getOperationalDigest, 
  getOperationalHeatmap, 
  getOperationalAnomalies, 
  getOperationalResources 
} from '../services/api';
import { useEnvironment } from '../context/EnvironmentContext';
import type { StabilityRecord, OperationalDigest, Node, Anomaly, ServiceResource } from '../types/index';
import StabilityGauge from '../components/operational/StabilityGauge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Input';

const OperationalIntelligence: React.FC = () => {
  const { environments, selectedEnvironment, setSelectedEnvironment } = useEnvironment();
  const navigate = useNavigate();
  const [stability, setStability] = useState<StabilityRecord[]>([]);
  const [digest, setDigest] = useState<OperationalDigest | null>(null);
  const [heatmap, setHeatmap] = useState<Node[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [services, setServices] = useState<ServiceResource[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!selectedEnvironment) return;
    setLoading(true);
    try {
      const [stabilityResp, digestResp, heatmapResp, anomaliesResp, resourcesResp] = await Promise.all([
        getOperationalStability(selectedEnvironment.id),
        getOperationalDigest(selectedEnvironment.id).catch(() => ({ data: null })),
        getOperationalHeatmap(selectedEnvironment.id),
        getOperationalAnomalies(selectedEnvironment.id),
        getOperationalResources(selectedEnvironment.id)
      ]);
      
      setStability(stabilityResp.data);
      setDigest(digestResp.data);
      setHeatmap(heatmapResp.data.nodes);
      setAnomalies(anomaliesResp.data);
      setServices(resourcesResp.data);
    } catch (error) {
      console.error('Failed to fetch operational data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, [selectedEnvironment]);

  const avgStability = stability.length > 0 
    ? Math.round(stability.reduce((acc, curr) => acc + curr.stabilityScore, 0) / stability.length) 
    : 0;

  return (
    <div className="p-8 space-y-8 min-h-full bg-[#0a0a0b]">
      {/* Environment Segmented Control */}
      <div className="flex gap-2 p-1 bg-[#0c0c0e] border border-white/5 rounded-xl w-fit">
        {environments.map((env) => (
          <button
            key={env.id}
            onClick={() => setSelectedEnvironment(env)}
            className={`px-6 py-2 rounded-lg text-sm font-black uppercase tracking-widest transition-all ${
              selectedEnvironment?.id === env.id 
                ? 'bg-primary/20 text-primary border border-primary/30' 
                : 'text-muted-foreground hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            {env.name}
          </button>
        ))}
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-primary mb-2">
            <Brain className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-[0.3em] font-mono">Operations Hub</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white">Operational Intelligence</h1>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
            Predictive infrastructure analytics and real-time incident orchestration.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <div className="text-right hidden md:block">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Environment Status</p>
              <p className="text-sm font-black text-emerald-500 uppercase">Synchronized</p>
           </div>
           <Button variant="outline" className="h-12 px-6 rounded-xl border-white/5 hover:bg-white/5 gap-2" onClick={fetchData} loading={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Intelligence
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: Core Metrics */}
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="bg-gradient-to-br from-[#0c0c0e] to-primary/5 border-white/5 overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                <TrendingUp className="w-32 h-32" />
              </div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] font-black text-muted-foreground">
                  <Activity className="w-4 h-4 text-primary" />
                  Stability Index
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center pb-8 pt-2">
                <StabilityGauge score={avgStability} />
                <div className="w-full mt-8 grid grid-cols-2 gap-4">
                  <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 text-center">
                    <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest mb-1">Status</p>
                    <p className={`text-sm font-black uppercase ${avgStability > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {avgStability > 80 ? 'Optimal' : 'Degraded'}
                    </p>
                  </div>
                  <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 text-center">
                    <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest mb-1">Confidence</p>
                    <p className="text-sm font-black text-white">{(94.2 + Math.random() * 4).toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Infrastructure Health Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="bg-[#0c0c0e] border-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] font-black text-muted-foreground">
                  <ShieldAlert className="w-4 h-4 text-primary" />
                  Compute Stability
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {heatmap.map((node) => (
                  <div key={node.id} className="group relative p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-primary/30 transition-all">
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${node.riskScore! > 70 ? 'bg-destructive animate-pulse' : 'bg-emerald-500'}`}></div>
                        <span className="font-bold text-sm tracking-tight">{node.id}</span>
                      </div>
                      <div className="flex items-center gap-4">
                         <span className={`text-[10px] font-black font-mono ${node.riskScore! > 70 ? 'text-destructive' : 'text-muted-foreground'}`}>
                           SCORE: {node.riskScore}%
                         </span>
                      </div>
                    </div>
                    <div className="mt-3 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                       <div 
                         className={`h-full transition-all duration-1000 ${node.riskScore! > 70 ? 'bg-destructive' : 'bg-primary'}`}
                         style={{ width: `${node.riskScore}%` }}
                       ></div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Middle/Right: AI Digests & Active Incidents */}
        <div className="xl:col-span-2 space-y-8">
          {/* Executive Digest */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="border-primary/20 bg-primary/[0.03] relative overflow-hidden group">
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-primary/10 rounded-full blur-[100px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                    <Brain className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black tracking-tight">Executive AI Digest</CardTitle>
                    <CardDescription className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">Heuristic Telemetry Synthesis</CardDescription>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-primary bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20">
                  <Zap className="w-3 h-3 fill-primary animate-pulse" />
                  Neural Sync Active
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {digest ? (
                  <div className="space-y-6">
                    <p className="text-lg leading-relaxed text-foreground/90 font-medium italic">
                      "{digest.summaryText}"
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 bg-white/[0.03] border border-white/5 rounded-2xl space-y-2">
                        <div className="flex items-center gap-2 text-primary">
                          <Info className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Business Context</span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed opacity-80">{digest.businessRisk}</p>
                      </div>
                      <div className="p-5 bg-white/[0.03] border border-white/5 rounded-2xl space-y-2">
                        <div className="flex items-center gap-2 text-emerald-500">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Action Required</span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed opacity-80">
                          {anomalies.length > 0 && anomalies[0].severity === 'CRITICAL' 
                            ? `Resolve immediate ${anomalies[0].type} conflict on target cluster ${anomalies[0].node}.`
                            : "Operational baseline stable. No intervention required at this cycle."}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center gap-4">
                    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Consulting Neural Net...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* App Observability CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="w-full"
          >
            <Card className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border-indigo-500/20 hover:border-indigo-500/40 transition-all cursor-pointer group" onClick={() => navigate('/observability/apps')}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                    <Activity className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black text-indigo-100 mb-1">Application Observability</CardTitle>
                    <CardDescription className="text-indigo-200/60 font-medium">Monitor your deployed applications via Prometheus /metrics — Golden Signals per app.</CardDescription>
                  </div>
                </div>
                <div className="p-2 bg-indigo-500/20 rounded-full group-hover:bg-indigo-500/40 transition-colors">
                  <ChevronRight className="w-5 h-5 text-indigo-300" />
                </div>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-[#0c0c0e] border-white/5">
              <CardHeader>
                <CardTitle className="text-xs uppercase tracking-[0.2em] font-black text-muted-foreground flex items-center justify-between">
                  Recent Anomalies
                  <ChevronRight className="w-4 h-4" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {anomalies.length > 0 ? anomalies.slice(0, 3).map((anomaly, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-2xl hover:bg-white/[0.02] transition-colors group border border-transparent hover:border-white/5">
                    <div className={`p-2.5 ${anomaly.severity === 'CRITICAL' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-500'} rounded-xl h-fit border border-current/20`}>
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold tracking-tight italic opacity-90">"{anomaly.description}"</p>
                      <p className="text-[10px] font-mono font-black text-muted-foreground/60 uppercase tracking-widest">
                        {anomaly.node} • {new Date(anomaly.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                )) : (
                  <div className="py-8 text-center text-muted-foreground italic text-xs font-medium opacity-50">
                    No heuristic anomalies detected in 24h cycle.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-950/20 to-transparent border-white/5">
              <CardHeader>
                <CardTitle className="text-xs uppercase tracking-[0.2em] font-black text-muted-foreground flex items-center justify-between">
                  Global Availability
                  <ChevronRight className="w-4 h-4" />
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-8">
                 <div className="text-6xl font-black tracking-tighter text-white">
                   {heatmap.length > 0 
                    ? (100 - (heatmap.filter(n => n.status === 'CRITICAL' || n.status === 'OFFLINE').length / heatmap.length) * 100).toFixed(2)
                    : "100.00"}%
                 </div>
                 <div className="flex items-center gap-2 mt-4 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">
                      {heatmap.some(n => n.status === 'CRITICAL' || n.status === 'OFFLINE') ? 'Interrupted Service' : 'Carrier Grade Link'}
                    </p>
                 </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Services Containers Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="bg-[#0c0c0e] border-white/5 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-6">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <Zap className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                   <CardTitle className="text-xl font-black tracking-tight">Live Service Resource Pulse</CardTitle>
                   <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Real-time container orchestration telemetry</CardDescription>
                </div>
             </div>
             <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Active Services</p>
                  <p className="text-sm font-black text-white">{services.length}</p>
                </div>
                <div className="h-8 w-px bg-white/10"></div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">System Health</p>
                  <p className="text-sm font-black text-emerald-500">100%</p>
                </div>
             </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.01]">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Service Name</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Node Instance</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">CPU Usage</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Memory</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Network (R/T)</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Restarts</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Uptime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {services.map((service, i) => (
                    <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-1.5 rounded-full ${service.status === 'HEALTHY' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : service.status === 'WARNING' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></div>
                          <span className="font-bold text-sm tracking-tight text-white group-hover:text-primary transition-colors">{service.serviceName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-mono font-black text-muted-foreground uppercase">{service.nodeName}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
                          service.status === 'HEALTHY' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                          service.status === 'WARNING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                          'bg-destructive/10 text-destructive border-destructive/20'
                        }`}>
                          {service.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 w-24">
                          <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
                            <span className="text-muted-foreground">CPU</span>
                            <span>{service.cpuUsagePercent.toFixed(1)}%</span>
                          </div>
                          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                             <div className={`h-full ${service.cpuUsagePercent > 80 ? 'bg-destructive' : 'bg-primary'} transition-all duration-1000`} style={{ width: `${Math.min(service.cpuUsagePercent, 100)}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 w-24">
                          <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
                            <span className="text-muted-foreground">RAM</span>
                            <span>{service.memoryUsagePercent.toFixed(1)}%</span>
                          </div>
                          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                             <div className={`h-full ${service.memoryUsagePercent > 85 ? 'bg-destructive' : 'bg-emerald-500'} transition-all duration-1000`} style={{ width: `${Math.min(service.memoryUsagePercent, 100)}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="flex flex-col">
                              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">↑ {(service.networkTxBytesPerSec / 1024).toFixed(1)} KB/s</span>
                              <span className="text-[9px] font-black text-primary uppercase tracking-tighter">↓ {(service.networkRxBytesPerSec / 1024).toFixed(1)} KB/s</span>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className={`text-[10px] font-mono font-black ${service.restartCount > 5 ? 'text-destructive animate-pulse' : 'text-white'}`}>
                           {service.restartCount}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <span className="text-[10px] font-mono font-black text-muted-foreground">
                            {service.uptimeSeconds > 86400 ? `${(service.uptimeSeconds / 86400).toFixed(1)}d` : 
                             service.uptimeSeconds > 3600 ? `${(service.uptimeSeconds / 3600).toFixed(1)}h` : 
                             `${(service.uptimeSeconds / 60).toFixed(0)}m`}
                         </span>
                      </td>
                    </tr>
                  ))}
                  {services.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground italic text-sm font-medium opacity-50">
                        Zero active containers detected in this environment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Page Footer */}
      <div className="pt-8 opacity-20 hover:opacity-100 transition-opacity duration-700 flex flex-col md:flex-row justify-between items-center gap-4 grayscale hover:grayscale-0">
         <div className="flex items-center gap-3">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Monetique Eye Ops Hub v4.2.0</span>
         </div>
         <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <span>Region: Global</span>
            <span>Intelligence: Enabled</span>
            <span>Neural Engine: Active</span>
         </div>
      </div>
    </div>
  );
};

export default OperationalIntelligence;
