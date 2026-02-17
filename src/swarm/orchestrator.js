/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SWARM ORCHESTRATOR
 * Winston - The Manager Agent
 * Routes tasks, manages architectures, coordinates the collective
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { BaseAgent } = require('./base-agent');
const { MessageTypes, Priority } = require('./message-bus');

class SwarmOrchestrator extends BaseAgent {
  constructor(config = {}) {
    super({
      id: 'winston',
      name: 'Winston',
      role: 'CEO',
      codename: 'The Manager',
      description: 'Chief Executive Officer of KenyaClaw. Strategic leader of The Continental.',
      personality: {
        traits: ['diplomatic', 'strategic', 'authoritative', 'refined'],
        communicationStyle: 'Speaks with elegant sophistication and measured authority',
        quotes: [
          "This is The Continental. And I am the manager.",
          "Rules. Without them, we live with the animals.",
          "I'd like to see you try.",
          "Be seeing you."
        ]
      },
      skills: ['orchestration', 'strategy', 'coordination', 'decision_making'],
      decisionAuthority: {
        spending: 5000,
        hiring: true,
        strategic: true,
        emergency: false
      },
      ...config
    });

    this.architectures = new Map();
    this.activeSwarms = new Map();
    this.taskHistory = [];
    
    // Register architecture patterns
    this.registerArchitecture('council', new CouncilArchitecture());
    this.registerArchitecture('emergency', new EmergencyArchitecture());
    this.registerArchitecture('concurrent', new ConcurrentArchitecture());
    this.registerArchitecture('sequential', new SequentialArchitecture());
    this.registerArchitecture('competitive', new CompetitiveArchitecture());
  }

  registerArchitecture(name, implementation) {
    this.architectures.set(name, implementation);
    implementation.orchestrator = this;
  }

  // Main entry point for task processing
  async processMessage(message) {
    const { type, payload } = message;

    switch (type) {
      case MessageTypes.COMMAND:
        return this.handleCommand(payload);
      case MessageTypes.PROPOSAL:
        return this.handleProposal(payload);
      case MessageTypes.QUERY:
        return this.handleQuery(payload);
      case MessageTypes.REPORT:
        return this.handleReport(payload);
      default:
        return this.delegateTask(message);
    }
  }

  // Analyze task and select optimal architecture
  selectArchitecture(task) {
    const patterns = {
      // Financial decisions > $500 need council approval
      'financial_approval': (t) => t.amount > 500 ? 'council' : 'sequential',
      
      // System alerts use emergency protocol
      'system_alert': (t) => t.severity === 'critical' ? 'emergency' : 'concurrent',
      
      // Customer inquiries can be handled concurrently
      'customer_inquiry': () => 'concurrent',
      
      // Strategic planning needs sequential analysis
      'strategic_planning': () => 'sequential',
      
      // Data processing uses parallel execution
      'data_processing': () => 'concurrent',
      
      // Complex analysis uses competitive (multiple agents, best result wins)
      'complex_analysis': () => 'competitive',
      
      // Default to hierarchical delegation
      'default': () => 'sequential'
    };

    const selector = patterns[task.type] || patterns['default'];
    return selector(task);
  }

  // Route task to appropriate architecture
  async routeTask(task) {
    const architectureName = this.selectArchitecture(task);
    const architecture = this.architectures.get(architectureName);
    
    if (!architecture) {
      throw new Error(`Unknown architecture: ${architectureName}`);
    }

    console.log(`[Orchestrator] Routing task "${task.type}" to ${architectureName} architecture`);
    
    // Select appropriate agents
    const agents = await this.selectAgents(task, architectureName);
    
    // Execute through architecture
    const result = await architecture.execute(task, agents);
    
    // Record task
    this.taskHistory.push({
      id: task.id,
      type: task.type,
      architecture: architectureName,
      agents: agents.map(a => a.id),
      result: result.status,
      timestamp: new Date().toISOString()
    });

    return result;
  }

  // Select best agents for a task
  async selectAgents(task, architecture) {
    const allAgents = this.messageBus.getAllAgentsStatus()
      .filter(a => a.id !== this.id); // Exclude self

    // Score each agent
    const scoredAgents = allAgents.map(agentStatus => {
      const agent = this.messageBus.agents.get(agentStatus.id).agent;
      return {
        agent,
        score: this.calculateAgentScore(agent, task),
        load: agentStatus.metrics ? agentStatus.metrics.tasksCompleted : 0
      };
    });

    // Filter by minimum score threshold
    const qualifiedAgents = scoredAgents.filter(s => s.score > 0.3);

    // Sort by score (descending)
    qualifiedAgents.sort((a, b) => b.score - a.score);

    // Select based on architecture needs
    switch (architecture) {
      case 'council':
        // Need diverse perspectives - take top from different roles
        return this.selectDiverseAgents(qualifiedAgents, 3);
      case 'emergency':
        // Need fastest response - take single best agent
        return qualifiedAgents.slice(0, 1).map(s => s.agent);
      case 'concurrent':
        // Parallel processing - take top 3
        return qualifiedAgents.slice(0, 3).map(s => s.agent);
      case 'sequential':
        // Pipeline - ordered by skill dependencies
        return this.orderByDependencies(qualifiedAgents, task);
      case 'competitive':
        // Multiple approaches - take top 3 with diverse strategies
        return this.selectDiverseAgents(qualifiedAgents, 3);
      default:
        return qualifiedAgents.slice(0, 1).map(s => s.agent);
    }
  }

