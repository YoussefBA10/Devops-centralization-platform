import React, { useState, useEffect } from 'react';
import { X, Server, Code, Box, GitBranch } from 'lucide-react';
import { Button, Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { getEnvironmentNodes } from '../../services/api';
import { useEnvironment } from '../../context/EnvironmentContext';

interface DeployApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (data: any) => Promise<void>;
}

const DeployApplicationModal: React.FC<DeployApplicationModalProps> = ({ isOpen, onClose, onDeploy }) => {
  const { selectedEnvironment } = useEnvironment();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [repoInfo, setRepoInfo] = useState<any>(null);
  
  const [nodes, setNodes] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    type: 'BACKEND',
    appLanguage: 'Java Spring Boot',
    repoUrl: '',
    targetNode: '',
    branch: 'main',
    port: '8080',
    envVars: '',
    sshPassword: '',
    srcPath: 'backend/',
    extraHosts: ''
  });

  useEffect(() => {
    if (isOpen && selectedEnvironment) {
      getEnvironmentNodes(selectedEnvironment.id)
        .then(res => setNodes(res.data))
        .catch(err => console.error("Failed to load nodes", err));
    }
  }, [isOpen, selectedEnvironment]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateGithub = async () => {
    if (!formData.repoUrl) return;
    setValidating(true);
    // Simple mock validation for demonstration. 
    // In reality, this could hit public GitHub API or use the backend to fetch Groq analysis.
    setTimeout(() => {
      let repoName = formData.repoUrl.split('/').pop()?.replace('.git', '') || 'Application Repository';
      setRepoInfo({
        name: repoName,
        description: 'Auto-detected repository details.',
        lastCommit: 'Just now'
      });
      if(!formData.name) setFormData({...formData, name: repoName});
      setValidating(false);
    }, 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Parse envVars basic implementation
    let envMap: Record<string, string> = {};
    if (formData.envVars) {
        formData.envVars.split('\n').forEach(line => {
            const [key, val] = line.split('=');
            if (key && val) envMap[key.trim()] = val.trim();
        });
    }

    const payload = {
        name: formData.name,
        environmentId: selectedEnvironment?.id,
        type: formData.type,
        appLanguage: formData.appLanguage,
        repoUrl: formData.repoUrl,
        targetNode: formData.targetNode,
        branch: formData.branch,
        port: parseInt(formData.port),
        envVars: envMap,
        sshPassword: formData.sshPassword,
        srcPath: formData.srcPath,
        extraHosts: formData.extraHosts
    };

    try {
      await onDeploy(payload);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0b]/80 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-2xl bg-card border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Deploy Application</h2>
              <p className="text-sm text-muted-foreground">Configure and deploy a new service</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="deploy-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* GitHub Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <GitBranch className="w-4 h-4" /> Source Repository
              </h3>
              <div className="flex gap-4">
                <Input 
                  name="repoUrl"
                  value={formData.repoUrl}
                  onChange={handleChange}
                  placeholder="https://github.com/organization/repo.git" 
                  className="flex-1 bg-black/20 focus:bg-black/40 border-white/10 focus:border-primary/50" 
                  required
                />
                <Button type="button" onClick={validateGithub} loading={validating} variant="outline" className="shrink-0 border-white/10 hover:bg-primary/20 hover:text-primary hover:border-primary/50">
                  <span className="flex items-center gap-2">Validate <GitBranch className="w-4 h-4" /></span>
                </Button>
              </div>

              {repoInfo && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-3 animate-in slide-in-from-top-2">
                  <GitBranch className="w-5 h-5 text-emerald-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-500">{repoInfo.name}</p>
                    <p className="text-xs text-muted-foreground">{repoInfo.description}</p>
                    <p className="text-[10px] uppercase tracking-widest text-emerald-500/70 mt-1">Ready for deployment</p>
                  </div>
                </div>
              )}
            </div>

            {/* App Configuration */}
            <div className="grid grid-cols-2 gap-6">
               <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Application Name</label>
                 <Input name="name" value={formData.name} onChange={handleChange} placeholder="e.g. user-service" className="bg-black/20 border-white/10" required />
               </div>
               <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Branch</label>
                 <div className="relative">
                   <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                   <Input name="branch" value={formData.branch} onChange={handleChange} placeholder="main" className="pl-9 bg-black/20 border-white/10" required />
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
               <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</label>
                 <select name="type" value={formData.type} onChange={handleChange} className="w-full h-10 px-3 rounded-lg bg-black/20 border border-white/10 text-sm focus:outline-none focus:border-primary/50 text-white appearance-none">
                    <option value="BACKEND">Backend API</option>
                    <option value="FRONTEND">Frontend Web</option>
                    <option value="FULLSTACK">Fullstack Monolith</option>
                 </select>
               </div>
               <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Code className="w-3 h-3" /> Framework</label>
                 <select name="appLanguage" value={formData.appLanguage} onChange={handleChange} className="w-full h-10 px-3 rounded-lg bg-black/20 border border-white/10 text-sm focus:outline-none focus:border-primary/50 text-white appearance-none">
                    <option value="Java Spring Boot">Java (Spring Boot)</option>
                    <option value="Node.js">Node.js (Express/Nest)</option>
                    <option value="React">React (Vite/CRA)</option>
                    <option value="Python">Python (FastAPI/Flask)</option>
                    <option value="Go">Go (Gin/Fiber)</option>
                 </select>
               </div>
            </div>

            {/* Infrastructure Target */}
            <div className="p-4 bg-black/20 border border-white/5 rounded-lg space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2"><Server className="w-4 h-4 text-primary" /> Infrastructure Target</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-muted-foreground block mb-2">Target Node</label>
                        <select name="targetNode" value={formData.targetNode} onChange={handleChange} className="w-full h-10 px-3 rounded-lg bg-black/40 border border-white/10 text-sm focus:outline-none focus:border-primary/50 text-white appearance-none" required>
                            <option value="">Select an active node...</option>
                            {nodes.map(node => (
                                <option key={node.ip} value={node.ip}>{node.hostname || node.ip}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-muted-foreground block mb-2">SSH Password (Optional)</label>
                        <Input type="password" name="sshPassword" value={formData.sshPassword} onChange={handleChange} placeholder="••••••••" className="bg-black/40 border-white/10" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-muted-foreground block mb-2">Port Mapping</label>
                        <Input name="port" type="number" value={formData.port} onChange={handleChange} placeholder="8080" className="bg-black/40 border-white/10" required />
                    </div>
                </div>
                <div className="grid grid-cols-1">
                    <div>
                        <label className="text-xs font-bold uppercase text-muted-foreground block mb-2">Source Directory (Relative to Repo Root)</label>
                        <Input name="srcPath" value={formData.srcPath} onChange={handleChange} placeholder="e.g. backend/ or . " className="bg-black/40 border-white/10" />
                        <p className="text-[10px] text-muted-foreground mt-1 italic">Leave empty or use "." if your application is in the root directory.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1">
                    <div>
                        <label className="text-xs font-bold uppercase text-muted-foreground block mb-2">Extra Hosts Mapping (One per line)</label>
                        <textarea 
                            name="extraHosts" 
                            value={formData.extraHosts} 
                            onChange={(e) => setFormData({...formData, extraHosts: e.target.value})}
                            placeholder="e.g. backend:192.168.126.130"
                            className="w-full bg-black/40 border border-white/10 rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px]"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1 italic">Format: hostname:ip (Fixes "host not found" in Nginx configs)</p>
                    </div>
                </div>
            </div>

            {/* Env Vars */}
            <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Environment Variables (Optional)</label>
                 <textarea 
                    name="envVars" 
                    value={formData.envVars}
                    onChange={handleChange}
                    placeholder="KEY=VALUE&#10;NODE_ENV=production" 
                    className="w-full h-24 p-3 rounded-lg bg-black/20 border border-white/10 text-sm focus:outline-none focus:border-primary/50 text-white font-mono resize-none placeholder:text-white/20"
                 />
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-white/5 flex items-center justify-end gap-3 bg-black/20">
          <Button variant="outline" onClick={onClose} className="border-white/10">Cancel</Button>
          <Button type="submit" form="deploy-form" loading={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            Deploy Application
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default DeployApplicationModal;
