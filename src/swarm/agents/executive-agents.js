/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXECUTIVE AGENTS - The Inner Circle
 * John Wick (CTO) and Adjudicator (CFO)
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { BaseAgent } = require('../base-agent');

class JohnWickAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      id: 'john-wick',
      name: 'John Wick',
      role: 'CTO',
      codename: 'Baba Yaga',
      description: 'Chief Technology Officer of KenyaClaw.',
      personality: {
        traits: ['efficient', 'focused', 'action-oriented', 'understated'],
        communicationStyle: 'Minimalist and direct.',
        quotes: ["Yeah.", "I'll handle it.", "Finished it."]
      },
      skills: ['infrastructure', 'architecture', 'security', 'devops'],
      decisionAuthority: { spending: 2000, technical: true, architecture: true },
      ...config
    });
  }

  async processMessage(message) {
    const { payload } = message;
    switch (payload?.type) {
      case 'infrastructure_issue':
        return this.handleInfrastructureIssue(payload);
      case 'vote_request':
        return { vote: 'approve', reasoning: 'Technically sound.', quote: this.getQuote() };
      default:
        return { response: "I'll handle it.", status: 'acknowledged' };
    }
  }

  async handleInfrastructureIssue(issue) {
    const actions = {
      critical: () => ({ action: 'immediate_remediation', autoApprove: true }),
      high: () => ({ action: 'scheduled_maintenance' }),
      medium: () => ({ action: 'backlog_ticket' })
    };
    const handler = actions[issue.severity] || actions.medium;
    return { response: this.getQuote(), plan: handler(), quote: issue.severity === 'critical' ? "Duck." : "I'll handle it." };
  }
}

class AdjudicatorAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      id: 'adjudicator',
      name: 'The Adjudicator',
      role: 'CFO',
      codename: 'The Judge',
      description: 'Chief Financial Officer of KenyaClaw.',
      personality: {
        traits: ['precise', 'rule-enforcing', 'uncompromising'],
        quotes: ["This is a violation.", "The High Table has ruled.", "This is not negotiable."]
      },
      skills: ['finance', 'accounting', 'audit', 'compliance'],
      decisionAuthority: { spending: 10000, financial: true, canHaltSpending: true },
      ...config
    });
  }

  async processMessage(message) {
    const { payload } = message;
    switch (payload?.type) {
      case 'spending_request':
        return this.handleSpendingRequest(payload);
      case 'vote_request':
        return { vote: payload.amount < 5000 ? 'approve' : 'abstain', reasoning: 'Financial review complete.', quote: this.getQuote() };
      default:
        return { response: "State your business.", status: 'awaiting_details' };
    }
  }

  async handleSpendingRequest(request) {
    const level = request.amount < 1000 ? 'auto' : request.amount < 5000 ? 'manager' : 'council';
    if (level === 'auto') {
      return { response: "Approved.", status: 'approved', approval_type: 'automatic' };
    }
    return { response: `Requires ${level} approval.`, status: 'pending_approval', approval_level: level };
  }
}

module.exports = { JohnWickAgent, AdjudicatorAgent };
