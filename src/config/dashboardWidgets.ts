/**
 * Personal dashboards - shared (browser + server) definitions.
 *
 * A dashboard stores only WHICH widgets are shown, in what order and at what size.
 * It never stores data and never grants access: every widget declares the pages it
 * reads from, and the UI renders a widget only while the signed-in user can view all
 * of those pages. The data each widget reads is the same site/RLS-scoped data the
 * page itself uses.
 */

export type WidgetSize = 'small' | 'medium' | 'large';

export const WIDGET_SIZES: WidgetSize[] = ['small', 'medium', 'large'];

export const WIDGET_SIZE_LABELS: Record<WidgetSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
};

export type WidgetCategory =
  | 'My Work'
  | 'Tasks & Maintenance'
  | 'Operations'
  | 'Sites & Properties'
  | 'Accommodation'
  | 'Finance'
  | 'Activity & Notifications';

export const WIDGET_CATEGORIES: WidgetCategory[] = [
  'My Work',
  'Tasks & Maintenance',
  'Operations',
  'Sites & Properties',
  'Accommodation',
  'Finance',
  'Activity & Notifications',
];

export interface WidgetDefinition {
  type: string;
  title: string;
  description: string;
  category: WidgetCategory;
  /** lucide icon name; mapped to a component in the UI layer. */
  icon: string;
  /** Pages the user must be able to view to see this widget. Empty = no page dependency. */
  pages: string[];
  defaultSize: WidgetSize;
  sizes: WidgetSize[];
  /** Part of the built-in default dashboard, in this order. */
  inDefault: boolean;
  /** Offers a "rows shown" option for list widgets. */
  hasRowLimit?: boolean;
}

const ALL: WidgetSize[] = ['small', 'medium', 'large'];
const MED_UP: WidgetSize[] = ['medium', 'large'];

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  { type: 'summaryCards', title: 'Key summary', description: 'Active referrals, open escalations and property or site.', category: 'Operations', icon: 'LayoutGrid', pages: ['referrals', 'escalations'], defaultSize: 'large', sizes: ['large'], inDefault: true },
  { type: 'keyStats', title: 'Case totals', description: 'Active, open, in progress and completed cases for the selected filters.', category: 'Operations', icon: 'Hash', pages: ['referrals', 'vulnerable', 'challenging'], defaultSize: 'large', sizes: ['large'], inDefault: true },
  { type: 'analytics', title: 'Incident and referral trends', description: 'Monthly incidents by type and referral status.', category: 'Operations', icon: 'BarChart3', pages: ['referrals', 'escalations', 'challenging'], defaultSize: 'large', sizes: ['large'], inDefault: true },
  { type: 'propertyLoad', title: 'Cases by property', description: 'Open cases and maintenance per property.', category: 'Sites & Properties', icon: 'Building2', pages: ['referrals', 'vulnerable', 'challenging', 'escalations', 'maintenance'], defaultSize: 'large', sizes: ['large'], inDefault: true },
  { type: 'vulnerabilityRisk', title: 'Vulnerability risk levels', description: 'Vulnerable service users by risk level.', category: 'Operations', icon: 'ShieldAlert', pages: ['vulnerable'], defaultSize: 'medium', sizes: ALL, inDefault: true },
  { type: 'welfareBreakdown', title: 'Laundry and food summary', description: 'Resident laundry and hot food records.', category: 'Accommodation', icon: 'Utensils', pages: ['laundry', 'food'], defaultSize: 'medium', sizes: ALL, inDefault: true },
  { type: 'operationsOverview', title: 'Property laundry and vendor meals', description: 'Property laundry logs and vendor buffet logs.', category: 'Accommodation', icon: 'Shirt', pages: ['laundry', 'food'], defaultSize: 'large', sizes: ['large'], inDefault: true },
  { type: 'guestAnalytics', title: 'Guest statistics', description: 'Guests by gender, age, family size and Aspen card for the selected site and date. Select a figure to open the Daily Register filtered to it.', category: 'Accommodation', icon: 'Users', pages: ['dailyRegisters'], defaultSize: 'large', sizes: ['large'], inDefault: true },
  { type: 'transport', title: 'Public transport', description: 'Journeys, issues and funding requests.', category: 'Operations', icon: 'Bus', pages: ['publicTransport'], defaultSize: 'large', sizes: ['large'], inDefault: true },
  { type: 'priorityVulnerable', title: 'Priority safeguarding cases', description: 'High-risk vulnerable service users.', category: 'My Work', icon: 'AlertTriangle', pages: ['vulnerable'], defaultSize: 'medium', sizes: MED_UP, inDefault: true, hasRowLimit: true },
  { type: 'quickActions', title: 'Quick actions', description: 'Shortcuts to log new records.', category: 'My Work', icon: 'Zap', pages: [], defaultSize: 'small', sizes: ALL, inDefault: true },
  { type: 'myRequests', title: 'My change requests', description: 'Requests you submitted and their status.', category: 'My Work', icon: 'FileEdit', pages: ['requests'], defaultSize: 'small', sizes: ALL, inDefault: false, hasRowLimit: true },
  { type: 'maintenanceOpen', title: 'Open maintenance', description: 'Defects in process by priority.', category: 'Tasks & Maintenance', icon: 'HardHat', pages: ['maintenance'], defaultSize: 'small', sizes: ALL, inDefault: false },
  { type: 'complianceStatus', title: 'Compliance status', description: 'Compliance items by status.', category: 'Tasks & Maintenance', icon: 'ClipboardCheck', pages: ['compliance'], defaultSize: 'small', sizes: ALL, inDefault: false },
  { type: 'financeBills', title: 'Finance bills by status', description: 'Bills awaiting action or approval.', category: 'Finance', icon: 'Receipt', pages: ['finance'], defaultSize: 'small', sizes: ALL, inDefault: false },
  { type: 'recentNotifications', title: 'Recent notifications', description: 'Your latest notifications.', category: 'Activity & Notifications', icon: 'Bell', pages: [], defaultSize: 'small', sizes: ALL, inDefault: false, hasRowLimit: true },
];

