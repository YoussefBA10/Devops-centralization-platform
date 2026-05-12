import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select: React.FC<SelectProps> = ({ className, label, children, ...props }) => {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>}
      <select
        className={cn(
          'flex h-10 w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all appearance-none cursor-pointer',
          className
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
};
