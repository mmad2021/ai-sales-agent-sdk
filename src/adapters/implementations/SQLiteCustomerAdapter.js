import { CustomerAdapter } from '../base/CustomerAdapter.js';
import { SQLiteClient } from './SQLiteClient.js';

export class SQLiteCustomerAdapter extends CustomerAdapter {
  constructor(options = {}) {
    super();
    this.client = options.client || new SQLiteClient(options);
  }

  async getCustomer(customerId) {
    const row = await this.client.queryOne('SELECT * FROM customers WHERE id = ?', [customerId]);
    return row ? this._mapCustomer(row) : null;
  }

  async getOrCreateCustomer(identifier) {
    if (!identifier?.email && !identifier?.phone) {
      throw new Error('Customer identifier requires email or phone.');
    }

    let row = null;

    if (identifier.email) {
      row = await this.client.queryOne('SELECT * FROM customers WHERE email = ?', [identifier.email]);
    }

    if (!row && identifier.phone) {
      row = await this.client.queryOne('SELECT * FROM customers WHERE phone = ?', [identifier.phone]);
    }

    if (row) {
      return this._mapCustomer(row);
    }

    await this.client.run(
      `INSERT INTO customers (name, email, phone, address, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [
        identifier.name || 'Guest Customer',
        identifier.email || null,
        identifier.phone || null,
        this._serializeAddress(identifier.address),
        JSON.stringify(identifier.metadata || {})
      ]
    );

    const id = await this.client.lastInsertId();
    await this.client.save();
    return this.getCustomer(id);
  }

  async updateCustomer(customerId, data) {
    const existing = await this.getCustomer(customerId);
    if (!existing) {
      throw new Error(`Customer ${customerId} not found.`);
    }

    await this.client.run(
      `UPDATE customers
       SET name = ?,
           email = ?,
           phone = ?,
           address = ?,
           metadata = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.name ?? existing.name,
        data.email ?? existing.email,
        data.phone ?? existing.phone,
        this._serializeAddress(data.address ?? existing.address),
        JSON.stringify(data.metadata ?? existing.metadata ?? {}),
        customerId
      ]
    );

    await this.client.save();
    return this.getCustomer(customerId);
  }

  async getOrderHistory(customerId) {
    const rows = await this.client.query(
      `SELECT * FROM orders
       WHERE customer_id = ?
       ORDER BY created_at DESC`,
      [customerId]
    );

    return rows.map((row) => ({
      id: row.id,
      orderNumber: row.order_number,
      status: row.status,
      paymentStatus: row.payment_status,
      totals: {
        subtotal: Number(row.subtotal) || 0,
        tax: Number(row.tax) || 0,
        shipping: Number(row.shipping) || 0,
        total: Number(row.total) || 0
      },
      createdAt: row.created_at ? new Date(row.created_at) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null
    }));
  }

  _mapCustomer(row) {
    return {
      id: row.id,
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      address: this._parseAddress(row.address),
      createdAt: row.created_at ? new Date(row.created_at) : null,
      metadata: this._parseMetadata(row.metadata)
    };
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

  _parseMetadata(value) {
    if (!value) {
      return {};
    }

    if (typeof value === 'object') {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch (_error) {
      return {};
    }
  }
}
