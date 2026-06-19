import React from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';

interface Props {
  message?: string;
}

const SecurityLoadingScreen: React.FC<Props> = ({ message = 'Loading security intelligence...' }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
    <div className="flex flex-col items-center gap-6 p-8 max-w-md text-center">
      <div className="relative">
        <ShieldCheck className="w-16 h-16 text-primary/30" />
        <Loader2 className="w-16 h-16 text-primary animate-spin absolute inset-0" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white">Security Dashboard</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full animate-[loading_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
      </div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
        Fetching vulnerabilities · Falco events · Attack surface
      </p>
    </div>
  </div>
);

export default SecurityLoadingScreen;
