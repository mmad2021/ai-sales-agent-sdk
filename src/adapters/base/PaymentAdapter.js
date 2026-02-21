/**
 * Abstract interface for payment processing
 */
export class PaymentAdapter {
  /**
   * Create payment intent/link
   * @param {Object} paymentData
   * @param {number} paymentData.amount - Amount in cents/smallest currency unit
   * @param {string} paymentData.currency - 'USD', 'MMK', etc.
   * @param {string|number} paymentData.orderId
   * @param {Object} paymentData.customer
   * @returns {Promise<Payment>}
   */
  async createPayment(paymentData) {
    throw new Error('Must implement createPayment()');
  }

  /**
   * Verify payment status
   * @param {string} paymentId
   * @returns {Promise<{status: string, verified: boolean}>}
   */
  async verifyPayment(paymentId) {
    throw new Error('Must implement verifyPayment()');
  }

  /**
   * Process payment receipt/proof (for manual verification)
   * @param {string|number} orderId
   * @param {string} receiptUrl - URL/path to receipt image
   * @returns {Promise<{verified: boolean, status: string}>}
   */
  async processReceipt(orderId, receiptUrl) {
    throw new Error('Must implement processReceipt()');
  }
}
