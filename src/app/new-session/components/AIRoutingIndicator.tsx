'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface AIRoutingIndicatorProps {
  observationLength: number;
  topic: string;
  isCacheHit: boolean;
}

const SENSITIVE_TOPICS = [
  'Sexual Well-being Education',
  'Distress Tolerance',
  'Emotional Regulation',
  'Physical Safety & Well-being',
];

export default function AIRoutingIndicator({
  observationLength,
  topic,
  isCacheHit,
}: AIRoutingIndicatorProps) {
  const isSensitive = SENSITIVE_TOPICS.includes(topic);
  const isComplex = observationLength > 150 || isSensitive;

  const model = isComplex ? 'Gemini Pro (Free Tier)' : 'Gemini Flash (Free Tier)';
  const modelColor = isComplex ? 'text-info' : 'text-positive';
  const modelBg = isComplex ? 'bg-info/10 border-info/20' : 'bg-positive/10 border-positive/20';

  if (!topic) return null;

  return (
    <div className={`rounded-xl border p-4 ${isCacheHit ? 'bg-accent/10 border-accent/20' : modelBg}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isCacheHit ? 'bg-accent/20' : isComplex ? 'bg-info/15' : 'bg-positive/15'
        }`}>
          <Icon
            name={isCacheHit ? 'BoltIcon' : 'CpuChipIcon'}
            size={17}
            className={isCacheHit ? 'text-accent-foreground' : modelColor}
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-700 text-foreground">
              {isCacheHit ? 'Cache Match Detected' : 'AI Routing Plan'}
            </p>
            {isCacheHit ? (
              <span className="status-badge badge-warning text-xs">
                <Icon name="BoltIcon" size={11} /> Smart Cache
              </span>
            ) : (
              <span className={`status-badge text-xs ${isComplex ? 'badge-info' : 'badge-positive'}`}>
                {model}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {isCacheHit
              ? 'A similar session exists in this student\'s history. The AI will adapt the previous analysis rather than generating from scratch — saving time and resources.'
              : isComplex
              ? `This session involves a sensitive topic ("${topic}") or a detailed observation. Routing to Gemini Pro for deeper, more nuanced analysis.`
              : `Standard session detected. Routing to Gemini Flash for fast, efficient analysis. Estimated response: under 8 seconds.`}
          </p>
          {isSensitive && !isCacheHit && (
            <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg bg-warning/10 border border-warning/20 w-fit">
              <Icon name="ShieldCheckIcon" size={12} className="text-warning" />
              <p className="text-xs text-warning font-600">Sensitive topic — enhanced persona active</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}