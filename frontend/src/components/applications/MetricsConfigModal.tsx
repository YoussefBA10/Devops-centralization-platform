import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Loader2, Play } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button, Input } from '../ui/Input';
import api from '../../services/api';

interface MetricsConfigModalProps {
  app: any;
  onClose: () => void;
  onSuccess: () => void;
}

const MetricsConfigModal: React.FC<MetricsConfigModalProps> = ({ app, onClose, onSuccess }) => {
  const [port, setPort] = useState<string>(app.metricsPort?.toString() || '');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleTest = async () => {
    if (!port) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post(`/applications/${app.id}/metrics/test`, { port: parseInt(port, 10) });
      setTestResult(res.data);
    } catch (e: any) {
      setTestResult({ success: false, message: e.response?.data?.message || 'Connection failed.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!testResult?.success) return;
    setSaving(true);
    try {
      await api.patch(`/applications/${app.id}/metrics/config`, {
        metricsPort: parseInt(port, 10),
        testStatus: 'SUCCESS'
      });
      onSuccess();
    } catch (e) {
      console.error('Failed to save config', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-md bg-[#0c0c0e] border-white/10 shadow-2xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
          <div>
            <CardTitle className="text-xl font-bold text-white">Configure Metrics</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Application: <span className="font-bold text-indigo-400">{app.name}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-white text-sm font-medium">Metrics Port</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="e.g. 8080"
                  value={port}
                  onChange={(e) => {
                    setPort(e.target.value);
                    setTestResult(null); // Reset test on change
                  }}
                  className="bg-black/50 border-white/10"
                />
                <Button 
                  onClick={handleTest} 
                  disabled={!port || testing}
                  variant="outline"
                  className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 min-w-[120px]"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4 mr-2" /> Test</>}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">The port where the application exposes /metrics.</p>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg border ${testResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'} animate-in slide-in-from-top-2`}>
                <div className="flex items-start gap-2">
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <div className="space-y-1 text-sm">
                    <p className="font-bold">{testResult.success ? 'Connection Successful' : 'Connection Failed'}</p>
                    <p className="text-xs opacity-90 leading-relaxed">{testResult.message}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
            <Button variant="ghost" onClick={onClose} disabled={saving} className="hover:bg-white/5">
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!testResult?.success || saving}
              className="bg-indigo-500 hover:bg-indigo-600 text-white min-w-[100px]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MetricsConfigModal;
