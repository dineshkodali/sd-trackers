import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APP_PAGES_REGISTRY } from '../src/config/pageRegistry';
import {
  WIDGET_DEFINITIONS, WIDGET_CATEGORIES, buildDefaultLayout, getWidgetDefinition, isWidgetAvailable,
  moveItem, sanitizeLayout, cleanDashboardName, MAX_WIDGETS_PER_DASHBOARD,
} from '../src/config/dashboardWidgets';

const pageIds = new Set(APP_PAGES_REGISTRY.map(p => p.id));

test('every widget has a unique type, a known category and only real pages', () => {
  const types = new Set<string>();
  for (const d of WIDGET_DEFINITIONS) {
    assert.ok(!types.has(d.type), `duplicate ${d.type}`);
    types.add(d.type);
    assert.ok(WIDGET_CATEGORIES.includes(d.category), `${d.type} category`);
    assert.ok(d.sizes.includes(d.defaultSize), `${d.type} default size`);
    for (const p of d.pages) assert.ok(pageIds.has(p), `${d.type} references unknown page ${p}`);
  }
});

test('no widget exposes administration or user-management pages', () => {
  const adminPages = new Set(['users', 'roles', 'setupOptions', 'notifications', 'pageAccess', 'settings', 'pageMaintenance', 'audit']);
  for (const d of WIDGET_DEFINITIONS) for (const p of d.pages) assert.ok(!adminPages.has(p), `${d.type} -> ${p}`);
});

test('a widget is available only when every page it reads is viewable', () => {
  const finance = getWidgetDefinition('financeBills')!;
  assert.equal(isWidgetAvailable(finance, () => false), false);
  assert.equal(isWidgetAvailable(finance, p => p === 'finance'), true);
  const multi = getWidgetDefinition('analytics')!;
  assert.equal(isWidgetAvailable(multi, p => p === 'referrals'), false);
  assert.equal(isWidgetAvailable(multi, () => true), true);
  assert.equal(isWidgetAvailable(getWidgetDefinition('recentNotifications')!, () => false), true);
});

test('default layout is made of known widgets at valid sizes', () => {
  const layout = buildDefaultLayout();
  assert.ok(layout.widgets.length > 0);
  assert.deepEqual(sanitizeLayout(layout), layout);
});

test('sanitizeLayout drops unknown widgets, fixes sizes and de-duplicates ids', () => {
  const out = sanitizeLayout({
    widgets: [
      { id: 'a', type: 'keyStats', size: 'small' },          // size not allowed -> default
      { id: 'a', type: 'maintenanceOpen', size: 'medium' },  // duplicate id
      { id: 'b', type: 'not-a-widget', size: 'large' },      // unknown
      { id: 'c', type: 'myRequests', size: 'small', config: { limit: 99 } }, // invalid limit
      { id: 'd', type: 'recentNotifications', size: 'large', config: { limit: 10 } },
      'junk', null,
    ],
  });
  assert.equal(out.widgets.length, 4);
  assert.equal(out.widgets[0].size, 'large');
  assert.notEqual(out.widgets[0].id, out.widgets[1].id);
  assert.equal(out.widgets[2].config, undefined);
  assert.deepEqual(out.widgets[3].config, { limit: 10 });
});

test('sanitizeLayout tolerates garbage and caps the widget count', () => {
  assert.deepEqual(sanitizeLayout(null), { version: 1, widgets: [] });
  assert.deepEqual(sanitizeLayout('x'), { version: 1, widgets: [] });
  const many = { widgets: Array.from({ length: 200 }, (_, i) => ({ id: `w${i}`, type: 'quickActions', size: 'small' })) };
  assert.equal(sanitizeLayout(many).widgets.length, MAX_WIDGETS_PER_DASHBOARD);
});

test('moveItem reorders without mutating', () => {
  const a = ['a', 'b', 'c', 'd'];
  assert.deepEqual(moveItem(a, 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveItem(a, 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(a, ['a', 'b', 'c', 'd']);
  assert.equal(moveItem(a, 1, 1), a);
  assert.equal(moveItem(a, 9, 0), a);
});

test('dashboard names are trimmed and bounded', () => {
  assert.equal(cleanDashboardName('  My   board '), 'My board');
  assert.equal(cleanDashboardName('   '), 'My dashboard');
  assert.equal(cleanDashboardName('x'.repeat(200)).length, 60);
});

test('migration 027 restricts every operation to the owner and grants nothing to anon', () => {
  const sql = fs.readFileSync('db/migrations/027_user_dashboards.sql', 'utf8');
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON public\.user_dashboards FROM anon/);
  for (const op of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    assert.match(sql, new RegExp(`FOR ${op} TO authenticated`), `${op} policy`);
  }
  assert.ok(!/USING \(true\)|WITH CHECK \(true\)/i.test(sql), 'no open policies');
});
