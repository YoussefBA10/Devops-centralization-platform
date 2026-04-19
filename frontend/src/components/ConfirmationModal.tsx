import React from 'react';
import { X, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/Input';
import { Card } from './ui/Card';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  loading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  loading = false
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger': return <AlertTriangle className="w-6 h-6 text-rose-500" />;
      case 'warning': return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      case 'success': return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
      default: return <Info className="w-6 h-6 text-blue-500" />;
    }
  };

  const getButtonClass = () => {
    switch (type) {
      case 'danger': return 'bg-rose-500 hover:bg-rose-600 text-white';
      case 'warning': return 'bg-amber-500 hover:bg-amber-600 text-white';
      case 'success': return 'bg-emerald-500 hover:bg-emerald-600 text-white';
      default: return 'bg-blue-500 hover:bg-blue-600 text-white';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-md bg-zinc-950 border-white/5 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl bg-white/5 border border-white/5`}>
              {getIcon()}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                {message}
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="p-1 text-zinc-500 hover:text-white transition-colors"
              disabled={loading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 bg-white/5 border-t border-white/5 flex items-center justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={loading}
            className="border-white/10 text-zinc-400 hover:text-white"
          >
            {cancelText}
          </Button>
          <Button 
            onClick={onConfirm} 
            loading={loading}
            className={getButtonClass()}
          >
            {confirmText}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ConfirmationModal;
