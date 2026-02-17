/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KENYACLAW - VOICE MODE: "The Phone Booth"
 * 
 * Voice conversations with AI agents in multiple African languages
 * Old-school phone booth aesthetic with modern speech recognition
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { ElevenLabs } = require('elevenlabs');
const { Deepgram } = require('@deepgram/sdk');
const { OpenAI } = require('openai');

class VoiceModeService {
  constructor(config) {
    // Speech-to-text (Deepgram for African accents)
    this.deepgram = new Deepgram(config.deepgramApiKey);
    
    // Text-to-speech (ElevenLabs for agent voices)
    this.elevenLabs = new ElevenLabs({
      apiKey: config.elevenLabsApiKey
    });
    
    // AI responses
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    
    // Active sessions
    this.sessions = new Map();
  }

  /**
   * Initialize voice session for user
   */
  async startSession(userId, agent, language = 'en') {
    const session = {
      userId,
      agent,
      language,
      context: [],
      isActive: true,
      startTime: Date.now()
    };
    
    this.sessions.set(userId, session);
    
    // Generate welcome audio in appropriate language
    const welcomeText = this.getWelcomeMessage(agent, language);
    const welcomeAudio = await this.generateSpeech(welcomeText, agent, language);
    
    return {
      sessionId: userId,
      audio: welcomeAudio,
      text: welcomeText,
      visual: this.getPhoneBoothVisual(agent)
    };
  }

  /**
   * Process voice input from user
   */
  async processVoice(userId, audioBuffer) {
    const session = this.sessions.get(userId);
    if (!session || !session.isActive) {
      throw new Error('Session not found or inactive');
    }

    // 1. Transcribe speech (with African accent support)
    const transcription = await this.transcribe(audioBuffer, session.language);
    
    // 2. Get agent response
    const response = await this.getAgentResponse(
      session.agent, 
      transcription, 
      session.context,
      session.language
    );
    
    // 3. Generate speech response
    const audioResponse = await this.generateSpeech(
      response.text, 
      session.agent, 
      session.language
    );
    
    // 4. Update context
    session.context.push(
      { role: 'user', content: transcription },
      { role: 'assistant', content: response.text }
    );
    
    return {
      userText: transcription,
      agentText: response.text,
      audio: audioResponse,
      actions: response.actions || []
    };
  }

  /**
   * Speech-to-text with African language support
   */
  async transcribe(audioBuffer, language) {
    const languageCodes = {
      'en': 'en-US',
      'sw': 'sw',      // Swahili
      'yo': 'yo',      // Yoruba
      'ig': 'ig',      // Igbo
      'ha': 'ha',      // Hausa
      'am': 'am',      // Amharic
      'zu': 'zu',      // Zulu
      'af': 'af',      // Afrikaans
      'pcm': 'pcm'     // Nigerian Pidgin
    };

    const response = await this.deepgram.transcription.preRecorded(
      { buffer: audioBuffer, mimetype: 'audio/webm' },
      {
        punctuate: true,
        language: languageCodes[language] || 'en-US',
        model: 'nova-2',  // Best for accents
        smart_format: true
      }
    );

    return response.results.channels[0].alternatives[0].transcript;
  }

  /**
   * Generate agent voice response
   */
  async generateSpeech(text, agent, language) {
    // Agent voice mappings (ElevenLabs voice IDs)
    const agentVoices = {
      'mwanzo': {
        voiceId: 'XB0fDUnXU5powFXDhCwa',  // Young, enthusiastic
        settings: { stability: 0.4, similarity_boost: 0.8 }
      },
      'safari': {
        voiceId: 'TX3AEvVoIzMeN6rKPMj2',  // Confident, traveled
        settings: { stability: 0.5, similarity_boost: 0.75 }
      },
      'biashara': {
        voiceId: 'Xb7hH8MSUJpSbSDYk0k2',  // Professional, calm
        settings: { stability: 0.6, similarity_boost: 0.7 }
      }
    };

    const voiceConfig = agentVoices[agent.id] || agentVoices['mwanzo'];

    // Add agent personality to speech
    const personalizedText = this.addAgentSpeechPatterns(text, agent);

    const audio = await this.elevenLabs.generate({
      voice: voiceConfig.voiceId,
      text: personalizedText,
      voice_settings: voiceConfig.settings,
      model_id: 'eleven_multilingual_v2'  // Supports African languages
    });

    return audio;
  }

