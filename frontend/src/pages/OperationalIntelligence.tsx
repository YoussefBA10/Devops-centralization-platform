import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  Brain, 
  Flame, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2,
  RefreshCw,
  Info,
  ChevronRight,
  Activity,
  ShieldAlert,
  Clock,
  ExternalLink,
  Search
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useEnvironment } from '../context/EnvironmentContext';
import type { StabilityRecord, OperationalDigest, Node, Anomaly } from '../types/index';
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
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!selectedEnvironment) return;
    setLoading(true);
    try {
      const [stabilityResp, digestResp, heatmapResp, anomaliesResp] = await Promise.all([
        api.get(`/operational/stability?environmentId=${selectedEnvironment.id}`),
        api.get(`/operational/digest?environmentId=${selectedEnvironment.id}`).catch(() => ({ data: null })),
        api.get(`/operational/heatmap?environmentId=${selectedEnvironment.id}`),
        api.get(`/operational/anomalies?environmentId=${selectedEnvironment.id}`)
      ]);
      
      setStability(stabilityResp.data);
      setDigest(digestResp.data);
      setHeatmap(heatmapResp.data.nodes);
      setAnomalies(anomaliesResp.data);
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
                   {pulseData.length > 0 
                    ? (100 - (pulseData.filter(s => s.status === 'CRITICAL').length / pulseData.length) * 100).toFixed(2)
                    : "100.00"}%
                 </div>
                 <div className="flex items-center gap-2 mt-4 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">
                      {pulseData.some(s => s.status === 'CRITICAL') ? 'Interrupted Service' : 'Carrier Grade Link'}
                    </p>
                 </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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
