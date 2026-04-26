import React, { createContext, useContext, useState, useCallback } from 'react';
import { ShieldX, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type ToastType = 'error' | 'warning' | 'success' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let globalShowToast: ((message: string, type?: ToastType) => void) | null = null;

export const showPermissionError = (message: string) => {
  if (globalShowToast) {
    globalShowToast(message, 'error');
  }
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

let nextId = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-dismiss after 5s
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 300);
    }, 5000);
  }, []);

  // Expose globally for api.ts interceptor
  globalShowToast = showToast;

  const dismiss = (id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'error': return <ShieldX className="w-5 h-5" />;
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      case 'success': return <CheckCircle2 className="w-5 h-5" />;
      case 'info': return <Info className="w-5 h-5" />;
    }
  };

  const getStyles = (type: ToastType) => {
    switch (type) {
      case 'error': return {
        bg: 'bg-[#1a0a0a]',
        border: 'border-red-500/30',
        iconBg: 'bg-red-500/15',
        iconColor: 'text-red-400',
        glow: 'shadow-[0_0_40px_rgba(239,68,68,0.15)]',
        bar: 'bg-gradient-to-r from-red-500 to-rose-600',
      };
      case 'warning': return {
        bg: 'bg-[#1a1400]',
        border: 'border-amber-500/30',
        iconBg: 'bg-amber-500/15',
        iconColor: 'text-amber-400',
        glow: 'shadow-[0_0_40px_rgba(245,158,11,0.15)]',
        bar: 'bg-gradient-to-r from-amber-500 to-orange-500',
      };
      case 'success': return {
        bg: 'bg-[#0a1a0a]',
        border: 'border-emerald-500/30',
        iconBg: 'bg-emerald-500/15',
        iconColor: 'text-emerald-400',
        glow: 'shadow-[0_0_40px_rgba(16,185,129,0.15)]',
        bar: 'bg-gradient-to-r from-emerald-500 to-green-500',
      };
      case 'info': return {
        bg: 'bg-[#0a0a1a]',
        border: 'border-blue-500/30',
        iconBg: 'bg-blue-500/15',
        iconColor: 'text-blue-400',
        glow: 'shadow-[0_0_40px_rgba(59,130,246,0.15)]',
        bar: 'bg-gradient-to-r from-blue-500 to-indigo-500',
      };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none" style={{ maxWidth: '420px' }}>
        {toasts.map(toast => {
          const s = getStyles(toast.type);
          return (
            <div
              key={toast.id}
              className={`
                pointer-events-auto
                ${s.bg} ${s.border} ${s.glow}
                border rounded-xl overflow-hidden
                backdrop-blur-xl
                transition-all duration-300 ease-out
                ${toast.exiting 
                  ? 'opacity-0 translate-x-8 scale-95' 
                  : 'opacity-100 translate-x-0 scale-100 animate-in slide-in-from-right-5'}
              `}
            >
              {/* Top accent bar */}
              <div className={`h-[2px] w-full ${s.bar}`} />
              
              <div className="flex items-start gap-3 p-4">
                <div className={`p-2 rounded-lg ${s.iconBg} ${s.iconColor} flex-shrink-0 mt-0.5`}>
                  {getIcon(toast.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1">
                    {toast.type === 'error' ? 'Access Denied' : toast.type === 'warning' ? 'Warning' : toast.type === 'success' ? 'Success' : 'Notice'}
                  </p>
                  <p className="text-sm text-white/90 leading-relaxed">
                    {toast.message}
                  </p>
                </div>
                <button 
                  onClick={() => dismiss(toast.id)}
                  className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0 p-1 rounded-lg hover:bg-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
