'use client';

import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface TopicPieChartProps {
  data: { topic: string; count: number; avgScore: number }[];
}

const PIE_COLORS = [
  'var(--primary)',
  'var(--accent)',
  'var(--info)',
  'var(--positive)',
  'var(--negative)',
  'var(--warning)',
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="card-elevated-md px-3 py-2.5 min-w-[160px]">
      <p className="text-xs font-700 text-foreground mb-1">{d.topic}</p>
      <p className="text-xs text-muted-foreground">{d.count} session{d.count !== 1 ? 's' : ''}</p>
      <p className="text-xs text-muted-foreground">Avg. score: <span className="font-600 text-foreground tabular-nums">{d.avgScore}</span></p>
    </div>
  );
}

function CustomLegend({ payload }: any) {
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {payload?.map((entry: any, i: number) => (
        <div key={`legend-${i}`} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <p className="text-xs text-muted-foreground truncate">{entry.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function TopicPieChart({ data }: TopicPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="45%"
          cy="50%"
          innerRadius={52}
          outerRadius={80}
          paddingAngle={3}
          dataKey="count"
          nameKey="topic"
        >
          {data.map((_, index) => (
            <Cell
              key={`pie-cell-${index}`}
              fill={PIE_COLORS[index % PIE_COLORS.length]}
              stroke="transparent"
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          content={<CustomLegend />}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}