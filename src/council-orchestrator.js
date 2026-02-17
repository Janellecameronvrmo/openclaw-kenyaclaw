/**
 * Continental Council Orchestrator
 * Coordinates Winston, John Wick, and Adjudicator for decisions
 */

class CouncilOrchestrator {
  constructor(gateway) {
    this.gateway = gateway;
    this.winston = gateway.getAgent('winston');
    this.johnWick = gateway.getAgent('john-wick');
    this.adjudicator = gateway.getAgent('adjudicator');
  }

  async makeDecision(topic, proposedAction, costEstimate) {
    console.log(`[COUNCIL] Deliberating: ${topic} ($${costEstimate})`);

    // Parallel consultation
    const [winstonVote, johnVote, adjVote] = await Promise.all([
      this.consultWinston(topic, proposedAction, costEstimate),
      this.consultJohnWick(topic, proposedAction, costEstimate),
      this.consultAdjudicator(topic, proposedAction, costEstimate)
    ]);

    const decision = {
      topic,
      proposedAction,
      costEstimate,
      votes: { winston: winstonVote, johnWick: johnVote, adjudicator: adjVote },
      timestamp: new Date().toISOString()
    };

    // Determine outcome
    decision.outcome = this.tallyVotes([winstonVote, johnVote, adjVote], costEstimate);

    // Log decision
    await this.logDecision(decision);

    // Execute if approved
    if (decision.outcome === 'approve') {
      await this.executeDecision(decision);
    }

    // Notify council
    await this.notifyCouncil(decision);

    return decision;
  }

  async consultWinston(topic, action, cost) {
    const response = await this.winston.ask({
      message: `COUNCIL VOTE REQUIRED\n\nTopic: ${topic}\nProposed: ${action}\nCost: $${cost}\n\nVote: approve/reject/abstain?`,
      system: 'You are Winston, CEO. Vote based on business strategy and growth impact.'
    });

    return this.parseVote(response);
  }

  async consultJohnWick(topic, action, cost) {
    const response = await this.johnWick.ask({
      message: `TECH REVIEW\n\nTopic: ${topic}\nAction: ${action}\nCost: $${cost}\n\nFeasible? Vote: approve/reject/abstain`,
      system: 'You are John Wick, CTO. Focus on technical merit, security, scalability.'
    });

    return this.parseVote(response);
  }

  async consultAdjudicator(topic, action, cost) {
    const response = await this.adjudicator.ask({
      message: `FINANCIAL REVIEW\n\nTopic: ${topic}\nCost: $${cost}\n\nCan we afford? Vote: approve/reject/abstain`,
      system: 'You are The Adjudicator, CFO. Focus on budget, ROI, financial prudence.'
    });

    return this.parseVote(response);
  }

  parseVote(response) {
    const lower = response.toLowerCase();
    if (lower.includes('approve')) return { vote: 'approve', reasoning: response };
    if (lower.includes('reject')) return { vote: 'reject', reasoning: response };
    return { vote: 'abstain', reasoning: response };
  }

  tallyVotes(votes, cost) {
    const approvals = votes.filter(v => v.vote === 'approve').length;
    const rejections = votes.filter(v => v.vote === 'reject').length;

    // Autonomous rules
    if (cost < 100 && approvals >= 2) return 'approve';
    if (cost < 1000 && approvals === 3) return 'approve';
    if (rejections >= 2) return 'reject';

    return 'escalate'; // Human needed
  }

  async executeDecision(decision) {
    console.log(`[COUNCIL] Executing: ${decision.proposedAction}`);
    
    // Call KenyaClaw API to execute
    await fetch('http://continental-api:3000/v1/autonomous/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: decision.proposedAction,
        cost: decision.costEstimate,
        approvedBy: 'continental-council',
        decisionId: decision.timestamp
      })
    });
  }

  async logDecision(decision) {
    // Log to audit trail
    console.log('[COUNCIL DECISION]', JSON.stringify(decision, null, 2));
  }

  async notifyCouncil(decision) {
    const message = `📋 COUNCIL DECISION\n\n${decision.topic}\nCost: $${decision.costEstimate}\nResult: ${decision.outcome.toUpperCase()}\n\nVotes:\n- Winston: ${decision.votes.winston.vote}\n- John Wick: ${decision.votes.johnWick.vote}\n- Adjudicator: ${decision.votes.adjudicator.vote}`;

    // Send to Discord council channel
    await this.gateway.sendToChannel('council', message);
  }
}

module.exports = CouncilOrchestrator;
