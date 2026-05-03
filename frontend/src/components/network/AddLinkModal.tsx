import React, { useState, useEffect } from 'react';
import { X, Globe, Server, Hash, Activity } from 'lucide-react';
import { getNetworkNodes, addNetworkLink } from '../../services/api';

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clusterId: string;
  envId: string;
}

const AddLinkModal: React.FC<AddLinkModalProps> = ({ isOpen, onClose, onSuccess, clusterId, envId }) => {
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sourceNodeId: '',
    targetNodeId: '',
    targetPort: 8080,
    targetPath: '/health',
    protocol: 'http',
    probeModule: 'http_2xx'
  });

  useEffect(() => {
    if (isOpen) {
      const fetchNodes = async () => {
        try {
          const res = await getNetworkNodes(clusterId, envId);
          setNodes(res.data);
        } catch (err) {
          console.error('Failed to fetch nodes:', err);
        }
      };
      fetchNodes();
    }
  }, [isOpen, clusterId, envId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addNetworkLink(formData);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to add link:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="bg-[#0f1117] border border-white/10 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Add Service Link</h2>
              <p className="text-xs text-muted-foreground">Configure inter-node health probing</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center">
                <Server className="w-4 h-4 mr-2" /> Source Node
              </label>
              <select
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                value={formData.sourceNodeId}
                onChange={(e) => setFormData({ ...formData, sourceNodeId: e.target.value })}
              >
                <option value="">Select Source</option>
                {nodes.map(node => (
                  <option key={node.id} value={node.id}>{node.nodeName || node.ip} ({node.ip})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center">
                <Globe className="w-4 h-4 mr-2" /> Target Node
              </label>
              <select
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                value={formData.targetNodeId}
                onChange={(e) => setFormData({ ...formData, targetNodeId: e.target.value })}
              >
                <option value="">Select Target</option>
                {nodes.map(node => (
                  <option key={node.id} value={node.id}>{node.nodeName || node.ip} ({node.ip})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground flex items-center">
              Link Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Frontend to Auth API"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center">
                <Hash className="w-4 h-4 mr-2" /> Target Port
              </label>
              <input
                type="number"
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                value={formData.targetPort}
                onChange={(e) => setFormData({ ...formData, targetPort: parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Protocol</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                value={formData.protocol}
                onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
              >
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="tcp">TCP</option>
                <option value="icmp">ICMP (Ping)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Target Path</label>
              <input
                type="text"
                disabled={formData.protocol === 'tcp' || formData.protocol === 'icmp'}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-50"
                value={formData.targetPath}
                onChange={(e) => setFormData({ ...formData, targetPath: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Probe Module</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                value={formData.probeModule}
                onChange={(e) => setFormData({ ...formData, probeModule: e.target.value })}
              >
                <option value="http_2xx">http_2xx (HTTP Success)</option>
                <option value="http_4xx">http_4xx (Expect Client Error)</option>
                <option value="tcp_connect">tcp_connect (Port Check)</option>
                <option value="icmp">icmp (Ping)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all font-medium disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Service Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddLinkModal;
