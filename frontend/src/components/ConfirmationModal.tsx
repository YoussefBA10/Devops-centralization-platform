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
  requiresConfirmationText?: string;
  confirmationPlaceholder?: string;
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
  loading = false,
  requiresConfirmationText,
  confirmationPlaceholder = 'Type here to confirm...'
}) => {
  const [inputValue, setInputValue] = React.useState('');

  React.useEffect(() => {
    if (isOpen) setInputValue('');
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmDisabled = loading || (requiresConfirmationText && inputValue !== requiresConfirmationText);

  const getIcon = () => {
    switch (type) {
      case 'danger': return <AlertTriangle className="w-6 h-6 text-rose-500" />;
      case 'warning': return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      case 'success': return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
      default: return <Info className="w-6 h-6 text-blue-500" />;
    }
  };

  const getButtonClass = () => {
    if (isConfirmDisabled) return 'bg-zinc-800 text-zinc-500 cursor-not-allowed';
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
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                {message}
              </p>

              {requiresConfirmationText && (
                <div className="mt-4 space-y-2">
                  <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">
                    To confirm, please type: <span className="text-white select-all">{requiresConfirmationText}</span>
                  </p>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={confirmationPlaceholder}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    autoFocus
                  />
                </div>
              )}
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
            disabled={!!isConfirmDisabled}
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
