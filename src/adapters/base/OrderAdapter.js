/**
 * Abstract interface for order management
 */
export class OrderAdapter {
  /**
   * Create a new order
   * @param {Object} orderData
   * @param {Array} orderData.items - Cart items
   * @param {Object} orderData.customer - Customer info
   * @param {Object} orderData.totals - Calculated totals
   * @returns {Promise<Order>}
   */
  async createOrder(orderData) {
    throw new Error('Must implement createOrder()');
  }

  /**
   * Get order by ID
   * @param {string|number} orderId
   * @returns {Promise<Order>}
   */
  async getOrder(orderId) {
    throw new Error('Must implement getOrder()');
  }

  /**
   * Update order status
   * @param {string|number} orderId
   * @param {string} status - 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
   * @param {string} notes - Optional status change notes
   * @returns {Promise<Order>}
   */
  async updateOrderStatus(orderId, status, notes = null) {
    throw new Error('Must implement updateOrderStatus()');
  }

  /**
   * Calculate order totals (subtotal, tax, shipping, total)
   * @param {Array} items - Cart items
   * @param {Object} customer - Customer info (for tax/shipping calculation)
   * @returns {Promise<Totals>}
   */
  async calculateTotals(items, customer) {
    throw new Error('Must implement calculateTotals()');
  }

  /**
   * Get customer's order history
   * @param {string} customerId
   * @param {number} limit
   * @returns {Promise<Order[]>}
   */
  async getCustomerOrders(customerId, limit = 10) {
    throw new Error('Must implement getCustomerOrders()');
  }
}