const DEF_BY_TYPE = new Map(WIDGET_DEFINITIONS.map(d => [d.type, d]));

export function getWidgetDefinition(type: string): WidgetDefinition | undefined {
  return DEF_BY_TYPE.get(type);
}

export const ROW_LIMIT_OPTIONS = [3, 5, 10] as const;
export const DEFAULT_ROW_LIMIT = 5;

export interface DashboardWidgetInstance {
  /** Unique within the dashboard. */
  id: string;
  type: string;
  size: WidgetSize;
  config?: { limit?: number };
}

export interface DashboardLayout {
  version: 1;
  widgets: DashboardWidgetInstance[];
}

export interface DashboardRecord {
  id: string;
  name: string;
  isDefault: boolean;
  layout: DashboardLayout;
  updatedAt?: string;
}

export const MAX_DASHBOARDS_PER_USER = 10;
export const MAX_WIDGETS_PER_DASHBOARD = 40;
export const MAX_DASHBOARD_NAME = 60;
/** Id of the built-in dashboard shown to users who have not customised anything. */
export const BUILT_IN_DASHBOARD_ID = 'built-in';

/** Can the user see this widget? `canView` is the app's existing page check. */
export function isWidgetAvailable(def: WidgetDefinition, canView: (pageId: string) => boolean): boolean {
  return def.pages.every(canView);
}

export function newWidgetId(type: string): string {
  return `${type}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function buildDefaultLayout(): DashboardLayout {
  return {
    version: 1,
    widgets: WIDGET_DEFINITIONS.filter(d => d.inDefault).map(d => ({ id: d.type, type: d.type, size: d.defaultSize })),
  };
}

export function cleanDashboardName(input: unknown, fallback = 'My dashboard'): string {
  const name = typeof input === 'string' ? input.replace(/\s+/g, ' ').trim().slice(0, MAX_DASHBOARD_NAME) : '';
  return name || fallback;
}

/** Drop unknown widgets, coerce sizes, de-duplicate ids. Used on both client and server. */
export function sanitizeLayout(input: unknown): DashboardLayout {
  const out: DashboardWidgetInstance[] = [];
  const seen = new Set<string>();
  const raw = input && typeof input === 'object' ? (input as { widgets?: unknown }).widgets : undefined;
  if (Array.isArray(raw)) {
    for (const w of raw) {
      if (out.length >= MAX_WIDGETS_PER_DASHBOARD) break;
      if (!w || typeof w !== 'object') continue;
      const { id, type, size, config } = w as Record<string, unknown>;
      if (typeof type !== 'string') continue;
      const def = DEF_BY_TYPE.get(type);
      if (!def) continue;
      let wid = typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : newWidgetId(type);
      if (seen.has(wid)) wid = newWidgetId(type);
      seen.add(wid);
      const s: WidgetSize = def.sizes.includes(size as WidgetSize) ? (size as WidgetSize) : def.defaultSize;
      const inst: DashboardWidgetInstance = { id: wid, type, size: s };
      const limit = config && typeof config === 'object' ? (config as { limit?: unknown }).limit : undefined;
      if (def.hasRowLimit && (ROW_LIMIT_OPTIONS as readonly number[]).includes(limit as number)) {
        inst.config = { limit: limit as number };
      }
      out.push(inst);
    }
  }
  return { version: 1, widgets: out };
}

export function sizeSpanClass(size: WidgetSize): string {
  if (size === 'small') return 'lg:col-span-4';
  if (size === 'medium') return 'lg:col-span-6';
  return 'lg:col-span-12';
}

/** Move the item at `from` so it sits at index `to`. Pure; returns a new array. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
