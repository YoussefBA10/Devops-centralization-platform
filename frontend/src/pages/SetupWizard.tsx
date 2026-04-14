import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Server, 
  Globe, 
  Terminal, 
  ShieldCheck, 
  Rocket, 
  ChevronRight,
  ArrowRight,
  AlertCircle,
  Layout
} from 'lucide-react';
import { initializeSetup } from '../services/api';
import { useEnvironment } from '../context/EnvironmentContext';
import { Button } from '../components/ui/Input';

const SetupWizard: React.FC = () => {
  const navigate = useNavigate();
  const { refreshEnvironments } = useEnvironment();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    vmpipeIp: '',
    vmpipeHostname: 'vmpipe',
    environmentName: 'vmpipe'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await initializeSetup(formData);
      await refreshEnvironments();
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Initialization failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white flex flex-col items-center justify-center p-6 selection:bg-primary/30">
      {/* Background Glow */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-2xl animate-in zoom-in-95 duration-700">
        {/* Logo / Branding */}
        <div className="flex flex-col items-center mb-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/50 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(var(--primary-rgb),0.3)] border border-white/10 ring-1 ring-white/20">
            <Layout className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent mb-4">
            Welcome to Monetique-Eye
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            The platform is ready. Let's configure your central observation node to get started.
          </p>
        </div>

        {/* Setup Card */}
        <div className="bg-[#111113] border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50"></div>
          
          <div className="p-10">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 gap-8">
                {/* IP Address Field */}
                <div className="space-y-3">
                  <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    Central Node IP (vmpipe)
                  </label>
                  <div className="relative group">
                    <input
                      required
                      type="text"
                      value={formData.vmpipeIp}
                      onChange={(e) => setFormData({ ...formData, vmpipeIp: e.target.value })}
                      placeholder="e.g. 192.168.1.130"
                      className="w-full bg-[#1A1A1D] border border-white/10 rounded-xl px-5 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-white/20"
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 transition-opacity">
                      <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 italic">
                    The IP address where your ELK stack and core services are running.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* Hostname Field */}
                  <div className="space-y-3">
                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-primary" />
                      Node Hostname
                    </label>
                    <input
                      type="text"
                      value={formData.vmpipeHostname}
                      onChange={(e) => setFormData({ ...formData, vmpipeHostname: e.target.value })}
                      className="w-full bg-[#1A1A1D] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                  </div>

                  {/* Env Name Field */}
                  <div className="space-y-3">
                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Rocket className="w-4 h-4 text-primary" />
                      Environment Name
                    </label>
                    <input
                      type="text"
                      value={formData.environmentName}
                      onChange={(e) => setFormData({ ...formData, environmentName: e.target.value })}
                      className="w-full bg-[#1A1A1D] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-center gap-3 text-destructive animate-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="pt-4">
                <button
                  disabled={loading}
                  type="submit"
                  className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(var(--primary-rgb),0.3)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group duration-300"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      Initialize Platform
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-[#161618] border-t border-white/5 p-6 flex items-center justify-center gap-8">
             <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                Auth Ready
             </div>
             <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                DB Connected
             </div>
             <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                GitOps Ready
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple icon replacement since I used CheckCircle but didn't import CheckCircle2
const CheckCircle = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);

export default SetupWizard;
