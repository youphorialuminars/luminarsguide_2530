'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';

interface ScoreBarChartProps {
  data: { date: string; score: number; topic: string }[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="card-elevated-md px-3 py-2.5 min-w-[140px]">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-700 text-foreground tabular-nums">{payload[0].value} / 100</p>
      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[140px]">{payload[0].payload.topic?.split(' — ')[1] || payload[0].payload.topic}</p>
    </div>
  );
}

export default function ScoreBarChart({ data }: ScoreBarChartProps) {
  const avg = data.length ? Math.round(data.reduce((s, d) => s + d.score, 0) / data.length) : 0;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barSize={28}>
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.9} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.4} />
          </linearGradient>
          <linearGradient id="barGradientLow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--negative)" stopOpacity={0.8} />
            <stop offset="100%" stopColor="var(--negative)" stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
        <ReferenceLine
          y={avg}
          stroke="var(--accent)"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          label={{ value: `Avg ${avg}`, fill: 'var(--accent-foreground)', fontSize: 10, fontFamily: 'var(--font-sans)' }}
        />
        <Bar dataKey="score" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`bar-cell-${index}`}
              fill={entry.score < 65 ? 'url(#barGradientLow)' : 'url(#barGradient)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}