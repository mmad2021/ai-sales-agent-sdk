import { ProductAdapter } from '../base/ProductAdapter.js';
import { SQLiteClient } from './SQLiteClient.js';

function parseJsonArray(value) {
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

export class SQLiteProductAdapter extends ProductAdapter {
  constructor(options = {}) {
    super();
    this.client = options.client || new SQLiteClient(options);
  }

  async searchProducts(query, filters = {}) {
    const conditions = [];
    const params = [];

    if (query) {
      conditions.push('(name LIKE ? OR description LIKE ? OR category LIKE ?)');
      const like = `%${query}%`;
      params.push(like, like, like);
    }

    if (filters.category) {
      conditions.push('category = ?');
      params.push(filters.category);
    }

    if (filters.minPrice !== undefined) {
      conditions.push('price >= ?');
      params.push(filters.minPrice);
    }

    if (filters.maxPrice !== undefined) {
      conditions.push('price <= ?');
      params.push(filters.maxPrice);
    }

    if (!filters.includeInactive) {
      conditions.push('status = ?');
      params.push('active');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.client.query(`SELECT * FROM products ${where} ORDER BY id`, params);
    return rows.map((row) => this._mapProduct(row));
  }

  async getProduct(productId) {
    const row = await this.client.queryOne('SELECT * FROM products WHERE id = ?', [productId]);
    return row ? this._mapProduct(row) : null;
  }

  async checkAvailability(productId, quantity) {
    const product = await this.getProduct(productId);
    if (!product) {
      return { available: false, stock: 0 };
    }

    return {
      available: product.stock >= quantity && product.status === 'active',
      stock: product.stock
    };
  }

  async listCategories() {
    const rows = await this.client.query(
      `SELECT DISTINCT category FROM products
       WHERE category IS NOT NULL AND category != ''
       ORDER BY category`
    );

    return rows.map((row) => ({ name: row.category, slug: String(row.category).toLowerCase().replace(/\s+/g, '-') }));
  }

  async getRelatedProducts(productId, limit = 5) {
    const product = await this.getProduct(productId);
    if (!product) {
      return [];
    }

    let rows;
    if (product.category) {
      rows = await this.client.query(
        `SELECT * FROM products
         WHERE category = ? AND id != ? AND status = ?
         ORDER BY id DESC
         LIMIT ?`,
        [product.category, product.id, 'active', limit]
      );
    } else {
      rows = await this.client.query(
        'SELECT * FROM products WHERE id != ? AND status = ? ORDER BY id DESC LIMIT ?',
        [product.id, 'active', limit]
      );
    }

    return rows.map((row) => this._mapProduct(row));
  }

  _mapProduct(row) {
    const colors = parseJsonArray(row.colors);
    const sizes = parseJsonArray(row.sizes);

    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      price: Number(row.price) || 0,
      stock: Number(row.stock) || 0,
      category: row.category || null,
      images: row.image_url ? [row.image_url] : [],
      attributes: {
        color: colors,
        size: sizes
      },
      status: row.status || ((Number(row.stock) || 0) > 0 ? 'active' : 'out_of_stock')
    };
  }
}
