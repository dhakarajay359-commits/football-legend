// Procedural Web Audio API sound engine + optional speech commentary

export class SoundManager {
  private ctx: AudioContext | null = null;
  private crowdGain: GainNode | null = null;
  public muted = false;
  public commentaryEnabled = true;

  public init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.startCrowdAmbience();
  }

  public setMuted(m: boolean) {
    this.muted = m;
    if (this.crowdGain && this.ctx) {
      this.crowdGain.gain.setTargetAtTime(m ? 0 : 0.045, this.ctx.currentTime, 0.1);
    }
  }

  private startCrowdAmbience() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 2.5;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.7;

    this.crowdGain = this.ctx.createGain();
    this.crowdGain.gain.value = this.muted ? 0 : 0.045;

    noise.connect(filter);
    filter.connect(this.crowdGain);
    this.crowdGain.connect(this.ctx.destination);
    noise.start();
  }

  public play(sound: string) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    switch (sound) {
      case 'kick':
      case 'pass': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(sound === 'kick' ? 145 : 190, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.11);
        gain.gain.setValueAtTime(sound === 'kick' ? 0.35 : 0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.13);
        break;
      }
      case 'bounce': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
        break;
      }
      case 'post': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.3);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.33);
        break;
      }
      case 'whistle':
      case 'whistle_long': {
        const dur = sound === 'whistle_long' ? 0.55 : 0.22;
        const osc = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2750, now);
        lfo.frequency.value = 38;
        lfoGain.gain.value = 160;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        lfo.start(now);
        osc.stop(now + dur + 0.02);
        lfo.stop(now + dur + 0.02);
        break;
      }
      case 'goal': {
        if (this.crowdGain) {
          this.crowdGain.gain.setTargetAtTime(0.22, now, 0.15);
          this.crowdGain.gain.setTargetAtTime(0.045, now + 2.4, 0.8);
        }
        break;
      }
      case 'save': {
        if (this.crowdGain) {
          this.crowdGain.gain.setTargetAtTime(0.12, now, 0.1);
          this.crowdGain.gain.setTargetAtTime(0.045, now + 1.0, 0.5);
        }
        break;
      }
      case 'tackle':
      case 'skill': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(sound === 'tackle' ? 95 : 260, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.14);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
        break;
      }
    }
  }

  public speakCommentary(text: string) {
    if (this.muted || !this.commentaryEnabled || !('speechSynthesis' in window)) return;
    if (window.speechSynthesis.speaking) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.12;
    utter.pitch = 1.02;
    utter.volume = 0.65;
    window.speechSynthesis.speak(utter);
  }
}
