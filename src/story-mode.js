/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KENYACLAW - STORY MODE: "A Day in the Life"
 * 
 * Gamified business simulation where users are "members" of the Continental
 * Episodes, achievements, rewards, and cinematic storytelling
 * ═══════════════════════════════════════════════════════════════════════════
 */

class StoryModeService {
  constructor(db) {
    this.db = db;
    this.episodes = this.defineEpisodes();
    this.achievements = this.defineAchievements();
  }

  /**
   * Define all story episodes
   */
  defineEpisodes() {
    return {
      'episode-1': {
        id: 'episode-1',
        title: 'The First Mark',
        subtitle: 'Every legend starts somewhere',
        description: 'Create your first invoice and receive payment',
        tier: 'mwanzo',
        duration: '5-10 minutes',
        rewards: {
          goldCoins: 50,
          badge: 'first-blood',
          xp: 100
        },
        scenes: [
          {
            id: 'scene-1-1',
            title: 'The Invitation',
            narrative: `Charon greets you at the door of the Continental. 
              "Welcome. I see potential in you. But potential means nothing without proof. 
              Your first test awaits."`,
            agent: 'charon',
            action: 'intro',
            visual: '/assets/scenes/continental-entrance.jpg'
          },
          {
            id: 'scene-1-2',
            title: 'The Request',
            narrative: `A message arrives. A client needs your service, 
              but they need proof you\'re serious. "Create an invoice," Charon advises. 
              "Show them you\'re a professional."`,
            agent: 'mwanzo',
            action: 'task',
            task: {
              type: 'create_invoice',
              instructions: 'Create your first invoice. Add a customer, service description, and amount.',
              validation: (invoice) => invoice && invoice.amount > 0 && invoice.customer
            }
          },
          {
            id: 'scene-1-3',
            title: 'The Wait',
            narrative: `The invoice is sent. Now comes the hardest part - waiting. 
              But not for long. Your phone buzzes. M-Pesa confirms: payment received.`,
            agent: 'charon',
            action: 'milestone',
            trigger: 'payment_received',
            visual: '/assets/scenes/mpesa-notification.jpg'
          },
          {
            id: 'scene-1-4',
            title: 'The Mark',
            narrative: `Charon nods approvingly. "You\'ve earned your first mark. 
              This is just the beginning. The Continental recognizes those who deliver." 
              A gold coin appears in your account.`,
            agent: 'charon',
            action: 'reward',
            reward_animation: 'coin-drop'
          }
        ]
      },

      'episode-2': {
        id: 'episode-2',
        title: 'The Nairobi Connection',
        subtitle: 'Business knows no borders',
        description: 'Send or receive an international payment',
        tier: 'safari',
        required: ['episode-1'],
        duration: '10-15 minutes',
        rewards: {
          goldCoins: 100,
          badge: 'globetrotter',
          xp: 250,
          unlock: 'international_transfers'
        },
        scenes: [
          {
            id: 'scene-2-1',
            title: 'The Call',
            narrative: `Safari appears, adjusting her aviator sunglasses. 
              "Word travels fast. You\'ve got a client in Lagos. They want to pay you. 
              But Nigerian Naira to Kenyan Shillings? That\'s a journey."`,
            agent: 'safari',
            action: 'intro',
            visual: '/assets/scenes/safari-office.jpg'
          },
          {
            id: 'scene-2-2',
            title: 'The Route',
            narrative: `"Here\'s the map," Safari says, unfolding a digital display. 
              "M-Pesa in Kenya. Paystack in Nigeria. The money crosses borders like a ghost. 
              Untraceable. Instant. Your job: make it happen."`,
            agent: 'safari',
            action: 'educational',
            content: {
              type: 'payment_routes',
              countries: ['Kenya', 'Nigeria', 'Ghana', 'Tanzania', 'South Africa'],
              methods: ['M-Pesa', 'Paystack', 'Chipper Cash', 'Bank Transfer']
            }
          },
          {
            id: 'scene-2-3',
            title: 'The Handoff',
            narrative: `You set up the payment link. Your Lagos client receives it. 
              Safari watches the transaction flow on her screen. 
              "Kenya... Nigeria... clearing... done."`,
            agent: 'safari',
            action: 'task',
            task: {
              type: 'receive_international_payment',
              instructions: 'Share your payment link with an international client',
              validation: (tx) => tx && tx.currency !== 'KES' && tx.status === 'completed'
            }
          },
          {
            id: 'scene-2-4',
            title: 'The Globe',
            narrative: `"You\'re not just local anymore," Safari smiles. 
              "You\'re connected. Africa is your playground now." 
              A world map lights up with your first international connection.`,
            agent: 'safari',
            action: 'reward',
            reward_animation: 'map-lightup'
          }
        ]
      },

      'episode-3': {
        id: 'episode-3',
        title: 'The Taxman Cometh',
        subtitle: 'Even the Continental pays its dues',
        description: 'Complete your first tax filing',
        tier: 'biashara',
        required: ['episode-2'],
        duration: '20-30 minutes',
        rewards: {
          goldCoins: 200,
          badge: 'clean-hands',
          xp: 500,
          unlock: 'tax_advisor_access'
        },
        scenes: [
          {
            id: 'scene-3-1',
            title: 'The Audit',
            narrative: `Biashara sits at her desk, a stack of files before her. 
              "The taxman is coming. Not metaphorically. KRA. iTax. 
              Every shilling you\'ve earned, they want their cut."`,
            agent: 'biashara',
            action: 'intro',
            visual: '/assets/scenes/biashara-office.jpg'
          },
          {
            id: 'scene-3-2',
            title: 'The Ledger',
            narrative: `"But we\'re prepared," she continues, opening your digital ledger. 
              "Every invoice. Every payment. Every expense. Organized. Clean. 
              This is what separates amateurs from professionals."`,
            agent: 'biashara',
            action: 'review',
            content: {
              type: 'financial_summary',
              show: ['revenue', 'expenses', 'taxable_income', 'vat_collected']
            }
          },
          {
            id: 'scene-3-3',
            title: 'The Filing',
            narrative: `Biashara walks you through the iTax portal. 
              "PIN number. Tax obligation. Upload your records. 
              The system does the math. We just need to verify."`,
            agent: 'biashara',
            action: 'task',
            task: {
              type: 'file_tax_return',
              instructions: 'Review and submit your quarterly tax return',
              validation: (filing) => filing && filing.status === 'submitted'
            }
          },
          {
            id: 'scene-3-4',
            title: 'The Clearance',
            narrative: `The confirmation arrives. Biashara stamps a virtual document. 
              "Clean. Your marker with the government is cleared. 
              Sleep well tonight." A "Tax Compliant" badge appears on your profile.`,
            agent: 'biashara',
            action: 'reward',
            reward_animation: 'stamp-approval'
          }
        ]
      },

      'episode-4': {
        id: 'episode-4',
        title: 'The Expansion',
        subtitle: 'One person can only do so much',
        description: 'Hire your first team member',
        tier: 'biashara',
        required: ['episode-3'],
        duration: '15-20 minutes',
        rewards: {
          goldCoins: 300,
          badge: 'employer',
          xp: 750,
          unlock: 'payroll_features'
        },
        scenes: [
          {
            id: 'scene-4-1',
            title: 'The Bottleneck',
            narrative: `You\'re overwhelmed. Too much business, not enough hands. 
              Biashara notices. "Growth requires delegation. You need someone. 
              The Continental can help you onboard them properly."`,
            agent: 'biashara',
            action: 'intro'
          },
          {
            id: 'scene-4-2',
            title: 'The Recruitment',
            narrative: `"First, documentation," Biashara instructs. 
              "KRA PIN for employee. NHIF. NSSF. Contracts. 
              Do it right from day one, or face consequences later."`,
            agent: 'biashara',
            action: 'educational',
            content: {
              type: 'employment_requirements',
              requirements: ['kra_pin', 'nhif', 'nssf', 'contract', 'bank_account']
            }
          },
          {
            id: 'scene-4-3',
            title: 'The First Payroll',
            narrative: `Your new hire starts. Biashara sets up the payroll system. 
              "Salary. Deductions. Net pay. All automatic. 
              They get their money, you stay compliant."`,
            agent: 'biashara',
            action: 'task',
            task: {
              type: 'process_payroll',
              instructions: 'Process payroll for your first employee',
              validation: (payroll) => payroll && payroll.employees.length > 0
            }
          }
        ]
      },

      'episode-5': {
        id: 'episode-5',
        title: 'The Empire',
        subtitle: 'You\'ve come a long way from the first mark',
        description: 'Reach 1 million in revenue',
        tier: 'biashara',
        required: ['episode-4'],
        rewards: {
          goldCoins: 1000,
          badge: 'legendary',
          xp: 2000,
          unlock: 'elite_status',
          title: 'Millionaire Member'
        },
        scenes: [
          {
            id: 'scene-5-1',
            title: 'The Milestone',
            narrative: `The numbers don\'t lie. 1,000,000 KES. 
              Biashara personally delivers the news. 
              "The Continental recognizes achievement. You\'re not just a member anymore."`,
            agent: 'biashara',
            action: 'milestone'
          },
          {
            id: 'scene-5-2',
            title: 'The Inner Circle',
            narrative: `"Welcome to the inner circle," a new voice says. 
              Winston appears. "You\'ve proven yourself. The High Table takes notice."`,
            agent: 'winston',
            action: 'reward',
            reward_animation: 'council-recognition'
          }
        ]
      }
    };
  }

