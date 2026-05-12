import React from 'react';
import { Settings, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Input';

const MaintenancePage: React.FC = () => {
  const handleRetry = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#060606] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full"></div>
      
      <div className="max-w-2xl w-full relative z-10 text-center">
        <div className="mb-12 relative inline-block">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
          <div className="relative bg-card/40 border border-white/5 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
            <Settings className="w-20 h-20 text-primary animate-[spin_8s_linear_infinite]" />
            <div className="absolute -top-2 -right-2">
                <div className="bg-amber-500 p-2 rounded-xl shadow-lg shadow-amber-500/20">
                    <AlertTriangle className="w-6 h-6 text-black" />
                </div>
            </div>
          </div>
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-white mb-6">
          System Maintenance
        </h1>
        
        <p className="text-xl text-muted-foreground mb-12 leading-relaxed max-w-lg mx-auto">
          The server is currently undergoing scheduled maintenance or experiencing a temporary outage. 
          We'll be back online shortly.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            onClick={handleRetry}
            className="h-14 px-10 text-lg shadow-xl shadow-primary/20 rounded-2xl group"
          >
            <RefreshCw className="w-5 h-5 mr-3 group-hover:rotate-180 transition-transform duration-500" />
            Retry Connection
          </Button>
          
          <div className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/5 rounded-2xl text-sm text-muted-foreground backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
            Expected resolution: <span className="text-white font-medium">Under 5 minutes</span>
          </div>
        </div>

        <div className="mt-20 pt-12 border-t border-white/5 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 opacity-50">
            <div className="w-8 h-[1px] bg-gradient-to-r from-transparent to-white"></div>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Monetique Eye Infrastructure</span>
            <div className="w-8 h-[1px] bg-gradient-to-l from-transparent to-white"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
