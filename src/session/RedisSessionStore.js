import { createClient } from 'redis';
import { SessionStore } from './SessionStore.js';

export class RedisSessionStore extends SessionStore {
  constructor(options = {}) {
    super();
    this.url = options.url || 'redis://localhost:6379';
    this.prefix = options.prefix || 'sales-agent:session:';
    this.defaultTTL = options.defaultTTL ?? 3600;
    this.client = createClient({ url: this.url });
    this._connected = false;
    this.client.on('error', (error) => {
      // Keep this non-throwing; callers handle command-level failures.
      console.error('RedisSessionStore error:', error);
    });
  }

  async get(sessionId) {
    await this._connect();
    const raw = await this.client.get(this._key(sessionId));
    return raw ? JSON.parse(raw) : null;
  }

  async save(sessionId, session) {
    await this._connect();
    await this.client.set(this._key(sessionId), JSON.stringify(session), { EX: this.defaultTTL });
  }

  async delete(sessionId) {
    await this._connect();
    await this.client.del(this._key(sessionId));
  }

  async updateTTL(sessionId, ttlSeconds) {
    await this._connect();
    await this.client.expire(this._key(sessionId), ttlSeconds);
  }

  async close() {
    if (!this._connected) {
      return;
    }
    await this.client.quit();
    this._connected = false;
  }

  _key(sessionId) {
    return `${this.prefix}${sessionId}`;
  }

  async _connect() {
    if (this._connected) {
      return;
    }

    if (!this.client.isOpen) {
      await this.client.connect();
    }
    this._connected = true;
  }
}
