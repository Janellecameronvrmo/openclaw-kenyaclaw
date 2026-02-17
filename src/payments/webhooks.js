/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PAYMENT WEBHOOK HANDLERS
 * Express middleware for M-Pesa and Paystack webhooks
 * ═══════════════════════════════════════════════════════════════════════════
 */

const crypto = require('crypto');

class PaymentWebhookHandler {
  constructor(mpesaService, paystackService, options = {}) {
    this.mpesa = mpesaService;
    this.paystack = paystackService;
    this.options = {
      validateSignatures: true,
      onPaymentSuccess: null,
      onPaymentFailed: null,
      ...options
    };
  }

  // Express middleware for M-Pesa webhooks
  mpesaMiddleware() {
    return async (req, res) => {
      try {
        console.log('[Webhook] M-Pesa callback received:', req.path);
        
        // Always acknowledge receipt quickly
        res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

        const data = req.body;
        let result;

        // Route based on path
        if (req.path.includes('stk')) {
          result = this.mpesa.handleStkCallback(data);
        } else if (req.path.includes('c2b/validate')) {
          result = this.mpesa.handleC2BValidation(data);
        } else if (req.path.includes('c2b/confirm')) {
          result = this.mpesa.handleC2BConfirmation(data);
        } else if (req.path.includes('b2c')) {
          result = this.mpesa.handleB2CResult(data);
        }

        // Trigger callback handlers
        if (result?.transaction) {
          if (result.transaction.status === 'completed' && this.options.onPaymentSuccess) {
            await this.options.onPaymentSuccess('mpesa', result.transaction);
          } else if (result.transaction.status === 'failed' && this.options.onPaymentFailed) {
            await this.options.onPaymentFailed('mpesa', result.transaction);
          }
        }

      } catch (error) {
        console.error('[Webhook] M-Pesa error:', error);
        // Already sent 200, just log
      }
    };
  }

  // Express middleware for Paystack webhooks
  paystackMiddleware() {
    return async (req, res) => {
      try {
        console.log('[Webhook] Paystack callback received');

        // Validate signature
        if (this.options.validateSignatures) {
          const signature = req.headers['x-paystack-signature'];
          const hash = crypto.createHmac('sha512', this.paystack.secretKey)
            .update(JSON.stringify(req.body))
            .digest('hex');

          if (signature !== hash) {
            console.error('[Webhook] Invalid Paystack signature');
            return res.status(401).json({ error: 'Invalid signature' });
          }
        }

        // Always acknowledge receipt
        res.status(200).send('OK');

        const event = req.body.event;
        const data = req.body.data;

        // Process webhook
        const result = this.paystack.handleWebhook(event, data);

        // Trigger callback handlers
        if (result.transaction) {
          if (result.event === 'charge.success' && this.options.onPaymentSuccess) {
            await this.options.onPaymentSuccess('paystack', result.transaction);
          } else if (result.event === 'charge.failed' && this.options.onPaymentFailed) {
            await this.options.onPaymentFailed('paystack', result.transaction);
          }
        }

      } catch (error) {
        console.error('[Webhook] Paystack error:', error);
      }
    };
  }

  // Combined router setup helper
  setupRoutes(app) {
    // M-Pesa webhooks
    app.post('/webhooks/mpesa/stk', this.mpesaMiddleware());
    app.post('/webhooks/mpesa/c2b/validate', this.mpesaMiddleware());
    app.post('/webhooks/mpesa/c2b/confirm', this.mpesaMiddleware());
    app.post('/webhooks/mpesa/b2c/result', this.mpesaMiddleware());
    app.post('/webhooks/mpesa/b2c/timeout', this.mpesaMiddleware());

    // Paystack webhooks
    app.post('/webhooks/paystack', this.paystackMiddleware());

    console.log('[Webhook] Routes configured:');
    console.log('  - POST /webhooks/mpesa/stk');
    console.log('  - POST /webhooks/mpesa/c2b/validate');
    console.log('  - POST /webhooks/mpesa/c2b/confirm');
    console.log('  - POST /webhooks/paystack');
  }
}

module.exports = { PaymentWebhookHandler };
