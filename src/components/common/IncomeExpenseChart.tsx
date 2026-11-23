import React, { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '../../lib/utils';

/** One month of the receitas × despesas chart (values in cents) */
export type MonthSeries = { key: string; label: string; inC: number; outC: number };

/**
 * Receitas × despesas grouped bars. Palette validated for light/dark surfaces and colour-vision
 * deficiencies (receitas #13875E / #2FA877, despesas #C9730A / #C98212): one axis, legend, hover
 * summary and a table view.
 */
/** Grouped bars, one axis, 2 validated series; hover shows both values, table view available */
export const IncomeExpenseChart: React.FC<{ series: MonthSeries[] }> = ({ series }) => {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  // draw at the real width so labels keep their size on phones (scaling a fixed drawing shrinks text)
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(600);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [asTable]);
  const max = Math.max(1, ...series.flatMap((s) => [s.inC, s.outC]));
  const nice = (() => {
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / step) * step;
  })();
  const W = boxW;
  const H = boxW < 420 ? 200 : 220;
  const padL = 48;
  const padB = 26;
  const plotH = H - padB - 12;
  const groupW = (W - padL) / series.length;
  const barW = Math.min(26, groupW / 3.2);
  const y = (v: number) => 12 + plotH - (v / nice) * plotH;
  const compact = (c: number) => (c >= 100000 ? `${(c / 100000).toFixed(c % 100000 ? 1 : 0).replace('.', ',')}k` : `${Math.round(c / 100)}`);
  // rounded top, square base anchored to the baseline
  const bar = (x: number, v: number) => {
    const top = y(v);
    const h = 12 + plotH - top;
    if (h <= 0) return '';
    const r = Math.min(4, h, barW / 2);
    return `M${x},${12 + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${12 + plotH} Z`;
  };
  const active = hover ?? series.length - 1;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-4 text-[11px] text-[#475569] dark:text-[#9AA8B6]" aria-label="Legenda">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#13875E] dark:bg-[#2FA877]" /> Receitas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#C9730A] dark:bg-[#C98212]" /> Despesas
          </span>
        </div>
        <button onClick={() => setAsTable(!asTable)} className="text-[11px] font-semibold text-[#426B5B] dark:text-[#7FB39F] hover:underline">
          {asTable ? 'Ver gráfico' : 'Ver tabela'}
        </button>
      </div>
      {asTable ? (
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-[#64748B]">
            <tr>
              <th className="text-left py-1.5">Mês</th>
              <th className="text-right py-1.5">Receitas</th>
              <th className="text-right py-1.5">Despesas</th>
              <th className="text-right py-1.5">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
            {series.map((s) => (
              <tr key={s.key}>
                <td className="py-1.5 capitalize">{s.label}</td>
                <td className="py-1.5 text-right font-semibold">{formatCurrency(s.inC)}</td>
                <td className="py-1.5 text-right font-semibold">{formatCurrency(s.outC)}</td>
                <td className={`py-1.5 text-right font-bold ${s.inC - s.outC < 0 ? 'text-rose-600' : ''}`}>{formatCurrency(s.inC - s.outC)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative" ref={boxRef}>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Receitas e despesas dos últimos 6 meses" onMouseLeave={() => setHover(null)}>
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={padL} x2={W} y1={y(nice * t)} y2={y(nice * t)} className="stroke-[#E5EAE7] dark:stroke-[#273830]" strokeWidth={1} />
                <text x={padL - 6} y={y(nice * t) + 3} textAnchor="end" className="fill-[#94A3B8] text-[10px]">
                  {compact(nice * t)}
                </text>
              </g>
            ))}
            {series.map((s, i) => {
              const gx = padL + i * groupW + groupW / 2;
              const isActive = i === active;
              return (
                <g key={s.key} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} className="cursor-pointer">
                  {/* hit target larger than the marks */}
                  <rect x={padL + i * groupW} y={0} width={groupW} height={H} fill="transparent" />
                  {isActive && <rect x={padL + i * groupW + 4} y={8} width={groupW - 8} height={plotH + 8} rx={6} className="fill-[#F1F5F3] dark:fill-[#1F332A]" />}
                  <path d={bar(gx - barW - 1, s.inC)} className="fill-[#13875E] dark:fill-[#2FA877]" />
                  <path d={bar(gx + 1, s.outC)} className="fill-[#C9730A] dark:fill-[#C98212]" />
                  <text x={gx} y={H - 8} textAnchor="middle" className={`text-[11px] capitalize ${isActive ? 'fill-[#17231D] dark:fill-[#F1F5F3] font-bold' : 'fill-[#64748B]'}`}>
                    {s.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold capitalize">{series[active].label}:</span>
            <span>
              Receitas <b>{formatCurrency(series[active].inC)}</b>
            </span>
            <span>
              Despesas <b>{formatCurrency(series[active].outC)}</b>
            </span>
            <span>
              Resultado <b className={series[active].inC - series[active].outC < 0 ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}>{formatCurrency(series[active].inC - series[active].outC)}</b>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
