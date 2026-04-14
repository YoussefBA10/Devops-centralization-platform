import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
  return (
    <div 
      className={cn(
        "bg-card border border-border rounded-xl transition-all duration-300 hover:shadow-xl hover:shadow-primary/5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardProps> = ({ children, className, ...props }) => (
  <div className={cn("p-6 flex flex-col space-y-1.5", className)} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<CardProps> = ({ children, className, ...props }) => (
  <h3 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<CardProps> = ({ children, className, ...props }) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<CardProps> = ({ children, className, ...props }) => (
  <div className={cn("p-6 pt-0", className)} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<CardProps> = ({ children, className, ...props }) => (
  <div className={cn("flex items-center p-6 pt-0", className)} {...props}>
    {children}
  </div>
);

export default Card;
