import React, { useState } from 'react';
import { Filter, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Select } from '../../components/ui/Select';
import { Button, Input } from '../../components/ui/Input';

export interface TimeRange {
  start: number; // Unix timestamp
  end: number;   // Unix timestamp
  preset?: number; // minutes
}

interface NodeFilterBarProps {
  nodes: string[];
  selectedNode: string;
  onChangeNode: (node: string) => void;

  interfaces: string[];
  selectedInterface: string;
  onChangeInterface: (iface: string) => void;

  mounts: string[];
  selectedMount: string;
  onChangeMount: (mount: string) => void;

  timeRange: TimeRange;
  onChangeTimeRange: (range: TimeRange) => void;

  refreshInterval: number;
  onChangeRefreshInterval: (interval: number) => void;

  onRefreshNow: () => void;
  refreshing: boolean;
}

const REFRESH_INTERVALS = [
  { label: 'Off', value: 0 },
  { label: '15s', value: 15000 },
  { label: '30s', value: 30000 },
  { label: '1m', value: 60000 },
  { label: '5m', value: 300000 },
];

const TIME_PRESETS = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
  { label: '3h', value: 180 },
  { label: '6h', value: 360 },
  { label: '12h', value: 720 },
  { label: '24h', value: 1440 },
  { label: '7d', value: 10080 },
];

export const NodeFilterBar: React.FC<NodeFilterBarProps> = ({
  nodes,
  selectedNode,
  onChangeNode,
  interfaces,
  selectedInterface,
  onChangeInterface,
  mounts,
  selectedMount,
  onChangeMount,
  timeRange,
  onChangeTimeRange,
  refreshInterval,
  onChangeRefreshInterval,
  onRefreshNow,
  refreshing
}) => {
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [customRange, setCustomRange] = useState({
    from: new Date(Date.now() - 3600000).toISOString().slice(0, 16),
    to: new Date().toISOString().slice(0, 16)
  });

  const handlePresetChange = (mins: number) => {
    const end = Math.floor(Date.now() / 1000);
    const start = end - mins * 60;
    onChangeTimeRange({ start, end, preset: mins });
    setShowCustomRange(false);
  };

  const handleCustomApply = () => {
    const start = Math.floor(new Date(customRange.from).getTime() / 1000);
    const end = Math.floor(new Date(customRange.to).getTime() / 1000);
    if (start && end && start < end) {
      onChangeTimeRange({ start, end });
      setShowCustomRange(false);
    }
  };

  return (
    <div className="sticky top-0 z-50 bg-[#1a1d27]/90 border-b border-[#2a2d3a] p-3 shadow-2xl backdrop-blur-md">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between gap-4 md:hidden">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-wider text-white">Filters</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setMobileExpanded(!mobileExpanded)}
            className="p-1 hover:bg-white/5 rounded-lg"
          >
            {mobileExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        <div className={`mt-3 flex-col gap-4 md:mt-0 md:flex md:flex-row md:items-center md:justify-between ${
          mobileExpanded ? 'flex' : 'hidden md:flex'
        }`}>
          {/* selectors */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1 w-full sm:w-44">
              <label className="text-[9px] font-black uppercase text-[#a1a1aa] tracking-widest">Node</label>
              <Select 
                value={selectedNode} 
                onChange={(e) => onChangeNode(e.target.value)}
                className="w-full bg-black/40 border-white/5 text-xs h-9"
              >
                {nodes.map(node => (
                  <option key={node} value={node}>{node}</option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1 w-full sm:w-36">
              <label className="text-[9px] font-black uppercase text-[#a1a1aa] tracking-widest">Interface</label>
              <Select 
                value={selectedInterface} 
                onChange={(e) => onChangeInterface(e.target.value)}
                className="w-full bg-black/40 border-white/5 text-xs h-9"
              >
                {interfaces.map(iface => (
                  <option key={iface} value={iface}>{iface}</option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1 w-full sm:w-32">
              <label className="text-[9px] font-black uppercase text-[#a1a1aa] tracking-widest">Mount Point</label>
              <Select 
                value={selectedMount} 
                onChange={(e) => onChangeMount(e.target.value)}
                className="w-full bg-black/40 border-white/5 text-xs h-9"
              >
                {mounts.map(mount => (
                  <option key={mount} value={mount}>{mount}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* Time pickers and refresh */}
          <div className="flex flex-wrap items-end gap-3 mt-4 md:mt-0">
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-[9px] font-black uppercase text-[#a1a1aa] tracking-widest">Time Range</label>
              <div className="flex items-center bg-black/40 border border-white/5 rounded-lg p-0.5">
                {TIME_PRESETS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => handlePresetChange(p.value)}
                    className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${
                      timeRange.preset === p.value 
                        ? 'bg-primary text-white shadow-lg' 
                        : 'text-muted-foreground hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => setShowCustomRange(!showCustomRange)}
                  className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${
                    showCustomRange ? 'bg-primary text-white' : 'text-muted-foreground hover:text-white hover:bg-white/5'
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1 w-full sm:w-28">
              <label className="text-[9px] font-black uppercase text-[#a1a1aa] tracking-widest">Auto Refresh</label>
              <Select 
                value={refreshInterval} 
                onChange={(e) => onChangeRefreshInterval(parseInt(e.target.value))}
                className="w-full bg-black/40 border-white/5 text-[10px] h-9 font-bold"
              >
                {REFRESH_INTERVALS.map(i => (
                  <option key={i.value} value={i.value}>Refresh: {i.label}</option>
                ))}
              </Select>
            </div>

            <Button 
              variant="outline" 
              className="h-9 w-9 p-0 border-white/10 hover:bg-white/5"
              onClick={onRefreshNow}
              loading={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {showCustomRange && (
          <div className="absolute right-3 mt-2 bg-[#1a1d27] border border-[#2a2d3a] p-4 rounded-xl shadow-2xl animate-in slide-in-from-top-2">
            <div className="flex flex-col sm:flex-row items-end gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-[#a1a1aa] tracking-widest">From</label>
                <Input 
                  type="datetime-local" 
                  value={customRange.from}
                  onChange={e => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-[#a1a1aa] tracking-widest">To</label>
                <Input 
                  type="datetime-local" 
                  value={customRange.to}
                  onChange={e => setCustomRange(prev => ({ ...prev, to: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
              <Button size="sm" className="h-9 w-full sm:w-auto" onClick={handleCustomApply}>Apply</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
