/**
 * Abstract session store interface
 */
export class SessionStore {
  /**
   * Get session by ID
   * @param {string} sessionId
   * @returns {Promise<Session>}
   */
  async get(sessionId) {
    throw new Error('Must implement get()');
  }

  /**
   * Save session
   * @param {string} sessionId
   * @param {Session} session
   * @returns {Promise<void>}
   */
  async save(sessionId, session) {
    throw new Error('Must implement save()');
  }

  /**
   * Delete session
   * @param {string} sessionId
   * @returns {Promise<void>}
   */
  async delete(sessionId) {
    throw new Error('Must implement delete()');
  }

  /**
   * Update session TTL
   * @param {string} sessionId
   * @param {number} ttlSeconds
   * @returns {Promise<void>}
   */
  async updateTTL(sessionId, ttlSeconds) {
    throw new Error('Must implement updateTTL()');
  }
}
