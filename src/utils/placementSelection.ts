import type { Placement } from '../types/masterData';

const stamp = (p: Placement) => Date.parse(p.startDate || '') || Date.parse(p.createdAt || '') || 0;

/**
 * A resident can end up with more than one Active placement (an interrupted move, a repeated save).
 * Every screen must agree on which one counts, so they all use this: the most recently started,
 * then the most recently updated.
 */
export function isNewerPlacement(a: Placement, b: Placement): boolean {
  const sa = stamp(a);
  const sb = stamp(b);
  if (sa !== sb) return sa > sb;
  return (a.updatedAt || a.createdAt || '') > (b.updatedAt || b.createdAt || '');
}

export function pickActivePlacement(placements: Placement[]): Placement | null {
  let best: Placement | null = null;
  for (const p of placements) {
    if (p.status !== 'Active') continue;
    if (!best || isNewerPlacement(p, best)) best = p;
  }
  return best;
}

/** One current placement per resident. */
export function activePlacementBySu(placements: Placement[]): Map<string, Placement> {
  const map = new Map<string, Placement>();
  for (const p of placements) {
    if (p.status !== 'Active') continue;
    const prev = map.get(p.suId);
    if (!prev || isNewerPlacement(p, prev)) map.set(p.suId, p);
  }
  return map;
}

/** Active placements that are superseded by a newer Active placement of the same resident. */
export function supersededActivePlacements(placements: Placement[]): Placement[] {
  const current = activePlacementBySu(placements);
  return placements.filter(p => p.status === 'Active' && current.get(p.suId)?.id !== p.id);
}
