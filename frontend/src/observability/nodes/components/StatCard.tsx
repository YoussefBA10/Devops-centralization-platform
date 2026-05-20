import React from 'react';
import { Card, CardContent } from '../../../components/ui/Card';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color?: string; // CSS style color
  loading?: boolean;
  description?: string;
  onClick?: () => void;
  className?: string;
  statusColor?: 'healthy' | 'warning' | 'critical' | 'unknown' | 'none';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  icon,
  color = 'var(--color-primary)',
  loading = false,
  description,
  onClick,
  className = '',
  statusColor = 'none'
}) => {
  const getBorderColorClass = () => {
    switch (statusColor) {
      case 'healthy': return 'border-emerald-500/30 hover:border-emerald-500/50';
      case 'warning': return 'border-amber-500/30 hover:border-amber-500/50';
      case 'critical': return 'border-rose-500/30 hover:border-rose-500/50';
      case 'unknown': return 'border-gray-500/30 hover:border-gray-500/50';
      default: return 'border-white/5 hover:border-white/10';
    }
  };

  return (
    <Card 
      className={`bg-[#1a1d27] shadow-xl transition-all border duration-300 ${getBorderColorClass()} ${
        onClick ? 'cursor-pointer transform hover:-translate-y-0.5' : ''
      } ${className}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#a1a1aa]">
            {title}
          </div>
          <div className="p-2.5 rounded-xl bg-white/5" style={{ color }}>
            {icon}
          </div>
        </div>

        <div className="space-y-1">
          {loading ? (
            <div className="h-10 w-28 bg-white/5 animate-pulse rounded-lg" />
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-mono font-black text-white tracking-tight">
                {value}
              </span>
              {unit && (
                <span className="text-base font-bold text-[#a1a1aa]">
                  {unit}
                </span>
              )}
            </div>
          )}
          
          {description && !loading && (
            <p className="text-[10px] text-muted-foreground font-medium truncate">
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
