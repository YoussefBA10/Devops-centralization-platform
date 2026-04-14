import React from 'react';
import { Card, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Input';
import { Server, Settings, MoreVertical, Cpu, Activity, HardDrive, AlertCircle, MapPin, ArrowUpRight, Loader2, CheckCircle2 } from 'lucide-react';
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
      <span className={value > 90 ? 'text-destructive' : value > 70 ? 'text-amber-500' : 'text-primary'}>
        {value.toFixed(1)}%
      </span>
    </div>
    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
      <div 
        className={`h-full transition-all duration-1000 ${color}`} 
        style={{ width: `${Math.min(value, 100)}%` }}
      ></div>
    </div>
  </div>
);

interface EnvironmentCardProps {
  env: Environment;
  resources: EnvResources;
  deploymentStatus: 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | null;
  onDeployClick: () => void;
  onNodesClick: () => void;
}

const EnvironmentCard: React.FC<EnvironmentCardProps> = ({ env, resources, deploymentStatus, onDeployClick, onNodesClick }) => {
  return (
    <Card className="group hover:border-primary/50 transition-all duration-300 overflow-hidden bg-card/30 backdrop-blur-sm relative">
      {/* Loading Overlay */}
      {deploymentStatus === 'IN_PROGRESS' && (
        <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <h3 className="text-xl font-bold text-white">Deploying agent...</h3>
          <p className="text-muted-foreground mt-2">Please wait while the SSH configuration completes</p>
        </div>
      )}
      
      {deploymentStatus === 'SUCCESS' && (
        <div className="absolute inset-0 z-10 bg-emerald-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-4" />
          <h3 className="text-xl font-bold text-white">Agent deployed successfully!</h3>
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#1a1a1c] border border-white/5 rounded-2xl flex items-center justify-center group-hover:border-primary/30 group-hover:bg-primary/5 transition-all duration-500">
              <Server className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <CardTitle className="text-2xl flex items-center gap-3">
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
              <CardDescription className="mt-1 text-base">{env.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-white/5" onClick={onNodesClick} disabled={deploymentStatus === 'IN_PROGRESS'}>
              <Settings className="w-5 h-5 text-muted-foreground hover:text-white transition-colors" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-white/5" disabled={deploymentStatus === 'IN_PROGRESS'}>
              <MoreVertical className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {resources.nodeCount > 0 ? (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <ResourceMetric 
              label="CPU Load" 
              value={resources.cpuUsage} 
              icon={<Cpu className="w-3 h-3" />} 
              color="bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" 
            />
            <ResourceMetric 
              label="RAM Usage" 
              value={resources.ramUsagePercent} 
              icon={<Activity className="w-3 h-3" />} 
              color="bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
            />
            <ResourceMetric 
              label="Disk Capacity" 
              value={resources.diskUsagePercent} 
              icon={<HardDrive className="w-3 h-3" />} 
              color="bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" 
            />
          </div>
        ) : (
          <div className="mt-8 py-6 px-4 bg-muted/20 border border-dashed border-white/10 rounded-2xl flex flex-col items-center text-center animate-in zoom-in-95">
            <AlertCircle className="w-8 h-8 text-muted-foreground mb-3 opacity-20" />
            <p className="text-sm font-medium text-muted-foreground">No nodes deployed yet in this environment.</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Click 'Deploy Node' to get started with observation.</p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Target Label</p>
              <p className="text-xs font-mono text-primary flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                {env.prometheusLabel}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Active nodes</p>
              <p className="text-xs font-bold">{resources.nodeCount} / 255</p>
            </div>
          </div>
          <Button 
            className="rounded-xl px-5 h-10 gap-2 border-primary/20 hover:bg-primary transition-all duration-300"
            variant={resources.nodeCount === 0 ? "default" : "outline"}
            onClick={onDeployClick}
            disabled={deploymentStatus === 'IN_PROGRESS'}
          >
            Deploy Node
            <ArrowUpRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default EnvironmentCard;