  /**
   * Define achievement badges
   */
  defineAchievements() {
    return {
      'first-blood': {
        id: 'first-blood',
        name: 'First Blood',
        description: 'Created your first invoice',
        icon: '🩸',
        rarity: 'common'
      },
      'globetrotter': {
        id: 'globetrotter',
        name: 'Globetrotter',
        description: 'Completed an international transaction',
        icon: '🌍',
        rarity: 'uncommon'
      },
      'clean-hands': {
        id: 'clean-hands',
        name: 'Clean Hands',
        description: 'Filed taxes on time',
        icon: '🧼',
        rarity: 'rare'
      },
      'employer': {
        id: 'employer',
        name: 'Employer',
        description: 'Hired your first employee',
        icon: '👔',
        rarity: 'rare'
      },
      'legendary': {
        id: 'legendary',
        name: 'Legendary',
        description: 'Reached 1 million KES revenue',
        icon: '👑',
        rarity: 'legendary'
      },
      'speed-demon': {
        id: 'speed-demon',
        name: 'Speed Demon',
        description: 'Created and sent an invoice in under 60 seconds',
        icon: '⚡',
        rarity: 'uncommon'
      },
      'night-owl': {
        id: 'night-owl',
        name: 'Night Owl',
        description: 'Completed a transaction between midnight and 5am',
        icon: '🦉',
        rarity: 'common'
      },
      'blood-oath': {
        id: 'blood-oath',
        name: 'Blood Oath',
        description: 'Member for 1 year',
        icon: '🩸',
        rarity: 'epic'
      }
    };
  }

