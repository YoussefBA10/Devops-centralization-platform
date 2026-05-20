import React, { useState, useEffect } from 'react';
import * as prometheus from '../../../services/prometheusService';
import { getCleanNodeIp } from '../queries';
import { Card, CardContent } from '../../../components/ui/Card';
import { CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';

interface ActiveAlertsProps {
  selectedNode: string;
  triggerRefresh: number;
}

interface LiveAlert {
  name: string;
  severity: 'CRITICAL' | 'WARNING';
  value: string;
  threshold: string;
  description: string;
}

export const ActiveAlerts: React.FC<ActiveAlertsProps> = ({ selectedNode, triggerRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);

  useEffect(() => {
    const evaluateAlerts = async () => {
      if (!selectedNode) return;
      setLoading(true);

      const cleanIp = getCleanNodeIp(selectedNode);
      const activeAlerts: LiveAlert[] = [];

      try {
        const [
          icmpRes,
          cpuRes,
          memRes,
          diskRes,
          inodeRes,
          dropRes,
          conntrackRes,
          blockedRes
        ] = await Promise.all([
          prometheus.queryInstantByKey('NODE_STATUS', { node_ip: cleanIp }),
          prometheus.queryInstantByKey('CPU_USAGE', { node: selectedNode }),
          prometheus.queryInstantByKey('MEMORY_USED_PCT', { node: selectedNode }),
          prometheus.queryInstantByKey('DISK_USED_PCT', { node: selectedNode, mount: '/' }),
          prometheus.queryInstantByKey('DISK_INODE_USED_PCT', { node: selectedNode, mount: '/' }),
          prometheus.queryInstantByKey('NET_DROP_TOTAL', { node: selectedNode }),
          prometheus.queryInstantByKey('CONNTRACK_UTIL', { node: selectedNode }),
          prometheus.queryInstantByKey('PROCESSES_BLOCKED', { node: selectedNode })
        ]);

        // 1. Host Down
        if (icmpRes && icmpRes.length > 0) {
          const icmpVal = parseFloat(icmpRes[0].value[1]);
          if (icmpVal === 0) {
            activeAlerts.push({
              name: 'Host Down / ICMP Failure',
              severity: 'CRITICAL',
              value: 'Down',
              threshold: 'Offline',
              description: `Node ${cleanIp} is unresponsive to ICMP ping probes.`
            });
          }
        }

        // 2. High CPU Usage
        if (cpuRes && cpuRes.length > 0) {
          const cpuVal = parseFloat(cpuRes[0].value[1]);
          if (cpuVal > 90) {
            activeAlerts.push({
              name: 'Host High CPU Saturation',
              severity: 'CRITICAL',
              value: `${cpuVal.toFixed(1)}%`,
              threshold: '> 90%',
              description: 'CPU utilization has exceeded critical threshold limit.'
            });
          } else if (cpuVal > 70) {
            activeAlerts.push({
              name: 'Host High CPU Usage',
              severity: 'WARNING',
              value: `${cpuVal.toFixed(1)}%`,
              threshold: '> 70%',
              description: 'CPU utilization is elevated.'
            });
          }
        }

        // 3. High Memory Usage
        if (memRes && memRes.length > 0) {
          const memVal = parseFloat(memRes[0].value[1]);
          if (memVal > 90) {
            activeAlerts.push({
              name: 'Host Memory Exhaustion',
              severity: 'CRITICAL',
              value: `${memVal.toFixed(1)}%`,
              threshold: '> 90%',
              description: 'Host physical memory is almost completely exhausted.'
            });
          } else if (memVal > 80) {
            activeAlerts.push({
              name: 'Host High Memory Usage',
              severity: 'WARNING',
              value: `${memVal.toFixed(1)}%`,
              threshold: '> 80%',
              description: 'Physical memory usage is approaching saturation limit.'
            });
          }
        }

        // 4. Disk Saturation (root)
        if (diskRes && diskRes.length > 0) {
          const diskVal = parseFloat(diskRes[0].value[1]);
          if (diskVal > 90) {
            activeAlerts.push({
              name: 'Filesystem Disk Saturation (/)',
              severity: 'CRITICAL',
              value: `${diskVal.toFixed(1)}%`,
              threshold: '> 90%',
              description: 'Filesystem free space on root mount is critically low.'
            });
          } else if (diskVal > 80) {
            activeAlerts.push({
              name: 'Filesystem Low Space (/)',
              severity: 'WARNING',
              value: `${diskVal.toFixed(1)}%`,
              threshold: '> 80%',
              description: 'Root mount storage space is filling up.'
            });
          }
        }

        // 5. Inode Saturation (root)
        if (inodeRes && inodeRes.length > 0) {
          const inodeVal = parseFloat(inodeRes[0].value[1]);
          if (inodeVal > 95) {
            activeAlerts.push({
              name: 'Filesystem Inode Saturation (/)',
              severity: 'CRITICAL',
              value: `${inodeVal.toFixed(1)}%`,
              threshold: '> 95%',
              description: 'Available inodes on root mount are critically depleted.'
            });
          } else if (inodeVal > 80) {
            activeAlerts.push({
              name: 'Filesystem High Inode Usage (/)',
              severity: 'WARNING',
              value: `${inodeVal.toFixed(1)}%`,
              threshold: '> 80%',
              description: 'Root mount inode count is approaching exhaustion.'
            });
          }
        }

        // 6. Network Packet Drops
        if (dropRes && dropRes.length > 0) {
          const dropVal = parseFloat(dropRes[0].value[1]);
          if (dropVal > 10) {
            activeAlerts.push({
              name: 'High Network Packet Drops',
              severity: 'WARNING',
              value: `${dropVal.toFixed(1)}/s`,
              threshold: '> 10/s',
              description: 'High rate of network interface drops detected.'
            });
          }
        }

        // 7. Conntrack Saturation
        if (conntrackRes && conntrackRes.length > 0) {
          const ctVal = parseFloat(conntrackRes[0].value[1]);
          if (ctVal > 90) {
            activeAlerts.push({
              name: 'Conntrack Table Saturation',
              severity: 'CRITICAL',
              value: `${ctVal.toFixed(1)}%`,
              threshold: '> 90%',
              description: 'Netfilter connection tracker table is near exhaustion.'
            });
          } else if (ctVal > 70) {
            activeAlerts.push({
              name: 'High Conntrack Utilization',
              severity: 'WARNING',
              value: `${ctVal.toFixed(1)}%`,
              threshold: '> 70%',
              description: 'Connection tracker table usage is elevated.'
            });
          }
        }



        // 9. Blocked Processes
        if (blockedRes && blockedRes.length > 0) {
          const blockedVal = parseFloat(blockedRes[0].value[1]);
          if (blockedVal > 10) {
            activeAlerts.push({
              name: 'High Blocked Processes count',
              severity: 'WARNING',
              value: `${blockedVal}`,
              threshold: '> 10',
              description: 'Elevated number of processes blocked waiting for disk or network I/O.'
            });
          }
        }

        setAlerts(activeAlerts);
      } catch (error) {
        console.error('Failed to evaluate active alerts:', error);
      } finally {
        setLoading(false);
      }
    };

    evaluateAlerts();
  }, [selectedNode, triggerRefresh]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-16 bg-[#1a1d27] border border-white/5 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="text-xs font-black uppercase tracking-wider">All systems nominal</p>
          <p className="text-[10px] opacity-80 mt-0.5">No active alerts triggered for node {getCleanNodeIp(selectedNode)}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {alerts.map((alert, idx) => (
        <Card key={idx} className={`bg-[#1a1d27] border shadow-2xl overflow-hidden ${
          alert.severity === 'CRITICAL' ? 'border-rose-500/30' : 'border-amber-500/30'
        }`}>
          <CardContent className="p-4 flex gap-4">
            <div className={`p-3 rounded-xl flex-shrink-0 ${
              alert.severity === 'CRITICAL' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
            }`}>
              {alert.severity === 'CRITICAL' ? <AlertOctagon className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-white truncate">{alert.name}</h4>
                <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded ${
                  alert.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {alert.severity}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{alert.description}</p>
              <div className="flex gap-4 pt-1 font-mono text-[9px] font-bold text-[#a1a1aa]">
                <div>Current: <span className="text-white">{alert.value}</span></div>
                <div>Threshold: <span className="text-white">{alert.threshold}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
export default ActiveAlerts;
