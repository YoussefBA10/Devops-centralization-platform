import React, { useState, useEffect, useCallback } from 'react';
import { getDeploymentEvents, triggerPipeline } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Rocket, RefreshCw, Clock, CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react';
import { Button } from '../ui/Input';

interface DeploymentsTabProps {
  appId: number;
  appName: string;
}

const DeploymentsTab: React.FC<DeploymentsTabProps> = ({ appId, appName }) => {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [triggerModal, setTriggerModal] = useState(false);
  const [triggerEnv, setTriggerEnv] = useState('dev');
  const [triggerBranch, setTriggerBranch] = useState('main');
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await getDeploymentEvents(appId);
      setEvents(res.data?.content || []);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Failed to fetch deployment events', e);
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 30000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const handleTrigger = async () => {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const jobName = `app-${appName.toLowerCase().replace(/\s+/g, '-')}-pipeline`;
      await triggerPipeline({ jobName, appId: String(appId), env: triggerEnv, gitBranch: triggerBranch });
      setTriggerResult({ ok: true, msg: 'Pipeline triggered successfully' });
      setTriggerModal(false);
      setTimeout(fetchEvents, 5000);
    } catch (e: any) {
      setTriggerResult({ ok: false, msg: e?.response?.data?.error || 'Failed to trigger pipeline' });
    } finally {
      setTriggering(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Success
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
      case 'ROLLED_BACK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" /> Rolled Back
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/5 text-muted-foreground border border-white/10">
            {status}
          </span>
        );
    }
  };

  const getEnvBadge = (env: string) => {
    const colors: Record<string, string> = {
      prod: 'bg-red-500/10 text-red-400 border-red-500/20',
      staging: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      dev: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${colors[env] || 'bg-white/5 text-muted-foreground border-white/10'}`}>
        {env}
      </span>
    );
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const secondsAgo = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Rocket className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold">CI/CD Deployments</h3>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Updated {secondsAgo < 5 ? 'just now' : `${secondsAgo}s ago`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchEvents} className="h-8 text-[11px] border-white/10">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={() => setTriggerModal(true)} className="h-8 text-[11px] bg-primary hover:bg-primary/90 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Rocket className="w-3.5 h-3.5 mr-1.5" /> Trigger Deploy
            </Button>
          )}
        </div>
      </div>

      {/* Toast result */}
      {triggerResult && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium border ${triggerResult.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {triggerResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {triggerResult.msg}
          <button onClick={() => setTriggerResult(null)} className="ml-auto p-0.5 hover:bg-white/5 rounded"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Table */}
      <div className="border border-white/5 rounded-xl overflow-hidden bg-[#0c0c0e]/80">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="text-left p-3 font-bold">Version</th>
              <th className="text-left p-3 font-bold">Env</th>
              <th className="text-left p-3 font-bold">Status</th>
              <th className="text-left p-3 font-bold">Build</th>
              <th className="text-right p-3 font-bold">Time</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted-foreground/50">
                  <Rocket className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No CI/CD deployments recorded yet.</p>
                </td>
              </tr>
            ) : (
              events.map((evt: any) => (
                <tr key={evt.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 font-mono text-xs text-white">{evt.version}</td>
                  <td className="p-3">{getEnvBadge(evt.env)}</td>
                  <td className="p-3">{getStatusBadge(evt.status)}</td>
                  <td className="p-3 text-xs text-muted-foreground">#{evt.buildNumber || '—'}</td>
                  <td className="p-3 text-right text-xs text-muted-foreground">{evt.startedAt ? timeAgo(evt.startedAt) : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Trigger Modal */}
      {triggerModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#080809] border border-white/10 rounded-xl shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="h-0.5 w-full bg-gradient-to-r from-primary to-blue-400" />
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Trigger Pipeline</h3>
                <button onClick={() => setTriggerModal(false)} className="p-1.5 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-white transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-muted-foreground">Trigger a Jenkins CI/CD pipeline for <span className="font-bold text-white">{appName}</span>.</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-bold">Environment</label>
                  <select value={triggerEnv} onChange={(e) => setTriggerEnv(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white focus:border-primary/50 outline-none">
                    <option value="dev">Development</option>
                    <option value="staging">Staging</option>
                    <option value="prod">Production</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-bold">Git Branch</label>
                  <input value={triggerBranch} onChange={(e) => setTriggerBranch(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white focus:border-primary/50 outline-none" placeholder="main" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setTriggerModal(false)} className="border-white/10">Cancel</Button>
                <Button size="sm" onClick={handleTrigger} loading={triggering} className="bg-primary hover:bg-primary/90">
                  <Rocket className="w-3.5 h-3.5 mr-1.5" /> {triggerEnv === 'prod' ? 'Deploy to Production' : 'Deploy'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeploymentsTab;
