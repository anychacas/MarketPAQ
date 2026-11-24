import { useEffect } from 'react';

/** Marks the current page as noindex, nofollow for search engines. */
export function useNoIndex() {
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    const prev = meta.content;
    meta.content = 'noindex, nofollow';
    return () => {
      meta.content = prev;
    };
  }, []);
}
