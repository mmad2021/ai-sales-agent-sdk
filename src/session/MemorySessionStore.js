import { SessionStore } from './SessionStore.js';

export class MemorySessionStore extends SessionStore {
  constructor(options = {}) {
    super();
    this.defaultTTL = options.defaultTTL ?? null;
    this.sessions = new Map();
  }

  async get(sessionId) {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    return structuredClone(entry.data);
  }

  async save(sessionId, session) {
    const previous = this.sessions.get(sessionId);
    const expiresAt = previous?.expiresAt ?? this._computeExpiresAt(this.defaultTTL);

    this.sessions.set(sessionId, {
      data: structuredClone(session),
      expiresAt
    });
  }

  async delete(sessionId) {
    this.sessions.delete(sessionId);
  }

  async updateTTL(sessionId, ttlSeconds) {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      return;
    }

    entry.expiresAt = this._computeExpiresAt(ttlSeconds);
    this.sessions.set(sessionId, entry);
  }

  _computeExpiresAt(ttlSeconds) {
    if (!ttlSeconds) {
      return null;
    }
    return Date.now() + (ttlSeconds * 1000);
  }
}
