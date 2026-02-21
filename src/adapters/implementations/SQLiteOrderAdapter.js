import { OrderAdapter } from '../base/OrderAdapter.js';
import { SQLiteClient } from './SQLiteClient.js';

function toAmount(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function parseItems(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return [];
  }
}

export class SQLiteOrderAdapter extends OrderAdapter {
  constructor(options = {}) {
    super();
    this.client = options.client || new SQLiteClient(options);
    this.taxRate = options.taxRate ?? 0.08;
    this.freeShippingThreshold = options.freeShippingThreshold ?? 50;
    this.defaultShippingCost = options.defaultShippingCost ?? 5;
  }

  async createOrder(orderData) {
    const items = orderData.items || [];
    if (!items.length) {
      throw new Error('Cannot create order with empty items.');
    }

    const customer = orderData.customer || {};
    const totals = orderData.totals || await this.calculateTotals(items, customer);

    await this._assertStock(items);

    const db = await this.client.getDB();
    db.run('BEGIN TRANSACTION');

    try {
      await this.client.run(
        `INSERT INTO orders (
          order_number, customer_id, customer_name, customer_email, customer_phone, customer_address,
          items, subtotal, tax, shipping, total, status, payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'PENDING',
          customer.id || null,
          customer.name || null,
          customer.email || null,
          customer.phone || null,
          this._serializeAddress(customer.address),
          JSON.stringify(items),
          toAmount(totals.subtotal),
          toAmount(totals.tax),
          toAmount(totals.shipping),
          toAmount(totals.total),
          'pending',
          'pending'
        ]
      );

      const orderId = await this.client.lastInsertId();
      const orderNumber = this._toOrderNumber(orderId);

      await this.client.run('UPDATE orders SET order_number = ? WHERE id = ?', [orderNumber, orderId]);

      await this._deductInventory(items, orderId);

      db.run('COMMIT');
      await this.client.save();

      return this.getOrder(orderId);
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  }

  async getOrder(orderId) {
    const row = await this.client.queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
    return row ? this._mapOrder(row) : null;
  }

  async updateOrderStatus(orderId, status, notes = null) {
    await this.client.run(
      `UPDATE orders
       SET status = ?,
           notes = COALESCE(?, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, notes, orderId]
    );

    await this.client.save();
    return this.getOrder(orderId);
  }

  async calculateTotals(items, _customer) {
    const subtotal = toAmount(items.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const qty = Number(item.quantity) || 0;
      return sum + (price * qty);
    }, 0));

    const tax = toAmount(subtotal * this.taxRate);
    const shipping = subtotal >= this.freeShippingThreshold ? 0 : this.defaultShippingCost;
    const total = toAmount(subtotal + tax + shipping);

    return {
      subtotal,
      tax,
      shipping: toAmount(shipping),
      total
    };
  }

  async getCustomerOrders(customerId, limit = 10) {
    const rows = await this.client.query(
      `SELECT * FROM orders
       WHERE customer_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [customerId, limit]
    );

    return rows.map((row) => this._mapOrder(row));
  }

  async _assertStock(items) {
    for (const item of items) {
      const product = await this.client.queryOne('SELECT id, name, stock FROM products WHERE id = ?', [item.productId]);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      if (Number(product.stock) < Number(item.quantity)) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
      }
    }
  }

  async _deductInventory(items, orderId) {
    const hasInventoryLog = await this.client.tableExists('inventory_log');

    for (const item of items) {
      const row = await this.client.queryOne('SELECT stock FROM products WHERE id = ?', [item.productId]);
      const previousStock = Number(row.stock) || 0;
      const quantity = Number(item.quantity) || 0;
      const newStock = previousStock - quantity;

      await this.client.run(
        `UPDATE products
         SET stock = ?,
             status = CASE WHEN ? <= 0 THEN 'out_of_stock' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newStock, newStock, item.productId]
      );

      if (hasInventoryLog) {
        await this.client.run(
          `INSERT INTO inventory_log (
            product_id, change_amount, previous_stock, new_stock, change_type, order_id
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [item.productId, -quantity, previousStock, newStock, 'order', orderId]
        );
      }
    }
  }

  _mapOrder(row) {
    const items = parseItems(row.items).map((item) => ({
      productId: item.productId || item.product_id,
      name: item.name,
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 0,
      color: item.color || null,
      size: item.size || null
    }));

    return {
      id: row.id,
      orderNumber: row.order_number || this._toOrderNumber(row.id),
      customer: {
        id: row.customer_id,
        name: row.customer_name,
        email: row.customer_email,
        phone: row.customer_phone,
        address: this._parseAddress(row.customer_address)
      },
      items,
      totals: {
        subtotal: Number(row.subtotal) || 0,
        tax: Number(row.tax) || 0,
        shipping: Number(row.shipping) || 0,
        total: Number(row.total) || 0
      },
      status: row.status,
      paymentStatus: row.payment_status || 'pending',
      createdAt: row.created_at ? new Date(row.created_at) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null
    };
  }

  _toOrderNumber(orderId) {
    return `ORD-${String(orderId).padStart(6, '0')}`;
  }

  _serializeAddress(address) {
    if (!address) {
      return null;
    }

    if (typeof address === 'string') {
      return address;
    }

    return JSON.stringify(address);
  }

  _parseAddress(value) {
    if (!value) {
      return null;
    }

    if (typeof value === 'object') {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch (_error) {
      return { raw: value };
    }
  }
}
