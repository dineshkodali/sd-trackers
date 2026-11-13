import test from 'node:test';
import assert from 'node:assert/strict';
import { pathForPage, pageForPath, tabFromSearch, searchWithTab } from '../src/config/pageRoutes.ts';
import { APP_PAGES_REGISTRY } from '../src/config/pageRegistry.ts';

const pages = APP_PAGES_REGISTRY.map(p => p.id);

test('every page has its own address and it maps back to that page', () => {
  const seen = new Map<string, string>();
  for (const id of pages) {
    const path = pathForPage(id);
    assert.ok(path.startsWith('/'), id);
    assert.equal(seen.has(path.toLowerCase()), false, `${id} shares ${path} with ${seen.get(path.toLowerCase())}`);
    seen.set(path.toLowerCase(), id);
    assert.equal(pageForPath(path, pages), id);
  }
});

test('the existing addresses and their aliases still open the same pages', () => {
  assert.equal(pageForPath('/su-users', pages), 'suUsers');
  assert.equal(pageForPath('/service-users', pages), 'suUsers');
  assert.equal(pageForPath('/property-management', pages), 'propertyManagement');
  assert.equal(pageForPath('/properties', pages), 'propertyManagement');
  assert.equal(pageForPath('/', pages), 'dashboard');
});

test('the page called "properties" no longer collides with the /properties alias', () => {
  assert.equal(pathForPage('properties'), '/site-properties');
  assert.equal(pageForPath('/site-properties', pages), 'properties');
});

test('paths ignore case and a trailing slash; unknown paths open nothing', () => {
  assert.equal(pageForPath('/Room-Checks/', pages), 'roomChecks');
  assert.equal(pageForPath('/no-such-page', pages), null);
  assert.equal(pageForPath('/room-checks/extra', pages), null);
});

test('tab parameter: accepted only when it is one of the page tabs', () => {
  assert.equal(tabFromSearch('?tab=log', ['required', 'log']), 'log');
  assert.equal(tabFromSearch('?tab=evil', ['required', 'log']), null);
  assert.equal(tabFromSearch('', ['required', 'log']), null);
});

test('writing the tab keeps other parameters and drops the default', () => {
  assert.equal(searchWithTab('', 'log', 'required'), '?tab=log');
  assert.equal(searchWithTab('?month=2026-10', 'log', 'required'), '?month=2026-10&tab=log');
  assert.equal(searchWithTab('?tab=log&month=2026-10', 'required', 'required'), '?month=2026-10');
  assert.equal(searchWithTab('?tab=log', 'required', 'required'), '');
});
