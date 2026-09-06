import { PropertyInfo, UserAccount, RoleType } from '../types';
import { INITIAL_SITES, INITIAL_USERS } from '../data/initialData';

export interface CacheMetadata {
  key: string;
  version: number;
  lastSyncTimestamp: number;
  checksum: string;
  itemCount: number;
  hitCount: number;
  syncState: 'synced' | 'syncing' | 'stale' | 'offline';
  lastSyncDurationMs: number;
  deltaUpdatesCount: number;
}

export interface CachedPayload<T> {
  data: T[];
  metadata: CacheMetadata;
}

export interface SmartCacheStats {
  properties: CacheMetadata;
  users: CacheMetadata;
  totalHits: number;
  isBackgroundSyncing: boolean;
  lastSyncFormatted: string;
}

const STORAGE_PREFIX = 'sg_smart_cache_';

// Simple fast checksum calculation for delta detection
function calculateChecksum<T>(items: T[]): string {
  try {
    const serialized = JSON.stringify(items);
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `chk_${Math.abs(hash).toString(16)}_${items.length}`;
  } catch {
    return `chk_${Date.now()}`;
  }
}

// In-Memory Fast Lookup Indices for 0ms access
class SmartIndexStore {
  private propertyByIdMap = new Map<string, PropertyInfo>();
  private propertyByNameMap = new Map<string, PropertyInfo>();
  private userByIdMap = new Map<string, UserAccount>();
  private userByEmailMap = new Map<string, UserAccount>();
  private usersByRoleMap = new Map<RoleType, UserAccount[]>();
  private totalHits = 0;

  public rebuildPropertyIndices(properties: PropertyInfo[]) {
    this.propertyByIdMap.clear();
    this.propertyByNameMap.clear();
    if (!Array.isArray(properties)) return;
    for (const prop of properties) {
      if (!prop) continue;
      if (prop.id) this.propertyByIdMap.set(prop.id, prop);
      if (prop.name && typeof prop.name === 'string') {
        this.propertyByNameMap.set(prop.name.toLowerCase().trim(), prop);
      }
    }
  }

  public rebuildUserIndices(users: UserAccount[]) {
    this.userByIdMap.clear();
    this.userByEmailMap.clear();
    this.usersByRoleMap.clear();
    if (!Array.isArray(users)) return;
    for (const user of users) {
      if (!user) continue;
      if (user.id) this.userByIdMap.set(user.id, user);
      if (user.email && typeof user.email === 'string') {
        this.userByEmailMap.set(user.email.toLowerCase().trim(), user);
      }
      
      if (user.role) {
        const roleList = this.usersByRoleMap.get(user.role) || [];
        roleList.push(user);
        this.usersByRoleMap.set(user.role, roleList);
      }
    }
  }

  public getPropertyById(id?: string): PropertyInfo | undefined {
    this.totalHits++;
    if (!id) return undefined;
    return this.propertyByIdMap.get(id);
  }

  public getPropertyByName(name?: string): PropertyInfo | undefined {
    this.totalHits++;
    if (!name || typeof name !== 'string') return undefined;
    return this.propertyByNameMap.get(name.toLowerCase().trim());
  }

  public getUserById(id?: string): UserAccount | undefined {
    this.totalHits++;
    if (!id) return undefined;
    return this.userByIdMap.get(id);
  }

  public getUserByEmail(email?: string): UserAccount | undefined {
    this.totalHits++;
    if (!email || typeof email !== 'string') return undefined;
    return this.userByEmailMap.get(email.toLowerCase().trim());
  }

  public getUsersByRole(role?: RoleType): UserAccount[] {
    this.totalHits++;
    if (!role) return [];
    return this.usersByRoleMap.get(role) || [];
  }

  public getHitCount(): number {
    return this.totalHits;
  }
}

export const fastIndices = new SmartIndexStore();

// Smart Cache Store with LocalStorage Persistence & Delta Sync
export class SmartCacheManager {
  private static instance: SmartCacheManager;
  private syncListeners: ((stats: SmartCacheStats) => void)[] = [];
  private isSyncing = false;

  private constructor() {
    // Initial warmup
    this.getPropertiesInstant();
    this.getUsersInstant();
  }

  public static getInstance(): SmartCacheManager {
    if (!SmartCacheManager.instance) {
      SmartCacheManager.instance = new SmartCacheManager();
    }
    return SmartCacheManager.instance;
  }

