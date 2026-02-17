/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KENYACLAW PAYMENTS MODULE
 * Unified payment processing for Africa
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { MpesaService } = require('./mpesa');
const { PaystackService } = require('./paystack');
const { PaymentWebhookHandler } = require('./webhooks');
const { TransactionProcessor } = require('./transaction-processor');

class KenyaClawPayments {
  constructor(config = {}) {
    // Initialize services
    this.mpesa = new MpesaService(config.mpesa);
    this.paystack = new PaystackService(config.paystack);
    
    // Initialize processor
    this.processor = new TransactionProcessor(
      this.mpesa,
      this.paystack,
      { swarm: config.swarm, db: config.db }
    );
    
    // Initialize webhook handler
    this.webhooks = new PaymentWebhookHandler(
      this.mpesa,
      this.paystack,
      {
        onPaymentSuccess: this.handlePaymentSuccess.bind(this),
        onPaymentFailed: this.handlePaymentFailed.bind(this)
      }
    );
  }

  // Quick payment methods
  async payWithMpesa(phoneNumber, amount, metadata = {}) {
    return this.processor.processPayment({
      type: 'invoice_payment',
      provider: 'mpesa',
      country: 'KE',
      amount: amount,
      currency: 'KES',
      customerPhone: phoneNumber,
      metadata: metadata
    });
  }

  async payWithPaystack(email, amount, currency = 'NGN', metadata = {}) {
    return this.processor.processPayment({
      type: 'invoice_payment',
      provider: 'paystack',
      country: currency === 'NGN' ? 'NG' : 'GH',
      amount: amount,
      currency: currency,
      customerEmail: email,
      metadata: metadata
    });
  }

  // Smart payment - auto-select provider
  async processPayment(params) {
    return this.processor.processPayment(params);
  }

  // Verify payment status
  async verifyPayment(transactionId) {
    return this.processor.getTransactionStatus(transactionId);
  }

  // Refund payment
  async refund(transactionId, amount, reason) {
    return this.processor.processRefund({
      originalTransactionId: transactionId,
      amount: amount,
      reason: reason
    });
  }

  // Handle successful payment
  async handlePaymentSuccess(provider, transaction) {
    console.log(`[Payments] Success: ${provider} - ${transaction.id}`);
    
    // Update invoice if applicable
    if (transaction.metadata?.invoiceId) {
      console.log(`[Payments] Updating invoice: ${transaction.metadata.invoiceId}`);
      // Update database
    }
    
    // Notify customer
    if (transaction.customerPhone || transaction.customerEmail) {
      console.log(`[Payments] Notifying customer`);
      // Send notification
    }
  }

  // Handle failed payment
  async handlePaymentFailed(provider, transaction) {
    console.log(`[Payments] Failed: ${provider} - ${transaction.id}`);
    
    // Retry logic for certain failures
    if (transaction.resultCode === '17') { // User cancelled
      console.log('[Payments] User cancelled - no retry');
    } else {
      console.log('[Payments] Scheduling retry');
      // Schedule retry
    }
  }

  // Setup Express routes
  setupRoutes(app) {
    this.webhooks.setupRoutes(app);
    
    // API routes
    app.post('/api/payments/mpesa', async (req, res) => {
      try {
        const result = await this.payWithMpesa(
          req.body.phoneNumber,
          req.body.amount,
          req.body.metadata
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.post('/api/payments/paystack', async (req, res) => {
      try {
        const result = await this.payWithPaystack(
          req.body.email,
          req.body.amount,
          req.body.currency,
          req.body.metadata
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.get('/api/payments/verify/:transactionId', async (req, res) => {
      try {
        const result = await this.verifyPayment(req.params.transactionId);
        res.json(result);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    console.log('[Payments] API routes configured');
  }

  // Get service status
  getStatus() {
    return {
      mpesa: { environment: this.mpesa.environment },
      paystack: { initialized: !!this.paystack.secretKey },
      transactions: {
        mpesa: this.mpesa.transactions.size,
        paystack: this.paystack.transactions.size
      }
    };
  }
}

// Factory function
function createPayments(config = {}) {
  return new KenyaClawPayments(config);
}

module.exports = {
  KenyaClawPayments,
  createPayments,
  MpesaService,
  PaystackService,
  PaymentWebhookHandler,
  TransactionProcessor
};
