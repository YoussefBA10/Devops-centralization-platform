import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Activity, 
  Cpu, 
  HardDrive, 
  Network, 
  ShieldAlert, 
  Clock, 
  Server,
  Zap,
  BarChart3,
  History,
  RefreshCw
} from 'lucide-react';
import { restartApplication, getApplications, getEnvironmentNodes, restartContainer } from '../../services/api';
import { useToast } from '../ui/Toast';
import { useEnvironment } from '../../context/EnvironmentContext';
import type { ServiceResource, Application, Node } from '../../types/index';

interface Props {
  service: ServiceResource | null;
  onClose: () => void;
}

const ServiceDetailsDrawer: React.FC<Props> = ({ service, onClose }) => {
  const { selectedEnvironment } = useEnvironment();
  const { showToast } = useToast();
  const [restarting, setRestarting] = React.useState(false);

  if (!service) return null;

  const handleRestart = async () => {
    if (!selectedEnvironment) return;
    setRestarting(true);
    try {
      // 1. Fetch applications for this environment to find the ID
      const appsRes = await getApplications(selectedEnvironment.id);
      const apps: Application[] = appsRes.data;
      
      const normalize = (s: string) => s.toLowerCase().replace(/[-_ ]/g, '');
      const searchName = normalize(service.serviceName);

      // Match by serviceNameKeyword (which is what pulse uses) or name
      const targetApp = apps.find(a => 
        normalize(a.serviceNameKeyword || '') === searchName || 
        normalize(a.name) === searchName
      );

      if (!targetApp) {
        // 1b. Fallback: Generic restart for system/infra containers (like cadvisor)
        const nodesRes = await getEnvironmentNodes(selectedEnvironment.id);
        const nodes: Node[] = nodesRes.data;
        
        const targetNode = nodes.find(n => 
          n.label === service.nodeName || 
          n.ip === service.nodeName ||
          n.id === service.nodeName ||
          (n.id.includes('-') && n.id.split('-').pop()?.replace(/-/g, '.') === service.nodeName)
        );

        if (!targetNode || !targetNode.ip) {
          showToast(`Could not find a managed application or node IP for "${service.serviceName}".`, 'warning');
          return;
        }

        await restartContainer(targetNode.ip, service.serviceName);
        showToast(`System container restart triggered for ${service.serviceName}.`, 'success');
        onClose();
        return;
      }

      // 2. Trigger restart
      await restartApplication(targetApp.id);
      showToast(`Restart command sent for ${targetApp.name}.`, 'success');
      onClose();
    } catch (err) {
      console.error("Restart failed", err);
      showToast("Failed to trigger restart.", 'error');
    } finally {
      setRestarting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex justify-end">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Drawer Content */}
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-xl bg-[#0a0a0a] border-l border-white/5 h-full shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="p-8 border-b border-white/5 relative bg-gradient-to-br from-primary/10 to-transparent">
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-primary/20 rounded-2xl shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{service.serviceName}</h2>
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-mono mt-0.5">
                  <Server className="w-3.5 h-3.5" />
                  {service.nodeName}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
               <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${service.status === 'HEALTHY' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                 {service.status}
               </span>
               <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-secondary/50 text-muted-foreground border-white/10">
                 Docker Container
               </span>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                  <Cpu className="w-4 h-4" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">CPU Allocation</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-primary">{service.cpuUsageCores.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">cores</span>
                </div>
                <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${service.cpuUsagePercent}%` }}></div>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                  <BarChart3 className="w-4 h-4" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">Memory Workset</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-500">{(service.memoryUsageBytes / (1024*1024)).toFixed(0)}</span>
                  <span className="text-xs text-muted-foreground">MB</span>
                </div>
                <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${service.memoryUsagePercent}%` }}></div>
                </div>
              </div>
            </div>

            {/* Deep Telemetry Section */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Network & I/O Internal
              </h3>
              <div className="space-y-3">
                 <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                   <div className="flex items-center gap-3">
                     <Network className="w-4 h-4 text-blue-500" />
                     <span className="text-sm font-medium">Network Throughput</span>
                   </div>
                   <div className="text-right">
                     <p className="text-sm font-bold">{(service.networkRxBytesPerSec / 1024).toFixed(1)} KB/s In</p>
                     <p className="text-[10px] text-muted-foreground">{(service.networkTxBytesPerSec / 1024).toFixed(1)} KB/s Out</p>
                   </div>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                   <div className="flex items-center gap-3">
                     <HardDrive className="w-4 h-4 text-amber-500" />
                     <span className="text-sm font-medium">Disk Operations</span>
                   </div>
                   <div className="text-right">
                     <p className="text-sm font-bold">{(service.diskWriteBytesPerSec / (1024*1024)).toFixed(2)} MB/s Write</p>
                     <p className="text-[10px] text-muted-foreground">Local storage IOPS priority: High</p>
                   </div>
                 </div>
              </div>
            </div>

            {/* Lifecycle Health */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Service Lifecycle
              </h3>
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Process Uptime</p>
                    <p className="text-lg font-bold flex items-center gap-2 text-foreground/90">
                      <Clock className="w-4 h-4 text-emerald-500" />
                      {Math.floor(service.uptimeSeconds / 3600)}h {Math.floor((service.uptimeSeconds % 3600) / 60)}m
                    </p>
                 </div>
                 <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Crash / Restarts</p>
                    <p className={`text-lg font-bold flex items-center gap-2 ${service.restartCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      <ShieldAlert className="w-4 h-4" />
                      {service.restartCount} Events
                    </p>
                 </div>
              </div>
            </div>

            {/* AI Diagnosis (Mock for executive feel) */}
            <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Activity className="w-16 h-16" />
               </div>
               <h4 className="text-sm font-bold text-primary mb-2 flex items-center gap-2">
                 <Zap className="w-4 h-4 fill-primary" />
                 AI Intelligence Verdict
               </h4>
               <p className="text-xs leading-relaxed text-foreground/80 italic">
                 "Service '{service.serviceName}' is performing within nominal stability bounds. 
                 Resource consumption trends indicate an expected spike during peak UTC traffic. 
                 No immediate intervention required."
               </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-white/5 flex gap-4">
            <button 
              onClick={handleRestart}
              disabled={restarting}
              className="flex-1 py-3 bg-primary text-black font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2"
            >
              {restarting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {restarting ? 'Restarting...' : 'Restart Service'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ServiceDetailsDrawer;
