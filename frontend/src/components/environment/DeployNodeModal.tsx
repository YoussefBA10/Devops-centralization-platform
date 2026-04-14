import React, { useState } from 'react';
import { Globe, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button, Input } from '../ui/Input';

interface DeployNodeModalProps {
  envName: string;
  onDeploy: (ip: string, user: string, pass: string) => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
}

const DeployNodeModal: React.FC<DeployNodeModalProps> = ({ envName, onDeploy, onClose, loading, error }) => {
  const [targetIp, setTargetIp] = useState('');
  const [sshUser, setSshUser] = useState('root');
  const [sshPassword, setSshPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onDeploy(targetIp, sshUser, sshPassword);
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
          <CardDescription>Deploying observability stack to a remote endpoint via SSH.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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
            
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-amber-500 flex items-start gap-3">
               <AlertCircle className="w-5 h-5 shrink-0" />
               <p className="text-xs leading-relaxed font-medium">Warning: Password is used only once for SSH configuration and is not stored or logged anywhere in our system.</p>
            </div>

            {error && (
              <div className="p-4 rounded-xl flex items-start gap-3 border bg-destructive/10 border-destructive/20 text-destructive animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-sm font-bold">{error}</span>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <Button variant="ghost" type="button" className="flex-1 h-12" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button type="submit" className="flex-1 h-12 font-bold shadow-lg shadow-primary/20" loading={loading}>
                Start Deployment
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// SVG for Rocket since it wasn't well-exported
const Rocket = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4.5c1.62-1.63 5-2.5 5-2.5"/><path d="M12 15v5s3.03-.55 4.5-2c1.63-1.62 2.5-5 2.5-5"/></svg>
);

export default DeployNodeModal;
