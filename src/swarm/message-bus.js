/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KENYACLAW MESSAGE BUS
 * Hybrid Hierarchical + Mesh Communication Protocol
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

class Message {
  constructor({ sender, recipients, type, payload, priority = 3, ttl = 300 }) {
    this.id = crypto.randomUUID();
    this.timestamp = new Date().toISOString();
    this.sender = sender;
    this.recipients = recipients;
    this.type = type;
    this.payload = payload;
    this.priority = priority;
    this.ttl = ttl;
    this.signature = this.sign();
  }

  sign() {
    const data = JSON.stringify({
      id: this.id,
      timestamp: this.timestamp,
      sender: this.sender,
      type: this.type,
      payload: this.payload
    });
    return crypto.createHmac('sha256', process.env.MESSAGE_SECRET || 'default-secret')
      .update(data)
      .digest('hex');
  }

  verify() {
    return this.signature === this.sign();
  }

  isExpired() {
    const age = (Date.now() - new Date(this.timestamp).getTime()) / 1000;
    return age > this.ttl;
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      sender: this.sender,
      recipients: this.recipients,
      type: this.type,
      payload: this.payload,
      priority: this.priority,
      ttl: this.ttl,
      signature: this.signature
    };
  }
}

class MessageBus extends EventEmitter {
  constructor(options = {}) {
    super();
    this.agents = new Map();
    this.channels = new Map();
    this.messageHistory = [];
    this.maxHistory = options.maxHistory || 10000;
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      messagesExpired: 0
    };
  }

  registerAgent(agent) {
    this.agents.set(agent.id, {
      agent,
      subscriptions: new Set(),
      lastSeen: Date.now()
    });
    this.subscribe(agent.id, agent.id);
    console.log(`[MessageBus] Agent ${agent.id} (${agent.codename}) registered`);
    this.emit('agent:registered', { agentId: agent.id, codename: agent.codename });
  }

  unregisterAgent(agentId) {
    const record = this.agents.get(agentId);
    if (record) {
      record.subscriptions.forEach(channel => {
        this.unsubscribe(agentId, channel);
      });
      this.agents.delete(agentId);
      this.emit('agent:unregistered', { agentId });
    }
  }

  subscribe(agentId, channel) {
    const record = this.agents.get(agentId);
    if (!record) return false;

    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    
    this.channels.get(channel).add(agentId);
    record.subscriptions.add(channel);
    return true;
  }

  unsubscribe(agentId, channel) {
    const record = this.agents.get(agentId);
    if (!record) return false;

    const channelSubscribers = this.channels.get(channel);
    if (channelSubscribers) {
      channelSubscribers.delete(agentId);
    }
    
    record.subscriptions.delete(channel);
    return true;
  }

  async send(message) {
    if (!(message instanceof Message)) {
      throw new Error('Invalid message type');
    }

    if (!message.verify()) {
      throw new Error('Message signature verification failed');
    }

    this.messageHistory.push(message.toJSON());
    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory.shift();
    }

    this.metrics.messagesSent++;

    let recipients = [];
    if (message.recipients === 'broadcast') {
      recipients = Array.from(this.agents.keys());
    } else if (Array.isArray(message.recipients)) {
      recipients = message.recipients;
    } else {
      recipients = [message.recipients];
    }

    const deliveries = recipients.map(async (recipientId) => {
      const record = this.agents.get(recipientId);
      if (!record) {
        this.emit('message:undelivered', { message, recipientId, reason: 'agent_not_found' });
        return { recipientId, status: 'failed', reason: 'agent_not_found' };
      }

      try {
        await record.agent.receiveMessage(message);
        this.metrics.messagesReceived++;
        this.emit('message:delivered', { message, recipientId });
        return { recipientId, status: 'delivered' };
      } catch (error) {
        this.emit('message:failed', { message, recipientId, error });
        return { recipientId, status: 'failed', reason: error.message };
      }
    });

    return Promise.all(deliveries);
  }

  async broadcast(channel, messageData) {
    const subscribers = this.channels.get(channel);
    if (!subscribers || subscribers.size === 0) {
      return { status: 'no_subscribers', channel };
    }

    const message = new Message({
      ...messageData,
      recipients: Array.from(subscribers)
    });

    return this.send(message);
  }

  queryHistory(filters = {}) {
    return this.messageHistory.filter(msg => {
      if (filters.sender && msg.sender !== filters.sender) return false;
      if (filters.recipient && !msg.recipients.includes(filters.recipient)) return false;
      if (filters.type && msg.type !== filters.type) return false;
      if (filters.after && new Date(msg.timestamp) < new Date(filters.after)) return false;
      if (filters.before && new Date(msg.timestamp) > new Date(filters.before)) return false;
      return true;
    });
  }

  getAgentStatus(agentId) {
    const record = this.agents.get(agentId);
    if (!record) return null;

    return {
      id: agentId,
      codename: record.agent.codename,
      status: record.agent.status,
      subscriptions: Array.from(record.subscriptions),
      lastSeen: record.lastSeen,
      metrics: record.agent.metrics
    };
  }

  getAllAgentsStatus() {
    return Array.from(this.agents.keys()).map(id => this.getAgentStatus(id));
  }

  cleanup() {
    const before = this.messageHistory.length;
    this.messageHistory = this.messageHistory.filter(msg => {
      const expired = new Date(msg.timestamp).getTime() + (msg.ttl * 1000) < Date.now();
      if (expired) this.metrics.messagesExpired++;
      return !expired;
    });
    const removed = before - this.messageHistory.length;
    if (removed > 0) {
      console.log(`[MessageBus] Cleaned up ${removed} expired messages`);
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      registeredAgents: this.agents.size,
      activeChannels: this.channels.size,
      historySize: this.messageHistory.length
    };
  }
}

const MessageTypes = {
  COMMAND: 'command',
  DELEGATE: 'delegate',
  REPORT: 'report',
  QUERY: 'query',
  RESPONSE: 'response',
  BROADCAST: 'broadcast',
  PROPOSAL: 'proposal',
  VOTE: 'vote',
  CONSENSUS: 'consensus',
  HEARTBEAT: 'heartbeat',
  ERROR: 'error',
  STATUS: 'status'
};

const Priority = {
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4,
  BACKGROUND: 5
};

module.exports = { MessageBus, Message, MessageTypes, Priority };
