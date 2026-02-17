/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PAYMENT-AGENT INTEGRATION
 * Connects payment processing to the Agent Swarm
 * Agents can now process M-Pesa and Paystack payments
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { KenyaClawPayments } = require('./index');

class PaymentAgentIntegration {
  constructor(swarm, paymentConfig = {}) {
    this.swarm = swarm;
    this.payments = new KenyaClawPayments({
      ...paymentConfig,
      swarm: swarm // Pass swarm for approval workflows
    });
    
    // Extend agents with payment capabilities
    this.extendAgents();
  }

  extendAgents() {
    // Get all agents from swarm
    const agents = this.swarm.agents;

    // Extend each agent with payment methods
    for (const [agentId, agent] of agents) {
      this.extendAgent(agent);
    }

    console.log('[PaymentAgent] Extended', agents.size, 'agents with payment capabilities');
  }

  extendAgent(agent) {
    // Add payment methods to agent
    agent.processPayment = this.createPaymentHandler(agent);
    agent.verifyPayment = this.createVerificationHandler(agent);
    agent.refundPayment = this.createRefundHandler(agent);
    agent.getPaymentStatus = this.createStatusHandler(agent);
  }

  createPaymentHandler(agent) {
    return async (params) => {
      console.log(`[${agent.codename}] Processing payment:`, params);

      // Check agent authority
      if (!this.canProcessPayment(agent, params.amount)) {
        return {
          success: false,
          error: 'Insufficient authority for this amount',
          required_approval: true
        };
      }

      // For large amounts, get council approval
      if (params.amount > agent.decisionAuthority?.spending || 0) {
        const approval = await this.swarm.submitTask({
          type: 'financial_approval',
          amount: params.amount,
          description: `Payment processing by ${agent.codename}`,
          agent: agent.id
        });

        if (!approval.approved) {
          return {
            success: false,
            error: 'Payment not approved by council',
            approval: approval
          };
        }
      }

      // Process payment
      const result = await this.payments.processPayment({
        ...params,
        metadata: {
          ...params.metadata,
          processedBy: agent.id,
          processedByName: agent.codename
        }
      });

      // Log transaction
      agent.remember(`payment:${result.transactionId}`, {
        ...result,
        timestamp: Date.now()
      });

      return {
        ...result,
        processedBy: agent.codename,
        quote: agent.getQuote()
      };
    };
  }

  createVerificationHandler(agent) {
    return async (transactionId) => {
      console.log(`[${agent.codename}] Verifying payment:`, transactionId);
      
      const status = await this.payments.verifyPayment(transactionId);
      
      return {
        ...status,
        verifiedBy: agent.codename
      };
    };
  }

  createRefundHandler(agent) {
    return async (transactionId, amount, reason) => {
      console.log(`[${agent.codename}] Processing refund:`, transactionId);

      // Only certain agents can process refunds
      if (!agent.decisionAuthority?.refunds && agent.role !== 'CFO') {
        return {
          success: false,
          error: 'Insufficient authority for refunds'
        };
      }

      const result = await this.payments.refund(transactionId, amount, reason);
      
      return {
        ...result,
        processedBy: agent.codename
      };
    };
  }

  createStatusHandler(agent) {
    return async (transactionId) => {
      const status = await this.payments.processor.getTransactionStatus(transactionId);
      
      return {
        ...status,
        checkedBy: agent.codename
      };
    };
  }

  canProcessPayment(agent, amount) {
    // Check if agent has spending authority
    const authority = agent.decisionAuthority?.spending || 0;
    
    // Agents can process up to their limit without council approval
    // Above that, council approval is needed (handled separately)
    return true; // Allow all, council approval handles large amounts
  }

  // Helper methods for specific agents
  
  // Charon processes customer payments
  async charonProcessPayment(customerPhone, amount, invoiceId) {
    const charon = this.swarm.getAgent('charon');
    if (!charon) throw new Error('Charon agent not found');

    return charon.processPayment({
      type: 'invoice_payment',
      provider: 'mpesa',
      country: 'KE',
      amount: amount,
      currency: 'KES',
      customerPhone: customerPhone,
      metadata: {
        invoiceId: invoiceId,
        customerTier: 'standard',
        processedBy: 'charon'
      }
    });
  }

  // Adjudicator processes high-value payments
  async adjudicatorApprovePayment(paymentRequest) {
    const adjudicator = this.swarm.getAgent('adjudicator');
    if (!adjudicator) throw new Error('Adjudicator agent not found');

    // Validate payment request
    const validation = await this.validatePaymentRequest(paymentRequest);
    
    if (!validation.valid) {
      return {
        success: false,
        error: 'Payment validation failed',
        violations: validation.violations,
        quote: "This is a violation."
      };
    }

    // Process if valid
    return adjudicator.processPayment(paymentRequest);
  }

  async validatePaymentRequest(request) {
    const violations = [];

    if (request.amount > 1000000) {
      violations.push('Amount exceeds maximum threshold');
    }

    if (!request.customerPhone && !request.customerEmail) {
      violations.push('Customer contact required');
    }

    if (request.amount <= 0) {
      violations.push('Invalid amount');
    }

    return {
      valid: violations.length === 0,
      violations: violations
    };
  }

  // Setup Express routes for agent payment APIs
  setupRoutes(app) {
    // Payment routes
    this.payments.setupRoutes(app);

    // Agent-specific payment endpoints
    app.post('/api/agents/:agentId/payments', async (req, res) => {
      try {
        const agent = this.swarm.getAgent(req.params.agentId);
        if (!agent) {
          return res.status(404).json({ error: 'Agent not found' });
        }

        const result = await agent.processPayment(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.get('/api/agents/:agentId/payments/:transactionId', async (req, res) => {
      try {
        const agent = this.swarm.getAgent(req.params.agentId);
        if (!agent) {
          return res.status(404).json({ error: 'Agent not found' });
        }

        const result = await agent.getPaymentStatus(req.params.transactionId);
        res.json(result);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    console.log('[PaymentAgent] Routes configured:');
    console.log('  - POST /api/agents/:agentId/payments');
    console.log('  - GET /api/agents/:agentId/payments/:transactionId');
  }

  getStatus() {
    return {
      payments: this.payments.getStatus(),
      agentsWithPaymentCapabilities: this.swarm.agents.size
    };
  }
}

module.exports = { PaymentAgentIntegration };
