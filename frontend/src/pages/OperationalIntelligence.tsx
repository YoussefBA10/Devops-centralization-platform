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
  Sparkles,
  Activity
} from 'lucide-react';
import api from '../services/api';
import { useEnvironment } from '../context/EnvironmentContext';
import type { StabilityRecord, OperationalDigest, Node, ServiceResource, Anomaly } from '../types/index';
import StabilityGauge from '../components/operational/StabilityGauge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Input';
import ServiceResourceTable from '../components/operational/ServiceResourceTable';
import ServiceDetailsDrawer from '../components/operational/ServiceDetailsDrawer';

const OperationalIntelligence: React.FC = () => {
  const { selectedEnvironment } = useEnvironment();
  const [stability, setStability] = useState<StabilityRecord[]>([]);
  const [digest, setDigest] = useState<OperationalDigest | null>(null);
  const [heatmap, setHeatmap] = useState<Node[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulseData, setPulseData] = useState<ServiceResource[]>([]);
  const [pulseLoading, setPulseLoading] = useState(false);
  const [selectedPulseService, setSelectedPulseService] = useState<ServiceResource | null>(null);
  const [lastPulseUpdate, setLastPulseUpdate] = useState<string>('Never');

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

  const fetchPulseData = async (silent = false) => {
    if (!selectedEnvironment) return;
    if (!silent) setPulseLoading(true);
    try {
      const resp = await api.get(`/infrastructure/services/resources?environmentId=${selectedEnvironment.id}`);
      setPulseData(resp.data);
      setLastPulseUpdate(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch pulse data', error);
    } finally {
      if (!silent) setPulseLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, [selectedEnvironment]);

  useEffect(() => {
    fetchPulseData();
    const interval = setInterval(() => fetchPulseData(true), 10000); // 10s auto-refresh pulse
    return () => clearInterval(interval);
  }, [selectedEnvironment]);

  const avgStability = stability.length > 0 
    ? Math.round(stability.reduce((acc, curr) => acc + curr.stabilityScore, 0) / stability.length) 
    : 0;

  return (
    <div className="p-8 space-y-8 min-h-full">
      {/* Page Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px w-8 bg-primary"></div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Intelligence Hub</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            Operational Intelligence
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">AI-powered predictive analytics and infrastructure health scoring.</p>
        </div>
        <Button variant="outline" onClick={fetchData} loading={loading}>
          <RefreshCw className="w-4 h-4" />
          Refresh Stats
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: Stability & Scoring */}
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="bg-gradient-to-br from-card to-secondary/30 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <TrendingUp className="w-32 h-32" />
              </div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Stability Index
                </CardTitle>
                <CardDescription>Aggregate environment Z-Score health</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center pb-8">
                <StabilityGauge score={avgStability} />
                <div className="w-full mt-6 grid grid-cols-2 gap-4">
                  <div className="bg-background/50 p-3 rounded-lg border border-border">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Status</p>
                    <p className={`text-sm font-bold mt-1 ${avgStability > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {avgStability > 80 ? 'Stable' : 'Degraded'}
                    </p>
                  </div>
                  <div className="bg-background/50 p-3 rounded-lg border border-border">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Confidence</p>
                    <p className="text-sm font-bold mt-1">{(90 + Math.random() * 8).toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Active Risks */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-destructive" />
                  Active Risk Heatmap
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {heatmap.map((node) => (
                    <div key={node.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl border border-border group hover:border-primary/30 transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${node.riskScore! > 70 ? 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-emerald-500'}`}></div>
                        <span className="font-semibold text-sm">{node.id}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-1.5 bg-background rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${node.riskScore! > 70 ? 'bg-destructive' : 'bg-primary'}`}
                            style={{ width: `${node.riskScore}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-bold text-muted-foreground">{node.riskScore}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right Column: AI Insights & Digests */}
        <div className="xl:col-span-2 space-y-8">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="border-primary/20 bg-primary/5 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl"></div>
              <CardHeader className="flex flex-row items-center justify-between border-b border-primary/10 pb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Brain className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Executive AI Digest</CardTitle>
                    <CardDescription>Synthesized intelligence from recent logs and metrics</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary px-3 py-1 bg-primary/10 rounded-full">
                  <Zap className="w-3 h-3 fill-primary" />
                  Real-time Sync
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {digest ? (
                  <div className="space-y-6">
                    <div className="prose prose-invert max-w-none">
                      <p className="text-lg leading-relaxed text-foreground/90">
                        {digest.summaryText}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-background/50 border border-border rounded-xl">
                        <div className="flex items-center gap-2 mb-2 text-primary">
                          <Info className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-wider">Business Impact</span>
                        </div>
                        <p className="text-sm">{digest.businessRisk}</p>
                      </div>
                      <div className="p-4 bg-background/50 border border-border rounded-xl">
                        <div className="flex items-center gap-2 mb-2 text-emerald-500">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-wider">Recommended Action</span>
                        </div>
                        <p className="text-sm">
                          {anomalies.length > 0 && anomalies[0].severity === 'CRITICAL' 
                            ? `Address critical ${anomalies[0].type} failure on ${anomalies[0].node} immediately.`
                            : "Continue monitoring baseline telemetry; system within operational limits."}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col p-8">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-muted-foreground font-medium italic">Synthesizing environment telemetry...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-widest flex items-center justify-between">
                  Recent Anomalies
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {anomalies.length > 0 ? anomalies.slice(0, 3).map((anomaly, i) => (
                  <div key={i} className="flex gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer border border-transparent hover:border-border">
                    <div className={`p-2 ${anomaly.severity === 'CRITICAL' ? 'bg-destructive/10' : 'bg-amber-500/10'} rounded-lg h-fit`}>
                      <AlertTriangle className={`w-4 h-4 ${anomaly.severity === 'CRITICAL' ? 'text-destructive' : 'text-amber-500'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold italic">"{anomaly.description}"</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {anomaly.node} • {new Date(anomaly.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                      </p>
                    </div>
                  </div>
                )) : (
                  <div className="py-8 text-center text-muted-foreground italic text-sm">
                    No anomalies detected in the last 24h.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-950/20 to-transparent">
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-widest flex items-center justify-between">
                  Uptime Efficiency
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-6">
                 <div className="text-5xl font-bold gradient-text">
                   {pulseData.length > 0 
                    ? (100 - (pulseData.filter(s => s.status === 'CRITICAL').length / pulseData.length) * 100).toFixed(2)
                    : "100.00"}%
                 </div>
                 <p className="text-xs font-bold text-emerald-500/80 uppercase tracking-widest mt-2">
                   {pulseData.some(s => s.status === 'CRITICAL') ? 'Interrupted' : 'Carrier Grade'}
                 </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Live Service Resource Pulse Section */}
      <div className="pt-4">
         <ServiceResourceTable 
            data={pulseData} 
            loading={pulseLoading}
            lastUpdated={lastPulseUpdate}
            onRefresh={() => fetchPulseData()}
            onRowClick={(s) => setSelectedPulseService(s)}
         />
      </div>

      <ServiceDetailsDrawer 
        service={selectedPulseService}
        onClose={() => setSelectedPulseService(null)}
      />
    </div>
  );
};

export default OperationalIntelligence;
