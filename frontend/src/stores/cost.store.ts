import { create } from 'zustand';
import type { CostSummary } from '../types';
import { getGlobalCosts } from '../services/meeseeks.api';

interface CostState {
  global: CostSummary;
  session: CostSummary;
  sessionStart: CostSummary;
  updateGlobal: (cost: CostSummary) => void;
  resetSession: () => void;
  loadGlobalCost: () => Promise<void>;
}

const emptyCost: CostSummary = {
  total_tokens: 0,
  total_input_tokens: 0,
  total_output_tokens: 0,
  total_cost: 0,
  entries_count: 0,
};

export const useCostStore = create<CostState>((set, get) => ({
  global: emptyCost,
  session: emptyCost,
  sessionStart: emptyCost,

  updateGlobal: (cost) => {
    const start = get().sessionStart;
    set({
      global: cost,
      session: {
        total_tokens: cost.total_tokens - start.total_tokens,
        total_input_tokens: cost.total_input_tokens - start.total_input_tokens,
        total_output_tokens: cost.total_output_tokens - start.total_output_tokens,
        total_cost: cost.total_cost - start.total_cost,
        entries_count: cost.entries_count - start.entries_count,
      },
    });
  },

  resetSession: () => {
    const current = get().global;
    set({ sessionStart: current, session: emptyCost });
  },

  loadGlobalCost: async () => {
    try {
      const cost = await getGlobalCosts();
      const start = get().sessionStart;
      set({
        global: cost,
        session: {
          total_tokens: cost.total_tokens - start.total_tokens,
          total_input_tokens: cost.total_input_tokens - start.total_input_tokens,
          total_output_tokens: cost.total_output_tokens - start.total_output_tokens,
          total_cost: cost.total_cost - start.total_cost,
          entries_count: cost.entries_count - start.entries_count,
        },
      });
    } catch {
      // ignore
    }
  },
}));
