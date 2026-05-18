import React, { useState } from 'react';
import { Globe, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button, Input } from '../ui/Input';

interface DeployNodeModalProps {
  envName: string;
  onDeploy: (ip: string, user: string, pass: string, osFamily: string, containerized: boolean) => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
}

const DeployNodeModal: React.FC<DeployNodeModalProps> = ({ envName, onDeploy, onClose, loading, error }) => {
  const [step, setStep] = useState(1);
  const [osFamily, setOsFamily] = useState<'ubuntu' | 'redhat' | null>(null);
  const [targetIp, setTargetIp] = useState('');
  const [sshUser, setSshUser] = useState('root');
  const [sshPassword, setSshPassword] = useState('');
  const [containerized, setContainerized] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    
    if (sshUser === envName) {
      setLocalError(`Security Restriction: SSH username cannot be identical to the environment name (${envName}).`);
      return;
    }
    
    if (!osFamily) return;
    onDeploy(targetIp, sshUser, sshPassword, osFamily, containerized);
  };


  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/95 backdrop-blur-xl" onClick={onClose}></div>
      <Card className="w-full max-w-xl relative z-10 shadow-3xl border-primary/20 bg-card overflow-hidden">
        <div className="h-2 w-full bg-primary animate-pulse"></div>
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Rocket className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs font-bold tracking-widest uppercase text-primary">Provisioning Engine</span>
          </div>
          <CardTitle className="text-2xl">Provision Agent: {envName}</CardTitle>
          <CardDescription>
            {step === 1 ? 'Step 1: Select target operating system' : 'Step 2: Configure remote connectivity'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => { setOsFamily('ubuntu'); setStep(2); }}
                  className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${
                    osFamily === 'ubuntu' ? 'border-primary bg-primary/5' : 'border-white/5 hover:border-primary/30 bg-black/20'
                  }`}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <UbuntuLogo className="w-24 h-24" />
                  </div>
                  <UbuntuLogo className={`w-12 h-12 mb-4 transition-transform group-hover:scale-110 ${osFamily === 'ubuntu' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <h3 className="text-xl font-bold text-white mb-1">Ubuntu</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">Optimized for Debian-based distributions (Debian, Ubuntu, Linux Mint).</p>
                </button>

                <button 
                  onClick={() => { setOsFamily('redhat'); setStep(2); }}
                  className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${
                    osFamily === 'redhat' ? 'border-primary bg-primary/5' : 'border-white/5 hover:border-primary/30 bg-black/20'
                  }`}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <RedHatLogo className="w-24 h-24" />
                  </div>
                  <RedHatLogo className={`w-12 h-12 mb-4 transition-transform group-hover:scale-110 ${osFamily === 'redhat' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <h3 className="text-xl font-bold text-white mb-1">RedHat</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">Enterprise ready for RHEL, CentOS, Rocky Linux, and Fedora.</p>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Choosing the correct OS family ensures the provisioning engine uses the appropriate package manager (apt vs dnf) and configuration paths.
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="ghost" className="flex-1 h-12" onClick={onClose}>Cancel</Button>
                <Button disabled={!osFamily} onClick={() => setStep(2)} className="flex-1 h-12">Next Step</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                   {osFamily === 'ubuntu' ? <UbuntuLogo className="w-5 h-5 text-primary" /> : <RedHatLogo className="w-5 h-5 text-primary" />}
                   <span className="text-sm font-bold text-white capitalize">{osFamily} Selection</span>
                </div>
                <button type="button" onClick={() => setStep(1)} className="text-xs font-bold text-primary hover:underline">Change OS</button>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Target Destination (IP / Host)
                </label>
                <Input 
                  placeholder="e.g. 192.168.1.135" 
                  value={targetIp} 
                  onChange={(e) => setTargetIp(e.target.value)}
                  required
                  className="h-14 bg-black/20 border-white/10 text-lg font-mono focus:ring-primary/50 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                     SSH Username
                  </label>
                  <Input 
                    placeholder="root" 
                    value={sshUser} 
                    onChange={(e) => setSshUser(e.target.value)}
                    required
                    className="h-12 bg-black/20 border-white/10"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                     SSH Password
                  </label>
                    <Input 
                      type="password"
                      placeholder="********" 
                      value={sshPassword} 
                      onChange={(e) => setSshPassword(e.target.value)}
                      required
                      className="h-12 bg-black/20 border-white/10 text-lg tracking-[0.2em]"
                    />
                  </div>
                </div>

              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  Node Observability Mode
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setContainerized(true)}
                    className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col justify-between h-32 ${
                      containerized ? 'border-primary bg-primary/5 text-white' : 'border-white/5 bg-black/20 text-muted-foreground hover:border-white/10'
                    }`}
                  >
                    <span className="font-bold text-sm block mb-1">Containerized</span>
                    <span className="text-[10px] opacity-70 leading-relaxed block">Deploys cAdvisor & Node Exporter inside Docker containers. Requires Docker daemon access.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setContainerized(false)}
                    className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col justify-between h-32 ${
                      !containerized ? 'border-primary bg-primary/5 text-white' : 'border-white/5 bg-black/20 text-muted-foreground hover:border-white/10'
                    }`}
                  >
                    <span className="font-bold text-sm block mb-1">Standalone Service</span>
                    <span className="text-[10px] opacity-70 leading-relaxed block">Installs Node Exporter alone as a standard systemd user service. Ideal for non-root environments.</span>
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                <div className="px-4 py-2 rounded-lg bg-blue-500/5 border border-blue-500/10 flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
                  <p className="text-[11px] text-blue-300/70 italic">
                    Info: Provisioning will use the <strong>{osFamily}-specific</strong> observability stack.
                  </p>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-amber-500 flex items-start gap-3">
                   <AlertCircle className="w-5 h-5 shrink-0" />
                   <p className="text-xs leading-relaxed font-medium">Warning: SSH credentials are used only for the automation run and are not persisted.</p>
                </div>
              </div>

              {localError && (
                <div className="p-4 rounded-xl flex items-start gap-3 border bg-destructive/10 border-destructive/20 text-destructive animate-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-bold">{localError}</span>
                </div>
              )}

              {error && !localError && (
                <div className="p-4 rounded-xl flex items-start gap-3 border bg-destructive/10 border-destructive/20 text-destructive animate-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-bold">{error}</span>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <Button variant="ghost" type="button" className="flex-1 h-12" onClick={() => setStep(1)} disabled={loading}>Back</Button>
                <Button type="submit" className="flex-1 h-12 font-bold shadow-lg shadow-primary/20" loading={loading}>
                  Start Deployment
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// SVG for Rocket since it wasn't well-exported
const Rocket = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4.5c1.62-1.63 5-2.5 5-2.5"/><path d="M12 15v5s3.03-.55 4.5-2c1.63-1.62 2.5-5 2.5-5"/></svg>
);

const UbuntuLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="8" />
    <line x1="12" y1="16" x2="12" y2="22" />
    <line x1="2" y1="12" x2="8" y2="12" />
    <line x1="16" y1="12" x2="22" y2="12" />
  </svg>
);

const RedHatLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
    <path d="M12 22V12" />
    <path d="m3 7 9 5 9-5" />
    <path d="M12 12 3 17" />
    <path d="M12 12 21 17" />
  </svg>
);

export default DeployNodeModal;
