/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PAYSTACK API INTEGRATION
 * Handles payments for Nigeria, Ghana, South Africa
 * ═══════════════════════════════════════════════════════════════════════════
 */

const axios = require('axios');

class PaystackService {
  constructor(config = {}) {
    this.secretKey = config.secretKey || process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = config.publicKey || process.env.PAYSTACK_PUBLIC_KEY;
    this.baseUrl = 'https://api.paystack.co';
    this.callbackUrl = config.callbackUrl || process.env.PAYSTACK_CALLBACK_URL;
    this.transactions = new Map();
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json'
    };
  }

  // Initialize transaction (payment request)
  async initializeTransaction(params) {
    const { email, amount, currency = 'NGN', metadata = {}, channels } = params;
    
    const requestBody = {
      email,
      amount: Math.round(amount * 100), // Paystack uses kobo/cents
      currency,
      callback_url: this.callbackUrl,
      metadata: {
        ...metadata,
        custom_fields: [
          { display_name: "Customer Name", variable_name: "customer_name", value: metadata.customerName || '' },
          { display_name: "Invoice ID", variable_name: "invoice_id", value: metadata.invoiceId || '' }
        ]
      }
    };

    if (channels) requestBody.channels = channels;

    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        requestBody,
        { headers: this.getHeaders() }
      );

      const transactionId = `PAYSTACK-${Date.now()}`;
      const transaction = {
        id: transactionId,
        type: 'initialization',
        email: email,
        amount: amount,
        currency: currency,
        reference: response.data.data.reference,
        accessCode: response.data.data.access_code,
        authorizationUrl: response.data.data.authorization_url,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      this.transactions.set(transactionId, transaction);
      this.transactions.set(response.data.data.reference, transaction);

      return {
        success: true,
        transactionId: transactionId,
        reference: response.data.data.reference,
        authorizationUrl: response.data.data.authorization_url,
        accessCode: response.data.data.access_code,
        message: 'Payment link generated'
      };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  // Verify transaction
  async verifyTransaction(reference) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        { headers: this.getHeaders() }
      );

      const data = response.data.data;
      const transaction = this.transactions.get(reference);

      if (transaction) {
        transaction.status = data.status;
        transaction.gatewayResponse = data.gateway_response;
        transaction.paidAt = data.paid_at;
        transaction.channel = data.channel;
        transaction.fees = data.fees / 100;
      }

      return {
        success: data.status === 'success',
        status: data.status,
        amount: data.amount / 100,
        currency: data.currency,
        reference: data.reference,
        paidAt: data.paid_at,
        channel: data.channel,
        receiptNumber: data.receipt_number,
        transaction: transaction
      };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  // Handle webhook
  handleWebhook(event, data) {
    console.log(`[Paystack] Webhook received: ${event}`, data);

    switch (event) {
      case 'charge.success':
        return this.handleChargeSuccess(data);
      case 'charge.failed':
        return this.handleChargeFailed(data);
      case 'transfer.success':
        return this.handleTransferSuccess(data);
      case 'transfer.failed':
        return this.handleTransferFailed(data);
      default:
        return { received: true, event, processed: false };
    }
  }

  handleChargeSuccess(data) {
    const reference = data.reference;
    const transaction = this.transactions.get(reference);

    if (transaction) {
      transaction.status = 'success';
      transaction.paidAt = data.paid_at;
      transaction.channel = data.channel;
      transaction.customer = data.customer;
    }

    return {
      success: true,
      event: 'charge.success',
      reference: reference,
      amount: data.amount / 100,
      customer: data.customer,
      transaction: transaction
    };
  }

  handleChargeFailed(data) {
    const reference = data.reference;
    const transaction = this.transactions.get(reference);

    if (transaction) {
      transaction.status = 'failed';
      transaction.failMessage = data.message;
    }

    return {
      success: false,
      event: 'charge.failed',
      reference: reference,
      message: data.message,
      transaction: transaction
    };
  }

  handleTransferSuccess(data) {
    return { success: true, event: 'transfer.success', transferCode: data.transfer_code };
  }

  handleTransferFailed(data) {
    return { success: false, event: 'transfer.failed', reason: data.reason };
  }

  // Create transfer recipient (for B2C payments)
  async createTransferRecipient(params) {
    const { type = 'mobile_money', name, accountNumber, bankCode, currency = 'NGN' } = params;

    try {
      const response = await axios.post(
        `${this.baseUrl}/transferrecipient`,
        {
          type,
          name,
          account_number: accountNumber,
          bank_code: bankCode,
          currency
        },
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        recipientCode: response.data.data.recipient_code,
        name: response.data.data.name
      };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  // Initiate transfer (B2C)
  async initiateTransfer(params) {
    const { recipient, amount, reason, currency = 'NGN' } = params;

    try {
      const response = await axios.post(
        `${this.baseUrl}/transfer`,
        {
          source: 'balance',
          recipient,
          amount: Math.round(amount * 100),
          currency,
          reason: reason || 'Payment'
        },
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        transferCode: response.data.data.transfer_code,
        reference: response.data.data.reference,
        amount: amount,
        status: response.data.data.status
      };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  // Get banks
  async getBanks(country = 'nigeria') {
    try {
      const response = await axios.get(
        `${this.baseUrl}/bank?country=${country}`,
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        banks: response.data.data
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Create payment page
  async createPaymentPage(params) {
    const { name, description, amount, slug } = params;

    try {
      const response = await axios.post(
        `${this.baseUrl}/page`,
        { name, description, amount: amount ? amount * 100 : null, slug },
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        pageUrl: response.data.data.url,
        slug: response.data.data.slug
      };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  getTransaction(id) {
    return this.transactions.get(id);
  }
}

module.exports = { PaystackService };
