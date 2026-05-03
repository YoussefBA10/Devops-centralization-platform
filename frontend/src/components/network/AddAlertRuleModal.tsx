import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Zap, Link as LinkIcon, Server } from 'lucide-react';
import { addAlertRule, getTopology } from '../../services/api';
import { useToast } from '../ui/Toast';

interface AddAlertRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddAlertRuleModal: React.FC<AddAlertRuleModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [links, setLinks] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetType, setTargetType] = useState<'GLOBAL' | 'LINK' | 'NODE'>('GLOBAL');
  const [formData, setFormData] = useState({
    name: '',
    ruleType: 'LATENCY',
    linkId: '',
    nodeId: null as number | null,
    thresholdValue: 0.5,
    thresholdUnit: 's',
    severity: 'WARNING'
  });

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          // Fetch topology for the entire infrastructure (all clusters)
          const res = await getTopology();
          setLinks(res.data.edges || []);
          setNodes(res.data.nodes || []);
        } catch (err) {
          console.error('Failed to fetch targets:', err);
          showToast('Failed to load targets', 'error');
        }
      };
      fetchData();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...formData };
      if (targetType === 'GLOBAL') {
        payload.linkId = '';
        payload.nodeId = null;
      } else if (targetType === 'LINK') {
        payload.nodeId = null;
        if (!payload.linkId) throw new Error('Please select a service link');
      } else if (targetType === 'NODE') {
        payload.linkId = '';
        if (!payload.nodeId) throw new Error('Please select a VM node');
      }

      await addAlertRule(payload);
      showToast('Alert rule created successfully', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || err.response?.data?.message || 'Failed to create alert rule', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-white/10 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/20 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-white">Create Alert Rule</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rule Name</label>
            <input
              type="text"
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="e.g., High Latency - Checkout Service"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rule Type</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                value={formData.ruleType}
                onChange={(e) => setFormData({ ...formData, ruleType: e.target.value })}
              >
                <option value="LATENCY">Latency</option>
                <option value="ERROR_RATE">Error Rate</option>
                <option value="PACKET_LOSS">Packet Loss</option>
                <option value="RETRANSMISSION">TCP Retransmits</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Severity</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
              >
                <option value="WARNING">Warning</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Scope</label>
            <div className="flex gap-2 p-1 bg-black/40 rounded-lg border border-white/5">
              <button
                type="button"
                onClick={() => setTargetType('GLOBAL')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-all ${targetType === 'GLOBAL' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:bg-white/5'}`}
              >
                Global
              </button>
              <button
                type="button"
                onClick={() => setTargetType('LINK')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-all ${targetType === 'LINK' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:bg-white/5'}`}
              >
                <LinkIcon className="w-3 h-3" /> Service Link
              </button>
              <button
                type="button"
                onClick={() => setTargetType('NODE')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-all ${targetType === 'NODE' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:bg-white/5'}`}
              >
                <Server className="w-3 h-3" /> VM Node
              </button>
            </div>
          </div>

          {targetType === 'LINK' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Link</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                value={formData.linkId}
                onChange={(e) => setFormData({ ...formData, linkId: e.target.value })}
                required
              >
                <option value="" disabled>Select a link...</option>
                {links.map(link => (
                  <option key={link.id} value={link.id}>{link.id}</option>
                ))}
              </select>
              {links.length === 0 && <p className="text-[10px] text-amber-500">No links found.</p>}
            </div>
          )}

          {targetType === 'NODE' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Node</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                value={formData.nodeId || ''}
                onChange={(e) => setFormData({ ...formData, nodeId: parseInt(e.target.value) })}
                required
              >
                <option value="" disabled>Select a node...</option>
                {nodes.map(node => (
                  <option key={node.id} value={node.id}>{node.label || node.ip} ({node.ip})</option>
                ))}
              </select>
              {nodes.length === 0 && <p className="text-[10px] text-amber-500">No nodes found.</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Threshold</label>
              <input
                type="number"
                step="0.01"
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                value={formData.thresholdValue}
                onChange={(e) => setFormData({ ...formData, thresholdValue: parseFloat(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unit</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                value={formData.thresholdUnit}
                onChange={(e) => setFormData({ ...formData, thresholdUnit: e.target.value })}
              >
                <option value="s">Seconds (s)</option>
                <option value="ms">Milliseconds (ms)</option>
                <option value="%">Percent (%)</option>
                <option value="byte/s">Bytes/sec</option>
                <option value="rate">Rate (count/s)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-white/10 rounded-lg text-white hover:bg-white/5 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Create Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAlertRuleModal;
