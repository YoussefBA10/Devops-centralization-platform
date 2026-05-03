import React from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';

interface DeleteLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  linkName: string;
  loading?: boolean;
}

const DeleteLinkModal: React.FC<DeleteLinkModalProps> = ({ isOpen, onClose, onConfirm, linkName, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="bg-[#0f1117] border border-white/10 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5 text-red-400">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-400/20 rounded-lg">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Delete Service Link</h2>
              <p className="text-xs text-muted-foreground/80">This action cannot be undone</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-lg flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-200/80 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-white">"{linkName}"</span>? 
              This will stop all network health probing for this link.
            </p>
          </div>

          <div className="pt-4 flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all font-medium disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Deleting...
                </>
              ) : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteLinkModal;
