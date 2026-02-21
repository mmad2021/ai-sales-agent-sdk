import { PaymentAdapter } from '../base/PaymentAdapter.js';
import { SQLiteClient } from './SQLiteClient.js';

function generatePaymentId() {
  const random = Math.random().toString(36).slice(2, 8);
  return `pay_${Date.now()}_${random}`;
}

function clampConfidence(value, fallback = null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, parsed));
}

function normalizeDecision(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'approve' || normalized === 'approved') {
    return 'approved';
  }
  if (normalized === 'reject' || normalized === 'rejected') {
    return 'rejected';
  }
  return 'pending';
}

function statusFromDecision(decision) {
  if (decision === 'approved') {
    return 'paid';
  }
  if (decision === 'rejected') {
    return 'verification_rejected';
  }
  return 'pending_verification';
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

  async processReceipt(orderId, receiptUrl, verification = {}) {
    const order = await this.client.queryOne('SELECT id FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      throw new Error(`Order ${orderId} not found.`);
    }

    const decision = normalizeDecision(verification.decision);
    const confidence = clampConfidence(verification.confidence, null);
    const reason = verification.reason || null;
    const status = verification.status || statusFromDecision(decision);

    const hasTable = await this.client.tableExists('payment_verifications');

    if (hasTable) {
      const tableColumns = await this.client.query('PRAGMA table_info(payment_verifications)');
      const availableColumns = new Set(tableColumns.map((col) => col.name));

      const insertData = {
        order_id: orderId,
        image_path: receiptUrl,
        status
      };

      if (availableColumns.has('llm_confidence')) {
        insertData.llm_confidence = confidence;
      }
      if (availableColumns.has('decision')) {
        insertData.decision = decision;
      }
      if (availableColumns.has('reason')) {
        insertData.reason = reason;
      }
      if (availableColumns.has('metadata')) {
        insertData.metadata = verification.analysis ? JSON.stringify(verification.analysis) : null;
      }
      if (availableColumns.has('reviewed_at')) {
        insertData.reviewed_at = status === 'pending_verification' ? null : new Date().toISOString();
      }

      const columns = Object.keys(insertData);
      const placeholders = columns.map(() => '?');
      const values = columns.map((column) => insertData[column]);

      await this.client.run(
        `INSERT INTO payment_verifications (${columns.join(', ')})
         VALUES (${placeholders.join(', ')})`,
        values
      );
    }

    await this.client.run(
      `UPDATE orders
       SET payment_status = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, orderId]
    );

    await this.client.save();

    return {
      verified: status === 'paid' || status === 'completed',
      status,
      decision,
      confidence
    };
  }
}