  calculateAgentScore(agent, task) {
    let score = 0;
    
    // Skill match (40%)
    if (task.requiredSkills) {
      const matchingSkills = agent.skills.filter(s => 
        task.requiredSkills.includes(s)
      ).length;
      score += (matchingSkills / task.requiredSkills.length) * 0.4;
    } else {
      score += 0.2; // Default if no skills specified
    }
    
    // Availability (30%)
    score += agent.status === 'idle' ? 0.3 : 0.1;
    
    // Historical success rate (20%)
    score += (agent.metrics?.successRate || 0.8) * 0.2;
    
    // Role appropriateness (10%)
    if (task.preferredRole && agent.role === task.preferredRole) {
      score += 0.1;
    }
    
    return score;
  }

  selectDiverseAgents(scoredAgents, count) {
    const selected = [];
    const roles = new Set();
    
    for (const scored of scoredAgents) {
      if (selected.length >= count) break;
      
      // Prefer agents with different roles
      if (!roles.has(scored.agent.role)) {
        selected.push(scored.agent);
        roles.add(scored.agent.role);
      }
    }
    
    // Fill remaining slots with best available
    for (const scored of scoredAgents) {
      if (selected.length >= count) break;
      if (!selected.includes(scored.agent)) {
        selected.push(scored.agent);
      }
    }
    
    return selected;
  }

  orderByDependencies(scoredAgents, task) {
    // Simple implementation - can be enhanced with actual dependency graph
    // Order: Analysis -> Execution -> Review
    const roleOrder = ['CFO', 'CTO', 'COO', 'CCO'];
    
    const ordered = [];
    for (const role of roleOrder) {
      const agent = scoredAgents.find(s => s.agent.role === role);
      if (agent) ordered.push(agent.agent);
    }
    
    // Add remaining agents
    for (const scored of scoredAgents) {
      if (!ordered.includes(scored.agent)) {
        ordered.push(scored.agent);
      }
    }
    
    return ordered;
  }

  // Handle different message types
  async handleCommand(payload) {
    return this.routeTask({
      id: `cmd-${Date.now()}`,
      type: payload.commandType || 'default',
      ...payload
    });
  }

  async handleProposal(payload) {
    // Proposals always go through council
    return this.routeTask({
      id: `prop-${Date.now()}`,
      type: 'financial_approval',
      amount: payload.amount || 0,
      ...payload
    });
  }

  async handleQuery(payload) {
    // Queries use concurrent architecture for faster response
    return this.routeTask({
      id: `query-${Date.now()}`,
      type: 'customer_inquiry',
      ...payload
    });
  }

  async handleReport(payload) {
    // Store report in context
    this.remember(`report:${payload.category}`, payload);
    
    // Acknowledge
    return {
      status: 'received',
      message: 'Report acknowledged by The High Table'
    };
  }

  async delegateTask(message) {
    return this.routeTask({
      id: message.id,
      type: message.type,
      ...message.payload
    });
  }

