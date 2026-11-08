import { useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import { lifecycleService } from '../services/lifecycleService';
import { LIFECYCLE_ENTITY_LABEL, type LifecycleAction, type LifecycleEntity } from '../config/recordLifecycle';
import type { LifecycleRequest } from '../components/common/LifecycleDialog';

export interface LifecycleNotice {
  type: 'success' | 'error';
  text: string;
}

const PAST: Record<LifecycleAction, string> = { archive: 'archived', delete: 'deleted', restore: 'restored' };

/**
 * Archive / restore flow for one page (Users or Properties): holds the open dialog, runs the
 * action through the API (which re-checks everything), refreshes the active lists, and reports
 * the outcome. `reloadKey` changes after every successful action so the Archived / Deleted
 * lists reload.
 */
export function useLifecycleActions(entity: LifecycleEntity) {
  const { syncFromDatabase } = useApp();
  const [request, setRequest] = useState<LifecycleRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<LifecycleNotice | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const ask = useCallback((action: LifecycleAction, record: { id: string; label: string }) => {
    setError(null);
    setNotice(null);
    setRequest({ entity, action, id: record.id, label: record.label });
  }, [entity]);

  const close = useCallback(() => { if (!busy) { setRequest(null); setError(null); } }, [busy]);

  const confirm = useCallback(async (reason: string) => {
    if (!request) return;
    setBusy(true);
    setError(null);
    try {
      await lifecycleService.apply(entity, request.id, request.action, reason);
      setRequest(null);
      setNotice({ type: 'success', text: `${LIFECYCLE_ENTITY_LABEL[entity]} ${request.label} ${PAST[request.action]}.` });
      setReloadKey(k => k + 1);
      try { await syncFromDatabase(); } catch { /* the list refreshes on the next sync */ }
    } catch (e: any) {
      setError(e?.message || 'The action could not be completed.');
    } finally {
      setBusy(false);
    }
  }, [request, entity, syncFromDatabase]);

  return { request, busy, error, notice, setNotice, reloadKey, ask, close, confirm };
}
