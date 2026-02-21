function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

export class ActionExecutor {
  constructor(options = {}) {
    this.adapters = options.adapters || {};
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
