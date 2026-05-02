import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnvironment } from '../context/EnvironmentContext';
import { getApplications } from '../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Input';
import { Activity, Settings, CheckCircle2, AlertCircle, RefreshCw, XCircle } from 'lucide-react';
import MetricsConfigModal from '../components/applications/MetricsConfigModal';

const ApplicationObservabilityPage: React.FC = () => {
  const { environments, selectedEnvironment, setSelectedEnvironment } = useEnvironment();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [configModalApp, setConfigModalApp] = useState<any>(null);

  const fetchApps = async () => {
    if (!selectedEnvironment) return;
    setLoading(true);
    try {
      const res = await getApplications(selectedEnvironment.id);
      setApplications(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, [selectedEnvironment]);

  return (
    <div className="flex-1 p-8 overflow-y-auto animate-in fade-in duration-500 bg-[#0a0a0b] min-h-full">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Environment Segmented Control */}
        <div className="flex gap-2 p-1 bg-[#0c0c0e] border border-white/5 rounded-xl w-fit">
          {environments.map((env) => (
            <button
              key={env.id}
              onClick={() => setSelectedEnvironment(env)}
              className={`px-6 py-2 rounded-lg text-sm font-black uppercase tracking-widest transition-all ${
                selectedEnvironment?.id === env.id 
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                  : 'text-muted-foreground hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              {env.name}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 text-indigo-400 mb-2">
              <Activity className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-[0.3em] font-mono">App Observability</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">Application Metrics</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Configure and view Golden Signals (Latency, Traffic, Errors, Saturation) for applications in <span className="font-bold text-indigo-400">{selectedEnvironment?.name || '...'}</span>
            </p>
          </div>
          <Button variant="outline" className="h-11 px-6 rounded-xl border-white/10 hover:bg-white/5 gap-2" onClick={fetchApps} loading={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {applications.map((app) => {
            const isConfigured = app.metricsTestStatus === 'SUCCESS';
            const isFailed = app.metricsTestStatus === 'FAILED';

            return (
              <Card key={app.id} className="bg-[#0c0c0e] border-white/5 hover:border-indigo-500/30 transition-all group overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 pr-4">
                      <CardTitle className="text-lg font-bold text-white truncate">{app.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{app.appLanguage} · {app.type}</p>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setConfigModalApp(app); }}
                      className="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 text-muted-foreground hover:text-indigo-400 transition-colors shrink-0"
                      title="Configure Metrics"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Status</span>
                      {isConfigured ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20">
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Active</span>
                        </div>
                      ) : isFailed ? (
                        <div className="flex items-center gap-1.5 text-red-400 bg-red-400/10 px-2 py-1 rounded border border-red-400/20">
                          <XCircle className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Failed</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-400 bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20">
                          <AlertCircle className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Unconfigured</span>
                        </div>
                      )}
                    </div>
                    
                    <Button 
                      className="w-full h-10 gap-2 bg-indigo-500 hover:bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                      disabled={!isConfigured}
                      onClick={() => navigate(`/observability/apps/${app.id}/dashboard`)}
                    >
                      <Activity className="w-4 h-4" />
                      View Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {applications.length === 0 && !loading && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl bg-black/20">
              <Activity className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-bold text-muted-foreground">No Applications Found</h3>
              <p className="text-sm text-muted-foreground/70 mb-6">Deploy applications to this environment first.</p>
            </div>
          )}
        </div>
      </div>

      {configModalApp && (
        <MetricsConfigModal
          app={configModalApp}
          onClose={() => setConfigModalApp(null)}
          onSuccess={() => {
            setConfigModalApp(null);
            fetchApps();
          }}
        />
      )}
    </div>
  );
};

export default ApplicationObservabilityPage;
