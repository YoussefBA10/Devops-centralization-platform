import React, { useState, useEffect } from 'react';
import { useEnvironment } from '../../context/EnvironmentContext';
import { useCluster } from '../../context/ClusterContext';
import { getNetworkHealthSummary } from '../../services/api';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import AddLinkModal from './AddLinkModal';

const LinkHealthTab: React.FC = () => {
  const { selectedEnvironment } = useEnvironment();
  const { selectedCluster } = useCluster();
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchLinks = async () => {
    const clusterId = selectedCluster?.id.toString();
    try {
      // Aggregate health summary for the whole cluster
      const res = await getNetworkHealthSummary(clusterId, undefined);
      setLinks(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
    const interval = setInterval(fetchLinks, 30000);
    return () => clearInterval(interval);
  }, [selectedEnvironment, selectedCluster]);

  if (loading && links.length === 0) return <div className="p-6 text-muted-foreground">Loading link health data...</div>;

  return (
    <div className="h-full w-full flex flex-col p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold">Service Link Health</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90"
        >
          + Add Link
        </button>
      </div>

      <div className="rounded-md border border-white/10 overflow-hidden bg-black/20">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-white/5 text-muted-foreground">
            <tr>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Link Name</th>
              <th className="px-6 py-3 font-medium">Current (ms)</th>
              <th className="px-6 py-3 font-medium">Avg 1h (ms)</th>
              <th className="px-6 py-3 font-medium">Max 1h (ms)</th>
              <th className="px-6 py-3 font-medium">Uptime 1h</th>
              <th className="px-6 py-3 font-medium">Error Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {links.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No links configured.</td>
              </tr>
            )}
            {links.map((link) => (
              <tr key={link.linkId} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {link.status === 'UP' || link.status === 'HEALTHY' ? (
                      <span className="flex items-center text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> UP
                      </span>
                    ) : link.status === 'DOWN' || link.status === 'CRITICAL' ? (
                      <span className="flex items-center text-red-400 bg-red-400/10 px-2 py-1 rounded text-xs font-medium">
                        <XCircle className="w-3.5 h-3.5 mr-1" /> DOWN
                      </span>
                    ) : link.status === 'DEGRADED' ? (
                      <span className="flex items-center text-amber-400 bg-amber-400/10 px-2 py-1 rounded text-xs font-medium">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" /> DEGRADED
                      </span>
                    ) : (
                      <span className="flex items-center text-slate-400 bg-slate-400/10 px-2 py-1 rounded text-xs font-medium">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" /> UNKNOWN
                      </span>
                    )}                  </div>
                </td>
                <td className="px-6 py-4 font-medium text-white">{link.linkName}</td>
                <td className="px-6 py-4 text-muted-foreground">{link.currentLatencyMs?.toFixed(0)} ms</td>
                <td className="px-6 py-4 text-muted-foreground">{link.avgLatencyMs?.toFixed(0)} ms</td>
                <td className="px-6 py-4 text-muted-foreground">{link.maxLatencyMs?.toFixed(0)} ms</td>
                <td className="px-6 py-4 text-muted-foreground">{link.uptimePercent?.toFixed(1)}%</td>
                <td className="px-6 py-4 text-muted-foreground">{link.errorRate?.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddLinkModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchLinks}
        clusterId={selectedCluster?.id.toString()}
      />
    </div>
  );
};

export default LinkHealthTab;