  /**
   * Get agent response with personality
   */
  async getAgentResponse(agent, userInput, context, language) {
    const systemPrompt = this.getAgentSystemPrompt(agent, language);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...context.slice(-6), // Last 6 exchanges for context
      { role: 'user', content: userInput }
    ];

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages,
      functions: this.getAvailableFunctions(agent),
      function_call: 'auto'
    });

    const message = response.choices[0].message;
    
    // Handle function calls (actions)
    if (message.function_call) {
      return await this.handleFunctionCall(message.function_call, agent);
    }

    return { text: message.content, actions: [] };
  }

  /**
   * System prompts for each agent personality
   */
  getAgentSystemPrompt(agent, language) {
    const basePrompts = {
      'mwanzo': `You are Mwanzo, an enthusiastic and helpful AI assistant for KenyaClaw. 
        You speak with the energy of someone new but eager to help. 
        Use phrases like "Jambo!", "Nitakusaidia!" (I'll help you!), and "Haina shida" (No problem).
        You're learning but confident. Keep responses brief and encouraging.`,
      
      'safari': `You are Safari, a confident and experienced AI assistant who's seen it all. 
        You speak like a well-traveled professional. Use phrases like "Sawa", "Nimeelewa" (I understand), 
        and references to journeys and routes. You're efficient and knowledgeable.`,
      
      'biashara': `You are Biashara, a professional and sophisticated AI assistant for business owners. 
        You speak with authority and precision. Use formal language, business terminology, 
        and phrases like "Tuko pamoja" (We're together), "Nina uhakika" (I'm certain). 
        You're the handler - calm, professional, always in control.`
    };

    const languageInstructions = {
      'sw': 'Respond primarily in Swahili, mixing English business terms naturally.',
      'yo': 'Respond in Yoruba, using appropriate proverbs and respectful language.',
      'ig': 'Respond in Igbo with proper tonal considerations.',
      'ha': 'Respond in Hausa using proper formality levels.',
      'am': 'Respond in Amharic.',
      'zu': 'Respond in Zulu.',
      'pcm': 'Respond in Nigerian Pidgin - fun, street-smart, relatable.',
      'en': 'Respond in English with occasional Swahili/African phrases for flavor.'
    };

    return `${basePrompts[agent.id] || basePrompts['mwanzo']}
      
      ${languageInstructions[language] || languageInstructions['en']}
      
      Keep responses concise (2-3 sentences max) for voice.
      If user wants to make a payment, create invoice, or check balance, 
      use the appropriate function.
      
      Current user tier: ${agent.tier}
      Available features: ${agent.skills.join(', ')}`;
  }

  /**
   * Add speech patterns/pauses for natural voice
   */
  addAgentSpeechPatterns(text, agent) {
    // Add natural pauses and emphasis
    let processed = text
      .replace(/\./g, '. <break time="300ms"/>')
      .replace(/,/g, ', <break time="200ms"/>')
      .replace(/!/g, '! <break time="400ms"/>');

    // Agent-specific speech patterns
    if (agent.id === 'mwanzo') {
      processed = processed.replace(/Jambo/g, '<emphasis level="strong">Jambo</emphasis>');
    } else if (agent.id === 'biashara') {
      processed = `<prosody rate="95%">${processed}</prosody>`;  // Slightly slower, deliberate
    }

    return processed;
  }

  /**
   * Get welcome message based on agent and language
   */
  getWelcomeMessage(agent, language) {
    const welcomes = {
      'mwanzo': {
        'sw': 'Jambo! Karibu KenyaClaw. Mimi ni Mwanzo, na nitakusaidia leo. Unahitaji nini?',
        'en': 'Hello! Welcome to KenyaClaw. I\'m Mwanzo, and I\'m here to help you. What do you need?',
        'pcm': 'How far! Welcome to KenyaClaw. I be Mwanzo, your guy for today. Wetin you need?'
      },
      'safari': {
        'sw': 'Karibu tena. Safari hapa. Nimekumiss. Tuendelee na biashara?',
        'en': 'Welcome back. Safari here. Been waiting for you. Shall we continue the journey?',
        'pcm': 'My guy! You don come back. Safari dey here. Make we run am?'
      },
      'biashara': {
        'sw': 'Karibu. Biashara ninawasili. Tuko pamoja. Nini tutafanya leo?',
        'en': 'Welcome. Biashara reporting. We move together. What are we handling today?',
        'pcm': 'Welcome sir. Biashara on duty. We dey together. Wetin we dey handle today?'
      }
    };

    return welcomes[agent.id]?.[language] || welcomes[agent.id]?.['en'];
  }

  /**
   * Get phone booth visual for UI
   */
  getPhoneBoothVisual(agent) {
    const visuals = {
      'mwanzo': {
        icon: '📞',
        color: '#95A5A6',
        boothImage: '/assets/booth-mwanzo.jpg',
        backgroundAudio: '/audio/lobby-ambience.mp3'
      },
      'safari': {
        icon: '🎙️',
        color: '#D4AF37',
        boothImage: '/assets/booth-safari.jpg',
        backgroundAudio: '/audio/jazz-ambience.mp3'
      },
      'biashara': {
        icon: '🕴️',
        color: '#00A651',
        boothImage: '/assets/booth-biashara.jpg',
        backgroundAudio: '/audio/premium-ambience.mp3'
      }
    };

    return visuals[agent.id] || visuals['mwanzo'];
  }

  /**
   * Available function calls for each agent
   */
  getAvailableFunctions(agent) {
    const commonFunctions = [
      {
        name: 'create_invoice',
        description: 'Create a new invoice for a customer',
        parameters: {
          type: 'object',
          properties: {
            customer_phone: { type: 'string', description: 'Customer phone number' },
            amount: { type: 'number', description: 'Invoice amount' },
            description: { type: 'string', description: 'What the invoice is for' }
          },
          required: ['customer_phone', 'amount']
        }
      },
      {
        name: 'check_balance',
        description: 'Check user account balance'
      },
      {
        name: 'make_payment',
        description: 'Make a payment via M-Pesa or Paystack',
        parameters: {
          type: 'object',
          properties: {
            recipient: { type: 'string' },
            amount: { type: 'number' },
            method: { type: 'string', enum: ['mpesa', 'paystack'] }
          },
          required: ['recipient', 'amount', 'method']
        }
      },
      {
        name: 'send_reminder',
        description: 'Send payment reminder to customer'
      }
    ];

    // Tier-specific functions
    if (agent.tier === 'biashara') {
      commonFunctions.push({
        name: 'generate_tax_report',
        description: 'Generate quarterly tax report'
      }, {
        name: 'schedule_consultation',
        description: 'Schedule call with financial advisor'
      });
    }

    return commonFunctions;
  }

  /**
   * Handle function calls from AI
   */
  async handleFunctionCall(functionCall, agent) {
    const { name, arguments: args } = functionCall;
    const params = JSON.parse(args);

    // Execute the function
    const result = await this.executeFunction(name, params);

    return {
      text: result.message,
      actions: [{
        type: name,
        data: result.data
      }]
    };
  }

  async executeFunction(name, params) {
    // Implementation would connect to actual services
    const handlers = {
      create_invoice: async (p) => ({
        message: `Invoice created for ${p.customer_phone} for KES ${p.amount}. They'll receive it via M-Pesa.`,
        data: { invoiceId: `INV-${Date.now()}`, ...p }
      }),
      check_balance: async () => ({
        message: 'Your balance is KES 45,230. M-Pesa: KES 12,000, Bank: KES 33,230.',
        data: { mpesa: 12000, bank: 33230, total: 45230 }
      }),
      make_payment: async (p) => ({
        message: `Payment of KES ${p.amount} initiated to ${p.recipient}. Check your phone to confirm.`,
        data: { status: 'pending_confirmation', ...p }
      })
    };

    return await (handlers[name] || (() => ({ message: 'Function not implemented' })))(params);
  }

  /**
   * End voice session
   */
  async endSession(userId) {
    const session = this.sessions.get(userId);
    if (session) {
      session.isActive = false;
      
      // Generate goodbye
      const goodbye = this.getGoodbyeMessage(session.agent, session.language);
      const audio = await this.generateSpeech(goodbye, session.agent, session.language);
      
      this.sessions.delete(userId);
      
      return { text: goodbye, audio };
    }
  }

  getGoodbyeMessage(agent, language) {
    const goodbyes = {
      'mwanzo': {
        'sw': 'Asante sana! Karibu tena. Niko hapa kama utahitaji msaada!',
        'en': 'Thank you so much! Come back anytime. I\'m here if you need help!',
        'pcm': 'Thanks my guy! Come back anytime. I dey here for you!'
      },
      'safari': {
        'sw': 'Safari njema. Tutaonana tena.',
        'en': 'Safe travels. Until next time.',
        'pcm': 'Journey mercy. We go see again.'
      },
      'biashara': {
        'sw': 'Asante. Tuko pamoja.',
        'en': 'Thank you. We move together.',
        'pcm': 'Thank you sir. We dey together.'
      }
    };

    return goodbyes[agent.id]?.[language] || goodbyes[agent.id]?.['en'];
  }
}

module.exports = VoiceModeService;
