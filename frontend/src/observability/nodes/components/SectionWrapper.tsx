import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SectionWrapperProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const SectionWrapper: React.FC<SectionWrapperProps> = ({
  id,
  title,
  icon,
  isCollapsed,
  onToggle,
  children,
  rightElement
}) => {
  return (
    <div className="space-y-4 border-b border-[#2a2d3a]/50 pb-6 last:border-0" id={`${id}-section`}>
      <div 
        className="flex items-center justify-between py-2 cursor-pointer group select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="text-primary group-hover:scale-115 transition-transform duration-300">
            {icon}
          </div>
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/80 group-hover:text-white transition-colors duration-200">
            {title}
          </h2>
        </div>
        
        <div className="flex items-center gap-4">
          {rightElement && <div onClick={(e) => e.stopPropagation()}>{rightElement}</div>}
          <div className="p-1 hover:bg-white/5 rounded-lg transition-colors">
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors" />
            ) : (
              <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors" />
            )}
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
    </div>
  );
};
