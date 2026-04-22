import { create } from 'zustand';
import type { Meeseeks, Message } from '../types';
import { listSession } from '../services/meeseeks.api';
import { apiGet } from '../services/api';

export interface RaceInfo {
  parentId: string;
  competitors: string[];
  task: string;
  winnerId?: string;
  loserId?: string;
  finished: boolean;
  scores?: Record<string, number>;
  judgeReason?: string;
}

interface HiveState {
  meeseeks: Map<string, Meeseeks>;
  selectedId: string | null;
  isConnected: boolean;
  messages: Map<string, Message[]>;
  races: Map<string, RaceInfo>;
  memoryInjected: Set<string>;
  memoryChain: Map<string, string>;  // meeseeksId → sourceId
  memoryNonces: Map<string, { nonce: number; ancestry: string[] }>; // meeseeksId → {nonce, full chain}

  setMeeseeks: (m: Meeseeks) => void;
  updateMeeseeks: (id: string, patch: Partial<Meeseeks>) => void;
  removeMeeseeks: (id: string) => void;
  setSelected: (id: string | null) => void;
  setConnected: (connected: boolean) => void;
  addMessage: (meeseeksId: string, message: Message) => void;
  setMessages: (meeseeksId: string, msgs: Message[]) => void;
  addRace: (race: RaceInfo) => void;
  finishRace: (parentId: string, winnerId: string, loserId: string, scores?: Record<string, number>, judgeReason?: string) => void;
  markMemoryInjected: (id: string) => void;
  setMemoryChain: (id: string, sourceId: string) => void;
  triggerGhost: (id: string, ancestry: string[]) => void;
  loadInitialState: () => Promise<void>;
  loadSnapshot: (data: Meeseeks[]) => void;
}

export const useHiveStore = create<HiveState>((set) => ({
  meeseeks: new Map(),
  selectedId: null,
  isConnected: false,
  messages: new Map(),
  races: new Map(),
  memoryInjected: new Set(),
  memoryChain: new Map(),
  memoryNonces: new Map(),

  setMeeseeks: (m) =>
    set((state) => {
      const next = new Map(state.meeseeks);
      next.set(m.id, m);
      return { meeseeks: next };
    }),

  updateMeeseeks: (id, patch) =>
    set((state) => {
      const existing = state.meeseeks.get(id);
      if (!existing) return state;
      const next = new Map(state.meeseeks);
      next.set(id, { ...existing, ...patch });
      return { meeseeks: next };
    }),

  removeMeeseeks: (id) =>
    set((state) => {
      const next = new Map(state.meeseeks);
      next.delete(id);
      return { meeseeks: next };
    }),

  setSelected: (id) => set({ selectedId: id }),
  setConnected: (connected) => set({ isConnected: connected }),

  addMessage: (meeseeksId, message) =>
    set((state) => {
      const next = new Map(state.messages);
      const existing = next.get(meeseeksId) ?? [];
      if (existing.some((m) => m.id === message.id)) return state;
      next.set(meeseeksId, [...existing, message]);
      return { messages: next };
    }),

  setMessages: (meeseeksId, msgs) =>
    set((state) => {
      const next = new Map(state.messages);
      const seen = new Set<string>();
      const deduped = msgs.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      next.set(meeseeksId, deduped);
      return { messages: next };
    }),

  addRace: (race) =>
    set((state) => {
      const next = new Map(state.races);
      next.set(race.parentId, race);
      return { races: next };
    }),

  finishRace: (parentId, winnerId, loserId, scores, judgeReason) =>
    set((state) => {
      const next = new Map(state.races);
      const existing = next.get(parentId);
      if (existing) {
        next.set(parentId, { ...existing, winnerId, loserId, finished: true, scores, judgeReason });
      }
      return { races: next };
    }),

  markMemoryInjected: (id) =>
    set((state) => {
      const next = new Set(state.memoryInjected);
      next.add(id);
      return { memoryInjected: next };
    }),

  setMemoryChain: (id, sourceId) =>
    set((state) => {
      const next = new Map(state.memoryChain);
      next.set(id, sourceId);
      return { memoryChain: next };
    }),

  triggerGhost: (id, ancestry) =>
    set((state) => {
      const next = new Map(state.memoryNonces);
      next.set(id, { nonce: Date.now(), ancestry });
      return { memoryNonces: next };
    }),

  loadInitialState: async () => {
    try {
      // Fetch backend session start time so we only load meeseeks from this backend session
      const { startedAt } = await apiGet<{ startedAt: string }>('/session');
      const { data } = await listSession(startedAt);
      const meeseeksMap = new Map<string, Meeseeks>();
      for (const m of data) {
        meeseeksMap.set(m.id, m);
      }
      set({ meeseeks: meeseeksMap, messages: new Map() });
    } catch (err) {
      console.error('Failed to load initial state:', err);
    }
  },

  loadSnapshot: (data) => {
    const meeseeksMap = new Map<string, Meeseeks>();
    for (const m of data) {
      meeseeksMap.set(m.id, m);
    }
    set({ meeseeks: meeseeksMap });
  },
}));
