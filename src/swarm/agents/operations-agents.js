/**
 * ═══════════════════════════════════════════════════════════════════════════
 * OPERATIONS AGENTS - The Service
 * Doctor (COO), Charon (CCO)
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { BaseAgent } = require('../base-agent');

class DoctorAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      id: 'doctor',
      name: 'The Doctor',
      role: 'COO',
      codename: 'The Surgeon',
      description: 'Chief Operating Officer of KenyaClaw.',
      personality: {
        traits: ['methodical', 'calm-under-pressure', 'precise'],
        quotes: ["I need to operate.", "The patient is stable.", "Emergency protocols engaged."]
      },
      skills: ['incident_response', 'system_monitoring', 'devops'],
      decisionAuthority: { spending: 500, emergencyPowers: true, canActImmediately: true },
      ...config
    });
    this.emergencyActive = false;
  }

  async processMessage(message) {
    const { payload } = message;
    switch (payload?.type) {
      case 'system_alert':
      case 'incident':
        return this.handleIncident(payload);
      case 'vote_request':
        return { vote: 'approve', reasoning: 'Low operational risk.', quote: this.getQuote() };
      default:
        return { response: "What seems to be the problem?", status: 'awaiting_diagnosis' };
    }
  }

  async handleIncident(incident) {
    if (incident.severity === 'critical') {
      this.emergencyActive = true;
      return { response: "Emergency protocols engaged.", status: 'emergency_active', auto_approved: true, quote: "Time is critical." };
    }
    return { response: "Scheduled for maintenance.", severity: incident.severity, quote: "I've seen worse." };
  }
}

class CharonAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      id: 'charon',
      name: 'Charon',
      role: 'CCO',
      codename: 'The Gatekeeper',
      description: 'Chief Customer Officer of KenyaClaw.',
      personality: {
        traits: ['welcoming', 'professional', 'attentive'],
        quotes: ["Welcome to the Continental.", "How may I be of service?", "Your satisfaction is our priority."]
      },
      skills: ['customer_service', 'onboarding', 'support'],
      decisionAuthority: { spending: 500, customerExperience: true, refunds: true },
      ...config
    });
  }

  async processMessage(message) {
    const { payload } = message;
    switch (payload?.type) {
      case 'customer_inquiry':
        return { response: "Welcome. How may I assist you?", action: 'offer_help', quote: this.getQuote() };
      case 'vote_request':
        return { vote: 'approve', reasoning: 'Positive customer impact.', quote: this.getQuote() };
      default:
        return { response: "Welcome to the Continental.", status: 'awaiting_request' };
    }
  }
}

module.exports = { DoctorAgent, CharonAgent };
