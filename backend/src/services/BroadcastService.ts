import fs from 'fs';
import path from 'path';

export interface SystemBroadcast {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'DANGER';
  targetTenantId?: string | null;
  targetTenantName?: string | null;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string | null;
}

class BroadcastService {
  private dataFilePath: string;
  private broadcasts: SystemBroadcast[] = [];

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (_) {}
    }
    this.dataFilePath = path.join(dataDir, 'broadcasts.json');
    this.loadFromFile();
  }

  private loadFromFile() {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
        this.broadcasts = JSON.parse(raw);
      } else {
        this.broadcasts = [];
      }
    } catch (err) {
      console.warn('[BroadcastService] Failed to load broadcasts.json, using empty array:', err);
      this.broadcasts = [];
    }
  }

  private saveToFile() {
    try {
      fs.writeFileSync(this.dataFilePath, JSON.stringify(this.broadcasts, null, 2), 'utf-8');
    } catch (err) {
      console.error('[BroadcastService] Failed to save broadcasts.json:', err);
    }
  }

  public getAll(): SystemBroadcast[] {
    return this.broadcasts;
  }

  public getActiveForTenant(tenantId?: string | null): SystemBroadcast[] {
    return this.broadcasts.filter(b => {
      if (!b.isActive) return false;
      // If broadcast is global (no targetTenantId), it applies to all tenants
      if (!b.targetTenantId) return true;
      // If broadcast is targeted to specific tenant
      if (tenantId && b.targetTenantId === tenantId) return true;
      return false;
    });
  }

  public create(payload: {
    title: string;
    message: string;
    type: 'INFO' | 'WARNING' | 'DANGER';
    targetTenantId?: string | null;
    targetTenantName?: string | null;
    expiresAt?: string | null;
  }): SystemBroadcast {
    const newBroadcast: SystemBroadcast = {
      id: `bc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: payload.title.trim(),
      message: payload.message.trim(),
      type: payload.type || 'INFO',
      targetTenantId: payload.targetTenantId || null,
      targetTenantName: payload.targetTenantName || null,
      isActive: true,
      createdAt: new Date().toISOString(),
      expiresAt: payload.expiresAt || null
    };

    this.broadcasts.unshift(newBroadcast);
    this.saveToFile();
    return newBroadcast;
  }

  public delete(id: string): boolean {
    const initialLen = this.broadcasts.length;
    this.broadcasts = this.broadcasts.filter(b => b.id !== id);
    if (this.broadcasts.length !== initialLen) {
      this.saveToFile();
      return true;
    }
    return false;
  }

  public toggleStatus(id: string): SystemBroadcast | null {
    const b = this.broadcasts.find(item => item.id === id);
    if (!b) return null;
    b.isActive = !b.isActive;
    this.saveToFile();
    return b;
  }
}

export const broadcastService = new BroadcastService();
