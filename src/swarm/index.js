/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KENYACLAW AGENT SWARM - Main Entry Point
 * The High Table Collective - Multi-Agent Orchestration System
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { MessageBus, Message, MessageTypes, Priority } = require('./message-bus');
const { BaseAgent } = require('./base-agent');
const { SwarmOrchestrator } = require('./orchestrator');
const { JohnWickAgent, AdjudicatorAgent } = require('./agents/executive-agents');
const { DoctorAgent, CharonAgent } = require('./agents/operations-agents');

class KenyaClawSwarm {
  constructor(options = {}) {
    this.messageBus = new MessageBus(options.messageBus);
    this.orchestrator = new SwarmOrchestrator(options.orchestrator);
    this.agents = new Map();
    this.initialized = false;
  }

  // Initialize the swarm with all agents
  async initialize() {
    if (this.initialized) {
      console.log('[Swarm] Already initialized');
      return;
    }

    console.log('[Swarm] Initializing The High Table Collective...');

    // Initialize orchestrator first
    this.orchestrator.initialize(this.messageBus);
    this.agents.set('winston', this.orchestrator);

    // Create and initialize all agents
    const agentConfigs = [
      { Class: JohnWickAgent, id: 'john-wick' },
      { Class: AdjudicatorAgent, id: 'adjudicator' },
      { Class: DoctorAgent, id: 'doctor' },
      { Class: CharonAgent, id: 'charon' }
    ];

    for (const config of agentConfigs) {
      const agent = new config.Class();
      agent.initialize(this.messageBus);
      this.agents.set(config.id, agent);
    }

    // Subscribe agents to relevant channels
    this.setupChannels();

    this.initialized = true;
    console.log('[Swarm] The High Table Collective is operational');
    console.log(`[Swarm] ${this.agents.size} agents ready`);

    return this.getStatus();
  }

  setupChannels() {
    // Executive channel
    this.messageBus.channels.set('executive', new Set(['winston', 'john-wick', 'adjudicator']));
    
    // Operations channel
    this.messageBus.channels.set('operations', new Set(['winston', 'doctor', 'charon']));
    
    // Council channel (all agents)
    this.messageBus.channels.set('council', new Set(this.agents.keys()));
    
    // Emergency channel
    this.messageBus.channels.set('emergency', new Set(['winston', 'doctor', 'john-wick']));
  }

  // Submit a task to the swarm
  async submitTask(task) {
    if (!this.initialized) {
      throw new Error('Swarm not initialized. Call initialize() first.');
    }

    const enrichedTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      submittedAt: new Date().toISOString(),
      ...task
    };

    console.log(`[Swarm] New task submitted: ${enrichedTask.type}`);

    // Route through orchestrator
    return this.orchestrator.routeTask(enrichedTask);
  }

  // Quick command methods
  async requestSpendingApproval(amount, description) {
    return this.submitTask({
      type: 'financial_approval',
      amount: amount,
      description: description,
      requiredSkills: ['finance', 'treasury']
    });
  }

  async reportIncident(severity, description) {
    return this.submitTask({
      type: 'system_alert',
      severity: severity,
      description: description,
      requiredSkills: ['incident_response', 'operations']
    });
  }

  async customerInquiry(customerId, topic) {
    return this.submitTask({
      type: 'customer_inquiry',
      customerId: customerId,
      topic: topic,
      requiredSkills: ['customer_service']
    });
  }

  // Get full swarm status
  getStatus() {
    return {
      initialized: this.initialized,
      orchestrator: this.orchestrator.getStatus(),
      agents: Array.from(this.agents.values()).map(a => a.getStatus()),
      messageBus: this.messageBus.getMetrics()
    };
  }

  // Get individual agent
  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  // Send direct message to agent
  async messageAgent(agentId, message) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const msg = new Message({
      sender: 'user',
      recipients: [agentId],
      type: MessageTypes.COMMAND,
      payload: message,
      priority: Priority.NORMAL
    });

    return this.messageBus.send(msg);
  }

  // Broadcast to all agents
  async broadcast(message) {
    return this.messageBus.broadcast('council', {
      sender: 'user',
      type: MessageTypes.BROADCAST,
      payload: message
    });
  }

  // Shutdown the swarm
  async shutdown() {
    console.log('[Swarm] Shutting down The High Table Collective...');

    // Shutdown all agents
    for (const [id, agent] of this.agents) {
      await agent.shutdown();
    }

    this.initialized = false;
    console.log('[Swarm] All agents offline');
  }

  // Query message history
  queryHistory(filters = {}) {
    return this.messageBus.queryHistory(filters);
  }
}

// Factory function for easy instantiation
async function createSwarm(options = {}) {
  const swarm = new KenyaClawSwarm(options);
  await swarm.initialize();
  return swarm;
}

module.exports = {
  KenyaClawSwarm,
  createSwarm,
  MessageBus,
  Message,
  MessageTypes,
  Priority,
  BaseAgent,
  SwarmOrchestrator,
  JohnWickAgent,
  AdjudicatorAgent,
  DoctorAgent,
  CharonAgent
};
