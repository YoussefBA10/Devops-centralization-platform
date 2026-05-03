import React, { useState, useEffect } from 'react';
import { useEnvironment } from '../../context/EnvironmentContext';
import { getNetworkVms, getVmNetworkMetrics } from '../../services/api';
import { Server, Activity, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  vmId?: string;
}

const VmNetworkHealthTab: React.FC<Props> = () => {
  const { selectedEnvironment } = useEnvironment();
  const [vms, setVms] = useState<any[]>([]);
  const [metricsData, setMetricsData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVms = async () => {
      if (!selectedEnvironment) return;
      try {
        const res = await getNetworkVms('1', selectedEnvironment.id.toString());
        setVms(res.data);
        
        // Fetch metrics for each VM
        const mData: Record<string, any> = {};
        await Promise.all(res.data.map(async (vm: any) => {
          try {
            const mRes = await getVmNetworkMetrics(vm.id, '1h');
            mData[vm.id] = mRes.data;
          } catch (e) {
            console.error(`Failed to fetch metrics for ${vm.id}`);
          }
        }));
        setMetricsData(mData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchVms();
    const interval = setInterval(fetchVms, 60000);
    return () => clearInterval(interval);
  }, [selectedEnvironment]);

  if (loading && vms.length === 0) return <div className="p-6 text-muted-foreground">Loading VM network health...</div>;

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
      <h2 className="text-lg font-bold mb-6">VM Network Health</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vms.map((vm) => {
          const metrics = metricsData[vm.id] || {};
          return (
            <div key={vm.id} className="bg-white/5 border border-white/10 rounded-lg p-5 hover:bg-white/10 transition-colors cursor-pointer">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-500/20 rounded-md text-blue-400 mr-3">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{vm.name || vm.ipAddress}</h3>
                    <p className="text-xs text-muted-foreground">{vm.role} • {vm.ipAddress}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 p-3 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground flex items-center"><Activity className="w-3 h-3 mr-1" /> TCP Retransmits</span>
                    <span className="text-xs font-bold">{getLatestValue(metrics.retransmitRate?.result?.[0]?.values)}/s</span>
                  </div>
                  {renderSparkline(metrics.retransmitRate?.result?.[0]?.values, '#f59e0b')}
                </div>

                <div className="bg-black/20 p-3 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground flex items-center"><ArrowDownCircle className="w-3 h-3 mr-1" /> Packet Drops</span>
                    <span className="text-xs font-bold">{getLatestValue(metrics.dropRate?.result?.[0]?.values)}/s</span>
                  </div>
                  {renderSparkline(metrics.dropRate?.result?.[0]?.values, '#ef4444')}
                </div>

                <div className="bg-black/20 p-3 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground flex items-center"><ArrowUpCircle className="w-3 h-3 mr-1 text-teal-400" /> BW Out</span>
                    <span className="text-xs font-bold">{getLatestValue(metrics.txMbps?.result?.[0]?.values)} Mbps</span>
                  </div>
                  {renderSparkline(metrics.txMbps?.result?.[0]?.values, '#2dd4bf')}
                </div>

                <div className="bg-black/20 p-3 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground flex items-center"><ArrowDownCircle className="w-3 h-3 mr-1 text-blue-400" /> BW In</span>
                    <span className="text-xs font-bold">{getLatestValue(metrics.rxMbps?.result?.[0]?.values)} Mbps</span>
                  </div>
                  {renderSparkline(metrics.rxMbps?.result?.[0]?.values, '#60a5fa')}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VmNetworkHealthTab;
