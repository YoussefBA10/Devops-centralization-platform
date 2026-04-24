import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Server, 
  Settings, 
  Shield, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  User
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
    vmpipeHostname: 'central-node',
    environmentName: 'central-node',
    sshUser: 'root',
    osFamily: '' as 'ubuntu' | 'redhat' | ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    if (formData.sshUser === formData.environmentName) {
      setError('Security Restriction: SSH User and Environment Name cannot be identical. Please use different values.');
      setLoading(false);
      return;
    }

    if (!formData.osFamily) {
      setError('Please select an Operating System family.');
      setLoading(false);
      return;
    }

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
                <p className="text-slate-400">Select the operating system family for your central node (vmpipe).</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setFormData({...formData, osFamily: 'ubuntu'})}
                  className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${
                    formData.osFamily === 'ubuntu' ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 hover:border-blue-500/30 bg-black/20'
                  }`}
                >
                  <UbuntuLogo className={`w-12 h-12 mb-4 transition-transform group-hover:scale-110 ${formData.osFamily === 'ubuntu' ? 'text-blue-500' : 'text-slate-500'}`} />
                  <h3 className="text-xl font-bold text-white mb-1">Ubuntu</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed">Debian-based systems (Ubuntu, Debian).</p>
                </button>

                <button 
                  onClick={() => setFormData({...formData, osFamily: 'redhat'})}
                  className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${
                    formData.osFamily === 'redhat' ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 hover:border-blue-500/30 bg-black/20'
                  }`}
                >
                  <RedHatLogo className={`w-12 h-12 mb-4 transition-transform group-hover:scale-110 ${formData.osFamily === 'redhat' ? 'text-blue-500' : 'text-slate-500'}`} />
                  <h3 className="text-xl font-bold text-white mb-1">RedHat</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed">Enterprise systems (RHEL, CentOS, Rocky).</p>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex gap-4">
                <AlertCircle className="w-6 h-6 text-blue-500 shrink-0" />
                <p className="text-sm text-blue-100/70 leading-relaxed">
                  The central node hosts your ELK stack, Prometheus, and Ansible core. Choosing the correct OS family is critical for automation.
                </p>
              </div>

              <button 
                disabled={!formData.osFamily}
                onClick={() => setStep(2)}
                className="w-full h-12 bg-white text-black font-semibold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                Continue Configuration
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  {formData.osFamily === 'ubuntu' ? <UbuntuLogo className="w-5 h-5 text-blue-500" /> : <RedHatLogo className="w-5 h-5 text-blue-500" />}
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{formData.osFamily} Platform selected</span>
                </div>

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
                    <label className="text-sm font-medium text-slate-400 ml-1">SSH User</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                      <input 
                        type="text"
                        placeholder="root"
                        className="w-full h-12 bg-[#0a0a0c] border border-white/5 rounded-xl pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white"
                        value={formData.sshUser}
                        onChange={e => setFormData({...formData, sshUser: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400 ml-1">Environment Name</label>
                    <div className="relative group">
                      <Settings className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                      <input 
                        type="text"
                        placeholder="central-node"
                        className="w-full h-12 bg-[#0a0a0c] border border-white/5 rounded-xl pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white"
                        value={formData.environmentName}
                        onChange={e => setFormData({...formData, environmentName: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="px-4 py-2 rounded-lg bg-blue-500/5 border border-blue-500/10 flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
                  <p className="text-[11px] text-blue-300/70 italic">
                    Info: Setup will initialize your <strong>{formData.osFamily}</strong> infrastructure.
                  </p>
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
                  Monetique-Eye has been successfully initialized on <strong>{formData.osFamily}</strong>. The central node is now being registered.
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

export default SetupWizard;
