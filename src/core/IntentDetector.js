export const DEFAULT_INTENTS = [
  'greeting',
  'browse_products',
  'product_inquiry',
  'add_to_cart',
  'view_cart',
  'remove_from_cart',
  'checkout',
  'track_order',
  'complaint',
  'unclear'
];

export class IntentDetector {
  constructor(options = {}) {
    this.llm = options.llm;
    this.config = options.config || {};
    this.enabledIntents = this.config.conversation?.intents || DEFAULT_INTENTS;
  }

  async detectIntent(message, conversationHistory = []) {
    const schema = {
      type: 'object',
      properties: {
        intent: { type: 'string' },
        confidence: { type: 'number' },
        entities: { type: 'object' }
      },
      required: ['intent', 'confidence', 'entities']
    };

    const historyBlock = conversationHistory.length
      ? `Recent conversation:\n${conversationHistory.slice(-6).map((item) => `${item.role}: ${item.text}`).join('\n')}\n\n`
      : '';

    const prompt = `${historyBlock}You are classifying customer intent for an e-commerce sales chat.

Message: "${message}"

Allowed intents:
${this.enabledIntents.map((intent) => `- ${intent}`).join('\n')}

Extract entities when present:
- product_type
- product_id
- category
- color
- size
- quantity
- price_range
- order_id

Respond with JSON only:
{
  "intent": "one_allowed_intent",
  "confidence": 0.0,
  "entities": {
    "product_type": null,
    "product_id": null,
    "category": null,
    "color": null,
    "size": null,
    "quantity": null,
    "price_range": null,
    "order_id": null
  }
}`;

    try {
      let result;
      if (typeof this.llm.completeJSON === 'function') {
        result = await this.llm.completeJSON(prompt, schema, { temperature: 0.2 });
      } else {
        const raw = await this.llm.complete(prompt, { temperature: 0.2 });
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) {
          throw new Error('LLM did not return JSON');
        }
        result = JSON.parse(match[0]);
      }

      return this._normalizeResult(result);
    } catch (_error) {
      return {
        intent: 'unclear',
        confidence: 0,
        entities: {}
      };
    }
  }

  _normalizeResult(result) {
    const normalizedIntent = this.enabledIntents.includes(result.intent)
      ? result.intent
      : 'unclear';

    const confidence = Number.isFinite(Number(result.confidence))
      ? Math.max(0, Math.min(1, Number(result.confidence)))
      : 0;

    return {
      intent: normalizedIntent,
      confidence,
      entities: result.entities || {}
    };
  }
}
