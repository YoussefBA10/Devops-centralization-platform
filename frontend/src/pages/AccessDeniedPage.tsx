import React from 'react';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AccessDeniedPageProps {
  title?: string;
  message?: string;
}

const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({ 
  title = 'Access Restricted',
  message = 'You do not have the required permissions to view this page. Contact your administrator to request access.'
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex items-center justify-center p-8 animate-in fade-in duration-500">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="relative mx-auto w-24 h-24 mb-8">
          <div className="absolute inset-0 bg-red-500/10 rounded-full animate-pulse" />
          <div className="absolute inset-2 bg-red-500/5 rounded-full" />
          <div className="absolute inset-0 flex items-center justify-center">
            <ShieldX className="w-12 h-12 text-red-400" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-3">{title}</h1>
        <p className="text-muted-foreground leading-relaxed mb-8">{message}</p>

        {/* Actions */}
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl transition-all duration-200 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default AccessDeniedPage;
