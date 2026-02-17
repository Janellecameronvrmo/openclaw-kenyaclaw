/**
 * M-Pesa STK Push Handler
 */

module.exports = async function handler(params, context) {
  const { phoneNumber, amount, accountReference, transactionDesc } = params;
  
  try {
    // Validate phone
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanPhone.match(/^(254|255)[0-9]{9}$/)) {
      return {
        success: false,
        error: 'Invalid phone number. Use format: 2547XXXXXXXX'
      };
    }
    
    // This is a placeholder - real implementation would call M-Pesa API
    context.logger.info('STK push initiated', {
      phone: cleanPhone,
      amount,
      accountReference
    });
    
    return {
      success: true,
      message: `STK push sent to ${cleanPhone}. Please check your phone and enter M-Pesa PIN.`,
      checkoutRequestId: 'ws_co_' + Date.now(),
      amount,
      phone: cleanPhone
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
