import React, { useState, useEffect } from 'react';
import { useEnvironment } from '../../context/EnvironmentContext';
import { useCluster } from '../../context/ClusterContext';
import { Server, Activity, ArrowDownCircle, ArrowUpCircle, Container, HardDrive, BarChart3 } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, AreaChart, Area } from 'recharts';
import { getNetworkNodes, getVmNetworkMetrics, getVmContainerMetrics } from '../../services/api';

interface Props {
  vmId?: string;
}

const VmNetworkHealthTab: React.FC<Props> = () => {
  const { selectedEnvironment } = useEnvironment();
  const { selectedCluster } = useCluster();
  const [nodes, setNodes] = useState<any[]>([]);
  const [metricsData, setMetricsData] = useState<Record<string, any>>({});
  const [containerMetrics, setContainerMetrics] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<Record<string, 'node' | 'containers'>>({});

  const fetchNodes = async () => {
    const clusterId = selectedCluster?.id.toString();
    
    try {
      const res = await getNetworkNodes(clusterId, undefined);
      setNodes(res.data);
      
      const mData: Record<string, any> = {};
      const cData: Record<string, any> = {};
      
      await Promise.all(res.data.map(async (node: any) => {
        try {
          const [mRes, cRes] = await Promise.all([
            getVmNetworkMetrics(node.id, '1h'),
            getVmContainerMetrics(node.id, '1h')
          ]);
          mData[node.id] = mRes.data;
          cData[node.id] = cRes.data;
        } catch (e) {
          console.error(`Failed to fetch metrics for ${node.id}`);
        }
      }));
      setMetricsData(mData);
      setContainerMetrics(cData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(fetchNodes, 60000);
    return () => clearInterval(interval);
  }, [selectedEnvironment, selectedCluster]);

  if (loading && nodes.length === 0) return <div className="p-6 text-muted-foreground">Loading VM network health...</div>;

  const renderSparkline = (dataArr: any[], color: string) => {
    if (!dataArr || dataArr.length === 0) return <div className="h-12 flex items-center justify-center text-xs text-muted-foreground">No data</div>;
    
    // Transform prometheus range data [timestamp, value] to objects
    const chartData = dataArr.map((point: any) => ({
      time: point[0],
      value: parseFloat(point[1])
    }));

    return (
      <div className="h-12 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '4px', fontSize: '12px' }}
              labelFormatter={() => ''}
            />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const getLatestValue = (dataArr: any[]) => {
    if (!dataArr || dataArr.length === 0) return '0';
    return parseFloat(dataArr[dataArr.length - 1][1]).toFixed(2);
  };

  return (
    <div className="h-full w-full overflow-y-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold">VM Network Health</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nodes.map((node) => {
          const metrics = metricsData[node.id] || {};
          const containers = containerMetrics[node.id] || {};
          const mode = viewMode[node.id] || 'node';
          
          return (
            <div key={node.id} className="bg-[#0f1117]/80 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden shadow-xl flex flex-col group">
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg mr-3 ${node.status === 'DEGRADED' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{node.nodeName || node.ip}</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{node.role || 'Managed Node'} • {node.ip}</p>
                  </div>
                </div>
                <div className="flex bg-black/40 p-1 rounded-md border border-white/5">
                  <button 
                    onClick={() => setViewMode({...viewMode, [node.id]: 'node'})}
                    className={`px-2 py-1 text-[10px] rounded transition-all ${mode === 'node' ? 'bg-blue-500 text-white font-bold' : 'text-muted-foreground hover:text-white'}`}
                  >
                    Node
                  </button>
                  <button 
                    onClick={() => setViewMode({...viewMode, [node.id]: 'containers'})}
                    className={`px-2 py-1 text-[10px] rounded transition-all ${mode === 'containers' ? 'bg-blue-500 text-white font-bold' : 'text-muted-foreground hover:text-white'}`}
                  >
                    Apps
                  </button>
                </div>
              </div>

              <div className="p-5 flex-1 space-y-4">
                {mode === 'node' ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground flex items-center uppercase font-medium">
                            <Activity className="w-3 h-3 mr-1 text-amber-400" /> TCP Retrans
                          </span>
                          <span className="text-xs font-mono font-bold text-amber-400">{getLatestValue(metrics.retransmitRate?.result?.[0]?.values)}/s</span>
                        </div>
                        {renderSparkline(metrics.retransmitRate?.result?.[0]?.values, '#f59e0b')}
                      </div>

                      <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground flex items-center uppercase font-medium">
                            <HardDrive className="w-3 h-3 mr-1 text-emerald-400" /> TCP Estab
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-400">{getLatestValue(metrics.tcpEstab?.result?.[0]?.values)}</span>
                        </div>
                        {renderSparkline(metrics.tcpEstab?.result?.[0]?.values, '#10b981')}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground flex items-center uppercase font-medium">
                              <ArrowUpCircle className="w-3 h-3 mr-1 text-teal-400" /> Bandwidth Out
                            </span>
                            <span className="text-xs font-bold text-white mt-1">{getLatestValue(metrics.txMbps?.result?.[0]?.values)} Mbps</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-muted-foreground flex items-center uppercase font-medium">
                              <ArrowDownCircle className="w-3 h-3 mr-1 text-blue-400" /> Bandwidth In
                            </span>
                            <span className="text-xs font-bold text-white mt-1">{getLatestValue(metrics.rxMbps?.result?.[0]?.values)} Mbps</span>
                          </div>
                        </div>
                        <div className="h-16 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics.txMbps?.result?.[0]?.values?.map((p: any, i: number) => ({
                              time: p[0],
                              out: parseFloat(p[1]),
                              in: parseFloat(metrics.rxMbps?.result?.[0]?.values?.[i]?.[1] || '0')
                            }))}>
                              <defs>
                                <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                              <Area type="monotone" dataKey="out" stroke="#2dd4bf" fillOpacity={1} fill="url(#colorOut)" />
                              <Area type="monotone" dataKey="in" stroke="#60a5fa" fillOpacity={1} fill="url(#colorIn)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="flex justify-between items-center px-2 py-1 bg-white/5 rounded-md border border-white/5">
                        <div className="flex items-center text-[10px] text-muted-foreground">
                          <BarChart3 className="w-3 h-3 mr-1 text-red-400" />
                          <span className="uppercase">Net Errors:</span>
                          <span className="ml-2 font-mono text-white">{getLatestValue(metrics.errors?.result?.[0]?.values)}</span>
                        </div>
                        <div className="flex items-center text-[10px] text-muted-foreground">
                          <span className="uppercase">Dropped:</span>
                          <span className="ml-2 font-mono text-white">{getLatestValue(metrics.dropRate?.result?.[0]?.values)}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {Object.keys(containers).length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground text-xs italic">
                        No container network metrics available
                      </div>
                    ) : (
                      Object.entries(containers).map(([name, cMetrics]: [string, any]) => (
                        <div key={name} className="bg-black/20 p-3 rounded-lg border border-white/5">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <Container className="w-3 h-3 mr-2 text-blue-400" />
                              <span className="text-xs font-bold text-white truncate max-w-[120px]">{name}</span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <span className="text-[10px] text-teal-400 font-mono">↑{getLatestValue(cMetrics.txMbps)}</span>
                              <span className="text-[10px] text-blue-400 font-mono">↓{getLatestValue(cMetrics.rxMbps)}</span>
                            </div>
                          </div>
                          <div className="h-8 w-full opacity-50">
                            {renderSparkline(cMetrics.rxMbps, '#60a5fa')}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VmNetworkHealthTab;
