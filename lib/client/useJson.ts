"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type JsonState<T> = { data: T | null; error: string | null; loading: boolean; retry: () => void };

/** Fetch JSON with honest loading/error states and a retry. `url = null` skips. */
export function useJson<T>(url: string | null): JsonState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(url));
  const [n, setN] = useState(0);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true);
    setError(null);
    fetch(url, { signal: c.signal })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
        return body as T;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof Error ? e.message : String(e));
        setData(null);
        setLoading(false);
      });
    return () => c.abort();
  }, [url, n]);

  const retry = useCallback(() => setN((x) => x + 1), []);
  return { data, error, loading, retry };
}

/** try/catch-guarded localStorage. */
export const store = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, v: string) {
    try {
      window.localStorage.setItem(key, v);
    } catch {
      /* private mode / blocked storage: feature degrades silently */
    }
  },
  del(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
