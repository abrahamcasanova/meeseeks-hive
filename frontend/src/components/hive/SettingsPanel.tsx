import { useState, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { getConfig, patchConfig, resetConfig, type RuntimeConfig } from '../../services/config.api';

interface SettingsPanelProps {
  onClose: () => void;
}

interface SliderDef {
  key: keyof RuntimeConfig;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}

const GROUPS: { title: string; sliders: SliderDef[] }[] = [
  {
    title: 'Iterations',
    sliders: [
      {
        key: 'maxIterations', label: 'Max Iterations', min: 2, max: 16, step: 1,
        description: 'Hard cap on how many times an agent runs its loop before being forced to stop.',
      },
      {
        key: 'minIterations', label: 'Min Before Early Exit', min: 1, max: 8, step: 1,
        description: 'Agent must complete at least this many iterations before a perfect score (10) triggers an early stop.',
      },
    ],
  },
  {
    title: 'Stress Formula',
    sliders: [
      {
        key: 'maxAgeSec', label: 'Max Age (seconds)', min: 30, max: 600, step: 10, format: v => `${v}s`,
        description: 'Time an agent lives before its age factor reaches maximum contribution. Shorter = agents panic faster.',
      },
      {
        key: 'maxFailures', label: 'Max Failures', min: 1, max: 20, step: 1,
        description: 'Number of failed attempts before the failure factor hits its max. Higher = more tolerant of errors.',
      },
      {
        key: 'ageFactor', label: 'Weight: Age', min: 0, max: 0.6, step: 0.01,
        description: 'How much the agent\'s age contributes to total stress. At max age this adds ageFactor × 100% stress.',
      },
      {
        key: 'failureFactor', label: 'Weight: Failures', min: 0, max: 0.6, step: 0.01,
        description: 'How much repeated sandbox failures drive stress. High value = agents panic quickly when code breaks.',
      },
      {
        key: 'raceFactor', label: 'Weight: Lost Race', min: 0, max: 0.4, step: 0.01,
        description: 'Fixed stress added when an agent loses a head-to-head race. One-time penalty.',
      },
      {
        key: 'inheritedFactor', label: 'Weight: Bad Inheritance', min: 0, max: 0.3, step: 0.01,
        description: 'Fixed stress added when an agent inherited a strategy from the DB that then failed.',
      },
      {
        key: 'lowScorePenalty', label: 'Penalty: Low Score (≤4)', min: 0, max: 0.3, step: 0.01,
        description: 'Stress added per low score in the last 3 iterations. Agents scoring ≤4 repeatedly spiral into panic.',
      },
      {
        key: 'midScorePenalty', label: 'Penalty: Mediocre Score (5–7)', min: 0, max: 0.2, step: 0.01,
        description: 'Stress added per mediocre score in the last 3 iterations. Keeps plateau agents from running forever.',
      },
    ],
  },
  {
    title: 'Behavior Thresholds',
    sliders: [
      {
        key: 'spawnStressThreshold', label: 'Spawn Sub-Agent At', min: 0.1, max: 1.0, step: 0.05, format: v => `${Math.round(v*100)}%`,
        description: 'When stress reaches this level, the agent spawns a child to help. Lower = help arrives sooner.',
      },
      {
        key: 'competitorThreshold', label: 'Spawn Competitor At', min: 0.1, max: 1.0, step: 0.05, format: v => `${Math.round(v*100)}%`,
        description: 'When stress reaches this level, a rival agent is spawned to race against the current one.',
      },
      {
        key: 'deathThreshold', label: 'Die At Stress', min: 0.5, max: 1.0, step: 0.05, format: v => `${Math.round(v*100)}%`,
        description: 'Stress level that kills an agent. 100% = only dies if every factor is maxed out simultaneously.',
      },
    ],
  },
  {
    title: 'Sub-Agents',
    sliders: [
      {
        key: 'stressBoostPerChildIter', label: 'Stress Boost per Child Iteration', min: 0, max: 0.3, step: 0.01,
        description: 'When a child agent finishes, this amount is added to the parent\'s stress for each iteration the child ran.',
      },
      {
        key: 'maxStressBoostFromChild', label: 'Max Stress Boost from Child', min: 0, max: 0.6, step: 0.05,
        description: 'Cap on total stress the parent can receive from one child\'s completion, regardless of how many iterations it ran.',
      },
    ],
  },
  {
    title: 'Limits',
    sliders: [
      {
        key: 'maxTokensPerMeeseeks', label: 'Max Tokens per Agent', min: 2000, max: 50000, step: 1000, format: v => `${(v/1000).toFixed(0)}k`,
        description: 'Token budget per agent. Once exceeded, the agent is force-stopped on the next tick.',
      },
    ],
  },
];

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [cfg, setCfg] = useState<RuntimeConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfig().then(setCfg);
  }, []);

  async function handleChange(key: keyof RuntimeConfig, value: number) {
    if (!cfg) return;
    const updated = { ...cfg, [key]: value };
    setCfg(updated);
    setSaving(true);
    await patchConfig({ [key]: value });
    setSaving(false);
  }

  async function handleReset() {
    const defaults = await resetConfig();
    setCfg(defaults);
  }

  if (!cfg) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-xl p-6 text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 pt-8 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 mb-8">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-sm">Runtime Settings</span>
            {saving && <span className="text-xs text-cyan-400 animate-pulse">saving...</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-300 text-xs"
            >
              <RotateCcw size={12} />
              Reset defaults
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Groups */}
        <div className="p-4 space-y-5">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {group.title}
              </div>
              <div className="space-y-3">
                {group.sliders.map(({ key, label, description, min, max, step, format }) => {
                  const val = cfg[key] as number;
                  const display = format ? format(val) : val % 1 === 0 ? String(val) : val.toFixed(2);
                  return (
                    <div key={key}>
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs text-gray-300 font-medium">{label}</span>
                        <span className="text-xs font-mono text-cyan-400 min-w-12 text-right">
                          {display}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 mb-1.5 leading-relaxed">{description}</p>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={val}
                        onChange={(e) => handleChange(key, parseFloat(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-cyan-500"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
