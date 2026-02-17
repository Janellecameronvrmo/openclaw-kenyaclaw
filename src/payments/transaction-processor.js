/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TRANSACTION PROCESSOR
 * Central coordinator for all payment operations
 * Integrates with Agent Swarm for intelligent processing
 * ═══════════════════════════════════════════════════════════════════════════
 */

class TransactionProcessor {
  constructor(mpesaService, paystackService, options = {}) {
    this.mpesa = mpesaService;
    this.paystack = paystackService;
    this.swarm = options.swarm || null;
    this.db = options.db || null; // Database connection
    this.processors = new Map();
    
    // Register processors
    this.registerProcessor('invoice_payment', this.processInvoicePayment.bind(this));
    this.registerProcessor('subscription', this.processSubscription.bind(this));
    this.registerProcessor('refund', this.processRefund.bind(this));
    this.registerProcessor('payout', this.processPayout.bind(this));
  }

  registerProcessor(type, handler) {
    this.processors.set(type, handler);
  }

  // Main entry point for payment processing
  async processPayment(params) {
    const {
      type,           // 'invoice_payment', 'subscription', 'refund', 'payout'
      provider,       // 'mpesa', 'paystack', 'auto'
      country,        // 'KE', 'NG', 'GH', 'ZA', 'TZ'
      amount,
      currency,
      customerPhone,
      customerEmail,
      customerName,
      metadata = {}
    } = params;

    // Auto-select provider based on country
    const selectedProvider = provider === 'auto' 
      ? this.selectProvider(country) 
      : provider;

    console.log(`[Transaction] Processing ${type} via ${selectedProvider} for ${country}`);

    // Pre-process with agents if swarm available
    if (this.swarm) {
      const approval = await this.swarm.submitTask({
        type: 'payment_processing',
        amount: amount,
        customerTier: metadata.customerTier,
        riskLevel: this.assessRisk(params)
      });

      if (!approval.approved) {
        return { success: false, error: 'Payment not approved by council' };
      }
    }

    // Execute payment
    let result;
    if (selectedProvider === 'mpesa') {
      result = await this.processMpesaPayment(params);
    } else if (selectedProvider === 'paystack') {
      result = await this.processPaystackPayment(params);
    } else {
      return { success: false, error: 'Unsupported payment provider' };
    }

    // Post-process with agents
    if (result.success && this.swarm) {
      await this.swarm.submitTask({
        type: 'payment_completed',
        transactionId: result.transactionId,
        amount: amount,
        customerId: metadata.customerId
      });
    }

    return result;
  }

  selectProvider(country) {
    const providers = {
      'KE': 'mpesa',      // Kenya
      'TZ': 'mpesa',      // Tanzania
      'NG': 'paystack',   // Nigeria
      'GH': 'paystack',   // Ghana
      'ZA': 'paystack'    // South Africa
    };
    return providers[country] || 'paystack';
  }

  assessRisk(params) {
    let risk = 0;
    
    // Amount-based risk
    if (params.amount > 100000) risk += 0.3;
    else if (params.amount > 50000) risk += 0.2;
    else if (params.amount > 10000) risk += 0.1;
    
    // New customer risk
    if (params.metadata?.isNewCustomer) risk += 0.2;
    
    // International risk
    if (params.country !== 'KE' && params.country !== 'NG') risk += 0.1;
    
    return Math.min(risk, 1.0);
  }

  async processMpesaPayment(params) {
    const { customerPhone, amount, metadata } = params;
    
    const result = await this.mpesa.stkPush({
      phoneNumber: customerPhone,
      amount: amount,
      accountReference: metadata.invoiceId || metadata.orderId || 'KenyaClaw',
      transactionDesc: metadata.description || 'Payment'
    });

    if (result.success) {
      // Store in database
      await this.saveTransaction({
        id: result.transactionId,
        provider: 'mpesa',
        type: params.type,
        amount: amount,
        currency: 'KES',
        status: 'pending',
        customerPhone: customerPhone,
        metadata: metadata,
        checkoutRequestId: result.checkoutRequestId
      });
    }

    return result;
  }

  async processPaystackPayment(params) {
    const { customerEmail, customerPhone, amount, currency, metadata } = params;
    
    // For mobile money in Nigeria
    const channels = currency === 'NGN' && customerPhone 
      ? ['mobile_money', 'card', 'bank']
      : ['card', 'bank'];

    const result = await this.paystack.initializeTransaction({
      email: customerEmail,
      amount: amount,
      currency: currency,
      channels: channels,
      metadata: {
        customerName: params.customerName,
        customerPhone: customerPhone,
        invoiceId: metadata.invoiceId,
        orderId: metadata.orderId,
        ...metadata
      }
    });

    if (result.success) {
      await this.saveTransaction({
        id: result.transactionId,
        provider: 'paystack',
        type: params.type,
        amount: amount,
        currency: currency,
        status: 'pending',
        customerEmail: customerEmail,
        metadata: metadata,
        reference: result.reference
      });
    }

    return result;
  }

