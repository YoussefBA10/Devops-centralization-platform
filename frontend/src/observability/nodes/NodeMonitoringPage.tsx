import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Server, Cpu, Zap, HardDrive, Network, Activity, ShieldAlert, AlertOctagon } from 'lucide-react';
import * as prometheus from '../../services/prometheusService';
import { deriveInterfaces, deriveMounts, deriveDisks } from './queries';
import { NodeFilterBar } from './NodeFilterBar';
import type { TimeRange } from './NodeFilterBar';
import { SectionWrapper } from './components/SectionWrapper';

// Import sections
import NodeSummary from './sections/NodeSummary';
import CpuAnalysis from './sections/CpuAnalysis';
import MemoryAnalysis from './sections/MemoryAnalysis';
import DiskStorage from './sections/DiskStorage';
import NetworkHealth from './sections/NetworkHealth';
import BlackboxReachability from './sections/BlackboxReachability';
import SystemSignals from './sections/SystemSignals';
import ActiveAlerts from './sections/ActiveAlerts';
import Incidents from './sections/Incidents';

export const NodeMonitoringPage: React.FC = () => {
  const navigate = useNavigate();

  // Filter States
  const [nodes, setNodes] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<string>('');
  
  const [interfaces, setInterfaces] = useState<string[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string>('');

  const [mounts, setMounts] = useState<string[]>([]);
  const [selectedMount, setSelectedMount] = useState<string>('');

  const [disks, setDisks] = useState<string[]>([]);
  const [selectedDisk, setSelectedDisk] = useState<string>('');

  const [timeRange, setTimeRange] = useState<TimeRange>({
    start: Math.floor(Date.now() / 1000) - 3600, // default 1h
    end: Math.floor(Date.now() / 1000),
    preset: 60
  });

  const [refreshInterval, setRefreshInterval] = useState<number>(30000); // default 30s
  const [triggerRefresh, setTriggerRefresh] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);

  // Section Collapse Preferences
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('obs_node_dashboard_collapsed');
      return saved ? JSON.parse(saved) : {
        summary: false,
        cpu: false,
        memory: false,
        disk: false,
        network: false,
        blackbox: false,
        signals: false,
        alerts: false,
        incidents: false
      };
    } catch {
      return {};
    }
  });

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const updated = { ...prev, [sectionId]: !prev[sectionId] };
      localStorage.setItem('obs_node_dashboard_collapsed', JSON.stringify(updated));
      return updated;
    });
  };

  // 1. Fetch initial nodes list
  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const result = await prometheus.queryInstant('node_uname_info');
        if (result && result.length > 0) {
          const fetchedNodes = Array.from(new Set(result.map(r => r.metric.instance))).filter(Boolean);
          setNodes(fetchedNodes);
          if (fetchedNodes.length > 0) {
            setSelectedNode(fetchedNodes[0]);
          }
        } else {
          // Fallback node if query fails
          setNodes(['127.0.0.1:9100']);
          setSelectedNode('127.0.0.1:9100');
        }
      } catch (error) {
        console.error('Failed to fetch node list:', error);
        setNodes(['127.0.0.1:9100']);
        setSelectedNode('127.0.0.1:9100');
      } finally {
        setInitialLoading(false);
      }
    };

    fetchNodes();
  }, []);

  // 2. Fetch derived interfaces, mounts, and disks when selectedNode changes
  useEffect(() => {
    const updateDerivedFilters = async () => {
      if (!selectedNode) return;
      
      try {
        const [ifaceList, mountList, diskList] = await Promise.all([
          deriveInterfaces(selectedNode),
          deriveMounts(selectedNode),
          deriveDisks(selectedNode)
        ]);

        setInterfaces(ifaceList);
        setSelectedInterface(ifaceList[0] || 'eth0');

        setMounts(mountList);
        setSelectedMount(mountList[0] || '/');

        setDisks(diskList);
        setSelectedDisk(diskList[0] || 'sda');
      } catch (error) {
        console.error('Failed to update filters for node:', selectedNode, error);
      }
    };

    updateDerivedFilters();
  }, [selectedNode]);

  // 3. Auto Refresh Interval Trigger
  useEffect(() => {
    if (refreshInterval === 0) return;

    const intervalId = setInterval(() => {
      // If using preset, slide time range end to now
      if (timeRange.preset) {
        const end = Math.floor(Date.now() / 1000);
        const start = end - timeRange.preset * 60;
        setTimeRange({ start, end, preset: timeRange.preset });
      }
      setTriggerRefresh(prev => prev + 1);
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval, timeRange.preset]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    if (timeRange.preset) {
      const end = Math.floor(Date.now() / 1000);
      const start = end - timeRange.preset * 60;
      setTimeRange({ start, end, preset: timeRange.preset });
    }
    setTriggerRefresh(prev => prev + 1);
    // Simulate brief spin
    setTimeout(() => setRefreshing(false), 800);
  };

  if (initialLoading || !selectedNode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Server className="w-12 h-12 text-primary animate-bounce" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Initializing Observability Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">
      {/* Sticky Filter Header */}
      <NodeFilterBar
        nodes={nodes}
        selectedNode={selectedNode}
        onChangeNode={setSelectedNode}
        interfaces={interfaces}
        selectedInterface={selectedInterface}
        onChangeInterface={setSelectedInterface}
        mounts={mounts}
        selectedMount={selectedMount}
        onChangeMount={setSelectedMount}
        timeRange={timeRange}
        onChangeTimeRange={setTimeRange}
        refreshInterval={refreshInterval}
        onChangeRefreshInterval={setRefreshInterval}
        onRefreshNow={handleManualRefresh}
        refreshing={refreshing}
      />

      {/* Main Container */}
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-8 flex-1 w-full">
        {/* Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/operational')}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-[#a1a1aa]" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] animate-pulse" />
                <h1 className="text-xl font-black uppercase tracking-wider text-white">Node Monitoring Dashboard</h1>
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                Infrastructure diagnostics & root cause intelligence mapping
              </p>
            </div>
          </div>
        </div>

        {/* Sections layout */}
        <div className="space-y-6">
          {/* Section 1: Summary */}
          <SectionWrapper
            id="summary"
            title="Node Overview Summary"
            icon={<Server className="w-4 h-4" />}
            isCollapsed={collapsedSections.summary}
            onToggle={() => toggleSection('summary')}
          >
            <NodeSummary selectedNode={selectedNode} triggerRefresh={triggerRefresh} />
          </SectionWrapper>

          {/* Section 8: Active Alerts (Evaluated dynamically) */}
          <SectionWrapper
            id="alerts"
            title="Live Active Alerts"
            icon={<AlertOctagon className="w-4 h-4" />}
            isCollapsed={collapsedSections.alerts}
            onToggle={() => toggleSection('alerts')}
          >
            <ActiveAlerts selectedNode={selectedNode} triggerRefresh={triggerRefresh} />
          </SectionWrapper>

          {/* Section 2: CPU Analysis */}
          <SectionWrapper
            id="cpu"
            title="CPU Utilization & Pressure"
            icon={<Cpu className="w-4 h-4" />}
            isCollapsed={collapsedSections.cpu}
            onToggle={() => toggleSection('cpu')}
          >
            <CpuAnalysis selectedNode={selectedNode} timeRange={timeRange} triggerRefresh={triggerRefresh} />
          </SectionWrapper>

          {/* Section 3: Memory Analysis */}
          <SectionWrapper
            id="memory"
            title="Memory Breakdown & Pressure"
            icon={<Zap className="w-4 h-4" />}
            isCollapsed={collapsedSections.memory}
            onToggle={() => toggleSection('memory')}
          >
            <MemoryAnalysis selectedNode={selectedNode} timeRange={timeRange} triggerRefresh={triggerRefresh} />
          </SectionWrapper>

          {/* Section 4: Disk Storage */}
          <SectionWrapper
            id="disk"
            title="Disk Storage & Inodes"
            icon={<HardDrive className="w-4 h-4" />}
            isCollapsed={collapsedSections.disk}
            onToggle={() => toggleSection('disk')}
          >
            <DiskStorage 
              selectedNode={selectedNode} 
              selectedDisk={selectedDisk}
              onChangeDisk={setSelectedDisk}
              disks={disks}
              timeRange={timeRange} 
              triggerRefresh={triggerRefresh} 
            />
          </SectionWrapper>

          {/* Section 5: Network Health */}
          <SectionWrapper
            id="network"
            title="Network Interface Health"
            icon={<Network className="w-4 h-4" />}
            isCollapsed={collapsedSections.network}
            onToggle={() => toggleSection('network')}
          >
            <NetworkHealth 
              selectedNode={selectedNode} 
              selectedInterface={selectedInterface}
              onChangeInterface={setSelectedInterface}
              interfaces={interfaces}
              timeRange={timeRange} 
              triggerRefresh={triggerRefresh} 
            />
          </SectionWrapper>

          {/* Section 6: Blackbox Reachability */}
          <SectionWrapper
            id="blackbox"
            title="Blackbox Probes & SSL Expiry"
            icon={<Activity className="w-4 h-4" />}
            isCollapsed={collapsedSections.blackbox}
            onToggle={() => toggleSection('blackbox')}
          >
            <BlackboxReachability selectedNode={selectedNode} timeRange={timeRange} triggerRefresh={triggerRefresh} />
          </SectionWrapper>

          {/* Section 7: System Signals */}
          <SectionWrapper
            id="signals"
            title="File Descriptors & HW Temps"
            icon={<ShieldAlert className="w-4 h-4" />}
            isCollapsed={collapsedSections.signals}
            onToggle={() => toggleSection('signals')}
          >
            <SystemSignals selectedNode={selectedNode} triggerRefresh={triggerRefresh} />
          </SectionWrapper>

          {/* Section 9: Incidents */}
          <SectionWrapper
            id="incidents"
            title="Incident Logs & History swimlanes"
            icon={<AlertOctagon className="w-4 h-4" />}
            isCollapsed={collapsedSections.incidents}
            onToggle={() => toggleSection('incidents')}
          >
            <Incidents selectedNode={selectedNode} timeRange={timeRange} triggerRefresh={triggerRefresh} />
          </SectionWrapper>
        </div>
      </div>
    </div>
  );
};
export default NodeMonitoringPage;
