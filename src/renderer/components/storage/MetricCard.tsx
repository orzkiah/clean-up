import React, { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  hint?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subValue,
  icon,
  badge,
  hint,
}) => {
  return (
    <div className="bg-slate-900/60 rounded-lg p-5 border border-slate-800/80 flex flex-col justify-between">
      <div className="flex items-center justify-between text-slate-400 mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {icon && <div className="text-slate-500">{icon}</div>}
      </div>

      <div className="my-1">
        <div className="text-2xl font-semibold tracking-tight text-slate-100 flex items-baseline gap-2">
          <span>{value}</span>
          {subValue && <span className="text-xs font-normal text-slate-400">{subValue}</span>}
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[11px] text-slate-500">
        <span>{hint || 'Live from Windows'}</span>
        {badge}
      </div>
    </div>
  );
};
