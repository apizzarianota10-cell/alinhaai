import React from 'react';

/** Small building blocks for information-dense screens, matching the Visão Geral cards */

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ElementType;
  tone?: 'green' | 'blue' | 'amber' | 'rose' | 'slate';
  onClick?: () => void;
}> = ({ label, value, hint, icon: Icon, tone = 'green', onClick }) => {
  const tones = {
    green: 'bg-[#E9F1EC] dark:bg-[#1F332A] text-[#426B5B] dark:text-[#7FB39F]',
    blue: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300',
    amber: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-300',
    rose: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300',
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`text-left p-3 sm:p-4 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs ${
        onClick ? 'hover:border-[#426B5B] transition-colors cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] sm:text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] leading-tight">{label}</span>
        <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <div className="mt-1.5 text-xl sm:text-2xl font-bold text-[#17231D] dark:text-[#F1F5F3]">{value}</div>
      {hint && <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5 leading-snug">{hint}</div>}
    </Tag>
  );
};

const AVATAR_COLORS = ['#426B5B', '#2563EB', '#B45309', '#BE185D', '#7C3AED', '#0F766E', '#9A3412'];

export const Avatar: React.FC<{ name: string; size?: 'sm' | 'md' | 'lg' }> = ({ name, size = 'md' }) => {
  const parts = name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  const color = AVATAR_COLORS[[...name].reduce((h, c) => h + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const dim = size === 'lg' ? 'w-14 h-14 text-lg' : size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-10 h-10 text-sm';
  return (
    <span className={`${dim} shrink-0 rounded-full flex items-center justify-center font-bold text-white`} style={{ backgroundColor: color }} aria-hidden>
      {initials}
    </span>
  );
};

/** Horizontal meter; colour follows the value unless a tone is forced */
export const ProgressBar: React.FC<{ value: number; max?: number; tone?: 'auto' | 'green' | 'amber' | 'rose' | 'blue'; label?: string }> = ({
  value,
  max = 100,
  tone = 'auto',
  label,
}) => {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const color =
    tone === 'auto'
      ? pct >= 80
        ? 'bg-emerald-500'
        : pct >= 60
        ? 'bg-amber-500'
        : 'bg-rose-500'
      : { green: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500', blue: 'bg-[#426B5B]' }[tone];
  return (
    <div className="w-full h-1.5 rounded-full bg-[#E5EAE7] dark:bg-[#273830] overflow-hidden" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

export type AlertTone = 'amber' | 'rose' | 'blue' | 'slate' | 'green';
export const Pill: React.FC<{ tone?: AlertTone; children: React.ReactNode; title?: string }> = ({ tone = 'slate', children, title }) => {
  const tones: Record<AlertTone, string> = {
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300',
    rose: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300',
    blue: 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
};

export const Card: React.FC<{ title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title,
  action,
  children,
  className = '',
}) => (
  <section className={`rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#E5EAE7] dark:border-[#273830]">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#17231D] dark:text-[#F1F5F3]">{title}</h2>
        {action}
      </div>
    )}
    <div className="p-3 sm:p-4">{children}</div>
  </section>
);

/** Whole days between two YYYY-MM-DD dates (b - a) */
export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);
