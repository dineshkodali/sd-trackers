import React, { useEffect } from 'react';
import { ServiceUserPicker, ServiceUserNotice } from './ServiceUserPicker';
import { useServiceUserSelection } from '../../hooks/useServiceUserSelection';
import type { FieldMap } from '../../utils/serviceUserProfile';

interface Props {
  /** The stored Service User id of the form */
  value?: string;
  /** form field -> profile field (or a function), for everything the profile should fill */
  fieldMap: FieldMap;
  getForm: () => Record<string, unknown>;
  apply: (changes: Record<string, unknown>) => void;
  /** Changes when the form is opened for a different record, so "typed by hand" memory starts fresh */
  resetKey?: unknown;
  /** Name of the form field holding the id (default "suId") */
  idField?: string;
  siteId?: string;
  required?: boolean;
  disabled?: boolean;
  hasError?: boolean;
  legacyText?: string;
  /** Heading above the picker; null hides it */
  title?: string | null;
}

/**
 * The standard "pick a Service User" block of a form: the shared picker, the shared autofill and the shared notice
 * (what the profile lacked, what was left alone because it was typed). Forms supply only the field map.
 */
export const ServiceUserSection: React.FC<Props> = ({
  value, fieldMap, getForm, apply, resetKey, idField, siteId, required, disabled, hasError, legacyText, title = 'Service User'
}) => {
  const selection = useServiceUserSelection({ fieldMap, getForm, apply, idField });
  useEffect(() => { selection.reset(); }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-3 bg-white border border-teal-100 rounded-xs shadow-2xs space-y-1.5">
      {title && <div className="text-[11px] font-semibold text-teal-800 uppercase tracking-wider">{title}{required ? ' *' : ''}</div>}
      <ServiceUserPicker
        value={value}
        legacyText={legacyText}
        onChange={selection.select}
        siteId={siteId}
        required={required}
        disabled={disabled}
        hasError={hasError}
      />
      <ServiceUserNotice profile={selection.profile} skipped={selection.skippedFields} onRefill={selection.refillSkipped} />
    </div>
  );
};