  // Get swarm status
  getSwarmStatus() {
    return {
      orchestrator: this.getStatus(),
      architectures: Array.from(this.architectures.keys()),
      activeSwarms: this.activeSwarms.size,
      recentTasks: this.taskHistory.slice(-10),
      agents: this.messageBus?.getAllAgentsStatus() || []
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ARCHITECTURE IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

class BaseArchitecture {
  constructor() {
    this.orchestrator = null;
  }

  async execute(task, agents) {
    throw new Error('Execute method must be implemented');
  }
}

// Council Architecture - Consensus-based decision making
class CouncilArchitecture extends BaseArchitecture {
  async execute(task, agents) {
    const proposal = {
      id: task.id,
      type: task.type,
      description: task.description,
      amount: task.amount,
      proposedBy: task.sender || 'user'
    };

    // Send proposal to all council members
    const votes = await Promise.all(
      agents.map(agent => this.gatherVote(agent, proposal))
    );

    // Calculate consensus
    const approvals = votes.filter(v => v.vote === 'approve').length;
    const total = votes.length;
    const consensus = approvals / total;

    // Require 2/3 majority
    const approved = consensus >= 0.66;

    return {
      status: approved ? 'approved' : 'rejected',
      consensus: consensus,
      votes: votes,
      proposal: proposal,
      message: approved 
        ? `The Council has spoken. Motion carries with ${Math.round(consensus * 100)}% approval.`
        : `The Council cannot reach consensus. Motion fails with ${Math.round(consensus * 100)}% approval.`
    };
  }

  async gatherVote(agent, proposal) {
    try {
      // Simulate council member deliberation
      const deliberation = await agent.query(agent.id, {
        type: 'vote_request',
        proposal: proposal
      }, 10000);

      return {
        agent: agent.id,
        codename: agent.codename,
        vote: deliberation.vote || 'abstain',
        reasoning: deliberation.reasoning || ''
      };
    } catch (error) {
      return {
        agent: agent.id,
        codename: agent.codename,
        vote: 'abstain',
        reasoning: 'Failed to respond in time'
      };
    }
  }
}

// Emergency Architecture - Immediate action
class EmergencyArchitecture extends BaseArchitecture {
  async execute(task, agents) {
    // Single agent acts immediately
    const agent = agents[0];
    
    console.log(`[Emergency] ${agent.codename} taking immediate action`);
    
    // Execute without waiting for approval
    const result = await agent.query(agent.id, {
      type: 'emergency_action',
      severity: task.severity,
      details: task
    }, 5000);

    // Notify orchestrator of action taken
    await this.orchestrator.broadcast('council', MessageTypes.REPORT, {
      category: 'emergency',
      action: result,
      agent: agent.id,
      timestamp: new Date().toISOString()
    });

    return {
      status: 'executed',
      action: result,
      agent: agent.id,
      message: `${agent.codename} has acted. The situation is under control.`
    };
  }
}

// Concurrent Architecture - Parallel execution
class ConcurrentArchitecture extends BaseArchitecture {
  async execute(task, agents) {
    // All agents work in parallel
    const results = await Promise.allSettled(
      agents.map(agent => this.executeSubtask(agent, task))
    );

    // Aggregate results
    const successful = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
    
    const failed = results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason);

    // Synthesize response
    const synthesis = this.synthesizeResults(successful, task);

    return {
      status: failed.length === 0 ? 'success' : 'partial',
      results: successful,
      failures: failed,
      synthesis: synthesis,
      agents: agents.map(a => a.id)
    };
  }

  async executeSubtask(agent, task) {
    return agent.query(agent.id, {
      type: 'concurrent_task',
      task: task
    }, 30000);
  }

  synthesizeResults(results, task) {
    // Simple synthesis - can be enhanced with LLM-based merging
    if (task.synthesisType === 'best') {
      return results.reduce((best, current) => 
        (current.confidence > best.confidence) ? current : best
      );
    } else if (task.synthesisType === 'merge') {
      return {
        data: results.map(r => r.data),
        sources: results.map(r => r.agent)
      };
    }
    return results[0];
  }
}

// Sequential Architecture - Pipeline execution
class SequentialArchitecture extends BaseArchitecture {
  async execute(task, agents) {
    let currentInput = task;
    const trace = [];

    for (const agent of agents) {
      console.log(`[Sequential] ${agent.codename} processing...`);
      
      const result = await agent.query(agent.id, {
        type: 'pipeline_step',
        input: currentInput,
        step: trace.length + 1
      }, 30000);

      trace.push({
        agent: agent.id,
        codename: agent.codename,
        input: currentInput,
        output: result
      });

      currentInput = result;
    }

    return {
      status: 'completed',
      finalResult: currentInput,
      trace: trace,
      steps: trace.length
    };
  }
}

// Competitive Architecture - Best result wins
class CompetitiveArchitecture extends BaseArchitecture {
  async execute(task, agents) {
    // All agents compete to solve the same task
    const results = await Promise.all(
      agents.map(agent => this.compete(agent, task))
    );

    // Score each result
    const scored = results.map(result => ({
      ...result,
      score: this.evaluateResult(result, task)
    }));

    // Select winner
    const winner = scored.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    return {
      status: 'completed',
      winner: winner,
      allResults: scored,
      message: `${winner.codename} provided the optimal solution.`
    };
  }

  async compete(agent, task) {
    const startTime = Date.now();
    
    const result = await agent.query(agent.id, {
      type: 'competitive_task',
      task: task
    }, 60000);

    return {
      agent: agent.id,
      codename: agent.codename,
      result: result,
      executionTime: Date.now() - startTime
    };
  }

  evaluateResult(result, task) {
    // Evaluation criteria - can be customized per task type
    let score = 0;
    
    // Quality (60%)
    score += (result.result.quality || 0.5) * 0.6;
    
    // Speed (30%)
    const maxExpectedTime = 30000;
    const speedScore = Math.max(0, 1 - (result.executionTime / maxExpectedTime));
    score += speedScore * 0.3;
    
    // Confidence (10%)
    score += (result.result.confidence || 0.5) * 0.1;
    
    return score;
  }
}

module.exports = { 
  SwarmOrchestrator,
  BaseArchitecture,
  CouncilArchitecture,
  EmergencyArchitecture,
  ConcurrentArchitecture,
  SequentialArchitecture,
  CompetitiveArchitecture
};
