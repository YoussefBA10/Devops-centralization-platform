import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface StabilityGaugeProps {
  score: number;
  size?: number;
}

const StabilityGauge: React.FC<StabilityGaugeProps> = ({ score, size = 200 }) => {
  const data = [
    { value: score },
    { value: 100 - score },
  ];

  const getColor = (s: number) => {
    if (s > 80) return '#10b981'; // emerald-500
    if (s > 50) return '#f59e0b'; // amber-500
    return '#ef4444'; // red-500
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size * 0.35}
            outerRadius={size * 0.45}
            startAngle={180}
            endAngle={0}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={getColor(score)} />
            <Cell fill="rgba(255,255,255,0.05)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
        <span className="text-4xl font-bold tracking-tight">{score}%</span>
        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-1">Stability</span>
      </div>
    </div>
  );
};

export default StabilityGauge;
