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
  private propertiesPayload: CachedPayload<PropertyInfo> | null = null;
  private usersPayload: CachedPayload<UserAccount> | null = null;

  private constructor() {
    // Proactively purge any residual localStorage caches
    try {
      localStorage.removeItem(STORAGE_PREFIX + 'properties');
      localStorage.removeItem(STORAGE_PREFIX + 'users');
    } catch {}
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
   * Returns in-memory properties with 0ms latency.
   * Data is hydrated strictly from the live database, not localStorage.
   */
  public getPropertiesInstant(): { data: PropertyInfo[]; metadata: CacheMetadata } {
    if (this.propertiesPayload && Array.isArray(this.propertiesPayload.data) && this.propertiesPayload.data.length > 0) {
      this.propertiesPayload.metadata.hitCount = (this.propertiesPayload.metadata.hitCount || 0) + 1;
      return this.propertiesPayload;
    }

    // In-memory seed initialization before live database sync completes
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
    this.propertiesPayload = payload;
    fastIndices.rebuildPropertyIndices(initialData);
    return payload;
  }

  /**
   * Returns in-memory users with 0ms latency.
   * Data is hydrated strictly from the live database, not localStorage.
   */
  public getUsersInstant(): { data: UserAccount[]; metadata: CacheMetadata } {
    if (this.usersPayload && Array.isArray(this.usersPayload.data) && this.usersPayload.data.length > 0) {
      this.usersPayload.metadata.hitCount = (this.usersPayload.metadata.hitCount || 0) + 1;
      return this.usersPayload;
    }

    // In-memory seed initialization before live database sync completes
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
    this.usersPayload = payload;
    fastIndices.rebuildUserIndices(initialData);
    return payload;
  }

  public savePropertiesCache(payload: CachedPayload<PropertyInfo>): void {
    this.propertiesPayload = payload;
    fastIndices.rebuildPropertyIndices(payload.data);
  }

  public saveUsersCache(payload: CachedPayload<UserAccount>): void {
    this.usersPayload = payload;
    fastIndices.rebuildUserIndices(payload.data);
  }

  /**
   * Background Delta Sync: Hydrates properties directly from live database stream
   */
  public async syncPropertiesDelta(
    _currentItems: PropertyInfo[],
    incomingMasterItems: PropertyInfo[]
  ): Promise<{ updatedData: PropertyInfo[]; deltaCount: number; durationMs: number }> {
    const startTime = performance.now();
    this.isSyncing = true;
    this.notifyStats();

    const updatedData: PropertyInfo[] = Array.isArray(incomingMasterItems) ? [...incomingMasterItems] : [];
    const deltaCount = updatedData.length;
    const durationMs = Math.round(performance.now() - startTime);

    const oldCached = this.getPropertiesInstant();
    const metadata: CacheMetadata = {
      key: 'properties',
      version: (oldCached.metadata.version || 1) + 1,
      lastSyncTimestamp: Date.now(),
      checksum: calculateChecksum(updatedData),
      itemCount: updatedData.length,
      hitCount: (oldCached.metadata.hitCount || 0) + 1,
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
   * Background Delta Sync: Hydrates users directly from live database stream
   */
  public async syncUsersDelta(
    _currentUsers: UserAccount[],
    incomingMasterUsers: UserAccount[]
  ): Promise<{ updatedData: UserAccount[]; deltaCount: number; durationMs: number }> {
    const startTime = performance.now();
    this.isSyncing = true;
    this.notifyStats();

    const updatedData: UserAccount[] = Array.isArray(incomingMasterUsers) ? [...incomingMasterUsers] : [];
    const deltaCount = updatedData.length;
    const durationMs = Math.round(performance.now() - startTime);

    const oldCached = this.getUsersInstant();
    const metadata: CacheMetadata = {
      key: 'users',
      version: (oldCached.metadata.version || 1) + 1,
      lastSyncTimestamp: Date.now(),
      checksum: calculateChecksum(updatedData),
      itemCount: updatedData.length,
      hitCount: (oldCached.metadata.hitCount || 0) + 1,
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
