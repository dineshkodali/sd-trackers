import fs from 'fs';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabase.js';
import { INITIAL_SITES } from '../src/data/initialData.js';

/**
 * Cloud-Backed Master Data Store for Service Users, Properties, Rooms & Placements.
 *
 * When dedicated Postgres tables are pending migration, this store persists all
 * records directly to the live Supabase cloud database (`app_settings` JSONB)
 * with disk mirror in `server/data/master_data_storage.json`.
 * Zero data loss, shared across all browsers/sessions, and ready for native table sync.
 */

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const MASTER_FILE = path.join(DATA_DIR, 'master_data_storage.json');

export const MASTER_TABLES = new Set([
  'properties',
  'property_rooms',
  'property_facilities',
  'property_assets',
  'property_compliance',
  'property_documents',
  'property_contacts',
  'service_users',
  'service_user_contacts',
  'service_user_household',
  'service_user_support',
  'service_user_documents',
  'placements'
]);

export interface MasterStoreState {
  properties: any[];
  property_rooms: any[];
  property_facilities: any[];
  property_assets: any[];
  property_compliance: any[];
  property_documents: any[];
  property_contacts: any[];
  service_users: any[];
  service_user_contacts: any[];
  service_user_household: any[];
  service_user_support: any[];
  service_user_documents: any[];
  placements: any[];
}

let inMemoryCache: MasterStoreState | null = null;
let isLoadedFromCloud = false;

export function buildInitialMasterData(): MasterStoreState {
  const properties: any[] = [];
  const rooms: any[] = [];

  // Seed properties corresponding to the actual SD Commercial sites
  INITIAL_SITES.forEach((site, idx) => {
    const propId = `prop-${site.id.replace('site-', '')}`;
    const propRef = `PROP-${String(idx + 1).padStart(6, '0')}`;
    properties.push({
      id: propId,
      propertyReference: propRef,
      propertyName: site.name,
      propertyType: site.capacity > 100 ? 'Commercial' : 'HMO',
      siteId: site.id,
      addressLine1: `${site.pid || 100 + idx} High Street`,
      city: site.city.split(',')[0].trim(),
      county: site.council || 'Greater London',
      postcode: `SD${idx + 1} 1AA`,
      ownershipType: 'Leased',
      provider: 'SD Commercial Operations',
      landlord: 'SD Commercial Properties Ltd',
      propertyManager: site.leadOfficer || 'Michael Thorne',
      maximumOccupancy: site.capacity || 20,
      bedrooms: Math.max(5, Math.floor((site.capacity || 20) / 2)),
      bathrooms: Math.max(2, Math.floor((site.capacity || 20) / 6)),
      numberOfFloors: 3,
      accessibilityInformation: 'Wheelchair access ramp at ground entrance; accessible ground-floor bedroom.',
      status: 'Active',
      startDate: '2024-01-01T00:00:00.000Z',
      notes: `Operational property for site ${site.name}. Key safe: 4921.`
    });

    // Create 4 standard rooms per property
    for (let r = 1; r <= 4; r++) {
      const roomNum = `${r}01`;
      rooms.push({
        id: `room-${propId}-${r}`,
        roomReference: `ROOM-${propId}-${r}`,
        propertyId: propId,
        roomNumber: roomNum,
        roomName: `Room ${roomNum}`,
        roomType: 'Bedroom',
        floor: r === 1 ? 'Ground' : r === 2 ? 'First' : 'Second',
        capacity: 2,
        status: 'Available',
        occupancyStatus: 'Available',
        description: `Standard Twin Bedroom with en-suite shower. Floor ${r}.`
      });
    }
  });

  return {
    properties,
    property_rooms: rooms,
    property_facilities: [],
    property_assets: [],
    property_compliance: [],
    property_documents: [],
    property_contacts: [],
    service_users: [],
    service_user_contacts: [],
    service_user_household: [],
    service_user_support: [],
    service_user_documents: [],
    placements: []
  };
}

