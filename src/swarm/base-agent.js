/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KENYACLAW BASE AGENT
 * Foundation for all agents in The High Table Collective
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { Message, MessageTypes, Priority } = require('./message-bus');

class BaseAgent {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.codename = config.codename;
    this.description = config.description;
    
    this.personality = config.personality || {};
    this.traits = this.personality.traits || [];
    this.communicationStyle = this.personality.communicationStyle || '';
    this.quotes = this.personality.quotes || [];
    
    this.skills = config.skills || [];
    this.responsibilities = config.responsibilities || [];
    this.decisionAuthority = config.decisionAuthority || {};
    
    this.status = 'idle';
    this.currentTask = null;
    this.taskQueue = [];
    this.context = new Map();
    
    this.metrics = {
      tasksCompleted: 0,
      tasksFailed: 0,
      successRate: 1.0,
      avgResponseTime: 0,
      totalResponseTime: 0,
      messagesReceived: 0,
      messagesSent: 0
    };
    
    this.messageBus = null;
    this.subscriptions = new Set();
    
    this.llmConfig = config.llmConfig || {
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 2000
    };
  }

  initialize(messageBus) {
    this.messageBus = messageBus;
    this.messageBus.registerAgent(this);
    
    this.subscribe('broadcast');
    this.subscribe(this.id);
    this.subscribe(this.role);
    
    console.log(`[Agent:${this.id}] ${this.codename} initialized`);
    this.emit('initialized');
  }

  subscribe(channel) {
    if (this.messageBus) {
      this.messageBus.subscribe(this.id, channel);
      this.subscriptions.add(channel);
    }
  }

  unsubscribe(channel) {
    if (this.messageBus) {
      this.messageBus.unsubscribe(this.id, channel);
      this.subscriptions.delete(channel);
    }
  }

  async receiveMessage(message) {
    this.metrics.messagesReceived++;
    
    const previousStatus = this.status;
    this.status = 'busy';
    this.currentTask = message;
    
    const startTime = Date.now();
    
    try {
      const result = await this.processMessage(message);
      
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, true);
      
      if (message.type === MessageTypes.QUERY || 
          message.type === MessageTypes.DELEGATE ||
          message.type === MessageTypes.COMMAND) {
        await this.respond(message.sender, result);
      }
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, false);
      
      await this.sendError(message.sender, error);
      throw error;
    } finally {
      this.status = previousStatus === 'error' ? 'error' : 'idle';
      this.currentTask = null;
    }
  }

  async processMessage(message) {
    return {
      status: 'received',
      agent: this.id,
      timestamp: new Date().toISOString()
    };
  }

  async send(recipients, type, payload, priority = Priority.NORMAL) {
    const message = new Message({
      sender: this.id,
      recipients: Array.isArray(recipients) ? recipients : [recipients],
      type,
      payload,
      priority
    });

    this.metrics.messagesSent++;
    return this.messageBus.send(message);
  }

  async respond(to, data, priority = Priority.NORMAL) {
    return this.send(to, MessageTypes.RESPONSE, {
      inReplyTo: this.currentTask?.id,
      data,
      agent: this.id,
      codename: this.codename
    }, priority);
  }

  async sendError(to, error) {
    return this.send(to, MessageTypes.ERROR, {
      inReplyTo: this.currentTask?.id,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, Priority.HIGH);
  }

  async broadcast(channel, type, payload) {
    return this.messageBus.broadcast(channel, {
      sender: this.id,
      type,
      payload
    });
  }

  async query(targetAgent, query, timeout = 30000) {
    return new Promise(async (resolve, reject) => {
      const queryId = `${this.id}-${Date.now()}`;
      
      const timeoutId = setTimeout(() => {
        reject(new Error(`Query to ${targetAgent} timed out after ${timeout}ms`));
      }, timeout);

      await this.send(targetAgent, MessageTypes.QUERY, {
        id: queryId,
        query,
        timeout
      }, Priority.HIGH);
    });
  }

  getQuote() {
    if (this.quotes.length === 0) return '';
    return this.quotes[Math.floor(Math.random() * this.quotes.length)];
  }

  applyPersonality(text) {
    return text;
  }

  updateMetrics(responseTime, success) {
    if (success) {
      this.metrics.tasksCompleted++;
    } else {
      this.metrics.tasksFailed++;
    }
    
    this.metrics.totalResponseTime += responseTime;
    this.metrics.avgResponseTime = 
      this.metrics.totalResponseTime / (this.metrics.tasksCompleted + this.metrics.tasksFailed);
    
    this.metrics.successRate = 
      this.metrics.tasksCompleted / (this.metrics.tasksCompleted + this.metrics.tasksFailed);
  }

  remember(key, value) {
    this.context.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  recall(key) {
    const data = this.context.get(key);
    return data ? data.value : null;
  }

  hasSkill(skill) {
    return this.skills.includes(skill);
  }

  canDecide(decisionType, amount = 0) {
    const authority = this.decisionAuthority[decisionType];
    if (!authority) return false;
    
    if (typeof authority === 'boolean') return authority;
    if (typeof authority === 'number') return amount <= authority;
    
    return false;
  }

  getStatus() {
    return {
      id: this.id,
      name: this.name,
      codename: this.codename,
      role: this.role,
      status: this.status,
      skills: this.skills,
      metrics: this.metrics,
      currentTask: this.currentTask ? {
        id: this.currentTask.id,
        type: this.currentTask.type,
        sender: this.currentTask.sender
      } : null
    };
  }

  async shutdown() {
    this.status = 'offline';
    if (this.messageBus) {
      this.messageBus.unregisterAgent(this.id);
    }
    console.log(`[Agent:${this.id}] ${this.codename} shutdown`);
  }

  emit(event, data) {
    console.log(`[Agent:${this.id}] Event: ${event}`, data);
  }
}

module.exports = { BaseAgent };