  async processInvoicePayment(params) {
    // Additional processing for invoice payments
    const { invoiceId, customerId } = params.metadata || {};
    
    if (invoiceId && this.db) {
      // Update invoice status
      await this.db.updateInvoice(invoiceId, { status: 'payment_pending' });
    }

    return this.processPayment(params);
  }

  async processSubscription(params) {
    // Set up recurring payment
    const result = await this.processPayment(params);
    
    if (result.success) {
      // Schedule next payment
      await this.scheduleNextPayment(params);
    }

    return result;
  }

  async processRefund(params) {
    const { originalTransactionId, amount, reason } = params;
    
    // Get original transaction
    const original = this.mpesa.getTransaction(originalTransactionId) || 
                    this.paystack.getTransaction(originalTransactionId);

    if (!original) {
      return { success: false, error: 'Original transaction not found' };
    }

    // Process refund via same provider
    let result;
    if (original.provider === 'paystack') {
      // Paystack refund API
      result = await this.paystack.refundTransaction(originalTransactionId, amount);
    } else {
      // M-Pesa B2C for refunds
      result = await this.mpesa.b2cPayment({
        phoneNumber: original.phoneNumber,
        amount: amount,
        remarks: `Refund: ${reason}`
      });
    }

    if (result.success) {
      await this.saveTransaction({
        type: 'refund',
        originalTransactionId: originalTransactionId,
        amount: amount,
        reason: reason,
        status: 'completed'
      });
    }

    return result;
  }

  async processPayout(params) {
    const { recipientPhone, recipientEmail, amount, country, reason } = params;
    
    const provider = this.selectProvider(country);
    let result;

    if (provider === 'mpesa') {
      result = await this.mpesa.b2cPayment({
        phoneNumber: recipientPhone,
        amount: amount,
        remarks: reason
      });
    } else {
      // Paystack transfer
      const recipient = await this.paystack.createTransferRecipient({
        type: 'mobile_money',
        name: params.recipientName,
        accountNumber: recipientPhone,
        bankCode: params.bankCode
      });

      if (recipient.success) {
        result = await this.paystack.initiateTransfer({
          recipient: recipient.recipientCode,
          amount: amount,
          reason: reason
        });
      }
    }

    return result || { success: false, error: 'Payout failed' };
  }

  async verifyPayment(provider, transactionId) {
    if (provider === 'mpesa') {
      return await this.mpesa.queryStkStatus(transactionId);
    } else if (provider === 'paystack') {
      return await this.paystack.verifyTransaction(transactionId);
    }
    return { success: false, error: 'Unknown provider' };
  }

  async saveTransaction(transaction) {
    if (this.db) {
      return await this.db.saveTransaction(transaction);
    }
    // In-memory fallback
    console.log('[Transaction] Saved:', transaction.id);
    return transaction;
  }

  async scheduleNextPayment(params) {
    // Implement recurring payment scheduling
    console.log('[Transaction] Scheduling next payment for', params.metadata?.subscriptionId);
  }

  // Get transaction status across all providers
  async getTransactionStatus(transactionId) {
    // Try M-Pesa
    const mpesaTx = this.mpesa.getTransaction(transactionId);
    if (mpesaTx) return { provider: 'mpesa', ...mpesaTx };

    // Try Paystack
    const paystackTx = this.paystack.getTransaction(transactionId);
    if (paystackTx) return { provider: 'paystack', ...paystackTx };

    // Query database
    if (this.db) {
      return await this.db.getTransaction(transactionId);
    }

    return null;
  }

  // Generate payment report
  async generateReport(startDate, endDate) {
    const mpesaTxs = this.mpesa.getAllTransactions({ startDate, endDate });
    // Similar for paystack...

    return {
      totalTransactions: mpesaTxs.length,
      totalAmount: mpesaTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0),
      successful: mpesaTxs.filter(tx => tx.status === 'completed').length,
      failed: mpesaTxs.filter(tx => tx.status === 'failed').length,
      pending: mpesaTxs.filter(tx => tx.status === 'pending').length
    };
  }
}

module.exports = { TransactionProcessor };
