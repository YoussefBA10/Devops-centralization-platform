import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Server, 
  Settings, 
  Terminal, 
  Shield, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { initializeSetup } from '../services/api';
import { useEnvironment } from '../context/EnvironmentContext';

const SetupWizard: React.FC = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshEnvironments } = useEnvironment();
  const navigate = useNavigate();

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
      setStep(3); // Move to success step
      // Brief delay before refreshing and navigating
      setTimeout(async () => {
        await refreshEnvironments();
        navigate('/');
      }, 15000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to initialize system. Please verify the IP address and backend status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-2xl relative">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 mb-6 shadow-2xl shadow-blue-500/20">
            <div className="w-full h-full bg-[#0a0a0c] rounded-[14px] flex items-center justify-center">
              < Shield className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-3">
            Monetique<span className="text-blue-500">-Eye</span>
          </h1>
          <p className="text-slate-400 text-lg">Platform Initial Configuration</p>
        </div>

        {/* Wizard Card */}
        <div className="bg-[#111114]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl">
          {/* Progress Bar */}
          <div className="flex items-center gap-4 mb-10">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${
                  step === s ? 'bg-blue-600 text-white ring-4 ring-blue-500/20' : 
                  step > s ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'
                }`}>
                  {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
                </div>
                <div className={`h-1 flex-1 rounded-full ${step > s ? 'bg-emerald-500/50' : 'bg-slate-800'}`} />
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-white">System Architecture</h2>
                <p className="text-slate-400">Welcome to Monetique-Eye. To monitor your infrastructure, we need to locate your central <b>vmpipe</b> node.</p>
              </div>
              
              <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex gap-4">
                <AlertCircle className="w-6 h-6 text-blue-500 shrink-0" />
                <p className="text-sm text-blue-100/70 leading-relaxed">
                  The central node hosts your ELK stack, Prometheus, and Ansible core. Ensure these services are reachable from this browser.
                </p>
              </div>

              <button 
                onClick={() => setStep(2)}
                className="w-full h-12 bg-white text-black font-semibold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2 group"
              >
                Start Setup
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Central Node IP Address</label>
                  <div className="relative group">
                    <Server className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      required
                      type="text"
                      placeholder="192.168.1.100"
                      className="w-full h-12 bg-[#0a0a0c] border border-white/5 rounded-xl pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white"
                      value={formData.vmpipeIp}
                      onChange={e => setFormData({...formData, vmpipeIp: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400 ml-1">Hostname</label>
                    <div className="relative group">
                      <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                      <input 
                        type="text"
                        placeholder="vmpipe"
                        className="w-full h-12 bg-[#0a0a0c] border border-white/5 rounded-xl pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white"
                        value={formData.vmpipeHostname}
                        onChange={e => setFormData({...formData, vmpipeHostname: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400 ml-1">Environment Name</label>
                    <div className="relative group">
                      <Settings className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                      <input 
                        type="text"
                        placeholder="vmpipe"
                        className="w-full h-12 bg-[#0a0a0c] border border-white/5 rounded-xl pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white"
                        value={formData.environmentName}
                        onChange={e => setFormData({...formData, environmentName: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 h-12 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-700 transition-all"
                >
                  Back
                </button>
                <button 
                  disabled={loading}
                  type="submit"
                  className="flex-[2] h-12 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    'Complete Setup'
                  )}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="text-center py-8 space-y-6 animate-in zoom-in-95 duration-500">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-500 mb-4 scale-110">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white">System Ready!</h2>
                <p className="text-slate-400 max-w-sm mx-auto">
                  Monetique-Eye has been successfully initialized. The central node is now being registered in Prometheus and your ELK dashboard.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-blue-500 text-sm font-medium animate-pulse">
                Redirecting to dashboard in a few seconds...
              </div>
            </div>
          )}
        </div>
        
        <p className="text-center mt-8 text-slate-500 text-sm">
          Precision Monitoring & Observability Stack v1.0.0
        </p>
      </div>
    </div>
  );
};

export default SetupWizard;