  /**
   * Get user's current story progress
   */
  async getUserProgress(userId) {
    const progress = await this.db.get('user_story_progress', userId) || {
      userId,
      currentEpisode: null,
      completedEpisodes: [],
      currentScene: null,
      goldCoins: 0,
      xp: 0,
      level: 1,
      badges: [],
      unlockedFeatures: [],
      startedAt: Date.now()
    };

    // Calculate level from XP
    progress.level = this.calculateLevel(progress.xp);
    
    // Get available episodes
    progress.availableEpisodes = this.getAvailableEpisodes(progress);
    
    return progress;
  }

  /**
   * Calculate user level from XP
   */
  calculateLevel(xp) {
    // Level formula: each level requires more XP
    // Level 1: 0 XP
    // Level 2: 100 XP
    // Level 3: 300 XP
    // Level 4: 600 XP
    // etc.
    let level = 1;
    let xpNeeded = 0;
    
    while (xp >= xpNeeded) {
      xpNeeded += level * 100;
      if (xp >= xpNeeded) level++;
    }
    
    return level;
  }

  /**
   * Get episodes available to user
   */
  getAvailableEpisodes(progress) {
    return Object.values(this.episodes).filter(episode => {
      // Check tier requirement
      const tierLevels = { mwanzo: 1, safari: 2, biashara: 3 };
      const userTierLevel = tierLevels[progress.tier] || 1;
      const requiredTierLevel = tierLevels[episode.tier] || 1;
      
      if (userTierLevel < requiredTierLevel) return false;
      
      // Check prerequisite episodes
      if (episode.required) {
        return episode.required.every(req => 
          progress.completedEpisodes.includes(req)
        );
      }
      
      return true;
    });
  }

  /**
   * Start an episode
   */
  async startEpisode(userId, episodeId) {
    const episode = this.episodes[episodeId];
    if (!episode) throw new Error('Episode not found');

    const progress = await this.getUserProgress(userId);
    
    // Check if already completed
    if (progress.completedEpisodes.includes(episodeId)) {
      return { error: 'Episode already completed', canReplay: true };
    }

    // Set current episode
    progress.currentEpisode = episodeId;
    progress.currentScene = episode.scenes[0].id;
    
    await this.db.set('user_story_progress', userId, progress);

    return {
      episode,
      currentScene: episode.scenes[0],
      progress
    };
  }

