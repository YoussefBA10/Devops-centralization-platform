import React, { useState, useEffect, useRef } from 'react';
import { X, Server, Code, Box, GitBranch, Info, Settings2, Settings, AlertCircle } from 'lucide-react';
import { Button, Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { getEnvironmentNodes } from '../../services/api';
import { useEnvironment } from '../../context/EnvironmentContext';

interface DeployApplicationModalProps {
  isOpen: boolean;
  initialData?: any;
  onClose: () => void;
  onDeploy: (data: any) => Promise<void>;
}

const DeployApplicationModal: React.FC<DeployApplicationModalProps> = ({ isOpen, initialData, onClose, onDeploy }) => {
  const { selectedEnvironment } = useEnvironment();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
    srcPath: 'backend/',
    containerPort: '8080',
    canary: false,
    autoGenerateConfig: true,

    // Fullstack distinct fields
    frontendSrcPath: 'frontend/',
    frontendPort: '3000',
    frontendContainerPort: '80',
    frontendAppLanguage: 'React',

    backendSrcPath: 'backend/',
    backendPort: '8080',
    backendContainerPort: '8080',
    backendAppLanguage: 'Java Spring Boot'
  });
// GitHub App logic temporarily disabled
/*
  const [connectLoading, setConnectLoading] = useState(false);

  const handleConnectGithub = async () => {
    try {
      setConnectLoading(true);
      const res = await getGitHubInstallUrl(initialData?.id || 0); 
      if (res.data.url) {
        window.open(res.data.url, '_blank', 'width=800,height=600');
      }
    } catch (e) {
      console.error('Failed to initiate GitHub install', e);
    } finally {
      setConnectLoading(false);
    }
  };

  const isPrivateRepoError = (msg: string) => {
    const lower = msg.toLowerCase();
    return lower.includes('authentication failed') || 
           lower.includes('repository not found') || 
           lower.includes('permission denied') ||
           lower.includes('could not read username') ||
           lower.includes('terminal prompts disabled') ||
           lower.includes('could not read from remote repository');
  };
*/

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          ...formData,
          name: initialData.name || '',
          type: initialData.type || 'BACKEND',
          appLanguage: initialData.appLanguage || 'Java Spring Boot',
          repoUrl: initialData.repoUrl || '',
          targetNode: initialData.targetNode || '',
          branch: initialData.branch || 'main',
          port: initialData.port?.toString() || '8080',
          containerPort: initialData.containerPort?.toString() || '8080',
          srcPath: initialData.srcPath || (initialData.type === 'BACKEND' ? 'backend/' : 'frontend/'),
          canary: false,
          autoGenerateConfig: true
        });
      } else {
        setFormData({
          name: '',
          type: 'BACKEND',
          appLanguage: 'Java Spring Boot',
          repoUrl: '',
          targetNode: '',
          branch: 'main',
          port: '8080',
          envVars: '',
          srcPath: 'backend/',
          containerPort: '8080',
          canary: false,
          autoGenerateConfig: true,
          frontendSrcPath: 'frontend/',
          frontendPort: '3000',
          frontendContainerPort: '80',
          frontendAppLanguage: 'React',
          backendSrcPath: 'backend/',
          backendPort: '8080',
          backendContainerPort: '8080',
          backendAppLanguage: 'Java Spring Boot'
        });
        setRepoInfo(null);
      }

      if (selectedEnvironment) {
        getEnvironmentNodes(selectedEnvironment.id)
          .then(res => setNodes(res.data))
          .catch(err => console.error("Failed to load nodes", err));
      }
    }
  }, [isOpen, initialData, selectedEnvironment]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
    if (localError) setLocalError(null);
  };

  const validateGithub = async () => {
    if (!formData.repoUrl) return;
    setValidating(true);
    setTimeout(() => {
      let repoName = formData.repoUrl.split('/').pop()?.replace('.git', '') || 'Application Repository';
      setRepoInfo({
        name: repoName,
        description: 'Auto-detected repository details.',
        lastCommit: 'Just now'
      });
      if (!formData.name) setFormData({ ...formData, name: repoName });
      setValidating(false);
    }, 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let envMap: Record<string, string> = {};
    if (formData.envVars) {
      formData.envVars.split('\n').forEach(line => {
        const [key, val] = line.split('=');
        if (key && val) envMap[key.trim()] = val.trim();
      });
    }

    const basePayload = {
      id: initialData?.id,
      name: formData.name,
      environmentId: selectedEnvironment?.id,
      repoUrl: formData.repoUrl,
      targetNode: formData.targetNode,
      branch: formData.branch,
      envVars: envMap,
      canary: formData.canary,
      autoGenerateConfig: formData.autoGenerateConfig
    };

    try {
      setLocalError(null);
      if (formData.type === 'FULLSTACK') {
        // Backend
        await onDeploy({
          ...basePayload,
          name: formData.name + '-backend',
          type: 'BACKEND',
          appLanguage: formData.backendAppLanguage,
          port: parseInt(formData.backendPort),
          containerPort: parseInt(formData.backendContainerPort),
          srcPath: formData.backendSrcPath
        });
        // Frontend
        await onDeploy({
          ...basePayload,
          name: formData.name + '-frontend',
          type: 'FRONTEND',
          appLanguage: formData.frontendAppLanguage,
          port: parseInt(formData.frontendPort),
          containerPort: parseInt(formData.frontendContainerPort),
          srcPath: formData.frontendSrcPath
        });
      } else {
        await onDeploy({
          ...basePayload,
          type: formData.type,
          appLanguage: formData.appLanguage,
          port: parseInt(formData.port),
          containerPort: parseInt(formData.containerPort),
          srcPath: formData.srcPath
        });
      }
      onClose();
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Deployment failed. Please check your configuration.';
      setLocalError(msg);
      // Ensure the user sees the error
      setTimeout(() => {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
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
              <h2 className="text-xl font-bold tracking-tight">
                {initialData ? 'Edit Application' : 'Deploy Application'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {initialData ? 'Modify existing configuration' : 'Configure and deploy a new service'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={scrollContainerRef} className="p-6 overflow-y-auto">
          <form id="deploy-form" onSubmit={handleSubmit} className="space-y-6">

            {/* Error Display */}
            {localError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-red-500 uppercase tracking-widest text-[10px]">Deployment Error</p>
                  <p className="text-sm text-red-200/80 leading-relaxed">{localError}</p>
                </div>
                <button 
                  onClick={() => setLocalError(null)}
                  className="ml-auto text-red-500/50 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Informational Banner */}
            <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg text-primary/90 text-sm">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <p><strong>Containerized Architecture:</strong> All applications are dynamically compiled and deployed as independent Docker containers on your target infrastructure.</p>
            </div>

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

            {/* General Type Select */}
            <div className="space-y-2 border-b border-white/5 pb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Architecture Type</label>
              <select name="type" value={formData.type} onChange={handleChange} className="w-full h-10 px-3 rounded-lg bg-black/20 border border-white/10 text-sm focus:outline-none focus:border-primary/50 text-white appearance-none">
                <option value="BACKEND">Backend API</option>
                <option value="FRONTEND">Frontend Web</option>
                <option value="FULLSTACK">Fullstack Monolith (Deploys 2 Containers)</option>
              </select>
            </div>

            {/* STANDARD CONFIG (Backend/Frontend) */}
            {formData.type !== 'FULLSTACK' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
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
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Source Directory</label>
                    <Input name="srcPath" value={formData.srcPath} onChange={handleChange} placeholder="e.g. backend/ or ." className="bg-black/20 border-white/10" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground block mb-2">Exposed Port (Host)</label>
                    <Input name="port" type="number" value={formData.port} onChange={handleChange} placeholder="8080" className="bg-black/20 border-white/10" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground block mb-2">Internal Port (Container)</label>
                    <Input name="containerPort" type="number" value={formData.containerPort} onChange={handleChange} placeholder="80" className="bg-black/20 border-white/10" required />
                  </div>
                </div>
              </div>
            )}

            {/* FULLSTACK CONFIG */}
            {formData.type === 'FULLSTACK' && (
              <div className="space-y-6">
                {/* Backend Section */}
                <div className="p-4 bg-black/20 border border-blue-500/10 rounded-lg space-y-4">
                  <h4 className="text-sm font-bold text-blue-400">Backend Configuration</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Framework</label>
                      <select name="backendAppLanguage" value={formData.backendAppLanguage} onChange={handleChange} className="w-full h-10 px-3 rounded-lg bg-black/40 border border-white/10 text-sm focus:outline-none focus:border-blue-500 text-white appearance-none">
                        <option value="Java Spring Boot">Java (Spring Boot)</option>
                        <option value="Node.js">Node.js</option>
                        <option value="Python">Python</option>
                        <option value="Go">Go</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-muted-foreground">Source Directory</label>
                      <Input name="backendSrcPath" value={formData.backendSrcPath} onChange={handleChange} placeholder="backend/" className="bg-black/40 border-white/10" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-muted-foreground">Exposed Port</label>
                      <Input name="backendPort" type="number" value={formData.backendPort} onChange={handleChange} className="bg-black/40 border-white/10" required />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-muted-foreground">Internal Port</label>
                      <Input name="backendContainerPort" type="number" value={formData.backendContainerPort} onChange={handleChange} className="bg-black/40 border-white/10" required />
                    </div>
                  </div>
                </div>

                {/* Frontend Section */}
                <div className="p-4 bg-black/20 border border-emerald-500/10 rounded-lg space-y-4">
                  <h4 className="text-sm font-bold text-emerald-400">Frontend Configuration</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Framework</label>
                      <select name="frontendAppLanguage" value={formData.frontendAppLanguage} onChange={handleChange} className="w-full h-10 px-3 rounded-lg bg-black/40 border border-white/10 text-sm focus:outline-none focus:border-emerald-500 text-white appearance-none">
                        <option value="React">React (Vite/CRA)</option>
                        <option value="Node.js">Next.js/Nuxt</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-muted-foreground">Source Directory</label>
                      <Input name="frontendSrcPath" value={formData.frontendSrcPath} onChange={handleChange} placeholder="frontend/" className="bg-black/40 border-white/10" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-muted-foreground">Exposed Port</label>
                      <Input name="frontendPort" type="number" value={formData.frontendPort} onChange={handleChange} className="bg-black/40 border-white/10" required />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-muted-foreground">Internal Port</label>
                      <Input name="frontendContainerPort" type="number" value={formData.frontendContainerPort} onChange={handleChange} className="bg-black/40 border-white/10" required />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Auto Generate Toggle */}
            <div className="flex items-center gap-3 mt-4">
              <input
                type="checkbox"
                id="autoGen"
                name="autoGenerateConfig"
                checked={formData.autoGenerateConfig}
                onChange={handleChange}
                className="w-4 h-4 rounded border-white/10 bg-black/20 text-primary accent-primary"
              />
              <label htmlFor="autoGen" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                <Settings2 className="w-4 h-4 text-muted-foreground" />
                Auto-generate Dockerfile and Nginx configuration if missing
              </label>
            </div>

            {/* Infrastructure Target */}
            <div className="p-4 bg-black/20 border border-white/5 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2"><Server className="w-4 h-4 text-primary" /> Infrastructure Target</h3>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] text-emerald-500 font-medium">
                  <Info className="w-3 h-3" /> Credentials managed by Node
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground block mb-2">Target Node</label>
                <select name="targetNode" value={formData.targetNode} onChange={handleChange} className="w-full h-10 px-3 rounded-lg bg-black/40 border border-white/10 text-sm focus:outline-none focus:border-primary/50 text-white appearance-none" required>
                  <option value="">Select an active node...</option>
                  {nodes.map(node => (
                    <option key={node.ip} value={node.ip}>{node.hostname || node.ip}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5">
                  <div className="flex items-center gap-3">
                    <Settings className="w-3.5 h-3.5 text-primary" />
                    <div>
                      <p className="text-[11px] font-bold">Auto-generate Configuration</p>
                      <p className="text-[9px] text-muted-foreground">Creates Dockerfile/Nginx configs if missing.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, autoGenerateConfig: !prev.autoGenerateConfig }))}
                    className={`w-10 h-5 rounded-full transition-colors relative ${formData.autoGenerateConfig ? 'bg-primary' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.autoGenerateConfig ? 'left-5.5' : 'left-0.5'}`}></div>
                  </button>
                </div>
              </div>
            </div>

            {/* Env Vars */}
            <div className="space-y-2">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Environment Variables</label>
                <p className="text-[10px] text-muted-foreground italic mb-1">For Frontend apps, these are securely injected as Docker build arguments.</p>
                <textarea
                  name="envVars"
                  value={formData.envVars}
                  onChange={handleChange}
                  placeholder="KEY=VALUE&#10;NODE_ENV=production"
                  className="w-full h-24 p-3 rounded-lg bg-black/20 border border-white/10 text-sm focus:outline-none focus:border-primary/50 text-white font-mono resize-none placeholder:text-white/20"
                />
              </div>

              {/* Deployment Strategy section removed. Updates default to standard replacement. */}
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-white/5 flex items-center justify-end gap-3 bg-black/20">
          <Button variant="outline" onClick={onClose} className="border-white/10">Cancel</Button>
          <Button type="submit" form="deploy-form" loading={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            {initialData ? 'Update & Redeploy' : 'Deploy Application'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default DeployApplicationModal;
