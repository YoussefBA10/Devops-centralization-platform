import React, { useState } from 'react';
import { Network, Activity, Server, AlertTriangle } from 'lucide-react';
import { useParams } from 'react-router-dom';

// We will implement these tabs later
import TopologyMapTab from '../components/network/TopologyMapTab';
import LinkHealthTab from '../components/network/LinkHealthTab';
import VmNetworkHealthTab from '../components/network/VmNetworkHealthTab';
import AlertsAndDiagnosticsTab from '../components/network/AlertsAndDiagnosticsTab';

const NetworkMonitor: React.FC = () => {
  const { vmId } = useParams<{ vmId?: string }>();
  // If a vmId is provided, default to the VM network health tab (tab 3)
  const [activeTab, setActiveTab] = useState<string>(vmId ? 'vms' : 'topology');

  const tabs = [
    { id: 'topology', label: 'Topology Map', icon: <Network className="w-4 h-4 mr-2" /> },
    { id: 'links', label: 'Link Health', icon: <Activity className="w-4 h-4 mr-2" /> },
    { id: 'vms', label: 'VM Network Health', icon: <Server className="w-4 h-4 mr-2" /> },
    { id: 'alerts', label: 'Alerts & Diagnostics', icon: <AlertTriangle className="w-4 h-4 mr-2" /> }
  ];

  return (
    <div className="flex flex-col h-full bg-background p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center">
            <Network className="w-6 h-6 mr-3 text-primary" />
            Network & Service Monitor
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Monitor inter-VM connectivity, TCP health, bandwidth, and link latencies.
          </p>
        </div>
      </div>

      <div className="border-b border-white/10 mb-6">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors
                ${activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-white hover:border-white/20'
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'topology' && <TopologyMapTab />}
        {activeTab === 'links' && <LinkHealthTab />}
        {activeTab === 'vms' && <VmNetworkHealthTab vmId={vmId} />}
        {activeTab === 'alerts' && <AlertsAndDiagnosticsTab />}
      </div>
    </div>
  );
};

export default NetworkMonitor;
