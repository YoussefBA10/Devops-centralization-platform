import React, { useState, useEffect } from 'react';
import { getActiveAlerts, getAlertRules, silenceAlert } from '../../services/api';
import { AlertTriangle, BellOff, Settings, ShieldAlert } from 'lucide-react';

const AlertsAndDiagnosticsTab: React.FC = () => {
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [alertsRes, rulesRes] = await Promise.all([
          getActiveAlerts(),
          getAlertRules()
        ]);
        
        // Handle Alertmanager v2 format
        if (alertsRes.data && Array.isArray(alertsRes.data)) {
          setActiveAlerts(alertsRes.data.filter((a: any) => a.status.state === 'active'));
        }
        
        if (rulesRes.data) {
          setRules(rulesRes.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSilence = async (alert: any) => {
    try {
      const alertname = alert.labels?.alertname;
      if (alertname) {
        await silenceAlert(alertname);
        alert('Alert silenced for 1 hour');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to silence alert');
    }
  };

  if (loading && activeAlerts.length === 0 && rules.length === 0) {
    return <div className="p-6 text-muted-foreground">Loading alerts and diagnostics...</div>;
  }

  return (
    <div className="h-full w-full flex flex-col md:flex-row gap-6 p-6 overflow-y-auto">
      {/* Left Panel: Active Alerts */}
      <div className="flex-[0.55] flex flex-col bg-white/5 border border-white/10 rounded-lg p-5">
        <h2 className="text-lg font-bold flex items-center mb-4">
          <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
          Active Network Alerts
        </h2>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
          {activeAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-emerald-500">
              <ShieldAlert className="w-10 h-10 mb-2 opacity-50" />
              <p>No active alerts. Network is healthy.</p>
            </div>
          ) : (
            activeAlerts.map((alert, idx) => (
              <div key={idx} className={`p-4 rounded-md border-l-4 bg-black/30 ${alert.labels?.severity === 'critical' ? 'border-red-500' : 'border-amber-500'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-sm text-white">{alert.annotations?.summary || alert.labels?.alertname}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{alert.annotations?.description}</p>
                    <div className="mt-2 text-[10px] bg-white/10 inline-block px-2 py-1 rounded text-muted-foreground">
                      {alert.labels?.vm_id || alert.labels?.link_id || 'Global'}
                    </div>
                  </div>
                  <button onClick={() => handleSilence(alert)} className="p-1.5 hover:bg-white/10 rounded text-muted-foreground hover:text-white transition-colors" title="Silence for 1h">
                    <BellOff className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Rules */}
      <div className="flex-[0.45] flex flex-col bg-white/5 border border-white/10 rounded-lg p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold flex items-center">
            <Settings className="w-5 h-5 mr-2 text-primary" />
            Alert Rules
          </h2>
          <button className="text-xs px-3 py-1.5 bg-primary/20 text-primary rounded border border-primary/50 hover:bg-primary/30">
            + Add Rule
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] uppercase text-muted-foreground bg-black/20">
              <tr>
                <th className="px-3 py-2">Rule Name</th>
                <th className="px-3 py-2">Threshold</th>
                <th className="px-3 py-2">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-white/5">
                  <td className="px-3 py-3 text-white text-xs font-medium">{rule.name}</td>
                  <td className="px-3 py-3 text-muted-foreground text-xs">{rule.thresholdValue} {rule.thresholdUnit}</td>
                  <td className="px-3 py-3">
                    <span className={`text-[10px] px-2 py-1 rounded ${rule.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {rule.severity}
                    </span>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground text-xs">No rules configured.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AlertsAndDiagnosticsTab;
