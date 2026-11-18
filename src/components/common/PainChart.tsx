import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { TrendingDown, TrendingUp, Minus, Activity } from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import { formatDate } from '../../lib/utils';

/** Pain scale (EVA 0-10) before/after each session for one patient */
export const PainChart: React.FC<{ patientId: string }> = ({ patientId }) => {
  const [history, setHistory] = useState(() => clinicStorage.getPainHistory(patientId));
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const load = () => {
      setHistory(clinicStorage.getPainHistory(patientId));
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    load();
    return clinicStorage.subscribe(load);
  }, [patientId]);

  if (history.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-[#64748B] dark:text-[#94A3B8] rounded-xl border border-dashed border-[#E5EAE7] dark:border-[#273830]">
        <Activity className="w-6 h-6 mx-auto mb-1 opacity-60" />
        Ainda não há registros de dor. Eles aparecem aqui a cada atendimento finalizado.
      </div>
    );
  }

  const data = history.map((h) => ({
    label: formatDate(h.date, 'dd/MM'),
    fullDate: formatDate(h.date, 'dd/MM/yyyy'),
    'Início da sessão': h.before,
    'Fim da sessão': h.after,
  }));

  const first = history[0].before;
  const last = history[history.length - 1].after;
  const delta = last - first;
  const avgRelief =
    history.reduce((sum, h) => sum + (h.before - h.after), 0) / history.length;

  const axis = isDark ? '#94A3B8' : '#64748B';
  const grid = isDark ? '#273830' : '#E5EAE7';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 rounded-lg bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830]">
          <span className="text-[10px] uppercase font-bold text-[#64748B]">Primeira sessão</span>
          <p className="text-lg font-bold">{first}/10</p>
        </div>
        <div className="p-2.5 rounded-lg bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830]">
          <span className="text-[10px] uppercase font-bold text-[#64748B]">Última sessão</span>
          <p className="text-lg font-bold">{last}/10</p>
        </div>
        <div
          className={`p-2.5 rounded-lg border ${
            delta < 0
              ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900'
              : delta > 0
              ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900'
              : 'bg-[#F8FAF9] dark:bg-[#111A15] border-[#E5EAE7] dark:border-[#273830]'
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-[#64748B]">Variação</span>
          <p
            className={`text-lg font-bold flex items-center justify-center gap-1 ${
              delta < 0 ? 'text-emerald-700 dark:text-emerald-400' : delta > 0 ? 'text-rose-600 dark:text-rose-400' : ''
            }`}
          >
            {delta < 0 ? <TrendingDown className="w-4 h-4" /> : delta > 0 ? <TrendingUp className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
            {delta > 0 ? '+' : ''}
            {delta}
          </p>
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="label" stroke={axis} fontSize={11} />
            <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} stroke={axis} fontSize={11} />
            <Tooltip
              labelFormatter={(_, payload) => (payload?.[0]?.payload as { fullDate?: string })?.fullDate || ''}
              formatter={(v: any) => [`${v}/10`]}
              contentStyle={{
                backgroundColor: isDark ? '#141F19' : '#FFFFFF',
                border: `1px solid ${grid}`,
                borderRadius: 8,
                fontSize: 12,
                color: isDark ? '#EEF3F0' : '#17231D',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="Início da sessão" stroke="#D97706" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="Fim da sessão" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
        {history.length} sessão(ões) registradas • alívio médio dentro da sessão: {avgRelief.toFixed(1)} ponto(s) na EVA.
      </p>
    </div>
  );
};
