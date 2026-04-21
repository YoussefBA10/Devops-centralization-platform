import React, { useState, useMemo } from 'react';
import { 
  ArrowUpDown, 
  Cpu, 
  HardDrive, 
  Network, 
  RefreshCcw, 
  ShieldCheck, 
  Activity,
  Server,
  Clock,
  Search,
  Filter
} from 'lucide-react';
import { ServiceResource } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';

interface Props {
  data: ServiceResource[];
  onRowClick: (service: ServiceResource) => void;
  lastUpdated: string;
  onRefresh: () => void;
  loading: boolean;
}

const ServiceResourceTable: React.FC<Props> = ({ data, onRowClick, lastUpdated, onRefresh, loading }) => {
  const [sortConfig, setSortConfig] = useState<{ key: keyof ServiceResource, direction: 'asc' | 'desc' } | null>({
    key: 'cpuUsagePercent',
    direction: 'desc'
  });
  const [filter, setFilter] = useState('');

  const sortData = (key: keyof ServiceResource) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];
    
    if (filter) {
      const lowFilter = filter.toLowerCase();
      result = result.filter(s => 
        s.serviceName.toLowerCase().includes(lowFilter) || 
        s.nodeName.toLowerCase().includes(lowFilter)
      );
    }

    if (sortConfig) {
      result.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return result;
  }, [data, sortConfig, filter]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (3600*24));
    const hours = Math.floor((seconds % (3600*24)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CRITICAL': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'WARNING': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      default: return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    }
  };

  const getResourceColor = (percent: number) => {
    if (percent > 80) return 'text-destructive';
    if (percent > 60) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const totals = useMemo(() => {
    const totalCpu = data.reduce((acc, s) => acc + s.cpuUsagePercent, 0) / (data.length || 1);
    const totalMem = data.reduce((acc, s) => acc + s.memoryUsagePercent, 0) / (data.length || 1);
    return {
      cpuAvg: totalCpu,
      memAvg: totalMem
    };
  }, [data]);

  return (
    <Card className="border-white/5 bg-card/30 backdrop-blur-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Live Service Resource Pulse
          </CardTitle>
          <CardDescription>Real-time per-service consumption as % of node total resources</CardDescription>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
            Last updated: {lastUpdated}
          </div>
          <button 
            onClick={onRefresh}
            className={`p-2 hover:bg-white/5 rounded-lg transition-colors ${loading ? 'animate-spin text-primary' : 'text-muted-foreground'}`}
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters and Summary Bar */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Filter by service or node..." 
                className="pl-10 bg-background/50 border-white/10"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-8">
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Total Services</span>
                <span className="text-lg font-bold">{data.length}</span>
              </div>
              <div className="h-8 w-px bg-white/10"></div>
              <div className="flex flex-col items-end text-destructive">
                <span className="text-[10px] uppercase font-bold opacity-70 tracking-tighter font-mono">High Load</span>
                <span className="text-lg font-bold">{data.filter(s => s.status === 'CRITICAL').length}</span>
              </div>
              <div className="h-8 w-px bg-white/10"></div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Cluster CPU Avg</span>
                <span className={`text-lg font-bold ${getResourceColor(totals.cpuAvg)}`}>{totals.cpuAvg.toFixed(1)}%</span>
              </div>
              <div className="h-8 w-px bg-white/10"></div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Cluster RAM Avg</span>
                <span className={`text-lg font-bold ${getResourceColor(totals.memAvg)}`}>{totals.memAvg.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3 cursor-pointer hover:text-primary transition-colors" onClick={() => sortData('serviceName')}>
                  <div className="flex items-center gap-2">Service <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-4 py-3 cursor-pointer hover:text-primary transition-colors" onClick={() => sortData('nodeName')}>
                  <div className="flex items-center gap-2">Node <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-4 py-3 cursor-pointer hover:text-primary transition-colors text-right" onClick={() => sortData('cpuUsagePercent')}>
                  <div className="flex items-center justify-end gap-2">CPU <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-4 py-3 cursor-pointer hover:text-primary transition-colors text-right" onClick={() => sortData('memoryUsagePercent')}>
                  <div className="flex items-center justify-end gap-2">Memory <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-4 py-3 text-right">Disk I/O</th>
                <th className="px-4 py-3 text-right">Network</th>
                <th className="px-4 py-3 text-center">Restarts</th>
                <th className="px-4 py-3 text-right">Uptime</th>
                <th className="px-4 py-3 text-right">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredAndSortedData.map((service, idx) => (
                <tr 
                  key={idx} 
                  onClick={() => onRowClick(service)}
                  className="group hover:bg-white/[0.03] cursor-pointer transition-all border-l-2 border-transparent hover:border-primary/40"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-secondary/50 rounded-lg group-hover:bg-primary/20 transition-colors">
                        <Activity className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-bold text-sm">{service.serviceName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                      <Server className="w-3 h-3" />
                      {service.nodeName}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className={`text-sm font-bold ${getResourceColor(service.cpuUsagePercent)}`}>
                        {service.cpuUsageCores.toFixed(1)} cores
                      </span>
                      <span className="text-[10px] text-muted-foreground">({service.cpuUsagePercent.toFixed(0)}%)</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className={`text-sm font-bold ${getResourceColor(service.memoryUsagePercent)}`}>
                        {formatBytes(service.memoryUsageBytes)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">({service.memoryUsagePercent.toFixed(0)}%)</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-col items-end text-[10px] text-muted-foreground font-mono">
                      <span className="flex items-center gap-1">R: {formatBytes(service.diskReadBytesPerSec)}/s</span>
                      <span className="flex items-center gap-1">W: {formatBytes(service.diskWriteBytesPerSec)}/s</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-col items-end text-[10px] text-muted-foreground font-mono">
                      <span className="flex items-center gap-1 text-emerald-500/80">Rx: {formatBytes(service.networkRxBytesPerSec)}/s</span>
                      <span className="flex items-center gap-1 text-blue-500/80">Tx: {formatBytes(service.networkTxBytesPerSec)}/s</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${service.restartCount > 5 ? 'bg-destructive/20 text-destructive' : 'bg-white/5 text-muted-foreground'}`}>
                      {service.restartCount}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatUptime(service.uptimeSeconds)}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className={`text-[10px] font-bold uppercase tracking-widest border px-2 py-0.5 rounded-md ${getStatusColor(service.status)}`}>
                      {service.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredAndSortedData.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-muted-foreground italic">
                    <div className="flex flex-col items-center gap-3">
                      <Filter className="w-10 h-10 opacity-20" />
                      No services detected matching your filter criteria.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ServiceResourceTable;
