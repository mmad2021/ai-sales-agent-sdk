/**
 * Abstract interface for product catalog operations
 */
export class ProductAdapter {
  /**
   * Search products by query and filters
   * @param {string} query - Search query
   * @param {Object} filters - Filters (category, price range, etc.)
   * @returns {Promise<Product[]>}
   */
  async searchProducts(query, filters = {}) {
    throw new Error('Must implement searchProducts()');
  }

  /**
   * Get product by ID
   * @param {string|number} productId
   * @returns {Promise<Product>}
   */
  async getProduct(productId) {
    throw new Error('Must implement getProduct()');
  }

  /**
   * Check stock availability
   * @param {string|number} productId
   * @param {number} quantity
   * @returns {Promise<{available: boolean, stock: number}>}
   */
  async checkAvailability(productId, quantity) {
    throw new Error('Must implement checkAvailability()');
  }

  /**
   * List all product categories
   * @returns {Promise<Category[]>}
   */
  async listCategories() {
    throw new Error('Must implement listCategories()');
  }

  /**
   * Get related/recommended products
   * @param {string|number} productId
   * @param {number} limit
   * @returns {Promise<Product[]>}
   */
  async getRelatedProducts(productId, limit = 5) {
    throw new Error('Must implement getRelatedProducts()');
  }
}
