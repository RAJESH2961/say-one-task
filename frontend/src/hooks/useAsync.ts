import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { toApiError, type ApiError } from "@/lib/api";

export interface AsyncState<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

/** Minimal data-fetching hook: tracks loading/error, ignores stale responses, exposes reload(). */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList = []): AsyncState<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const callId = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    const id = ++callId.current;
    setLoading(true);
    try {
      const result = await fnRef.current();
      if (id === callId.current) {
        setDataState(result);
        setError(null);
      }
    } catch (err) {
      if (id === callId.current) setError(toApiError(err));
    } finally {
      if (id === callId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void run();
  }, [run]);

  const setData = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) => (typeof updater === "function" ? (updater as (p: T | undefined) => T)(prev) : updater));
  }, []);

  return { data, error, loading, reload: run, setData };
}
