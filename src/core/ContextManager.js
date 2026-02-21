export class ContextManager {
  constructor(options = {}) {
    this.sessionStore = options.sessionStore;
    this.config = options.config || {};
    this.maxHistoryLength = this.config.conversation?.maxHistoryLength ?? 20;
    this.sessionTTL = this.config.conversation?.sessionTTL ?? 3600;
  }

  async getSession(sessionId) {
    const rawSession = await this.sessionStore.get(sessionId);
    return this._normalizeSession(sessionId, rawSession);
  }

  appendMessage(session, role, text, metadata = {}) {
    session.history.push({
      role,
      text,
      metadata,
      timestamp: new Date().toISOString()
    });

    this._trimHistory(session);
    this.touch(session);
    return session;
  }

  setCustomer(session, customer) {
    session.customer = customer || session.customer;
    this.touch(session);
  }

  setContext(session, context = {}) {
    session.context = {
      ...session.context,
      ...context
    };
    this.touch(session);
  }

  clearCart(session) {
    session.cart = { items: [] };
    this.touch(session);
  }

  touch(session) {
    session.lastActivity = new Date().toISOString();
  }

  async saveSession(sessionId, session) {
    this._trimHistory(session);
    this.touch(session);
    await this.sessionStore.save(sessionId, session);
    await this.sessionStore.updateTTL(sessionId, this.sessionTTL);
  }

  _normalizeSession(sessionId, session) {
    if (!session) {
      return this._newSession(sessionId);
    }

    const normalizedCart = this._normalizeCart(session.cart);

    return {
      id: session.id || sessionId,
      customer: session.customer || null,
      history: Array.isArray(session.history) ? session.history : [],
      cart: normalizedCart,
      context: session.context || {},
      createdAt: session.createdAt || new Date().toISOString(),
      lastActivity: session.lastActivity || new Date().toISOString()
    };
  }

  _newSession(sessionId) {
    const now = new Date().toISOString();
    return {
      id: sessionId,
      customer: null,
      history: [],
      cart: { items: [] },
      context: {},
      createdAt: now,
      lastActivity: now
    };
  }

  _normalizeCart(cart) {
    if (!cart || !cart.items) {
      return { items: [] };
    }

    if (Array.isArray(cart.items)) {
      return { ...cart, items: cart.items };
    }

    return {
      ...cart,
      items: Object.values(cart.items)
    };
  }

  _trimHistory(session) {
    if (session.history.length > this.maxHistoryLength) {
      session.history = session.history.slice(-this.maxHistoryLength);
    }
  }
}
