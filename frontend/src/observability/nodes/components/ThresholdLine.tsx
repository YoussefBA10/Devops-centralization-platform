import React from 'react';
import { ReferenceLine } from 'recharts';

interface ThresholdLineProps {
  y: number;
  label: string;
  type: 'warning' | 'critical' | 'info';
}

export const ThresholdLine: React.FC<ThresholdLineProps> = ({ y, label, type }) => {
  const getColor = () => {
    switch (type) {
      case 'warning': return '#f59e0b';
      case 'critical': return '#ef4444';
      default: return '#3b82f6';
    }
  };

  const color = getColor();

  return (
    <ReferenceLine 
      y={y} 
      stroke={color} 
      strokeDasharray="4 4" 
      strokeWidth={1.5}
      label={{ 
        value: label, 
        position: 'top', 
        fill: color, 
        fontSize: 9, 
        fontWeight: 'bold',
        style: { letterSpacing: '0.1em', textTransform: 'uppercase' }
      }} 
    />
  );
};