  /**
   * Loads properties instantly from localStorage or fallback with 0ms latency
   */
  public getPropertiesInstant(): { data: PropertyInfo[]; metadata: CacheMetadata } {
    const raw = localStorage.getItem(STORAGE_PREFIX + 'properties');
    if (raw) {
      try {
        const payload: CachedPayload<PropertyInfo> = JSON.parse(raw);
        if (Array.isArray(payload.data) && payload.data.length > 0) {
          payload.metadata.hitCount = (payload.metadata.hitCount || 0) + 1;
          fastIndices.rebuildPropertyIndices(payload.data);
          return payload;
        }
      } catch (err) {
        console.warn('SmartCache: Failed to parse cached properties, refreshing from master data');
      }
    }

    // Default Seed Initialization
    const initialData: PropertyInfo[] = INITIAL_SITES;
    const metadata: CacheMetadata = {
      key: 'properties',
      version: 1,
      lastSyncTimestamp: Date.now(),
      checksum: calculateChecksum(initialData),
      itemCount: initialData.length,
      hitCount: 1,
      syncState: 'synced',
      lastSyncDurationMs: 0,
      deltaUpdatesCount: 0
    };

    const payload: CachedPayload<PropertyInfo> = { data: initialData, metadata };
    this.savePropertiesCache(payload);
    fastIndices.rebuildPropertyIndices(initialData);
    return payload;
  }

  /**
   * Loads users instantly from localStorage or fallback with 0ms latency
   */
  public getUsersInstant(): { data: UserAccount[]; metadata: CacheMetadata } {
    const raw = localStorage.getItem(STORAGE_PREFIX + 'users');
    if (raw) {
      try {
        const payload: CachedPayload<UserAccount> = JSON.parse(raw);
        if (Array.isArray(payload.data) && payload.data.length > 0) {
          if (payload.data.length < INITIAL_USERS.length) {
            const merged = [...payload.data];
            INITIAL_USERS.forEach(iu => {
              if (!merged.some(u => u.email?.toLowerCase() === iu.email?.toLowerCase())) {
                merged.push(iu);
              }
            });
            payload.data = merged;
            payload.metadata.itemCount = merged.length;
            this.saveUsersCache(payload);
          }
          payload.metadata.hitCount = (payload.metadata.hitCount || 0) + 1;
          fastIndices.rebuildUserIndices(payload.data);
          return payload;
        }
      } catch (err) {
        console.warn('SmartCache: Failed to parse cached users, refreshing from master data');
      }
    }

    // Default Seed Initialization
    const initialData: UserAccount[] = INITIAL_USERS;
    const metadata: CacheMetadata = {
      key: 'users',
      version: 1,
      lastSyncTimestamp: Date.now(),
      checksum: calculateChecksum(initialData),
      itemCount: initialData.length,
      hitCount: 1,
      syncState: 'synced',
      lastSyncDurationMs: 0,
      deltaUpdatesCount: 0
    };

    const payload: CachedPayload<UserAccount> = { data: initialData, metadata };
    this.saveUsersCache(payload);
    fastIndices.rebuildUserIndices(initialData);
    return payload;
  }

  public savePropertiesCache(payload: CachedPayload<PropertyInfo>): void {
    try {
      localStorage.setItem(STORAGE_PREFIX + 'properties', JSON.stringify(payload));
      fastIndices.rebuildPropertyIndices(payload.data);
    } catch {
      // quota safeguard
    }
  }

  public saveUsersCache(payload: CachedPayload<UserAccount>): void {
    try {
      localStorage.setItem(STORAGE_PREFIX + 'users', JSON.stringify(payload));
      fastIndices.rebuildUserIndices(payload.data);
    } catch {
      // quota safeguard
    }
  }

  /**
   * Background Delta Sync: Merges only modified / new records without replacing unchanged ones
   */
  public async syncPropertiesDelta(
    currentItems: PropertyInfo[],
    incomingMasterItems: PropertyInfo[]
  ): Promise<{ updatedData: PropertyInfo[]; deltaCount: number; durationMs: number }> {
    const startTime = performance.now();
    this.isSyncing = true;
    this.notifyStats();

    // Simulated background micro-task latency
    await new Promise(resolve => setTimeout(resolve, 80));

    let deltaCount = 0;
    const existingMap = new Map<string, PropertyInfo>();
    currentItems.forEach(item => existingMap.set(item.id, item));

    const updatedData: PropertyInfo[] = [];

    // Detect new or updated items from incoming stream
    for (const incoming of incomingMasterItems) {
      const existing = existingMap.get(incoming.id);
      if (!existing) {
        // New item
        updatedData.push(incoming);
        deltaCount++;
      } else {
        // Compare fields for changes
        const hasChanged = 
          existing.name !== incoming.name ||
          existing.city !== incoming.city ||
          existing.capacity !== incoming.capacity ||
          existing.status !== incoming.status ||
          existing.leadOfficer !== incoming.leadOfficer ||
          existing.contactNumber !== incoming.contactNumber ||
          existing.pid !== incoming.pid;

        if (hasChanged) {
          updatedData.push({ ...existing, ...incoming });
          deltaCount++;
        } else {
          updatedData.push(existing); // keep unchanged reference
        }
      }
    }

    // Preserve any custom properties added locally not in incoming stream
    for (const existing of currentItems) {
      if (!existing || !existing.name || typeof existing.name !== 'string') continue;
      const existingName = existing.name.toLowerCase().trim();
      if (!incomingMasterItems.some(i => i && (i.id === existing.id || (i.name && typeof i.name === 'string' && i.name.toLowerCase().trim() === existingName)))) {
        updatedData.push(existing);
      }
    }

    const durationMs = Math.round(performance.now() - startTime);

    const oldCached = this.getPropertiesInstant();
    const metadata: CacheMetadata = {
      key: 'properties',
      version: oldCached.metadata.version + (deltaCount > 0 ? 1 : 0),
      lastSyncTimestamp: Date.now(),
      checksum: calculateChecksum(updatedData),
      itemCount: updatedData.length,
      hitCount: oldCached.metadata.hitCount + 1,
      syncState: 'synced',
      lastSyncDurationMs: durationMs,
      deltaUpdatesCount: deltaCount
    };

    this.savePropertiesCache({ data: updatedData, metadata });
    this.isSyncing = false;
    this.notifyStats();

    return { updatedData, deltaCount, durationMs };
  }

