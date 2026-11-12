import { useCallback, useRef, useState } from 'react';
import { computeAutofill, type FieldMap, type ServiceUserProfile } from '../utils/serviceUserProfile';

/**
 * Shared autofill behaviour for any form that picks a Service User.
 *
 *   const sel = useServiceUserSelection({ fieldMap, getForm: () => formData, apply: changes => setFormData(p => ({ ...p, ...changes })) });
 *   <ServiceUserPicker value={formData.suId} onChange={sel.select} />
 *   <input onChange={e => { sel.touch('phone'); ... }} />     // a hand-typed field is never overwritten
 *
 * `select(profile)` sets the person (id first) and fills mapped fields; `select(null)` clears the person and the fields
 * that were filled automatically. Call `reset()` when the form is opened fresh.
 */
export interface UseServiceUserSelectionOptions {
  fieldMap: FieldMap;
  getForm: () => Record<string, unknown>;
  /** Receives the fields to set, including `suId` */
  apply: (changes: Record<string, unknown>) => void;
  /** Name of the form field that holds the person's id (default "suId") */
  idField?: string;
}

export function useServiceUserSelection({ fieldMap, getForm, apply, idField = 'suId' }: UseServiceUserSelectionOptions) {
  const touched = useRef(new Set<string>());
  const autofilled = useRef(new Set<string>());
  const [lastProfile, setLastProfile] = useState<ServiceUserProfile | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);

  const select = useCallback((profile: ServiceUserProfile | null) => {
    setLastProfile(profile);
    if (!profile) {
      const clear: Record<string, unknown> = { [idField]: '' };
      for (const field of autofilled.current) clear[field] = '';
      autofilled.current.clear();
      setSkipped([]);
      apply(clear);
      return;
    }
    const { changes, skipped: left } = computeAutofill(profile, fieldMap, { touched: touched.current, autofilled: autofilled.current }, getForm());
    for (const field of Object.keys(changes)) autofilled.current.add(field);
    setSkipped(left);
    apply({ [idField]: profile.suId, ...changes });
  }, [fieldMap, getForm, apply, idField]);

  /** Mark a field as typed by the user so a later selection leaves it alone. */
  const touch = useCallback((field: string) => {
    touched.current.add(field);
    autofilled.current.delete(field);
  }, []);

  const reset = useCallback(() => {
    touched.current.clear();
    autofilled.current.clear();
    setLastProfile(null);
    setSkipped([]);
  }, []);

  /** Overwrite the fields that were skipped because the user had typed in them (the "update from profile" button). */
  const refillSkipped = useCallback(() => {
    if (!lastProfile) return;
    for (const f of skipped) touched.current.delete(f);
    const { changes } = computeAutofill(lastProfile, fieldMap, { touched: touched.current, autofilled: new Set(Object.keys(fieldMap)) }, getForm());
    for (const field of Object.keys(changes)) autofilled.current.add(field);
    setSkipped([]);
    apply(changes);
  }, [lastProfile, skipped, fieldMap, getForm, apply]);

  return { select, touch, reset, refillSkipped, profile: lastProfile, skippedFields: skipped };
}
