import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// TEST ONLY: exercise media (c) Gym visual, stored in the private Supabase bucket `exercise-media`.
// It is not licensed for distribution. Remove or replace it before any public release.
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

export function mediaUrl(kind: 'gif' | 'thumb', catalogId: string): Promise<string | null> {
  const path = `${kind}/${catalogId}.${kind === 'gif' ? 'gif' : 'jpg'}`;
  const hit = cache.get(path);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(path);
  if (pending) return pending;
  const p = supabase.storage
    .from('exercise-media')
    .createSignedUrl(path, 60 * 60 * 24)
    .then(({ data }) => {
      inflight.delete(path);
      if (data?.signedUrl) cache.set(path, data.signedUrl);
      return data?.signedUrl ?? null;
    })
    .catch(() => { inflight.delete(path); return null; });
  inflight.set(path, p);
  return p;
}

export function useMedia(kind: 'gif' | 'thumb', catalogId?: string | null): string | null {
  const [state, setState] = useState<{ key: string; url: string | null }>({ key: '', url: null });
  const key = catalogId ? `${kind}:${catalogId}` : '';
  useEffect(() => {
    if (!catalogId) return;
    let alive = true;
    mediaUrl(kind, catalogId).then((url) => { if (alive) setState({ key, url }); });
    return () => { alive = false; };
  }, [kind, catalogId, key]);
  return state.key === key ? state.url : null;
}