  /**
   * Advance to next scene
   */
  async advanceScene(userId, actionData = null) {
    const progress = await this.getUserProgress(userId);
    const episode = this.episodes[progress.currentEpisode];
    
    if (!episode) throw new Error('No active episode');

    // Find current scene index
    const currentSceneIndex = episode.scenes.findIndex(
      s => s.id === progress.currentScene
    );

    // Validate task completion if needed
    const currentScene = episode.scenes[currentSceneIndex];
    if (currentScene.task && actionData) {
      const isValid = currentScene.task.validation(actionData);
      if (!isValid) {
        return {
          success: false,
          error: 'Task requirements not met',
          retry: true
        };
      }
    }

    // Check if there's a next scene
    const nextSceneIndex = currentSceneIndex + 1;
    if (nextSceneIndex >= episode.scenes.length) {
      // Episode complete
      return this.completeEpisode(userId, episode);
    }

    // Advance to next scene
    const nextScene = episode.scenes[nextSceneIndex];
    progress.currentScene = nextScene.id;
    await this.db.set('user_story_progress', userId, progress);

    return {
      success: true,
      scene: nextScene,
      progress
    };
  }

  /**
   * Complete an episode
   */
  async completeEpisode(userId, episode) {
    const progress = await this.getUserProgress(userId);
    
    // Add to completed
    if (!progress.completedEpisodes.includes(episode.id)) {
      progress.completedEpisodes.push(episode.id);
    }

    // Award rewards
    progress.goldCoins += episode.rewards.goldCoins;
    progress.xp += episode.rewards.xp;
    progress.badges.push(episode.rewards.badge);
    
    if (episode.rewards.unlock) {
      progress.unlockedFeatures.push(episode.rewards.unlock);
    }

    // Clear current episode
    progress.currentEpisode = null;
    progress.currentScene = null;

    // Recalculate level
    progress.level = this.calculateLevel(progress.xp);

    await this.db.set('user_story_progress', userId, progress);

    return {
      success: true,
      completed: true,
      episode,
      rewards: episode.rewards,
      progress,
      nextEpisodes: this.getAvailableEpisodes(progress)
    };
  }

  /**
   * Check and award achievements
   */
  async checkAchievements(userId, action) {
    const progress = await this.getUserProgress(userId);
    const newAchievements = [];

    // Speed Demon
    if (action.type === 'create_invoice' && action.duration < 60000) {
      if (!progress.badges.includes('speed-demon')) {
        newAchievements.push(this.achievements['speed-demon']);
        progress.badges.push('speed-demon');
        progress.xp += 50;
      }
    }

    // Night Owl
    if (action.type === 'transaction' && this.isNightTime()) {
      if (!progress.badges.includes('night-owl')) {
        newAchievements.push(this.achievements['night-owl']);
        progress.badges.push('night-owl');
        progress.xp += 25;
      }
    }

    // Blood Oath (1 year membership)
    const memberDuration = Date.now() - progress.startedAt;
    if (memberDuration > 365 * 24 * 60 * 60 * 1000) {
      if (!progress.badges.includes('blood-oath')) {
        newAchievements.push(this.achievements['blood-oath']);
        progress.badges.push('blood-oath');
        progress.xp += 500;
      }
    }

    if (newAchievements.length > 0) {
      await this.db.set('user_story_progress', userId, progress);
    }

    return newAchievements;
  }

  isNightTime() {
    const hour = new Date().getHours();
    return hour >= 0 && hour < 5;
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit = 10) {
    // In production, this would query the database
    return [
      { rank: 1, name: 'Anonymous Legend', level: 15, xp: 15000, badge: 'legendary' },
      { rank: 2, name: 'Nairobi Hustler', level: 12, xp: 12000, badge: 'employer' },
      { rank: 3, name: 'Lagos Connect', level: 11, xp: 10500, badge: 'globetrotter' },
      // ... more entries
    ];
  }

  /**
   * Get user profile card
   */
  async getProfileCard(userId) {
    const progress = await this.getUserProgress(userId);
    
    return {
      level: progress.level,
      title: this.getTitleForLevel(progress.level),
      xp: progress.xp,
      xpToNextLevel: this.getXpToNextLevel(progress.xp),
      goldCoins: progress.goldCoins,
      badges: progress.badges.map(b => this.achievements[b]),
      completedEpisodes: progress.completedEpisodes.length,
      unlockedFeatures: progress.unlockedFeatures,
      memberSince: progress.startedAt
    };
  }

  getTitleForLevel(level) {
    const titles = {
      1: 'New Member',
      2: 'Rising Star',
      3: 'Associate',
      5: 'Professional',
      7: 'Expert',
      10: 'Master',
      15: 'Legend'
    };
    
    // Find highest applicable title
    let title = titles[1];
    for (const [lvl, t] of Object.entries(titles)) {
      if (level >= parseInt(lvl)) title = t;
    }
    
    return title;
  }

  getXpToNextLevel(currentXp) {
    const currentLevel = this.calculateLevel(currentXp);
    let xpNeeded = 0;
    for (let i = 1; i <= currentLevel; i++) {
      xpNeeded += i * 100;
    }
    return xpNeeded - currentXp;
  }
}

module.exports = StoryModeService;
