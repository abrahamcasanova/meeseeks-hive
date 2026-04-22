import { useState, useEffect } from 'react';
import { getForensicsReport } from '../services/forensics.api';
import type { ForensicsReport } from '../types/forensics';

const cache = new Map<string, ForensicsReport>();

export function useForensics(meeseeksId: string | null) {
  const [report, setReport] = useState<ForensicsReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meeseeksId) {
      setReport(null);
      return;
    }

    const cached = cache.get(meeseeksId);
    if (cached) {
      setReport(cached);
      return;
    }

    setIsLoading(true);
    setError(null);

    getForensicsReport(meeseeksId)
      .then((data) => {
        cache.set(meeseeksId, data);
        setReport(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load forensics'))
      .finally(() => setIsLoading(false));
  }, [meeseeksId]);

  return { report, isLoading, error };
}
