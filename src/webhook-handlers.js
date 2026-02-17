/**
 * KenyaClaw Webhook Handlers
 * Process callbacks from payment providers
 */

module.exports = {
  // M-Pesa webhook handler
  async handleMpesaCallback(payload, context) {
    const { Body } = payload;
    const callback = Body.stkCallback;

    context.logger.info('M-Pesa callback received', { 
      resultCode: callback.ResultCode,
      checkoutRequestId: callback.CheckoutRequestID 
    });

    if (callback.ResultCode === 0) {
      // Success
      const metadata = callback.CallbackMetadata.Item;
      const amount = metadata.find(i => i.Name === 'Amount')?.Value;
      const receipt = metadata.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
      const phone = metadata.find(i => i.Name === 'PhoneNumber')?.Value;

      // Update payment record
      await context.db.payments.update({
        where: { checkoutRequestId: callback.CheckoutRequestID },
        data: {
          status: 'completed',
          receiptNumber: receipt,
          completedAt: new Date()
        }
      });

      // Notify user
      await context.sendMessage(phone, 
        `✅ Payment received!\nAmount: KSh ${amount}\nReceipt: ${receipt}\n\nThank you for using KenyaClaw!`
      );

      return { success: true, receipt };
    } else {
      // Failed
      await context.db.payments.update({
        where: { checkoutRequestId: callback.CheckoutRequestID },
        data: {
          status: 'failed',
          failureReason: callback.ResultDesc
        }
      });

      return { success: false, error: callback.ResultDesc };
    }
  },

  // Paystack webhook handler
  async handlePaystackWebhook(payload, headers, context) {
    // Verify signature
    const signature = headers['x-paystack-signature'];
    const expected = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expected) {
      throw new Error('Invalid webhook signature');
    }

    const { event, data } = payload;

    if (event === 'charge.success') {
      await context.db.payments.update({
        where: { reference: data.reference },
        data: {
          status: 'completed',
          paidAt: new Date(data.paid_at)
        }
      });

      context.logger.info('Paystack payment confirmed', { 
        reference: data.reference,
        amount: data.amount 
      });
    }

    return { received: true };
  },

  // Stripe webhook handler
  async handleStripeWebhook(payload, signature, context) {
    // Verify signature
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      
      await context.db.payments.update({
        where: { stripePaymentIntentId: paymentIntent.id },
        data: { status: 'completed' }
      });
    }

    return { received: true };
  }
};
