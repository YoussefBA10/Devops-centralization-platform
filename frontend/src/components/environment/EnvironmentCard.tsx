import React, { useState, useEffect } from 'react';
import { Card, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Input';
import { Server, Settings, MoreVertical, Cpu, Activity, HardDrive, AlertCircle, MapPin, ArrowUpRight, Loader2, CheckCircle2, XCircle, RefreshCw, Trash2, Terminal } from 'lucide-react';
import { getDeploymentStatus } from '../../services/api';
import type { Environment } from '../../types';

interface EnvResources {
  cpuUsage: number;
  ramUsagePercent: number;
  diskUsagePercent: number;
  nodeCount: number;
}

const ResourceMetric: React.FC<{ label: string; value: number; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      <div className="flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <span className={(value || 0) > 90 ? 'text-destructive' : (value || 0) > 70 ? 'text-amber-500' : 'text-primary'}>
        {(value || 0).toFixed(1)}%
      </span>
    </div>
    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
      <div 
        className={`h-full transition-all duration-1000 ${color}`} 
        style={{ width: `${Math.min(value || 0, 100)}%` }}
      ></div>
    </div>
  </div>
);

interface EnvironmentCardProps {
  env: Environment;
  resources: EnvResources;
  onDeployClick: () => void;
  onNodesClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onRefresh: () => void;
  activeDeploymentIp?: string | null;
}

type DeploymentState = 'idle' | 'deploying' | 'success' | 'failed';

const EnvironmentCard: React.FC<EnvironmentCardProps> = ({ env, resources, onDeployClick, onNodesClick, onEdit, onDelete, onRefresh, activeDeploymentIp }) => {
  const [status, setStatus] = useState<DeploymentState>(activeDeploymentIp ? 'deploying' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fullLog, setFullLog] = useState<string | null>(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Sync internal state with prop if triggered from parent
  useEffect(() => {
    if (activeDeploymentIp) {
      setStatus('deploying');
    }
  }, [activeDeploymentIp]);

  // Polling logic tied to this specific card
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (status === 'deploying' && activeDeploymentIp) {
      interval = setInterval(async () => {
        try {
          const res = await getDeploymentStatus(env.id, activeDeploymentIp);
          const currentStatus = res.data.status;

          if (currentStatus === 'SUCCESS') {
            setStatus('success');
            onRefresh(); // Refresh parent data
            // Maintain success state for 15 seconds for better visibility
            setTimeout(() => setStatus('idle'), 15000);
          } else if (currentStatus === 'FAILED') {
            setStatus('failed');
            setErrorMessage(res.data.shortError || res.data.log?.split('\n').pop() || 'Deployment failed. Check logs.');
            setFullLog(res.data.log || '');
            // Maintain failure state for 1 minute or until manual close
            setTimeout(() => setStatus('idle'), 60000);
          }
        } catch (error) {
          // Keep polling if there's a network error, backend might be starting up
        }
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, activeDeploymentIp, env.id, onRefresh]);

  return (
    <Card className="group hover:border-primary/50 transition-all duration-300 overflow-hidden bg-card/30 backdrop-blur-sm relative">
      {/* Loading Overlay */}
      {status === 'deploying' && (
        <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-[4px] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <h3 className="text-xl font-bold text-white tracking-tight">Deploying agent...</h3>
          <p className="text-muted-foreground mt-2 text-sm font-medium">Please wait while the SSH configuration completes</p>
          <div className="mt-8 px-4 py-1.5 bg-primary/10 rounded-full border border-primary/20">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary animate-pulse">
              Orchestrating Stack
            </span>
          </div>
        </div>
      )}
      
      {/* Success Overlay */}
      {status === 'success' && (
        <div className="absolute inset-0 z-10 bg-emerald-950/80 backdrop-blur-[6px] flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30 mb-4 animate-bounce">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-black text-white tracking-tight">Deployment Success!</h3>
          <p className="text-emerald-400/80 mt-2 font-medium">Infrastructure node is now reporting.</p>
        </div>
      )}

      {/* Failure Overlay */}
      {status === 'failed' && (
        <div className="absolute inset-0 z-10 bg-destructive/90 backdrop-blur-[6px] flex flex-col items-center justify-center animate-in fade-in duration-300 p-6 text-center">
          <XCircle className="w-12 h-12 text-white mb-4" />
          <h3 className="text-xl font-bold text-white">Deployment Failed</h3>
          <p className="text-white/80 mt-2 text-sm max-w-[250px]">{errorMessage}</p>
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" size="sm" onClick={onDeployClick} className="bg-white/10 hover:bg-white/20 border-white/20 text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowLogsModal(true)} className="bg-white/5 border-white/20 text-white hover:bg-white/10">
              <Terminal className="w-4 h-4 mr-2" />
              Logs
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setStatus('idle')} className="text-white hover:bg-white/10">
              <XCircle className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Log Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-4xl bg-[#0c0c0e] border-white/10 shadow-3xl animate-in zoom-in-95 duration-300 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="h-1 w-full bg-destructive" />
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#08080a]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-destructive/10 rounded-xl">
                  <Terminal className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Infrastructure Deployment Logs</h3>
                  <p className="text-sm text-muted-foreground">Target: <span className="font-mono text-white">{activeDeploymentIp || env.prometheusLabel}</span></p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowLogsModal(false)} className="rounded-xl">
                <XCircle className="w-6 h-6" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto bg-black/40 p-6">
              <div className="mb-6 p-4 bg-destructive/5 border border-destructive/20 rounded-xl">
                <h4 className="text-xs font-bold text-destructive uppercase tracking-widest mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Primary Issue Detected
                </h4>
                <p className="text-sm text-red-200 font-medium leading-relaxed">
                  {errorMessage}
                </p>
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Full Technical Output</h4>
                <pre className="p-5 text-[11px] font-mono text-emerald-400/80 leading-relaxed overflow-auto bg-black/60 rounded-xl border border-white/5 whitespace-pre-wrap break-words min-h-[300px]">
                  {fullLog || 'No output available.'}
                </pre>
              </div>
            </div>
            <div className="p-6 border-t border-white/5 bg-[#08080a] flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowLogsModal(false)}>Close</Button>
              <Button onClick={() => { setShowLogsModal(false); onDeployClick(); }}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#1a1a1c] border border-white/5 rounded-2xl flex items-center justify-center group-hover:border-primary/30 group-hover:bg-primary/5 transition-all duration-500">
              <Server className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <CardTitle className="text-2xl flex items-center gap-3 font-bold tracking-tight">
                {env.name}
                {resources.nodeCount > 0 ? (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20">
                    Active
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-widest border border-border">
                    Idle
                  </span>
                )}
              </CardTitle>
              <CardDescription className="mt-1 text-base text-muted-foreground/80">{env.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1 relative">
            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-white/5 transition-colors" onClick={onNodesClick} disabled={status === 'deploying'}>
              <Settings className="w-5 h-5 text-muted-foreground hover:text-white transition-colors" />
            </Button>
            {(onEdit || onDelete) && <div className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className={`rounded-xl hover:bg-white/5 transition-colors ${showMenu ? 'bg-white/10 text-white' : ''}`} 
                disabled={status === 'deploying'}
                onClick={() => setShowMenu(!showMenu)}
              >
                <MoreVertical className="w-5 h-5 text-muted-foreground" />
              </Button>
              
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-[#111114] border border-white/10 rounded-xl shadow-2xl py-2 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                    {onEdit && <button 
                      onClick={() => { onEdit(); setShowMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 flex items-center gap-2 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-primary" />
                      Edit Environment
                    </button>}
                    {onDelete && <button 
                      onClick={() => { onDelete(); setShowMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Environment
                    </button>}
                  </div>
                </>
              )}
            </div>}
          </div>
        </div>

        {resources.nodeCount > 0 ? (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <ResourceMetric 
              label="CPU Load" 
              value={resources.cpuUsage} 
              icon={<Cpu className="w-3 h-3" />} 
              color="bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]" 
            />
            <ResourceMetric 
              label="RAM Usage" 
              value={resources.ramUsagePercent} 
              icon={<Activity className="w-3 h-3" />} 
              color="bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" 
            />
            <ResourceMetric 
              label="Disk Capacity" 
              value={resources.diskUsagePercent} 
              icon={<HardDrive className="w-3 h-3" />} 
              color="bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]" 
            />
          </div>
        ) : (
          <div className="mt-8 py-8 px-4 bg-muted/10 border border-dashed border-white/10 rounded-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4">
               <AlertCircle className="w-6 h-6 text-muted-foreground opacity-30" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">No nodes deployed yet</p>
            <p className="text-xs text-muted-foreground/50 mt-1 max-w-[200px]">Kickstart observation by provisioning a target node.</p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest opacity-60">Target Instance</p>
              <p className="text-xs font-mono text-primary flex items-center gap-1.5 font-bold">
                <MapPin className="w-3.5 h-3.5" />
                {env.prometheusLabel}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest opacity-60">Node Count</p>
              <div className="text-xs font-bold flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${resources.nodeCount > 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-muted'}`}></div>
                {resources.nodeCount} / 255
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              className="rounded-xl px-4 h-11 gap-2 border-white/5 hover:bg-white/5 transition-all duration-300"
              onClick={onNodesClick}
              disabled={status === 'deploying'}
            >
              <Activity className="w-4 h-4" />
              View Nodes
            </Button>
            <Button 
              className="rounded-xl px-6 h-11 gap-2 border-primary/20 hover:bg-primary transition-all duration-300 shadow-xl shadow-primary/5 group"
              variant={resources.nodeCount === 0 ? "primary" : "outline"}
              onClick={onDeployClick}
              disabled={status === 'deploying'}
            >
              Deploy Node
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default EnvironmentCard;
