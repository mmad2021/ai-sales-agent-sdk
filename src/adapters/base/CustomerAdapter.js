/**
 * Abstract interface for customer data
 */
export class CustomerAdapter {
  /**
   * Get customer by ID
   * @param {string|number} customerId
   * @returns {Promise<Customer>}
   */
  async getCustomer(customerId) {
    throw new Error('Must implement getCustomer()');
  }

  /**
   * Get or create customer by email/phone
   * @param {Object} identifier - { email?, phone? }
   * @returns {Promise<Customer>}
   */
  async getOrCreateCustomer(identifier) {
    throw new Error('Must implement getOrCreateCustomer()');
  }

  /**
   * Update customer profile
   * @param {string|number} customerId
   * @param {Object} data - Fields to update
   * @returns {Promise<Customer>}
   */
  async updateCustomer(customerId, data) {
    throw new Error('Must implement updateCustomer()');
  }

  /**
   * Get customer's order history
   * @param {string|number} customerId
   * @returns {Promise<Order[]>}
   */
  async getOrderHistory(customerId) {
    throw new Error('Must implement getOrderHistory()');
  }
}
