import { MemorySessionStore } from '../session/MemorySessionStore.js';
import { ActionExecutor } from './ActionExecutor.js';
import { ContextManager } from './ContextManager.js';
import { IntentDetector } from './IntentDetector.js';
import { ResponseGenerator } from './ResponseGenerator.js';

const DEFAULT_CONFIG = {
  business: {
    name: 'Store',
    description: 'Online store',
    supportedLanguages: ['en'],
    currency: 'USD',
    timezone: 'UTC'
  },
  conversation: {
    maxHistoryLength: 20,
    sessionTTL: 3600,
    greetingMessage: 'Welcome!'
  },
  llm: {
    temperature: 0.7,
    maxTokens: 500,
    systemPrompt: 'You are a helpful sales assistant.'
  },
  orders: {
    taxRate: 0.08,
    freeShippingThreshold: 50,
    defaultShippingCost: 5,
    currency: 'USD'
  },
  payments: {
    autoApproveThreshold: 0.85,
    autoRejectThreshold: 0.35,
    visionPrompt: 'Assess whether this image is a valid payment receipt for the provided order details. Return JSON only.'
  }
};

function mergeConfig(config = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    business: { ...DEFAULT_CONFIG.business, ...(config.business || {}) },
    conversation: { ...DEFAULT_CONFIG.conversation, ...(config.conversation || {}) },
    llm: { ...DEFAULT_CONFIG.llm, ...(config.llm || {}) },
    orders: { ...DEFAULT_CONFIG.orders, ...(config.orders || {}) },
    payments: { ...DEFAULT_CONFIG.payments, ...(config.payments || {}) }
  };
}

export class AISalesAgent {
  constructor(options = {}) {
    if (!options.llm) {
      throw new Error('AISalesAgent requires an llm provider.');
    }

    this.llm = options.llm;
    this.adapters = options.adapters || {};
    this.sessionStore = options.sessionStore || new MemorySessionStore();
    this.config = mergeConfig(options.config);
    this.middleware = options.middleware || [];

    this.contextManager = new ContextManager({
      sessionStore: this.sessionStore,
      config: this.config
    });

    this.intentDetector = new IntentDetector({
      llm: this.llm,
      config: this.config
    });

    this.actionExecutor = new ActionExecutor({
      adapters: this.adapters,
      llm: this.llm,
      config: this.config
    });

    this.responseGenerator = new ResponseGenerator({
      llm: this.llm,
      config: this.config
    });
  }

  async chat(sessionId, message, metadata = {}) {
    const ctx = {
      sessionId,
      message,
      metadata,
      startedAt: Date.now()
    };

    await this._runMiddleware('before', ctx);

    let session = await this.contextManager.getSession(sessionId);

    try {
      const historyForIntent = session.history || [];
      this.contextManager.appendMessage(session, 'user', message, metadata);

      const intentData = await this.detectIntent(message, historyForIntent);
      const actionResult = await this.executeAction(intentData, session, { ...metadata, message });
      const responseText = await this.generateResponse({
        message,
        intentData,
        actionResult,
        session,
        metadata
      });

      this.contextManager.appendMessage(session, 'assistant', responseText, {
        intent: intentData.intent,
        confidence: intentData.confidence
      });

      await this.contextManager.saveSession(sessionId, session);

      const response = {
        text: responseText,
        intent: intentData.intent,
        confidence: intentData.confidence,
        entities: intentData.entities,
        actions: actionResult.actions,
        data: actionResult.data,
        session: {
          cart: session.cart,
          customer: session.customer,
          context: session.context
        }
      };

      ctx.response = response;
      await this._runMiddleware('after', ctx);
      return response;
    } catch (error) {
      const fallbackText = 'I am having trouble processing that request right now. Please try again.';
      this.contextManager.appendMessage(session, 'assistant', fallbackText, {
        error: error.message
      });
      await this.contextManager.saveSession(sessionId, session);

      const failure = {
        text: fallbackText,
        intent: 'error',
        confidence: 0,
        entities: {},
        actions: {},
        data: null,
        error: error.message
      };

      ctx.error = error;
      ctx.response = failure;
      await this._runMiddleware('error', ctx);
      return failure;
    }
  }

  async detectIntent(message, conversationHistory = []) {
    return this.intentDetector.detectIntent(message, conversationHistory);
  }

  async executeAction(intentData, session, metadata = {}) {
    return this.actionExecutor.executeAction(intentData, session, metadata);
  }

  async generateResponse(payload) {
    return this.responseGenerator.generateResponse(payload);
  }

  async _runMiddleware(hook, ctx) {
    for (const middleware of this.middleware) {
      if (middleware && typeof middleware[hook] === 'function') {
        await middleware[hook](ctx);
      }
    }
  }
}
