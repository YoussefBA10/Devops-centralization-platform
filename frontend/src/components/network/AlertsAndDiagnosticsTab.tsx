import React, { useState, useEffect } from 'react';
import { getActiveAlerts, getAlertGroups, getAlertRules, silenceAlert, deleteAlertRule } from '../../services/api';
import { AlertTriangle, BellOff, Settings, ShieldAlert, Trash2 } from 'lucide-react';
import AddAlertRuleModal from './AddAlertRuleModal';
import { useToast } from '../ui/Toast';

const AlertsAndDiagnosticsTab: React.FC = () => {
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [view, setView] = useState<'raw' | 'smart'>('smart');
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [alertsRes, groupsRes, rulesRes] = await Promise.all([
          getActiveAlerts(),
          getAlertGroups(),
          getAlertRules()
        ]);
        
        if (alertsRes.data && Array.isArray(alertsRes.data)) {
          setActiveAlerts(alertsRes.data.filter((a: any) => a.status.state === 'active'));
        }
        
        if (groupsRes.data) {
          setGroups(groupsRes.data);
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

  const handleDeleteRule = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this alert rule?')) return;
    try {
      await deleteAlertRule(id);
      setRules(rules.filter(r => r.id !== id));
      showToast('Alert rule deleted successfully', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to delete alert rule', 'error');
    }
  };

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
      {/* Left Panel: Active Alerts / Groups */}
      <div className="flex-[0.55] flex flex-col bg-white/5 border border-white/10 rounded-lg p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
            {view === 'raw' ? 'Active Network Alerts' : 'Smart Alert Groups'}
          </h2>
          <div className="flex bg-black/40 rounded-md p-1 border border-white/5">
            <button 
              onClick={() => setView('smart')}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${view === 'smart' ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground hover:text-white'}`}
            >
              SMART
            </button>
            <button 
              onClick={() => setView('raw')}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${view === 'raw' ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground hover:text-white'}`}
            >
              RAW
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
          {view === 'raw' ? (
            activeAlerts.length === 0 ? (
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
            )
          ) : (
            groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-emerald-500">
                <ShieldAlert className="w-10 h-10 mb-2 opacity-50" />
                <p>No smart groups detected. Infrastructure is stable.</p>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.id} className={`p-4 rounded-md border-l-4 bg-black/30 ${group.severity === 'critical' ? 'border-red-500' : 'border-amber-500'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-white">{group.name}</h3>
                        {group.incidentId && (
                          <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">
                            INCIDENT #{group.incidentId}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        First fired: {new Date(group.firstFiredAt).toLocaleTimeString()}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <div className="text-[10px] bg-white/10 inline-block px-2 py-1 rounded text-muted-foreground">
                          {group.fingerprint.substring(0, 8)}
                        </div>
                        <div className={`text-[10px] inline-block px-2 py-1 rounded font-bold ${group.severity === 'critical' ? 'text-red-400 bg-red-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
                          {group.severity.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                       <button onClick={() => {/* Resolve logic */}} className="p-1.5 hover:bg-white/10 rounded text-muted-foreground hover:text-white transition-colors" title="Mark as Resolved">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )
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
          <button 
            onClick={() => setIsModalOpen(true)}
            className="text-xs px-3 py-1.5 bg-primary/20 text-primary rounded border border-primary/50 hover:bg-primary/30 transition-colors"
          >
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
                <th className="px-3 py-2 text-right">Action</th>
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
                  <td className="px-3 py-3 text-right">
                    <button 
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1 hover:bg-red-500/10 rounded text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
       <AddAlertRuleModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          // Refresh rules list
          getAlertRules().then(res => setRules(res.data));
        }}
      />
    </div>
  );
};

export default AlertsAndDiagnosticsTab;
