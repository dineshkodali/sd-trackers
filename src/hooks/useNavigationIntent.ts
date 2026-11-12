import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { isIntentFresh, type NavigationIntent } from '../utils/navigationIntent';

/**
 * Lets a page react once to a link that opened it with filters or a record id
 * (see navigateWithIntent in AppContext). The handler runs at most once per intent, only on the page the
 * intent names, and never for a stale one. Pages that do not call this are unaffected.
 */
export function useNavigationIntent(page: string, onIntent: (intent: NavigationIntent) => void) {
  const { pendingIntent, consumeIntent } = useApp();
  const handler = useRef(onIntent);
  handler.current = onIntent;

  useEffect(() => {
    if (!pendingIntent || pendingIntent.page !== page) return;
    const fresh = isIntentFresh(pendingIntent, page, Date.now());
    consumeIntent(pendingIntent.id);
    if (fresh) handler.current(pendingIntent);
  }, [pendingIntent, page, consumeIntent]);
}
