import { authHeaders, getApiUrl, getApiBaseUrl, isDirectSupabaseActive, enableDirectSupabaseFallback } from './apiService';
import { runDirectWorkflow, type WorkflowResult } from '../lib/directWorkflows';

/**
 * Calls one of the workflow endpoints (/api/su, /api/oyster, /api/transport-funding).
 *
 * With an Express backend it goes there. On static hosting with no backend (the /api path answers with a web page, or
 * cannot be reached) the same action runs straight against the database through the same database function, so the
 * transaction, locks and history are identical. See src/lib/directWorkflows.ts.
 */
export type { WorkflowResult };

export async function callWorkflow(path: string, body?: unknown, method: 'GET' | 'POST' | 'DELETE' = 'POST'): Promise<WorkflowResult> {
  const direct = async (reason: string): Promise<WorkflowResult> => {
    const result = await runDirectWorkflow(method, path, body);
    if (result) { enableDirectSupabaseFallback(); return result; }
    return { ok: false, status: 0, json: { error: reason } };
  };

  if (isDirectSupabaseActive() && !getApiBaseUrl()) return direct('The database is not reachable.');

  try {
    const res = await fetch(getApiUrl(path), {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined
    });
    if (!(res.headers.get('content-type') || '').includes('application/json')) {
      return direct(`The server did not answer (HTTP ${res.status}).`);
    }
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && json?.success !== false, status: res.status, json };
  } catch (err: any) {
    return direct(`Network error: ${err.message}`);
  }
}
