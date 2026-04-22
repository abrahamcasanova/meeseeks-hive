import { useState, useCallback } from 'react';

interface StreamState {
  isStreaming: boolean;
  streamedText: string;
  error: string | null;
}

export function useStreamMessage() {
  const [state, setState] = useState<StreamState>({
    isStreaming: false,
    streamedText: '',
    error: null,
  });

  const sendMessage = useCallback(async (meeseeksId: string, content: string) => {
    setState({ isStreaming: true, streamedText: '', error: null });

    try {
      const res = await fetch(`/api/v1/meeseeks/${meeseeksId}/message/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6);
          try {
            const parsed = JSON.parse(json) as { type: string; text?: string };
            if (parsed.type === 'text' && parsed.text) {
              accumulated += parsed.text;
              setState((prev) => ({ ...prev, streamedText: accumulated }));
            }
          } catch {
            // skip malformed
          }
        }
      }

      setState((prev) => ({ ...prev, isStreaming: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: err instanceof Error ? err.message : 'Stream failed',
      }));
    }
  }, []);

  return { ...state, sendMessage };
}
