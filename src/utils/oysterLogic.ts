/**
 * Oyster card rules shared by the screens and the tests (the database and /api/oyster enforce the same rules).
 *
 * Cards belong to a property. A card is Available until it is issued to one Service User; the loan (transaction) records the
 * balance at handover and, on return, the balance actually found on the card. Balances are typed in by staff: nothing here
 * checks them with Transport for London, and a difference between two balances is not assumed to be spending.
 */

export const OYSTER_CARD_STATUSES = ['Available', 'Issued', 'Lost', 'Damaged', 'Deactivated'] as const;
export const OYSTER_CONDITIONS = ['Good', 'Damaged', 'Lost'] as const;

/** Statuses staff may set by hand on a card that is not on loan. Issued and returned states come only from the actions. */
export const OYSTER_MANUAL_STATUSES = ['Available', 'Lost', 'Damaged', 'Deactivated'] as const;

/** A funding request whose transport method is an Oyster card (the card comes from the property's stock). */
export const isOysterMethod = (m?: string | null) => (m || '').toLowerCase().startsWith('oyster');

const same = (a?: string | null, b?: string | null) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

/** Cards that can be issued from a property: available, and held by that property. */
export function availableCardsFor<T extends { status: string; siteName?: string | null }>(cards: T[], siteName?: string | null): T[] {
  if (!siteName) return [];
  return cards.filter(c => c.status === 'Available' && same(c.siteName, siteName));
}

export interface UsageTxn {
  status: string;
  balanceAtIssue?: number | null;
  balanceAtReturn?: number | null;
  returnCondition?: string | null;
  balanceAdjusted?: boolean | null;
}

export interface OysterUsage { calculable: boolean; amount?: number; reason?: string }

/**
 * The balance difference between handover and return, only when it can be relied on. It is a difference in recorded balances,
 * not confirmed spending: it is withheld whenever the card was topped up or corrected while out, came back damaged, was lost,
 * is still out, or shows a higher balance than it left with.
 */
export function oysterUsage(t: UsageTxn): OysterUsage {
  if (t.status === 'Issued') return { calculable: false, reason: 'Card is still out' };
  if (t.status === 'Lost' || t.returnCondition === 'Lost') return { calculable: false, reason: 'Card was lost, so no return balance exists' };
  const issue = t.balanceAtIssue;
  const back = t.balanceAtReturn;
  if (issue === null || issue === undefined || back === null || back === undefined) return { calculable: false, reason: 'A balance was not recorded' };
  if (t.balanceAdjusted) return { calculable: false, reason: 'The balance was changed while the card was out (for example a top-up)' };
  if (t.returnCondition === 'Damaged') return { calculable: false, reason: 'The card came back damaged, so its balance may not be reliable' };
  if (back > issue) return { calculable: false, reason: 'The return balance is higher than the handover balance' };
  return { calculable: true, amount: Math.round((issue - back) * 100) / 100 };
}

export const formatMoney = (v?: number | null) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : `£${Number(v).toFixed(2)}`);

export function validateRegisterCard(input: { cardRef?: string; siteName?: string; balance?: number | string }): string | null {
  if (!(input.cardRef || '').trim()) return 'Enter the card reference number.';
  if (!(input.siteName || '').trim()) return 'Choose the property that holds this card.';
  if (input.balance === undefined || input.balance === '' || !(Number(input.balance) >= 0)) return 'Enter the current balance on the card (zero or more).';
  return null;
}

export function validateIssue(input: { cardId?: string; suId?: string; balance?: number | string; issuedDate?: string }, today: string): string | null {
  if (!input.cardId) return 'Choose an available card.';
  if (!input.suId) return 'Choose the Service User.';
  if (input.balance === undefined || input.balance === '' || !(Number(input.balance) >= 0)) return 'Enter the balance on the card at handover.';
  if (input.issuedDate && input.issuedDate > today) return 'The issue date cannot be in the future.';
  return null;
}

export function validateReturn(input: { condition?: string; balance?: number | string; notes?: string; returnedDate?: string }, issuedDate: string | undefined, today: string): string | null {
  if (!input.condition || !(OYSTER_CONDITIONS as readonly string[]).includes(input.condition)) return 'Choose the condition of the card.';
  if (input.condition !== 'Lost' && (input.balance === undefined || input.balance === '' || !(Number(input.balance) >= 0))) return 'Enter the actual remaining balance on the card.';
  if (input.condition !== 'Good' && !(input.notes || '').trim()) return 'Add a note describing the damage or loss.';
  if (input.returnedDate && input.returnedDate > today) return 'The return date cannot be in the future.';
  if (input.returnedDate && issuedDate && input.returnedDate < issuedDate) return 'The return date cannot be before the issue date.';
  return null;
}

export interface TxnFilter { site?: string; query?: string; from?: string; to?: string; status?: string }

/** Search / filter loans by property, Service User name or reference, card reference, and issue date range. */
export function filterOysterTransactions<T extends { siteName: string; cardRef: string; issuedDate: string; status: string; suId: string }>(
  txns: T[], f: TxnFilter, suText: (suId: string) => string
): T[] {
  const q = (f.query || '').trim().toLowerCase();
  return txns.filter(t => {
    if (f.site && f.site !== 'all' && !same(t.siteName, f.site)) return false;
    if (f.status && f.status !== 'all' && t.status !== f.status) return false;
    if (f.from && t.issuedDate < f.from) return false;
    if (f.to && t.issuedDate > f.to) return false;
    if (q && !`${t.cardRef} ${suText(t.suId)}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Totals for a filtered list: only reliable differences are added up, and the rest are counted, never guessed. */
export function summariseUsage(txns: UsageTxn[]) {
  let total = 0, reliable = 0, notCalculable = 0, open = 0;
  for (const t of txns) {
    if (t.status === 'Issued') { open += 1; continue; }
    const u = oysterUsage(t);
    if (u.calculable) { total += u.amount || 0; reliable += 1; } else notCalculable += 1;
  }
  return { balanceDifferenceTotal: Math.round(total * 100) / 100, reliable, notCalculable, open };
}
