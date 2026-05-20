import React, { useState, useEffect } from 'react';
import * as prometheus from '../../../services/prometheusService';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Terminal, Activity, Zap, ShieldAlert } from 'lucide-react';

interface SystemSignalsProps {
  selectedNode: string;
  triggerRefresh: number;
}

interface TempSensor {
  sensor: string;
  chip: string;
  temp: number;
}

export const SystemSignals: React.FC<SystemSignalsProps> = ({ selectedNode, triggerRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [fdPercent, setFdPercent] = useState<number>(0);
  const [fdAllocated, setFdAllocated] = useState<number>(0);
  const [fdMax, setFdMax] = useState<number>(0);
  const [runningProcesses, setRunningProcesses] = useState<number>(0);
  const [blockedProcesses, setBlockedProcesses] = useState<number>(0);
  const [entropyBits, setEntropyBits] = useState<number>(0);
  const [tempSensors, setTempSensors] = useState<TempSensor[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedNode) return;
      setLoading(true);

      try {
        const [
          fdPctRes,
          fdAllocRes,
          fdMaxRes,
          runningRes,
          blockedRes,
          entropyRes,
          tempRes
        ] = await Promise.all([
          prometheus.queryInstantByKey('FILE_FD_USED_PCT', { node: selectedNode }),
          prometheus.queryInstantByKey('FILE_FD_ALLOCATED', { node: selectedNode }),
          prometheus.queryInstantByKey('FILE_FD_MAXIMUM', { node: selectedNode }),
          prometheus.queryInstantByKey('PROCESSES_RUNNING', { node: selectedNode }),
          prometheus.queryInstantByKey('PROCESSES_BLOCKED', { node: selectedNode }),
          prometheus.queryInstantByKey('ENTROPY_POOL', { node: selectedNode }),
          prometheus.queryInstantByKey('HW_TEMP', { node: selectedNode })
        ]);

        setFdPercent(fdPctRes && fdPctRes.length > 0 ? parseFloat(fdPctRes[0].value[1]) : 0);
        setFdAllocated(fdAllocRes && fdAllocRes.length > 0 ? parseInt(fdAllocRes[0].value[1]) : 0);
        setFdMax(fdMaxRes && fdMaxRes.length > 0 ? parseInt(fdMaxRes[0].value[1]) : 0);

        setRunningProcesses(runningRes && runningRes.length > 0 ? parseInt(runningRes[0].value[1]) : 0);
        setBlockedProcesses(blockedRes && blockedRes.length > 0 ? parseInt(blockedRes[0].value[1]) : 0);
        setEntropyBits(entropyRes && entropyRes.length > 0 ? parseInt(entropyRes[0].value[1]) : 0);

        const sensors: TempSensor[] = [];
        if (tempRes && tempRes.length > 0) {
          tempRes.forEach(r => {
            sensors.push({
              sensor: r.metric.sensor || 'sensor',
              chip: r.metric.chip || 'hwmon',
              temp: parseFloat(r.value[1])
            });
          });
        }
        setTempSensors(sensors);

      } catch (error) {
        console.error('Failed to load system signals:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedNode, triggerRefresh]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="bg-[#1a1d27] border-white/5 h-24 animate-pulse">
            <div />
          </Card>
        ))}
      </div>
    );
  }

  const isFdWarn = fdPercent > 80;
  const isBlockedWarn = blockedProcesses > 10;
  const isEntropyWarn = entropyBits < 256;

  return (
    <div className="space-y-6">
      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. File Descriptors */}
        <Card className={`bg-[#1a1d27] border shadow-xl transition-all duration-300 ${
          isFdWarn ? 'border-rose-500/30' : 'border-white/5'
        }`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-[#a1a1aa]">File Descriptors</span>
              <Terminal className={`w-4 h-4 ${isFdWarn ? 'text-rose-500' : 'text-primary'}`} />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-mono font-black text-white">{fdPercent.toFixed(2)}%</span>
                <span className="text-[10px] text-[#a1a1aa] font-bold">used</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${isFdWarn ? 'bg-rose-500' : 'bg-primary'}`} 
                  style={{ width: `${Math.min(fdPercent, 100)}%` }} 
                />
              </div>
              <p className="text-[9px] text-[#a1a1aa] font-bold font-mono">
                {fdAllocated} / {fdMax}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 2. Running Processes */}
        <Card className="bg-[#1a1d27] border border-white/5 shadow-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-[#a1a1aa]">Running Processes</span>
              <Activity className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <div className="text-xl font-mono font-black text-white">{runningProcesses}</div>
              <p className="text-[9px] text-[#a1a1aa] font-bold">Currently running threads</p>
            </div>
          </CardContent>
        </Card>

        {/* 3. Blocked Processes */}
        <Card className={`bg-[#1a1d27] border shadow-xl transition-all duration-300 ${
          isBlockedWarn ? 'border-amber-500/30' : 'border-white/5'
        }`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-[#a1a1aa]">Blocked Processes</span>
              <ShieldAlert className={`w-4 h-4 ${isBlockedWarn ? 'text-amber-500' : 'text-[#a1a1aa]'}`} />
            </div>
            <div className="space-y-1">
              <div className="text-xl font-mono font-black text-white">{blockedProcesses}</div>
              <p className="text-[9px] text-[#a1a1aa] font-bold">
                {isBlockedWarn ? 'Warning: High disk/IO wait blocks' : 'Threads waiting for I/O'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 4. Entropy Pool */}
        <Card className={`bg-[#1a1d27] border shadow-xl transition-all duration-300 ${
          isEntropyWarn ? 'border-amber-500/30' : 'border-white/5'
        }`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-[#a1a1aa]">Entropy Available</span>
              <Zap className={`w-4 h-4 ${isEntropyWarn ? 'text-amber-500' : 'text-primary'}`} />
            </div>
            <div className="space-y-1">
              <div className="text-xl font-mono font-black text-white">{entropyBits} <span className="text-xs">bits</span></div>
              <p className="text-[9px] text-[#a1a1aa] font-bold">
                {isEntropyWarn ? 'Warning: Low cryptographic entropy' : 'Random seed pool size'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hardware Temperatures */}
      <Card className="bg-[#1a1d27] border border-white/5 shadow-2xl overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-[#a1a1aa]">Hardware Temperature Sensors</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {tempSensors.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              No hardware temperature sensors detected on this host.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {tempSensors.map((sensor, i) => {
                const isWarn = sensor.temp > 80;
                const isCrit = sensor.temp > 90;
                return (
                  <div key={i} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center space-y-1">
                    <p className="text-[8px] font-black uppercase text-[#a1a1aa] tracking-wider truncate" title={sensor.sensor}>
                      {sensor.sensor}
                    </p>
                    <p className={`text-lg font-mono font-black ${
                      isCrit ? 'text-rose-500' : isWarn ? 'text-amber-500' : 'text-emerald-500'
                    }`}>
                      {sensor.temp.toFixed(1)}°C
                    </p>
                    <p className="text-[8px] text-muted-foreground font-semibold truncate">
                      {sensor.chip}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default SystemSignals;
