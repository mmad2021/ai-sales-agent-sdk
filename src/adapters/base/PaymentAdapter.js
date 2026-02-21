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
   * @param {Object} verification
   * @param {'approved'|'rejected'|'pending'} verification.decision
   * @param {number} verification.confidence - 0..1 score
   * @param {string} verification.reason
   * @param {string} verification.status
   * @returns {Promise<{verified: boolean, status: string, decision?: string, confidence?: number}>}
   */
  async processReceipt(orderId, receiptUrl, verification = {}) {
    throw new Error('Must implement processReceipt()');
  }
}