  /**
   * Background Delta Sync for Users
   */
  public async syncUsersDelta(
    currentUsers: UserAccount[],
    incomingMasterUsers: UserAccount[]
  ): Promise<{ updatedData: UserAccount[]; deltaCount: number; durationMs: number }> {
    const startTime = performance.now();
    this.isSyncing = true;
    this.notifyStats();

    let deltaCount = 0;
    const existingMap = new Map<string, UserAccount>();
    (currentUsers || []).forEach(u => {
      if (u?.id) existingMap.set(u.id, u);
      if (u?.email) existingMap.set(u.email.toLowerCase().trim(), u);
    });

    const updatedData: UserAccount[] = [];
    const processedKeys = new Set<string>();

    for (const incoming of (incomingMasterUsers || [])) {
      if (!incoming || !incoming.email) continue;
      const emailKey = incoming.email.toLowerCase().trim();
      processedKeys.add(incoming.id);
      processedKeys.add(emailKey);

      const existing = existingMap.get(incoming.id) || existingMap.get(emailKey);
      if (!existing) {
        updatedData.push(incoming);
        deltaCount++;
      } else {
        const merged: UserAccount = {
          ...incoming,
          ...existing,
          assignedSites: Array.isArray(existing.assignedSites) && existing.assignedSites.length > 0
            ? existing.assignedSites
            : (Array.isArray(incoming.assignedSites) && incoming.assignedSites.length > 0 ? incoming.assignedSites : ['All Sites'])
        };

        const hasChanged =
          existing.name !== merged.name ||
          existing.email !== merged.email ||
          existing.role !== merged.role ||
          existing.status !== merged.status ||
          JSON.stringify(existing.assignedSites) !== JSON.stringify(merged.assignedSites);

        if (hasChanged) {
          updatedData.push(merged);
          deltaCount++;
        } else {
          updatedData.push(existing);
        }
      }
    }

    for (const current of (currentUsers || [])) {
      if (!current || !current.email) continue;
      const emailKey = current.email.toLowerCase().trim();
      if (!processedKeys.has(current.id) && !processedKeys.has(emailKey)) {
        updatedData.push(current);
      }
    }

    const durationMs = Math.round(performance.now() - startTime);

    const oldCached = this.getUsersInstant();
    const metadata: CacheMetadata = {
      key: 'users',
      version: oldCached.metadata.version + (deltaCount > 0 ? 1 : 0),
      lastSyncTimestamp: Date.now(),
      checksum: calculateChecksum(updatedData),
      itemCount: updatedData.length,
      hitCount: oldCached.metadata.hitCount + 1,
      syncState: 'synced',
      lastSyncDurationMs: durationMs,
      deltaUpdatesCount: deltaCount
    };

    this.saveUsersCache({ data: updatedData, metadata });
    this.isSyncing = false;
    this.notifyStats();

    return { updatedData, deltaCount, durationMs };
  }

  public getStats(): SmartCacheStats {
    const props = this.getPropertiesInstant().metadata;
    const users = this.getUsersInstant().metadata;
    const totalHits = (props.hitCount || 0) + (users.hitCount || 0) + fastIndices.getHitCount();
    
    const maxTime = Math.max(props.lastSyncTimestamp, users.lastSyncTimestamp);
    const date = new Date(maxTime);
    const lastSyncFormatted = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;

    return {
      properties: props,
      users,
      totalHits,
      isBackgroundSyncing: this.isSyncing,
      lastSyncFormatted
    };
  }

  public subscribeStats(listener: (stats: SmartCacheStats) => void): () => void {
    this.syncListeners.push(listener);
    listener(this.getStats());
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  private notifyStats(): void {
    const stats = this.getStats();
    this.syncListeners.forEach(l => {
      try {
        l(stats);
      } catch {}
    });
  }
}

export const smartCache = SmartCacheManager.getInstance();
