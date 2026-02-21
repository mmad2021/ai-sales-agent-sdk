import { PaymentAdapter } from '../base/PaymentAdapter.js';
import { SQLiteClient } from './SQLiteClient.js';

function generatePaymentId() {
  const random = Math.random().toString(36).slice(2, 8);
  return `pay_${Date.now()}_${random}`;
}

export class SQLitePaymentAdapter extends PaymentAdapter {
  constructor(options = {}) {
    super();
    this.client = options.client || new SQLiteClient(options);
    this.checkoutBaseUrl = options.checkoutBaseUrl || 'https://payments.example.com/checkout';
  }

  async createPayment(paymentData) {
    const order = await this.client.queryOne('SELECT id FROM orders WHERE id = ?', [paymentData.orderId]);
    if (!order) {
      throw new Error(`Order ${paymentData.orderId} not found.`);
    }

    const paymentId = generatePaymentId();
    const paymentLink = `${this.checkoutBaseUrl}/${paymentId}`;

    await this.client.run(
      `UPDATE orders
       SET payment_id = ?,
           payment_link = ?,
           payment_status = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [paymentId, paymentLink, 'pending', paymentData.orderId]
    );

    await this.client.save();

    return {
      id: paymentId,
      orderId: paymentData.orderId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: 'pending',
      paymentLink,
      createdAt: new Date()
    };
  }

  async verifyPayment(paymentId) {
    const row = await this.client.queryOne(
      'SELECT payment_status FROM orders WHERE payment_id = ?',
      [paymentId]
    );

    if (!row) {
      return { status: 'not_found', verified: false };
    }

    const status = row.payment_status || 'pending';
    return {
      status,
      verified: status === 'paid' || status === 'completed'
    };
  }

  async processReceipt(orderId, receiptUrl) {
    const hasTable = await this.client.tableExists('payment_verifications');

    if (hasTable) {
      await this.client.run(
        `INSERT INTO payment_verifications (order_id, image_path, status)
         VALUES (?, ?, ?)`,
        [orderId, receiptUrl, 'pending']
      );
    }

    await this.client.run(
      `UPDATE orders
       SET payment_status = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      ['pending_verification', orderId]
    );

    await this.client.save();

    return {
      verified: false,
      status: 'pending_verification'
    };
  }
}
