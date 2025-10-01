// Sound Manager for tips and gifts notifications
class SoundManager {
  constructor() {
    this.sounds = {};
    this.volume = 0.5;
    this.enabled = true;
    this.initialized = false;
    
    // Initialize sounds
    this.initializeSounds();
  }

  initializeSounds() {
    // Define sound URLs (we'll use free sound effects from CDN)
    this.soundUrls = {
      // Tip sounds
      tipSmall: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      tipMedium: 'https://www.soundjay.com/misc/sounds/cash-register-02.wav',
      tipLarge: 'https://www.soundjay.com/misc/sounds/cash-register-01.wav',
      
      // Gift sounds by rarity
      giftCommon: 'https://www.soundjay.com/misc/sounds/pop-1.wav',
      giftRare: 'https://www.soundjay.com/misc/sounds/magic-chime-01.wav',
      giftEpic: 'https://www.soundjay.com/misc/sounds/magic-chime-02.wav',
      giftLegendary: 'https://www.soundjay.com/misc/sounds/fanfare-1.wav',
      giftMythic: 'https://www.soundjay.com/misc/sounds/fanfare-3.wav',
      
      // Special effects
      achievement: 'https://www.soundjay.com/misc/sounds/achievement-1.wav',
      celebration: 'https://www.soundjay.com/misc/sounds/applause-2.wav',
      notification: 'https://www.soundjay.com/misc/sounds/notification-1.wav'
    };
    
    // Create Audio objects
    this.sounds = {
      tipSmall: new Audio(),
      tipMedium: new Audio(),
      tipLarge: new Audio(),
      giftCommon: new Audio(),
      giftRare: new Audio(),
      giftEpic: new Audio(),
      giftLegendary: new Audio(),
      giftMythic: new Audio(),
      achievement: new Audio(),
      celebration: new Audio(),
      notification: new Audio()
    };
    
    // Set volumes
    Object.values(this.sounds).forEach(audio => {
      audio.volume = this.volume;
    });
    
    this.initialized = true;
  }

  // Play tip sound based on amount
  playTipSound(amount) {
    if (!this.enabled || !this.initialized) return;
    
    try {
      let sound;
      if (amount < 500) {
        sound = this.sounds.tipSmall;
      } else if (amount < 2000) {
        sound = this.sounds.tipMedium;
      } else {
        sound = this.sounds.tipLarge;
      }
      
      // Clone and play to allow overlapping sounds
      const audioClone = sound.cloneNode();
      audioClone.volume = this.volume;
      audioClone.play().catch(e => console.log('Audio play failed:', e));
    } catch (error) {
      console.error('Error playing tip sound:', error);
    }
  }

  // Play gift sound based on rarity
  playGiftSound(rarity) {
    if (!this.enabled || !this.initialized) return;
    
    try {
      const soundMap = {
        common: this.sounds.giftCommon,
        rare: this.sounds.giftRare,
        epic: this.sounds.giftEpic,
        legendary: this.sounds.giftLegendary,
        mythic: this.sounds.giftMythic
      };
      
      const sound = soundMap[rarity] || this.sounds.giftCommon;
      const audioClone = sound.cloneNode();
      audioClone.volume = this.volume;
      audioClone.play().catch(e => console.log('Audio play failed:', e));
    } catch (error) {
      console.error('Error playing gift sound:', error);
    }
  }

  // Play special effect sound
  playSpecialSound(type) {
    if (!this.enabled || !this.initialized) return;
    
    try {
      const sound = this.sounds[type];
      if (sound) {
        const audioClone = sound.cloneNode();
        audioClone.volume = this.volume;
        audioClone.play().catch(e => console.log('Audio play failed:', e));
      }
    } catch (error) {
      console.error('Error playing special sound:', error);
    }
  }

  // Set volume (0-1)
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    Object.values(this.sounds).forEach(audio => {
      audio.volume = this.volume;
    });
  }

  // Toggle sound on/off
  toggleSound() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // Enable sounds
  enable() {
    this.enabled = true;
  }

  // Disable sounds
  disable() {
    this.enabled = false;
  }
}

// Create singleton instance
const soundManager = new SoundManager();

export default soundManager;