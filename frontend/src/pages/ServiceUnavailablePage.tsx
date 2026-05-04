import React from 'react';
import { RefreshCw, ChevronLeft } from 'lucide-react';
import { Button } from '../components/ui/Input';
import logo from '../assets/logo.png';

const ServiceUnavailablePage: React.FC = () => {
  const handleRetry = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6 font-sans">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-destructive/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative w-full max-w-2xl text-center space-y-12 animate-in fade-in zoom-in duration-700">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img src={logo} alt="Monetique Eye" className="h-16 w-auto opacity-80 hover:opacity-100 transition-opacity drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
        </div>



        {/* Text Content */}
        <div className="space-y-4">
          <h1 className="text-6xl font-black tracking-tighter text-white">
            Connection <span className="text-destructive">Lost</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
            The Monetique Eye core engine is currently unreachable. Our neural link to the infrastructure has been interrupted.
          </p>
        </div>

        {/* Technical Details Box */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 max-w-md mx-auto text-left space-y-3 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse"></div>
            Diagnostic Report
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Error Code</span>
              <span className="font-mono text-destructive">CORE_UNREACHABLE_503</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Target API</span>
              <span className="font-mono text-white/40">{import.meta.env.VITE_API_URL || 'http://localhost:8880'}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            className="h-14 px-10 text-lg rounded-2xl gap-3 shadow-2xl shadow-primary/20 hover:scale-105 transition-all"
            onClick={handleRetry}
          >
            <RefreshCw className="w-5 h-5" />
            Reconnect to Core
          </Button>
          <Button 
            variant="outline" 
            className="h-14 px-10 text-lg rounded-2xl border-white/10 hover:bg-white/5 gap-3"
            onClick={() => window.history.back()}
          >
            <ChevronLeft className="w-5 h-5" />
            Go Back
          </Button>
        </div>

        {/* Status indicator footer */}
        <div className="pt-12 flex justify-center gap-8 opacity-30 grayscale grayscale-100 hover:grayscale-0 hover:opacity-100 transition-all duration-700">
           <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            Frontend: Live
           </div>
           <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse"></div>
            Backend: Offline
           </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceUnavailablePage;
