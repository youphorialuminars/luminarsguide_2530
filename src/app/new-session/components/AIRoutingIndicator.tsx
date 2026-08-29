'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface AIRoutingIndicatorProps {
  observationLength: number;
  topic: string;
  isCacheHit: boolean;
  providerUsed?: string | null;
  responseTimeMs?: number | null;
  isSensitiveFromBackend?: boolean | null;
}

const SENSITIVE_TOPICS = [
  'Psychological Fortitude and Mindfulness',
  'Bodily Integrity and Social Conscientiousness',
];

export default function AIRoutingIndicator({
  observationLength,
  topic,
  isCacheHit,
  providerUsed,
  responseTimeMs,
  isSensitiveFromBackend,
}: AIRoutingIndicatorProps) {
  if (!topic) return null;

  // If we have actual backend data, show the result — no provider/model naming
  if (providerUsed) {
    const isSensitive = isSensitiveFromBackend ?? SENSITIVE_TOPICS.includes(topic);

    return (
      <div className="rounded-xl border p-4 bg-positive/10 border-positive/20">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-positive/15">
            <Icon name="CheckCircleIcon" size={17} className="text-positive" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-700 text-foreground">Analysis Complete</p>
              {responseTimeMs != null && (
                <span className="status-badge badge-info text-xs">
                  <Icon name="ClockIcon" size={11} /> {(responseTimeMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Your personalized analysis has been generated and saved.
            </p>
            {isSensitive && (
              <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg bg-warning/10 border border-warning/20 w-fit">
                <Icon name="ShieldCheckIcon" size={12} className="text-warning" />
                <p className="text-xs text-warning font-600">Sensitive pillar — enhanced persona was active</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Pre-submission: generic status, no model/tier naming
  const isSensitive = SENSITIVE_TOPICS.includes(topic);

  return (
    <div className={`rounded-xl border p-4 ${isCacheHit ? 'bg-accent/10 border-accent/20' : 'bg-positive/10 border-positive/20'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isCacheHit ? 'bg-accent/20' : 'bg-positive/15'
        }`}>
          <Icon
            name={isCacheHit ? 'BoltIcon' : 'CpuChipIcon'}
            size={17}
            className={isCacheHit ? 'text-accent-foreground' : 'text-positive'}
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-700 text-foreground">
              {isCacheHit ? 'Cache Match Detected' : 'Ready to Analyze'}
            </p>
            {isCacheHit && (
              <span className="status-badge badge-warning text-xs">
                <Icon name="BoltIcon" size={11} /> Smart Cache
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {isCacheHit
              ? "A similar session exists in this student's history. The AI will adapt the previous analysis rather than generating from scratch — saving time and resources."
              : "Your veteran educator AI will synthesise all five observation areas with the test score to generate personalized guidance."}
          </p>
          {isSensitive && !isCacheHit && (
            <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg bg-warning/10 border border-warning/20 w-fit">
              <Icon name="ShieldCheckIcon" size={12} className="text-warning" />
              <p className="text-xs text-warning font-600">Sensitive pillar — enhanced persona active</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}