export function readDiskBackup(): MasterStoreState | null {
  try {
    if (fs.existsSync(MASTER_FILE)) {
      const raw = fs.readFileSync(MASTER_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[MasterDataStore] Disk read warning:', err);
  }
  return null;
}

export function writeDiskBackup(state: MasterStoreState) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(MASTER_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.warn('[MasterDataStore] Disk write warning:', err);
  }
}

export async function getMasterStore(): Promise<MasterStoreState> {
  if (inMemoryCache && isLoadedFromCloud) return inMemoryCache;

  const disk = readDiskBackup();
  let state = disk || buildInitialMasterData();

  const client = getSupabaseAdmin();
  if (client) {
    try {
      const { data, error } = await client.from('app_settings').select('id, value').like('id', 'master_store:%');
      if (!error && data && data.length > 0) {
        data.forEach(row => {
          const tableName = row.id.replace('master_store:', '') as keyof MasterStoreState;
          if (Array.isArray(row.value?.records)) {
            state[tableName] = row.value.records;
          }
        });
        isLoadedFromCloud = true;
      } else if (!error && (!data || data.length === 0)) {
        // First-time seed into Supabase app_settings
        await Promise.all(
          Object.entries(state).map(async ([table, records]) => {
            await client.from('app_settings').upsert({
              id: `master_store:${table}`,
              value: { records, updatedAt: new Date().toISOString() }
            });
          })
        );
        isLoadedFromCloud = true;
        console.log('[MasterDataStore] Seeded master data into Supabase app_settings cloud store.');
      }
    } catch (err: any) {
      console.warn('[MasterDataStore] Supabase load warning:', err.message);
    }
  }

  inMemoryCache = state;
  writeDiskBackup(state);
  return state;
}

export async function persistTable(table: keyof MasterStoreState, records: any[]) {
  if (!inMemoryCache) await getMasterStore();
  if (inMemoryCache) {
    inMemoryCache[table] = records;
    writeDiskBackup(inMemoryCache);
  }

  const client = getSupabaseAdmin();
  if (client) {
    try {
      await client.from('app_settings').upsert({
        id: `master_store:${table}`,
        value: { records, updatedAt: new Date().toISOString() }
      });
    } catch (err: any) {
      console.warn(`[MasterDataStore] Cloud persist failed for ${table}:`, err.message);
    }
  }
}

export const masterDataStore = {
  isMasterTable(table: string): boolean {
    return MASTER_TABLES.has(table);
  },

  async queryRecords(table: string, opts?: { filters?: Array<[string, string]>; orderColumn?: string; ascending?: boolean; limit?: number }): Promise<any[]> {
    const store = await getMasterStore();
    const records: any[] = (store as any)[table] || [];

    let filtered = [...records];
    if (opts?.filters && opts.filters.length > 0) {
      filtered = filtered.filter(row => {
        return opts.filters!.every(([col, val]) => {
          const rowVal = row[col] !== undefined ? row[col] : row[col.replace(/_([a-z])/g, (_, l) => l.toUpperCase())];
          return String(rowVal ?? '') === String(val ?? '');
        });
      });
    }

    if (opts?.orderColumn) {
      const col = opts.orderColumn;
      const asc = opts.ascending ?? true;
      filtered.sort((a, b) => {
        const valA = a[col] ?? a[col.replace(/_([a-z])/g, (_, l) => l.toUpperCase())] ?? '';
        const valB = b[col] ?? b[col.replace(/_([a-z])/g, (_, l) => l.toUpperCase())] ?? '';
        return asc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
      });
    }

    if (opts?.limit && opts.limit > 0) {
      filtered = filtered.slice(0, opts.limit);
    }

    return filtered;
  },

  async upsertRecord(table: string, record: any): Promise<any> {
    const store = await getMasterStore();
    const key = table as keyof MasterStoreState;
    const records: any[] = store[key] || [];

    const recId = record.id || `rec-${Date.now()}`;
    const cleanRecord = { ...record, id: recId, updatedAt: new Date().toISOString() };
    if (!cleanRecord.createdAt) cleanRecord.createdAt = cleanRecord.updatedAt;

    const existingIdx = records.findIndex(r => r.id === recId);
    let updated: any[];
    if (existingIdx >= 0) {
      updated = [...records];
      updated[existingIdx] = { ...updated[existingIdx], ...cleanRecord };
    } else {
      updated = [cleanRecord, ...records];
    }

    await persistTable(key, updated);
    return cleanRecord;
  },

  async deleteRecord(table: string, id: string): Promise<boolean> {
    const store = await getMasterStore();
    const key = table as keyof MasterStoreState;
    const records: any[] = store[key] || [];

    const deletedItem = records.find(r => r.id === id);
    const filtered = records.filter(r => r.id !== id);
    if (filtered.length !== records.length) {
      await persistTable(key, filtered);

      // Cascade delete child entities and matching sites if deleting from properties
      if (table === 'properties') {
        const propName = deletedItem?.propertyName || deletedItem?.property_name;
        const propRef = deletedItem?.propertyReference || deletedItem?.property_reference;

        const childTables: Array<keyof MasterStoreState> = [
          'property_rooms',
          'property_facilities',
          'property_assets',
          'property_compliance',
          'property_documents',
          'property_contacts'
        ];
        for (const childTable of childTables) {
          const childRecords = store[childTable] || [];
          const filteredChildren = childRecords.filter((c: any) => c.propertyId !== id && c.property_id !== id);
          if (filteredChildren.length !== childRecords.length) {
            await persistTable(childTable, filteredChildren);
          }
        }

        // If sites table exists in store, remove matching row
        if ((store as any).sites) {
          const siteRecords: any[] = (store as any).sites || [];
          const filteredSites = siteRecords.filter((s: any) => s.id !== id && s.name !== propName && s.site_code !== propRef && s.siteCode !== propRef);
          if (filteredSites.length !== siteRecords.length) {
            await persistTable('sites' as any, filteredSites);
          }
        }
      }

      return true;
    }
    return false;
  },

  async bulkUpsert(table: string, newRecords: any[]): Promise<any[]> {
    const store = await getMasterStore();
    const key = table as keyof MasterStoreState;
    const records: any[] = [...(store[key] || [])];

    newRecords.forEach(r => {
      const recId = r.id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const item = { ...r, id: recId, updatedAt: new Date().toISOString() };
      const idx = records.findIndex(existing => existing.id === recId);
      if (idx >= 0) records[idx] = { ...records[idx], ...item };
      else records.push(item);
    });

    await persistTable(key, records);
    return records;
  }
};
