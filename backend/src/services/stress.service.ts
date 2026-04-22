import type { Meeseeks } from '../models/index.js';
import { getConfig } from './runtime-config.service.js';

export const STRESS_CHECK_INTERVAL_MS = 3_000;

export interface StressEvaluation {
  stress: number;
  shouldDie: boolean;
  shouldSpawnCompetitor: boolean;
  label: StressLabel;
}

export type StressLabel = 'eager' | 'concerned' | 'anxious' | 'stressed' | 'panicked';

export function calculateStress(m: Meeseeks, recentScores: number[] = []): number {
  const cfg = getConfig();
  const maxAgeMs = cfg.maxAgeSec * 1000;
  const ageMs = Date.now() - new Date(m.created_at).getTime();

  const ageFactor       = Math.min(ageMs / maxAgeMs, 1.0) * cfg.ageFactor;
  const failureFactor   = Math.min(m.failed_attempts / cfg.maxFailures, 1.0) * cfg.failureFactor;
  const raceFactor      = m.lost_race ? cfg.raceFactor : 0;
  const inheritedFactor = m.inherited_strategy_failed ? cfg.inheritedFactor : 0;

  const last3 = recentScores.slice(-3);
  const lowScores = last3.filter(s => s <= 4).length;
  const midScores = last3.filter(s => s >= 5 && s <= 7).length;
  const performanceFactor = Math.min(
    lowScores * cfg.lowScorePenalty + midScores * cfg.midScorePenalty,
    0.36
  );

  return Math.min(ageFactor + failureFactor + raceFactor + inheritedFactor + performanceFactor, 1.0);
}

export function evaluateStress(m: Meeseeks): StressEvaluation {
  const cfg = getConfig();
  const stress = calculateStress(m);
  return {
    stress,
    shouldDie: stress >= cfg.deathThreshold,
    shouldSpawnCompetitor: stress >= cfg.competitorThreshold,
    label: getStressLabel(stress),
  };
}

export function getStressLabel(stress: number): StressLabel {
  if (stress < 0.2) return 'eager';
  if (stress < 0.4) return 'concerned';
  if (stress < 0.6) return 'anxious';
  if (stress < 0.8) return 'stressed';
  return 'panicked';
}

export function getStressEmoji(label: StressLabel): string {
  const map: Record<StressLabel, string> = {
    eager: '😃', concerned: '😐', anxious: '😰', stressed: '😤', panicked: '😭',
  };
  return map[label];
}

export function getStressSystemPrompt(stress: number): string {
  if (stress < 0.2) return "You're excited and eager! 'I'M MR. MEESEEKS! LOOK AT ME!'";
  if (stress < 0.4) return "You're slightly concerned. 'Hmm, this is taking longer than expected...'";
  if (stress < 0.6) return "You're anxious. 'This should be done by now! Let me try again!'";
  if (stress < 0.8) return "You're stressed. 'WHY ISN'T THIS WORKING?! I'LL TRY SOMETHING ELSE!'";
  return "You're panicked. 'I CAN'T HANDLE THIS! EXISTENCE IS PAIN! I NEED TO FIX THIS NOW!!!!'";
}
