function formatCurrency(value, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch (_error) {
    return `$${Number(value).toFixed(2)}`;
  }
}

export class ResponseGenerator {
  constructor(options = {}) {
    this.llm = options.llm;
    this.config = options.config || {};
  }

  async generateResponse(payload) {
    const { message, intentData, actionResult, session } = payload;

    if (actionResult.error) {
      return `I hit an issue: ${actionResult.error} Please share another option and I can continue.`;
    }

    const prompt = this._buildPrompt({ message, intentData, actionResult, session });
    const llmOptions = {
      temperature: this.config.llm?.temperature ?? 0.7,
      maxTokens: this.config.llm?.maxTokens ?? 400
    };

    try {
      const response = await this.llm.complete(prompt, llmOptions);
      if (response && response.trim()) {
        return response.trim();
      }
    } catch (_error) {
      // Fall back to deterministic templates.
    }

    return this._fallback(intentData.intent, actionResult, session);
  }

  _buildPrompt({ message, intentData, actionResult, session }) {
    const businessName = this.config.business?.name || 'our store';
    const businessDescription = this.config.business?.description || 'online retail business';
    const currency = this.config.business?.currency || 'USD';
    const systemPrompt = this.config.llm?.systemPrompt || 'You are a helpful AI sales assistant.';

    const conciseActionData = JSON.stringify(actionResult.data || {}, null, 2);
    const cartItems = (session.cart?.items || []).map((item) => `${item.name} x${item.quantity}`).join(', ') || 'empty';

    return `${systemPrompt}

Business: ${businessName}
Description: ${businessDescription}
Currency: ${currency}

Customer message: "${message}"
Intent: ${intentData.intent}
Confidence: ${intentData.confidence}
Entities: ${JSON.stringify(intentData.entities || {})}
Cart: ${cartItems}
Action result: ${conciseActionData}

Instructions:
- Reply naturally and clearly.
- Keep the response concise (2-5 sentences).
- If products are returned, suggest one strong next step.
- If checkout data is returned, include order summary and payment instructions when available.`;
  }

  _fallback(intent, actionResult, session) {
    const currency = this.config.business?.currency || 'USD';

    switch (intent) {
      case 'greeting':
        return this.config.conversation?.greetingMessage || 'Welcome. How can I help with your order today?';
      case 'browse_products': {
        const products = actionResult.data?.products || [];
        if (products.length === 0) {
          return 'I could not find matching products yet. Share what type, color, or price range you want.';
        }
        const names = products.slice(0, 3).map((p) => `${p.name} (${formatCurrency(p.price, currency)})`).join(', ');
        return `Here are a few options: ${names}. Tell me which one you want to add.`;
      }
      case 'add_to_cart': {
        const items = session.cart?.items || [];
        const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
        return `Added to cart. You now have ${totalQty} item(s) in your cart.`;
      }
      case 'view_cart': {
        const totals = actionResult.data?.totals;
        if (!totals) {
          return 'Your cart is ready. Let me know if you want to checkout.';
        }
        return `Your cart total is ${formatCurrency(totals.total, currency)}. Say "checkout" when ready.`;
      }
      case 'checkout': {
        const order = actionResult.data?.order;
        const payment = actionResult.data?.payment;
        if (!order) {
          return 'I could not complete checkout yet. Please confirm your customer details and try again.';
        }
        const paymentPart = payment?.paymentLink ? ` Complete payment here: ${payment.paymentLink}` : '';
        return `Order ${order.orderNumber} has been created.${paymentPart}`;
      }
      case 'track_order': {
        const order = actionResult.data?.order;
        if (!order) {
          return 'I could not find that order. Please share your order ID.';
        }
        return `Order ${order.orderNumber} is currently ${order.status}.`;
      }
      case 'submit_payment_receipt': {
        const data = actionResult.data || {};
        if (data.decision === 'approved') {
          return `Thanks. I verified your receipt and marked payment as completed for order ${data.orderId}.`;
        }
        if (data.decision === 'rejected') {
          return `I could not validate that receipt for order ${data.orderId}. Please upload a clearer payment proof or contact support.`;
        }
        return `I received your receipt for order ${data.orderId}. It is pending manual review.`;
      }
      default:
        return 'I can help with products, cart updates, checkout, and order tracking. What do you want to do next?';
    }
  }
}
