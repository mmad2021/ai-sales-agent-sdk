function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp01(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, parsed));
}

function extractJSONBlock(value) {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[0]);
  } catch (_error) {
    return null;
  }
}

function normalizeStatus(order) {
  if (!order) {
    return null;
  }

  if (order.status === 'completed') {
    return 'delivered';
  }

  return order.status;
}

function normalizeDecision(value) {
  const raw = String(value || '').toLowerCase();
  if (raw === 'approve' || raw === 'approved') {
    return 'approved';
  }
  if (raw === 'reject' || raw === 'rejected') {
    return 'rejected';
  }
  return 'pending';
}

function statusFromDecision(decision) {
  if (decision === 'approved') {
    return 'paid';
  }
  if (decision === 'rejected') {
    return 'verification_rejected';
  }
  return 'pending_verification';
}

export class ActionExecutor {
  constructor(options = {}) {
    this.adapters = options.adapters || {};
    this.llm = options.llm;
    this.config = options.config || {};
  }

  async executeAction(intentData, session, metadata = {}) {
    const { intent, entities = {} } = intentData;

    const result = {
      actions: {
        addedToCart: false,
        removedFromCart: false,
        proceedToCheckout: false
      },
      data: null,
      error: null
    };

    try {
      switch (intent) {
        case 'browse_products':
          result.data = await this._browseProducts(metadata.message || '', entities);
          break;
        case 'product_inquiry':
          result.data = await this._productInquiry(metadata.message || '', entities);
          break;
        case 'add_to_cart':
          result.data = await this._addToCart(session, metadata.message || '', entities);
          result.actions.addedToCart = Boolean(result.data?.added);
          break;
        case 'view_cart':
          result.data = await this._viewCart(session);
          break;
        case 'remove_from_cart':
          result.data = await this._removeFromCart(session, entities);
          result.actions.removedFromCart = Boolean(result.data?.removed);
          break;
        case 'checkout':
          result.data = await this._checkout(session, metadata);
          result.actions.proceedToCheckout = Boolean(result.data?.order);
          break;
        case 'submit_payment_receipt':
          result.data = await this._submitPaymentReceipt(entities, metadata);
          break;
        case 'track_order':
          result.data = await this._trackOrder(entities, metadata);
          break;
        default:
          result.data = { info: 'No action required for this intent.' };
      }
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  async _browseProducts(message, entities) {
    const productsAdapter = this.adapters.products;
    if (!productsAdapter) {
      throw new Error('Product adapter is required for browsing products.');
    }

    const query = entities.product_type || entities.category || message;
    const filters = {
      category: entities.category || undefined
    };

    const products = await productsAdapter.searchProducts(query || '', filters);
    return { products };
  }

  async _productInquiry(message, entities) {
    const productsAdapter = this.adapters.products;
    if (!productsAdapter) {
      throw new Error('Product adapter is required for product inquiry.');
    }

    let product = null;
    if (entities.product_id) {
      product = await productsAdapter.getProduct(entities.product_id);
    }

    if (!product) {
      const matches = await productsAdapter.searchProducts(entities.product_type || message || '', {});
      product = matches[0] || null;
    }

    const relatedProducts = product
      ? await productsAdapter.getRelatedProducts(product.id, 5)
      : [];

    return { product, relatedProducts };
  }

  async _addToCart(session, message, entities) {
    const productsAdapter = this.adapters.products;
    if (!productsAdapter) {
      throw new Error('Product adapter is required for add to cart.');
    }

    const quantity = Math.max(1, Math.floor(toNumber(entities.quantity, 1)));
    const color = entities.color || null;
    const size = entities.size || null;

    let product = null;
    if (entities.product_id) {
      product = await productsAdapter.getProduct(entities.product_id);
    }

    if (!product) {
      const matches = await productsAdapter.searchProducts(entities.product_type || message, {});
      product = matches[0] || null;
    }

    if (!product) {
      throw new Error('Product not found for add-to-cart request.');
    }

    const availability = await productsAdapter.checkAvailability(product.id, quantity);
    if (!availability.available) {
      throw new Error(`Insufficient stock for ${product.name}. Available: ${availability.stock}.`);
    }

    const cart = this._ensureCart(session);
    const lineId = `${product.id}:${color || 'default'}:${size || 'default'}`;
    const existing = cart.items.find((item) => item.lineId === lineId);

    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({
        lineId,
        productId: product.id,
        name: product.name,
        price: toNumber(product.price, 0),
        quantity,
        color,
        size,
        category: product.category || null
      });
    }

    return {
      added: true,
      cart: session.cart,
      item: product,
      quantity
    };
  }

  async _viewCart(session) {
    const cart = this._ensureCart(session);
    const ordersAdapter = this.adapters.orders;

    let totals = {
      subtotal: cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      tax: 0,
      shipping: 0,
      total: cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };

    if (ordersAdapter && cart.items.length > 0) {
      totals = await ordersAdapter.calculateTotals(cart.items, session.customer || {});
    }

    return {
      items: cart.items,
      totals
    };
  }

  async _removeFromCart(session, entities) {
    const cart = this._ensureCart(session);

    if (cart.items.length === 0) {
      return { removed: false, cart };
    }

    let removed = false;

    if (entities.product_id) {
      const nextItems = cart.items.filter((item) => String(item.productId) !== String(entities.product_id));
      removed = nextItems.length !== cart.items.length;
      cart.items = nextItems;
    } else {
      removed = cart.items.length > 0;
      cart.items = [];
    }

    return { removed, cart };
  }

  async _checkout(session, metadata) {
    const ordersAdapter = this.adapters.orders;
    if (!ordersAdapter) {
      throw new Error('Order adapter is required for checkout.');
    }

    const cart = this._ensureCart(session);
    if (cart.items.length === 0) {
      throw new Error('Cart is empty.');
    }

    const customer = await this._resolveCustomer(session, metadata.customer || {});
    const totals = await ordersAdapter.calculateTotals(cart.items, customer);

    const order = await ordersAdapter.createOrder({
      items: cart.items,
      customer,
      totals
    });

    let payment = null;
    if (this.adapters.payments) {
      payment = await this.adapters.payments.createPayment({
        amount: Math.round(toNumber(totals.total, 0) * 100),
        currency: this.config.business?.currency || 'USD',
        orderId: order.id,
        customer
      });
    }

    cart.items = [];

    return {
      order,
      payment,
      totals
    };
  }

  async _submitPaymentReceipt(entities, metadata) {
    const paymentsAdapter = this.adapters.payments;
    if (!paymentsAdapter) {
      throw new Error('Payment adapter is required for receipt verification.');
    }

    const orderId = entities.order_id || metadata.orderId || metadata.order_id;
    const receiptUrl = entities.receipt_url
      || metadata.receiptUrl
      || metadata.receiptURL
      || metadata.imageUrl
      || metadata.image_url;

    if (!orderId) {
      throw new Error('Order ID is required to verify a receipt.');
    }

    if (!receiptUrl) {
      throw new Error('Receipt URL/path is required to verify a payment receipt.');
    }

    const ordersAdapter = this.adapters.orders;
    let order = null;
    if (ordersAdapter && typeof ordersAdapter.getOrder === 'function') {
      order = await ordersAdapter.getOrder(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} was not found.`);
      }
    }

    const analysis = await this._analyzeReceiptWithVision({
      orderId,
      receiptUrl,
      order,
      paymentId: entities.payment_id || metadata.paymentId || metadata.payment_id
    });

    const decision = this._decideReceiptOutcome(analysis.confidence);
    const paymentStatus = statusFromDecision(decision);

    const processed = await paymentsAdapter.processReceipt(orderId, receiptUrl, {
      decision,
      confidence: analysis.confidence,
      reason: analysis.reason,
      status: paymentStatus,
      analysis: {
        validity: analysis.validity,
        raw: analysis.raw
      }
    });

    return {
      orderId,
      receiptUrl,
      decision,
      confidence: analysis.confidence,
      paymentStatus: processed?.status || paymentStatus,
      verified: typeof processed?.verified === 'boolean' ? processed.verified : decision === 'approved',
      reason: analysis.reason,
      validity: analysis.validity
    };
  }

  async _analyzeReceiptWithVision(payload) {
    if (!this.llm || typeof this.llm.analyzeImage !== 'function') {
      return {
        confidence: 0.5,
        validity: 'unclear',
        reason: 'Vision model is unavailable, pending manual verification.',
        raw: null
      };
    }

    const prompt = this._buildReceiptVisionPrompt(payload);

    try {
      const raw = await this.llm.analyzeImage(payload.receiptUrl, prompt, { temperature: 0.1 });
      const parsed = extractJSONBlock(raw);

      if (parsed) {
        const confidence = clamp01(
          parsed.validity_score ?? parsed.confidence ?? parsed.score,
          0.5
        );
        const validity = String(parsed.validity || parsed.classification || 'unclear').toLowerCase();

        return {
          confidence,
          validity: ['valid', 'invalid', 'unclear'].includes(validity) ? validity : 'unclear',
          reason: parsed.reason || parsed.summary || 'Receipt analysis completed.',
          raw
        };
      }

      const inferredConfidence = this._extractConfidenceFromRaw(raw);
      return {
        confidence: inferredConfidence,
        validity: 'unclear',
        reason: String(raw || 'Receipt analysis completed.').trim().slice(0, 300),
        raw
      };
    } catch (error) {
      return {
        confidence: 0.5,
        validity: 'unclear',
        reason: `Vision analysis failed: ${error.message}`,
        raw: null
      };
    }
  }

  _buildReceiptVisionPrompt({ orderId, order, paymentId }) {
    const configuredPrompt = this.config.payments?.visionPrompt
      || 'Assess whether this image is a valid payment receipt for the provided order details.';
    const orderTotal = order?.totals?.total ?? null;
    const currency = this.config.business?.currency || 'USD';

    return `${configuredPrompt}

Order context:
- order_id: ${orderId}
- order_number: ${order?.orderNumber || 'unknown'}
- expected_total: ${orderTotal !== null ? `${orderTotal} ${currency}` : 'unknown'}
- payment_id: ${paymentId || order?.paymentId || 'unknown'}

Return JSON only in this schema:
{
  "validity_score": 0.0,
  "validity": "valid|invalid|unclear",
  "reason": "short explanation"
}

Rules:
- validity_score is probability that this image is acceptable proof of payment for this order.
- Use 0 when clearly invalid and 1 when clearly valid.
- If unsure, set validity to "unclear" and score between 0.4 and 0.6.`;
  }

  _extractConfidenceFromRaw(raw) {
    const text = String(raw || '');
    const match = text.match(/\b(0(?:\.\d+)?|1(?:\.0+)?)\b/);
    if (!match) {
      return 0.5;
    }
    return clamp01(match[1], 0.5);
  }

  _decideReceiptOutcome(confidence) {
    const approveThreshold = clamp01(this.config.payments?.autoApproveThreshold, 0.85);
    let rejectThreshold = clamp01(this.config.payments?.autoRejectThreshold, 0.35);

    if (rejectThreshold > approveThreshold) {
      rejectThreshold = Math.max(0, approveThreshold - 0.05);
    }

    const normalizedConfidence = clamp01(confidence, 0.5);
    if (normalizedConfidence >= approveThreshold) {
      return 'approved';
    }
    if (normalizedConfidence <= rejectThreshold) {
      return 'rejected';
    }
    return normalizeDecision('pending');
  }

  async _trackOrder(entities, metadata) {
    const ordersAdapter = this.adapters.orders;
    if (!ordersAdapter) {
      throw new Error('Order adapter is required for order tracking.');
    }

    const orderId = entities.order_id || metadata.orderId;
    if (!orderId) {
      throw new Error('Order ID is required to track an order.');
    }

    const order = await ordersAdapter.getOrder(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} was not found.`);
    }

    return {
      order: {
        ...order,
        status: normalizeStatus(order)
      }
    };
  }

  async _resolveCustomer(session, customerOverride) {
    const customersAdapter = this.adapters.customers;
    const candidate = {
      ...(session.customer || {}),
      ...(customerOverride || {})
    };

    if (!customersAdapter) {
      session.customer = candidate;
      return candidate;
    }

    const identifier = {
      email: candidate.email,
      phone: candidate.phone,
      name: candidate.name,
      address: candidate.address
    };

    if (!identifier.email && !identifier.phone) {
      return candidate;
    }

    const customer = await customersAdapter.getOrCreateCustomer(identifier);
    session.customer = customer;
    return customer;
  }

  _ensureCart(session) {
    if (!session.cart || !Array.isArray(session.cart.items)) {
      session.cart = { items: [] };
    }
    return session.cart;
  }
}
