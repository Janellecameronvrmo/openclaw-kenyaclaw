/**
 * ═══════════════════════════════════════════════════════════════════════════
 * M-PESA DARAJA API INTEGRATION
 * Handles M-Pesa payments for Kenya and Tanzania
 * ═══════════════════════════════════════════════════════════════════════════
 */

const axios = require('axios');

class MpesaService {
  constructor(config = {}) {
    this.environment = config.environment || 'sandbox';
    this.consumerKey = config.consumerKey || process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = config.consumerSecret || process.env.MPESA_CONSUMER_SECRET;
    this.shortcode = config.shortcode || process.env.MPESA_SHORTCODE;
    this.passkey = config.passkey || process.env.MPESA_PASSKEY;
    this.callbackUrl = config.callbackUrl || process.env.MPESA_CALLBACK_URL;
    this.baseUrl = this.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
    this.accessToken = null;
    this.tokenExpiry = null;
    this.transactions = new Map();
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 300000) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { 'Authorization': `Basic ${auth}` } }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      return this.accessToken;
    } catch (error) {
      throw new Error(`M-Pesa authentication failed: ${error.message}`);
    }
  }

  async stkPush(params) {
    const { phoneNumber, amount, accountReference, transactionDesc } = params;
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const timestamp = this.generateTimestamp();
    const password = this.generatePassword(timestamp);
    const transactionId = `MPESA-${Date.now()}`;
    
    const requestBody = {
      BusinessShortCode: this.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: this.shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: this.callbackUrl,
      AccountReference: accountReference || 'KenyaClaw',
      TransactionDesc: transactionDesc || 'Payment'
    };

    try {
      const token = await this.getAccessToken();
      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        requestBody,
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      const transaction = {
        id: transactionId,
        type: 'stk_push',
        phoneNumber: formattedPhone,
        amount: amount,
        accountReference: accountReference,
        checkoutRequestId: response.data.CheckoutRequestID,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      this.transactions.set(transactionId, transaction);
      this.transactions.set(response.data.CheckoutRequestID, transaction);
      
      return {
        success: true,
        transactionId: transactionId,
        checkoutRequestId: response.data.CheckoutRequestID,
        message: 'STK Push sent to customer phone'
      };
    } catch (error) {
      return { success: false, error: error.response?.data?.errorMessage || error.message };
    }
  }

  async queryStkStatus(checkoutRequestId) {
    const timestamp = this.generateTimestamp();
    const password = this.generatePassword(timestamp);
    
    try {
      const token = await this.getAccessToken();
      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
        {
          BusinessShortCode: this.shortcode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId
        },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      const isSuccess = response.data.ResultCode === '0';
      const transaction = this.transactions.get(checkoutRequestId);
      
      if (transaction) {
        transaction.status = isSuccess ? 'completed' : 'failed';
        transaction.resultCode = response.data.ResultCode;
        transaction.resultDesc = response.data.ResultDesc;
      }
      
      return { success: isSuccess, status: transaction?.status, resultDesc: response.data.ResultDesc };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  handleStkCallback(data) {
    const { Body } = data;
    const checkoutRequestId = Body.stkCallback.CheckoutRequestID;
    const resultCode = Body.stkCallback.ResultCode;
    const transaction = this.transactions.get(checkoutRequestId);
    
    if (transaction) {
      transaction.status = resultCode === 0 ? 'completed' : 'failed';
      transaction.resultCode = resultCode;
      transaction.resultDesc = Body.stkCallback.ResultDesc;
      
      if (resultCode === 0) {
        const metadata = Body.stkCallback.CallbackMetadata?.Item || [];
        metadata.forEach(item => {
          if (item.Name === 'MpesaReceiptNumber') transaction.mpesaReceiptNumber = item.Value;
          if (item.Name === 'TransactionDate') transaction.transactionDate = item.Value;
        });
      }
    }
    
    return { success: true, transaction };
  }

  formatPhoneNumber(phone) {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '254' + cleaned.substring(1);
    else if (!cleaned.startsWith('254')) cleaned = '254' + cleaned;
    return cleaned;
  }

  generateTimestamp() {
    const date = new Date();
    return `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}${String(date.getSeconds()).padStart(2,'0')}`;
  }

  generatePassword(timestamp) {
    return Buffer.from(this.shortcode + this.passkey + timestamp).toString('base64');
  }

  getTransaction(id) { return this.transactions.get(id); }
}

module.exports = { MpesaService };
