import React, { useState, useEffect } from 'react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import * as prometheus from '../../../services/prometheusService';
import { getCleanNodeIp, parseAlertTransitions } from '../queries';
import type { AlertTransition } from '../queries';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button, Input } from '../../../components/ui/Input';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface IncidentsProps {
  selectedNode: string;
  timeRange: { start: number; end: number };
  triggerRefresh: number;
}

export const Incidents: React.FC<IncidentsProps> = ({
  selectedNode,
  timeRange,
  triggerRefresh
}) => {
  const [loading, setLoading] = useState(true);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [transitions, setTransitions] = useState<AlertTransition[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    const fetchIncidents = async () => {
      if (!selectedNode) return;
      setLoading(true);

      const cleanIp = getCleanNodeIp(selectedNode);
      const { start, end } = timeRange;

      try {
        // 1. Fetch currently firing alerts (instant query)
        const firingRes = await prometheus.queryInstantByKey(
          'NODE_ACTIVE_ALERTS',
          { node_ip: cleanIp }
        );
        setActiveAlerts(firingRes || []);

        // 2. Fetch history of alerts (range query over ALERTS metric)
        const historyRes = await prometheus.queryRangeByKey(
          'NODE_ALERTS_HISTORY',
          start,
          end,
          undefined,
          { node_ip: cleanIp }
        );
        
        const parsedTransitions = parseAlertTransitions(historyRes);
        setTransitions(parsedTransitions);
      } catch (error) {
        console.error('Failed to load incidents data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchIncidents();
  }, [selectedNode, timeRange, triggerRefresh]);

  // Compute incident summary counts
  const totalIncidents = transitions.length;
  const activeCount = transitions.filter(t => t.active).length;
  const criticalCount = transitions.filter(t => t.severity === 'critical').length;
  const warningCount = transitions.filter(t => t.severity === 'warning').length;

  // Search filter
  const filteredTransitions = transitions.filter(t => {
    const query = searchQuery.toLowerCase();
    const matchesName = t.alertname.toLowerCase().includes(query);
    const matchesLabels = Object.entries(t.labels).some(([k, v]) => 
      k.toLowerCase().includes(query) || v.toLowerCase().includes(query)
    );
    return matchesName || matchesLabels;
  });

  // Pagination
  const totalPages = Math.max(Math.ceil(filteredTransitions.length / itemsPerPage), 1);
  const paginatedTransitions = filteredTransitions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Group transitions into time buckets for the "Incident Count over Time" chart
  const getBucketedData = () => {
    const { start, end } = timeRange;
    const duration = end - start;
    const bucketCount = 10;
    const bucketSize = duration / bucketCount;

    const buckets = Array.from({ length: bucketCount }).map((_, idx) => {
      const bStart = start + idx * bucketSize;
      return {
        timestamp: Math.floor(bStart * 1000),
        count: 0
      };
    });

    transitions.forEach(t => {
      const firedTs = Math.floor(new Date(t.firedAt).getTime() / 1000);
      buckets.forEach((b, idx) => {
        const bStart = start + idx * bucketSize;
        const bEnd = bStart + bucketSize;
        if (firedTs >= bStart && firedTs < bEnd) {
          b.count += 1;
        }
      });
    });

    return buckets;
  };

  const bucketedData = getBucketedData();

  // Swimlane Timeline Computations
  const getSwimlaneTimeline = () => {
    const { start, end } = timeRange;
    const rangeDuration = end - start;

    // Group transitions by Alert Name
    const groups: Record<string, AlertTransition[]> = {};
    transitions.forEach(t => {
      if (!groups[t.alertname]) {
        groups[t.alertname] = [];
      }
      groups[t.alertname].push(t);
    });

    return Object.entries(groups).map(([alertname, items]) => {
      const blocks = items.map(item => {
        const firedUnix = Math.floor(new Date(item.firedAt).getTime() / 1000);
        const resolvedUnix = item.resolvedAt === 'Still firing' 
          ? end 
          : Math.floor(new Date(item.resolvedAt).getTime() / 1000);

        const leftPct = Math.max(0, ((firedUnix - start) / rangeDuration) * 100);
        const rightUnix = Math.min(end, resolvedUnix);
        const widthPct = Math.max(0.5, ((rightUnix - firedUnix) / rangeDuration) * 100);

        return {
          leftPct,
          widthPct,
          severity: item.severity,
          firedAt: item.firedAt,
          resolvedAt: item.resolvedAt,
          duration: item.duration
        };
      });

      return {
        alertname,
        blocks
      };
    });
  };

  const swimlanes = getSwimlaneTimeline();

  const formatTime = (tick: number) => {
    try {
      return format(new Date(tick), 'HH:mm');
    } catch {
      return '';
    }
  };

  const chartTheme = {
    grid: { stroke: 'rgba(255,255,255,0.05)', strokeDasharray: '3 3' },
    tooltip: {
      contentStyle: { backgroundColor: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: '8px' },
      labelStyle: { color: '#a1a1aa', fontWeight: 'bold', fontSize: '10px' }
    }
  };

  if (loading) {
    return (
      <Card className="bg-[#1a1d27] border-white/5 h-80 animate-pulse">
        <div />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1a1d27] border border-white/5 p-4 rounded-xl">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#a1a1aa]">Total Incidents</p>
          <p className="text-2xl font-mono font-black text-white mt-1">{totalIncidents}</p>
        </div>

        <div className="bg-[#1a1d27] border border-white/5 p-4 rounded-xl">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#a1a1aa]">Currently Firing</p>
          <p className="text-2xl font-mono font-black text-rose-500 mt-1">{activeCount}</p>
        </div>

        <div className="bg-[#1a1d27] border border-white/5 p-4 rounded-xl">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#a1a1aa]">Critical Priority</p>
          <p className="text-2xl font-mono font-black text-rose-400 mt-1">{criticalCount}</p>
        </div>

        <div className="bg-[#1a1d27] border border-white/5 p-4 rounded-xl">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#a1a1aa]">Warning Priority</p>
          <p className="text-2xl font-mono font-black text-amber-400 mt-1">{warningCount}</p>
        </div>
      </div>

      {/* 2. Active Incidents Table */}
      {activeAlerts.length > 0 && (
        <Card className="bg-rose-950/10 border border-rose-500/20 shadow-2xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-rose-400">Firing Alert Incident Tickets</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-medium">
              <thead>
                <tr className="border-b border-rose-500/10 bg-rose-500/[0.02] text-rose-400 text-[9px] uppercase tracking-widest">
                  <th className="p-4 font-black">Alert ID</th>
                  <th className="p-4 font-black">Severity</th>
                  <th className="p-4 font-black">Details</th>
                  <th className="p-4 font-black text-right">Active Since</th>
                </tr>
              </thead>
              <tbody>
                {activeAlerts.map((alert, idx) => {
                  const m = alert.metric;
                  const sev = m.severity || 'warning';
                  return (
                    <tr key={idx} className="border-b border-rose-500/10 hover:bg-rose-500/[0.01]">
                      <td className="p-4 font-bold text-white font-mono">{m.alertname || 'UnknownAlert'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${
                          sev === 'critical' ? 'bg-rose-500/25 text-rose-400 border border-rose-500/30' : 'bg-amber-500/25 text-amber-400 border border-amber-500/30'
                        }`}>
                          {sev}
                        </span>
                      </td>
                      <td className="p-4 text-[#a1a1aa]">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(m).map(([k, v]) => {
                            if (['__name__', 'alertstate', 'alertname', 'severity', 'instance'].includes(k)) return null;
                            return (
                              <span key={k} className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] font-mono">
                                {k}={v as string}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono text-white/80 font-bold">
                        {format(new Date(parseFloat(alert.value[0]) * 1000), 'yyyy-MM-dd HH:mm:ss')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 3 & 4. Incident Timeline & Grouped counts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SVG Swimlane Timeline */}
        <Card className="bg-[#1a1d27] border border-white/5 shadow-2xl flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">Incident Firing Swimlanes</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-5 space-y-4">
            {swimlanes.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
                No historical incidents in this selected window.
              </div>
            ) : (
              <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                {swimlanes.map((lane, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold text-[#a1a1aa]">
                      <span className="font-mono text-white truncate max-w-[180px]">{lane.alertname}</span>
                    </div>
                    <div className="relative h-6 bg-white/[0.02] border border-white/5 rounded-lg overflow-hidden">
                      {lane.blocks.map((block, blockIdx) => (
                        <div
                          key={blockIdx}
                          className={`absolute top-1 bottom-1 rounded border shadow transition-all hover:scale-y-105 ${
                            block.severity === 'critical' 
                              ? 'bg-rose-500/20 border-rose-500/50 hover:bg-rose-500/35' 
                              : 'bg-amber-500/20 border-amber-500/50 hover:bg-amber-500/35'
                          }`}
                          style={{
                            left: `${block.leftPct}%`,
                            width: `${block.widthPct}%`
                          }}
                          title={`${block.firedAt} -> ${block.resolvedAt} (${block.duration})`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recharts incident counts over time */}
        <Card className="bg-[#1a1d27] border border-white/5 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">Incidents Frequency (Trigger counts)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bucketedData}>
                <CartesianGrid stroke={chartTheme.grid.stroke} strokeDasharray={chartTheme.grid.strokeDasharray} />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#4b5563" fontSize={10} />
                <YAxis stroke="#4b5563" fontSize={10} allowDecimals={false} />
                <Tooltip {...chartTheme.tooltip} labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')} />
                <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} name="Trigger Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 5. Incident Log Transitions table */}
      <Card className="bg-[#1a1d27] border border-white/5 shadow-2xl overflow-hidden">
        <CardHeader className="pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">Incident History Transition Log</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search incidents/labels..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {paginatedTransitions.length === 0 ? (
            <div className="p-12 text-xs text-muted-foreground text-center">
              No historical incident transitions found.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              <table className="w-full text-left border-collapse text-xs font-medium">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02] text-[#a1a1aa] text-[9px] uppercase tracking-widest">
                    <th className="p-4 font-black">Incident Ticket Name</th>
                    <th className="p-4 font-black">Priority</th>
                    <th className="p-4 font-black">Fired At</th>
                    <th className="p-4 font-black">Resolved At</th>
                    <th className="p-4 font-black">Duration</th>
                    <th className="p-4 font-black">Source Labels</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransitions.map((t, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.01]">
                      <td className="p-4 font-bold text-white font-mono flex items-center gap-2">
                        {t.active ? (
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping flex-shrink-0" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-[#10b981] flex-shrink-0" />
                        )}
                        {t.alertname}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${
                          t.severity === 'critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {t.severity}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-[#a1a1aa]">
                        {format(new Date(t.firedAt), 'yyyy-MM-dd HH:mm:ss')}
                      </td>
                      <td className="p-4 font-mono font-bold text-[#a1a1aa]">
                        {t.resolvedAt === 'Still firing' ? (
                          <span className="text-rose-400 animate-pulse font-black uppercase tracking-wider text-[9px]">Firing</span>
                        ) : (
                          format(new Date(t.resolvedAt), 'yyyy-MM-dd HH:mm:ss')
                        )}
                      </td>
                      <td className="p-4 font-mono font-black text-white">{t.duration}</td>
                      <td className="p-4 text-[#a1a1aa]">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {Object.entries(t.labels).map(([k, v]) => (
                            <span key={k} className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] font-mono">
                              {k}={v as string}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination controls */}
              <div className="flex items-center justify-between p-4 bg-white/[0.01]">
                <p className="text-[10px] text-muted-foreground font-semibold">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredTransitions.length)} of {filteredTransitions.length} incidents
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default Incidents;
