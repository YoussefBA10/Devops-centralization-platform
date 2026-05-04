import React, { useState, useEffect, useRef } from 'react';
import { X, GitBranch, Box, Server, Info, Settings2, AlertCircle, Upload, Check, ChevronRight, ChevronLeft, Loader2, FileCode, Trash2, Zap } from 'lucide-react';
import { Button, Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { getEnvironmentNodes } from '../../services/api';
import { useEnvironment } from '../../context/EnvironmentContext';
import api from '../../services/api';
import { useToast } from '../ui/Toast';
import ConfirmationModal from '../ConfirmationModal';

interface DetectedApp {
  name: string;
  type: string;
  framework: string;
  srcPath: string;
  hasDockerfile: boolean;
  hasNginxConf: boolean;
}

interface DeployApplicationModalProps {
  isOpen: boolean;
  initialData?: any;
  onClose: () => void;
  onDeploy: (data: any) => Promise<void>;
}

const FRAMEWORK_DEFAULTS: Record<string, { port: string; containerPort: string }> = {
  'Java Spring Boot': { port: '8080', containerPort: '8080' },
  'Node.js': { port: '3000', containerPort: '3000' },
  'React': { port: '3000', containerPort: '80' },
  'Vue.js': { port: '3000', containerPort: '80' },
  'Angular': { port: '4200', containerPort: '80' },
  'Next.js': { port: '3000', containerPort: '3000' },
  'Python': { port: '8000', containerPort: '8000' },
  'Go': { port: '8080', containerPort: '8080' },
};

const DeployApplicationModal: React.FC<DeployApplicationModalProps> = ({ isOpen, initialData, onClose, onDeploy }) => {
  const { selectedEnvironment } = useEnvironment();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Onboarding choice
  const [onboardingType, setOnboardingType] = useState<'AUTOMATIC' | 'MANUAL' | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{ success: boolean; message: string } | null>(null);

  // Step 1
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [isPrivateRepo, setIsPrivateRepo] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedApps, setDetectedApps] = useState<DetectedApp[]>([]);
  const [, setRepoName] = useState('');

  // Step 2
  const [selectedAppIdx, setSelectedAppIdx] = useState(0);
  const [appName, setAppName] = useState('');
  const [port, setPort] = useState('8080');
  const [containerPort, setContainerPort] = useState('8080');
  const [targetNode, setTargetNode] = useState('');
  const [autoGenerateConfig, setAutoGenerateConfig] = useState(true);
  const [nodes, setNodes] = useState<any[]>([]);
  const [manualFramework, setManualFramework] = useState('Java Spring Boot');
  const [manualType, setManualType] = useState('BACKEND');

  // Step 3
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);
  const [envText, setEnvText] = useState('');
  const [alreadyDeployed, setAlreadyDeployed] = useState(false);
  const { showToast } = useToast();
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [statusConfirmData, setStatusConfirmData] = useState<{ title: string; message: string; type: 'warning' | 'danger' | 'success' | 'info' } | null>(null);

  // Edit mode: skip step 1
  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setStep(2);
      setOnboardingType(initialData.repoUrl && initialData.repoUrl !== 'local' ? 'AUTOMATIC' : 'MANUAL');
      setRepoUrl(initialData.repoUrl || '');
      setBranch(initialData.branch || 'main');
      setRepoName(initialData.name || '');
      setDetectedApps([{
        name: initialData.name,
        type: initialData.type || 'BACKEND',
        framework: initialData.appLanguage || 'Java Spring Boot',
        srcPath: initialData.srcPath || '.',
        hasDockerfile: true,
        hasNginxConf: false
      }]);
      setSelectedAppIdx(0);
      setAppName(initialData.name || '');
      setPort(initialData.port?.toString() || '8080');
      setContainerPort(initialData.containerPort?.toString() || '8080');
      setTargetNode(initialData.targetNode || '');
      setAutoGenerateConfig(true);
      setGithubToken(initialData.gitToken || '');
      setIsPrivateRepo(!!initialData.gitToken);
      if (initialData.envVars) {
        const vars = Object.entries(initialData.envVars as Record<string, string>).map(([key, value]) => ({ key, value }));
        setEnvVars(vars);
        setEnvText(vars.map(v => `${v.key}=${v.value}`).join('\n'));
      }
    } else {
      setStep(1);
      setOnboardingType(null);
      setRepoUrl('');
      setBranch('main');
      setDetectedApps([]);
      setRepoName('');
      setSelectedAppIdx(0);
      setAppName('');
      setPort('8080');
      setContainerPort('8080');
      setTargetNode('');
      setAutoGenerateConfig(true);
      setEnvVars([]);
      setEnvText('');
      setAlreadyDeployed(false);
      setVerificationResult(null);
    }
    setLocalError(null);
    if (selectedEnvironment) {
      getEnvironmentNodes(selectedEnvironment.id)
        .then(res => setNodes(res.data))
        .catch(() => {});
    }
  }, [isOpen, initialData, selectedEnvironment]);

  // When selected app changes, update defaults
  useEffect(() => {
    if (onboardingType !== 'AUTOMATIC' || detectedApps.length === 0) return;
    const app = detectedApps[selectedAppIdx];
    if (!app) return;
    
    setAppName(app.name);
    const defaults = FRAMEWORK_DEFAULTS[app.framework] || { port: '8080', containerPort: '8080' };
    setPort(defaults.port);
    setContainerPort(defaults.containerPort);
  }, [selectedAppIdx, detectedApps, onboardingType]);

  const chooseAutomatic = () => {
    setOnboardingType('AUTOMATIC');
    setAlreadyDeployed(false);
  };

  const chooseManual = () => {
    setOnboardingType('MANUAL');
    setAlreadyDeployed(true);
    setAutoGenerateConfig(false);
    setRepoUrl('local');
    setManualFramework('Java Spring Boot');
    setManualType('BACKEND');
    setDetectedApps([{
      name: '',
      type: 'BACKEND',
      framework: 'Java Spring Boot',
      srcPath: '.',
      hasDockerfile: false,
      hasNginxConf: false
    }]);
    setStep(2);
  };

  const handleVerifyConnectivity = async () => {
    if (!targetNode || !port || !appName) {
      setLocalError("Please enter App Name, Target Node, and Port before verifying.");
      return;
    }
    setVerifying(true);
    setVerificationResult(null);
    try {
      const res = await api.post('/applications/check-running', {
        targetIp: targetNode,
        appName: appName,
        port: port
      });
      if (res.data.isRunning) {
        setVerificationResult({ success: true, message: "Connection successful! Application detected." });
      } else {
        setVerificationResult({ success: false, message: "Application not detected on the specified node and port." });
      }
    } catch (err: any) {
      setVerificationResult({ success: false, message: "Connection error: " + (err.response?.data?.message || err.message) });
    } finally {
      setVerifying(false);
    }
  };

  const analyzeRepo = async () => {
    if (!repoUrl.trim()) return;
    setAnalyzing(true);
    setLocalError(null);
    setDetectedApps([]);
    try {
      if (isPrivateRepo && githubToken.trim()) {
        try {
          await api.post('/github/token', { token: githubToken.trim() });
        } catch (err: any) {
          throw new Error(err.response?.data?.message || 'Failed to validate or save GitHub token.');
        }
      }

      let finalRepoUrl = repoUrl;
      if (isPrivateRepo) {
        finalRepoUrl = finalRepoUrl.replace('https://github.com/', '').replace('.git', '').replace('http://github.com/', '');
      }

      const res = await api.post('/repo/analyze', { repoUrl: finalRepoUrl, branch });
      const data = res.data;
      if (data.error) {
        setLocalError(data.error);
      } else if (data.apps && data.apps.length > 0) {
        setDetectedApps(data.apps);
        setRepoName(data.repoName || '');
        setAppName(data.apps[0].name);
        const defaults = FRAMEWORK_DEFAULTS[data.apps[0].framework] || { port: '8080', containerPort: '8080' };
        setPort(defaults.port);
        setContainerPort(defaults.containerPort);
        setStep(2);
      } else {
        setLocalError('No recognizable applications detected in this repository. Ensure it contains a pom.xml, package.json, requirements.txt, or go.mod.');
      }
    } catch (err: any) {
      setLocalError(err.message || err.response?.data?.error || 'Failed to analyze repository.');
    } finally {
      setAnalyzing(false);
    }
  };

  const parseEnvFile = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    const vars: { key: string; value: string }[] = [];
    for (const line of lines) {
      const eqIdx = line.indexOf('=');
      if (eqIdx > 0) {
        vars.push({ key: line.substring(0, eqIdx).trim(), value: line.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '') });
      }
    }
    return vars;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setEnvText(text);
      setEnvVars(parseEnvFile(text));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDeploy = async (force: boolean = false) => {
    const selectedApp = detectedApps[selectedAppIdx];
    if (!selectedApp || !selectedEnvironment) return;
    setLoading(true);
    setLocalError(null);

    const envMap: Record<string, string> = {};
    envVars.forEach(v => { if (v.key.trim()) envMap[v.key.trim()] = v.value; });

    if (alreadyDeployed && !force) {
      try {
        const checkRes = await api.post('/applications/check-running', {
          targetIp: targetNode,
          appName: appName,
          port: port
        });
        
        if (!checkRes.data.isRunning) {
          setStatusConfirmData({
            title: "Application Not Detected",
            message: "The application was NOT detected running on the target node and port. Do you want to register it anyway, or quit and deploy it properly?",
            type: 'warning'
          });
          setShowStatusConfirm(true);
          setLoading(false);
          return;
        } else {
          showToast("Application found! The service is running on the node.", "success");
        }
      } catch (err) {
        setStatusConfirmData({
          title: "Connection Error",
          message: "Could not reach the target node to verify the application status. Do you want to register it anyway?",
          type: 'danger'
        });
        setShowStatusConfirm(true);
        setLoading(false);
        return;
      }
    }

    let finalRepoUrl = repoUrl;
    if (isPrivateRepo) {
      finalRepoUrl = finalRepoUrl.replace('https://github.com/', '').replace('.git', '').replace('http://github.com/', '');
    }

    try {
      await onDeploy({
        id: initialData?.id,
        name: appName,
        environmentId: selectedEnvironment.id,
        type: selectedApp.type,
        appLanguage: selectedApp.framework,
        repoUrl: finalRepoUrl,
        targetNode,
        branch,
        port: parseInt(port),
        containerPort: parseInt(containerPort),
        srcPath: selectedApp.srcPath,
        envVars: envMap,
        gitToken: githubToken,
        autoGenerateConfig,
        canary: false,
        alreadyDeployed
      });
      onClose();
      showToast("Application deployment started!", "success");
    } catch (err: any) {
      setLocalError(err.response?.data?.message || 'Deployment failed.');
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedApp = detectedApps[selectedAppIdx];
  const getStepLabel = () => {
    if (step === 1 && !onboardingType) return 'Onboarding';
    if (step === 1) return onboardingType === 'AUTOMATIC' ? 'Repository' : 'Configuration';
    if (step === 2) return 'Configuration';
    return 'Environment Variables';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0b]/80 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-2xl bg-card border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary"><Box className="w-5 h-5" /></div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{initialData ? 'Edit Application' : 'Deploy Application'}</h2>
              <p className="text-sm text-muted-foreground">
                {getStepLabel()} {onboardingType && `— Step ${step} of ${onboardingType === 'MANUAL' ? '2' : '3'}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-2">
          {(onboardingType === 'MANUAL' ? [1, 2] : [1, 2, 3]).map(s => (
            <React.Fragment key={s}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${s < step ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : s === step ? 'bg-primary/20 text-primary border border-primary/40 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'bg-white/5 text-muted-foreground border border-white/10'}`}>
                {s < step ? <Check className="w-3.5 h-3.5" /> : s}
              </div>
              {s < (onboardingType === 'MANUAL' ? 2 : 3) && <div className={`flex-1 h-px ${s < step ? 'bg-emerald-500/30' : 'bg-white/10'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div ref={scrollRef} className="p-6 overflow-y-auto flex-1">
          {localError && (
            <div className="p-4 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0"><p className="text-sm text-red-200/80 leading-relaxed break-words">{localError}</p></div>
              <button onClick={() => setLocalError(null)} className="text-red-500/50 hover:text-red-500"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* ========== CHOICE STEP (Step 1 - Choice) ========== */}
          {step === 1 && !onboardingType && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="text-center space-y-2 mb-8">
                <h3 className="text-lg font-semibold">How would you like to add your application?</h3>
                <p className="text-sm text-muted-foreground">Select a method to bring your service into Monetique Eye.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={chooseAutomatic}
                  className="group relative p-6 rounded-2xl bg-primary/5 border border-primary/20 hover:border-primary/50 hover:bg-primary/10 transition-all text-left space-y-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <GitBranch className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Automated Deployment</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">Connect a GitHub repository. We'll analyze your code, build the image, and deploy it using GitOps.</p>
                  </div>
                  <div className="pt-2 flex items-center text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    START GITOPS FLOW <ChevronRight className="w-3 h-3 ml-1" />
                  </div>
                </button>

                <button
                  onClick={chooseManual}
                  className="group relative p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all text-left space-y-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Manual Onboarding</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">Register an application that is already running on a node. Note: Automated infrastructure actions will be disabled.</p>
                  </div>
                  <div className="pt-2 flex items-center text-xs font-bold text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    ADD EXISTING APP <ChevronRight className="w-3 h-3 ml-1" />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ========== STEP 1 (Automatic Repo Input) ========== */}
          {step === 1 && onboardingType === 'AUTOMATIC' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg text-primary/90 text-sm">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <p>Enter your Git repository URL. The system will clone and automatically detect all deployable applications and their frameworks.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Repository URL</label>
                  <Input value={repoUrl} onChange={e => setRepoUrl(e.target.value)} placeholder="https://github.com/organization/repo.git" className="bg-black/20 border-white/10" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Branch</label>
                  <div className="relative">
                    <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={branch} onChange={e => setBranch(e.target.value)} placeholder="main" className="pl-9 bg-black/20 border-white/10" />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isPrivateRepo"
                    checked={isPrivateRepo}
                    onChange={(e) => setIsPrivateRepo(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 bg-black/20 text-primary focus:ring-primary focus:ring-offset-0"
                  />
                  <label htmlFor="isPrivateRepo" className="text-sm font-medium text-white/80 cursor-pointer">
                    This is a private repository
                  </label>
                </div>

                {isPrivateRepo && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">GitHub Personal Access Token (PAT)</label>
                    <div className="relative">
                      <Settings2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="password"
                        value={githubToken}
                        onChange={e => setGithubToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxx"
                        className="pl-9 bg-black/20 border-white/10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your token will be securely saved and used for deployment. It requires the 'repo' scope.
                    </p>
                  </div>
                )}
              </div>
              <Button onClick={analyzeRepo} loading={analyzing} disabled={!repoUrl.trim()} className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                {analyzing ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Cloning & Analyzing Repository...</span>
                ) : (
                  <span className="flex items-center gap-2"><GitBranch className="w-4 h-4" />Analyze Repository</span>
                )}
              </Button>
            </div>
          )}
          {/* ========== STEP 2 (Configure) ========== */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Detected Apps (only for automatic) */}
              {onboardingType === 'AUTOMATIC' && detectedApps.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2"><FileCode className="w-4 h-4" />Detected Applications ({detectedApps.length})</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {detectedApps.map((app, idx) => (
                      <button key={idx} type="button" onClick={() => setSelectedAppIdx(idx)}
                        className={`p-4 rounded-xl border text-left transition-all ${selectedAppIdx === idx ? 'border-primary/50 bg-primary/5 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-white/10 bg-black/20 hover:border-white/20'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${app.type === 'FRONTEND' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                              {app.type === 'FRONTEND' ? 'FE' : 'BE'}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{app.name}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{app.framework} · {app.srcPath}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {app.hasDockerfile && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 font-bold">Dockerfile</span>}
                            {selectedAppIdx === idx && <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {onboardingType === 'MANUAL' && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-200/80 text-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <p>Registering an existing application. <strong>Note:</strong> In this mode, automated infrastructure actions (Redeploy, Undeploy, Restart) are disabled as the service is managed externally.</p>
                </div>
              )}

              {/* Config */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Application Name</label>
                    <Input value={appName} onChange={e => setAppName(e.target.value)} placeholder="app-name" className="bg-black/20 border-white/10" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Application Type</label>
                    {onboardingType === 'AUTOMATIC' ? (
                      <Input value={selectedApp?.type || ''} readOnly className="bg-black/30 border-white/5 text-muted-foreground cursor-not-allowed" />
                    ) : (
                      <div className="flex p-1 bg-black/20 rounded-lg border border-white/10 h-10">
                        {['BACKEND', 'FRONTEND'].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              setManualType(t);
                              if (detectedApps[0]) {
                                const n = [...detectedApps];
                                n[0].type = t;
                                setDetectedApps(n);
                              }
                            }}
                            className={`flex-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${manualType === t ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Framework / Language</label>
                    {onboardingType === 'AUTOMATIC' ? (
                      <Input value={selectedApp?.framework || ''} readOnly className="bg-black/30 border-white/5 text-muted-foreground cursor-not-allowed" />
                    ) : (
                      <select 
                        value={manualFramework} 
                        onChange={e => {
                          setManualFramework(e.target.value);
                          const defaults = FRAMEWORK_DEFAULTS[e.target.value] || { port: '8080', containerPort: '8080' };
                          setPort(defaults.port);
                          setContainerPort(defaults.containerPort);
                          if (detectedApps[0]) {
                            const n = [...detectedApps];
                            n[0].framework = e.target.value;
                            setDetectedApps(n);
                          }
                        }}
                        className="w-full h-10 px-3 rounded-lg bg-slate-900 border border-white/10 text-sm focus:outline-none focus:border-primary/50 text-white"
                      >
                        {Object.keys(FRAMEWORK_DEFAULTS).map(f => <option key={f} value={f} className="bg-slate-900">{f}</option>)}
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Exposed Port (Host)</label>
                    <Input type="number" value={port} onChange={e => setPort(e.target.value)} className="bg-black/20 border-white/10" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Internal Port (Container)</label>
                    <Input type="number" value={containerPort} onChange={e => setContainerPort(e.target.value)} className="bg-black/20 border-white/10" required />
                  </div>
                </div>
              </div>

              {/* Target Node */}
              <div className="p-4 bg-black/20 border border-white/5 rounded-lg space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2"><Server className="w-4 h-4 text-primary" />Infrastructure Target</h3>
                <select value={targetNode} onChange={e => setTargetNode(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-slate-900 border border-white/10 text-sm focus:outline-none focus:border-primary/50 text-white appearance-none" required>
                  <option value="" className="bg-slate-900">Select a node...</option>
                  {nodes.map((n: any) => <option key={n.ip} value={n.ip} className="bg-slate-900">{n.hostname || n.ip}</option>)}
                </select>

                {onboardingType === 'MANUAL' && (
                  <div className="pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleVerifyConnectivity} 
                      loading={verifying}
                      className="w-full border-dashed border-white/20 hover:border-primary/50 hover:bg-primary/5"
                    >
                      {verifying ? "Testing Connection..." : "Test Connectivity"}
                    </Button>
                    
                    {verificationResult && (
                      <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 text-xs animate-in slide-in-from-top-1 duration-200 ${verificationResult.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {verificationResult.success ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {verificationResult.message}
                      </div>
                    )}
                  </div>
                )}

                {onboardingType === 'AUTOMATIC' && (
                  <>
                    <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5">
                      <div className="flex items-center gap-3">
                        <Settings2 className="w-3.5 h-3.5 text-primary" />
                        <div>
                          <p className="text-[11px] font-bold">Auto-generate Dockerfile & Nginx</p>
                          <p className="text-[9px] text-muted-foreground">Creates config files if missing in repo.</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setAutoGenerateConfig(!autoGenerateConfig)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${autoGenerateConfig ? 'bg-primary' : 'bg-white/10'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${autoGenerateConfig ? 'left-[22px]' : 'left-0.5'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5">
                      <div className="flex items-center gap-3">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <div>
                          <p className="text-[11px] font-bold">App is already deployed</p>
                          <p className="text-[9px] text-muted-foreground">Skip initial deployment, just register app.</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setAlreadyDeployed(!alreadyDeployed)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${alreadyDeployed ? 'bg-amber-500' : 'bg-white/10'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${alreadyDeployed ? 'left-[22px]' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ========== STEP 3 ========== */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg text-primary/90 text-sm">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <p>Define environment variables for <strong>{appName}</strong>. You can type them manually or upload a <code className="bg-primary/20 px-1 rounded">.env</code> file.</p>
              </div>

              {/* Upload */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors text-sm font-medium">
                  <Upload className="w-4 h-4" /> Upload .env file
                  <input type="file" accept=".env,.txt" className="hidden" onChange={handleFileUpload} />
                </label>
                <span className="text-xs text-muted-foreground">or type below</span>
              </div>

              {/* Textarea */}
              <textarea
                value={envText}
                onChange={e => { setEnvText(e.target.value); setEnvVars(parseEnvFile(e.target.value)); }}
                placeholder={"# Paste your environment variables\nDATABASE_URL=postgres://...\nAPI_KEY=your-secret-key\nNODE_ENV=production"}
                className="w-full h-28 p-3 rounded-lg bg-black/20 border border-white/10 text-sm font-mono focus:outline-none focus:border-primary/50 text-white resize-none placeholder:text-white/20"
              />

              {/* Parsed Variables Table */}
              {envVars.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{envVars.length} Variables Detected</h4>
                  <div className="border border-white/10 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[1fr_1fr_40px] gap-px bg-white/5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <div className="p-2 bg-black/40">Key</div>
                      <div className="p-2 bg-black/40">Value</div>
                      <div className="p-2 bg-black/40" />
                    </div>
                    {envVars.map((v, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_40px] gap-px bg-white/5">
                        <input value={v.key} onChange={e => { const n = [...envVars]; n[i].key = e.target.value; setEnvVars(n); }} className="p-2 bg-black/60 text-xs font-mono text-white border-none focus:outline-none focus:bg-black/80" />
                        <input value={v.value} onChange={e => { const n = [...envVars]; n[i].value = e.target.value; setEnvVars(n); }} className="p-2 bg-black/60 text-xs font-mono text-white border-none focus:outline-none focus:bg-black/80" />
                        <button onClick={() => setEnvVars(envVars.filter((_, j) => j !== i))} className="flex items-center justify-center bg-black/60 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="p-4 bg-black/20 border border-white/5 rounded-lg space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Deployment Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-muted-foreground">App</span><span className="font-bold">{appName}</span>
                  <span className="text-muted-foreground">Onboarding</span><span className="font-bold">{onboardingType === 'AUTOMATIC' ? 'Automatic (GitOps)' : 'Manual (Existing)'}</span>
                  <span className="text-muted-foreground">Framework</span><span className="font-bold">{onboardingType === 'AUTOMATIC' ? selectedApp?.framework : manualFramework}</span>
                  <span className="text-muted-foreground">Node</span><span className="font-bold">{targetNode || '—'}</span>
                  <span className="text-muted-foreground">Port</span><span className="font-bold">{port}:{containerPort}</span>
                  <span className="text-muted-foreground">Env Vars</span><span className="font-bold">{envVars.length} variable{envVars.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 flex items-center justify-between bg-black/20">
          <div>
            {(step > 1 || onboardingType) && !initialData && (
              <Button variant="outline" onClick={() => { 
                if (step === 2 && onboardingType === 'MANUAL') {
                  setStep(1);
                  setOnboardingType(null);
                } else if (step === 1 && onboardingType === 'AUTOMATIC') {
                  setOnboardingType(null);
                } else {
                  setStep(step - 1); 
                }
                setLocalError(null); 
              }} className="border-white/10">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} className="border-white/10">Cancel</Button>
            {step === 2 && onboardingType === 'MANUAL' && (
              <Button onClick={() => handleDeploy()} loading={loading}
                disabled={!verificationResult || !verificationResult.success}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                Add Application
              </Button>
            )}
            {step === 2 && onboardingType === 'AUTOMATIC' && (
              <Button onClick={() => { if (!targetNode) { setLocalError('Please select a target node.'); return; } setLocalError(null); setStep(3); }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={() => handleDeploy()} loading={loading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                {initialData ? 'Update & Redeploy' : 'Deploy Application'}
              </Button>
            )}
          </div>
        </div>
      </Card>
      <ConfirmationModal
        isOpen={showStatusConfirm}
        onClose={() => setShowStatusConfirm(false)}
        onConfirm={() => {
          setShowStatusConfirm(false);
          handleDeploy(true);
        }}
        title={statusConfirmData?.title || 'Confirmation'}
        message={statusConfirmData?.message || ''}
        type={statusConfirmData?.type || 'warning'}
        confirmText="Register Anyway"
        cancelText="Quit"
      />
    </div>
  );
};

export default DeployApplicationModal;
