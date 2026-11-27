import { FootballEngine } from '../../shared/engine.js';
import { HALF_LENGTH, HALF_WIDTH } from '../../shared/constants.js';
import { InputManager } from '../controls/InputManager.js';
import { SoundManager } from '../audio/SoundManager.js';
import { SceneRenderer } from './SceneRenderer.js';
import { GameStore } from '../state/GameStore.js';
import { MultiplayerClient } from '../network/MultiplayerClient.js';
import { cgSDK } from '../sdk/CrazyGamesSDK.js';

export interface MatchConfig {
  mode: 'match' | 'penalty_shootout' | 'free_kick' | 'training';
  teamSize?: 5 | 11;
  drill?: string;
  homeTeam: any;
  awayTeam: any;
  localTwoPlayer?: boolean;
  onlineClient?: MultiplayerClient;
  onlineSlot?: string;
  onFinish?: (result: { homeGoals: number; awayGoals: number; stats: any; trainingScore?: number }) => void;
  onExit: () => void;
}

export class MatchSession {
  private container: HTMLElement;
  private store: GameStore;
  private config: MatchConfig;
  private renderer: SceneRenderer;
  private input: InputManager;
  private sound: SoundManager;
  private engine: FootballEngine | null = null;
  private rafId = 0;
  private lastTime = 0;
  private paused = false;
  private finishedHandled = false;
  private remoteState: any = null;

  // DOM HUD elements
  private scoreHomeEl!: HTMLElement;
  private scoreAwayEl!: HTMLElement;
  private clockEl!: HTMLElement;
  private bannerEl!: HTMLElement;
  private playerBarEl!: HTMLElement;
  private awayBarEl!: HTMLElement;
  private awayStaminaEl!: HTMLElement;
  private staminaEl!: HTMLElement;
  private eventTickerEl!: HTMLElement;
  private radarCanvas!: HTMLCanvasElement;
  private pauseModalEl!: HTMLElement;
  private fulltimeModalEl!: HTMLElement;

  constructor(container: HTMLElement, store: GameStore, config: MatchConfig) {
    this.container = container;
    this.store = store;
    this.config = config;
    this.sound = new SoundManager();
    this.sound.setMuted(store.settings.muted);
    this.sound.commentaryEnabled = store.settings.commentary;

    this.input = new InputManager();
    this.input.localTwoPlayer = Boolean(config.localTwoPlayer);

    this.container.innerHTML = '';
    const viewport = document.createElement('div');
    viewport.className = 'match-container';
    this.container.appendChild(viewport);

    this.renderer = new SceneRenderer(viewport);
    this.renderer.cameraMode = store.settings.cameraMode;
    this.renderer.cameraZoom = store.settings.cameraZoom;
    this.renderer.cameraAngle = store.settings.cameraAngle;

    this.buildHUD(viewport);

    // Ensure Away team never clashes visually with Home team kit color
    const awayTeamResolved = { ...config.awayTeam, kit: { ...config.awayTeam.kit } };
    if (awayTeamResolved.kit.primary.toLowerCase() === config.homeTeam.kit.primary.toLowerCase()) {
      awayTeamResolved.kit.primary = awayTeamResolved.kit.secondary === config.homeTeam.kit.primary ? '#ef4444' : awayTeamResolved.kit.secondary;
      awayTeamResolved.kit.secondary = '#111827';
    }
    this.config.awayTeam = awayTeamResolved;

    if (config.onlineClient) {
      // Authoritative server mode
      this.remoteState = null;
    } else {
      this.engine = new FootballEngine({
        mode: config.mode,
        teamSize: config.teamSize || 11,
        drill: config.drill,
        difficulty: store.settings.difficulty,
        matchDurationSec: store.settings.matchDurationSec,
        stadiumId: store.settings.stadiumId,
        weather: store.settings.weather,
        timeOfDay: store.settings.timeOfDay,
        homeTeam: config.homeTeam,
        awayTeam: config.awayTeam,
        humanTeams: {
          home: 'p1',
          away: config.localTwoPlayer ? 'p2' : 'ai'
        }
      });

      this.renderer.initMatchVisuals(
        this.engine.serializeState(),
        this.engine.teams,
        store.settings.stadiumId,
        store.settings.timeOfDay,
        store.settings.weather
      );
    }

    window.addEventListener('keydown', this.onGlobalKey);
    this.sound.init();
    cgSDK.gameplayStart();
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public receiveOnlineState(state: any) {
    if (!this.remoteState) {
      this.renderer.initMatchVisuals(
        state,
        { home: this.config.homeTeam, away: this.config.awayTeam },
        this.store.settings.stadiumId,
        this.store.settings.timeOfDay,
        this.store.settings.weather
      );
    }
    this.remoteState = state;
  }

  private onGlobalKey = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      this.togglePause();
    }
  };

  private togglePause() {
    if (this.config.onlineClient) return; // Online matches don't pause server clock
    this.paused = !this.paused;
    this.pauseModalEl.style.display = this.paused ? 'flex' : 'none';
    if (this.paused) cgSDK.gameplayStop(); else cgSDK.gameplayStart();
  }

  private buildHUD(viewport: HTMLElement) {
    const hud = document.createElement('div');
    hud.className = 'hud-overlay';
    hud.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div class="scoreboard" style="padding:6px 14px; gap:10px;">
          <span class="clock-pill" id="hud-clock" style="font-size:14px; font-weight:800;">00'</span>
          <span style="color:${this.config.homeTeam.badgeColor}; font-weight:900;">${this.config.homeTeam.shortName}</span>
          <span class="score-num" id="hud-sh" style="background:#f8fafc; color:#0f172a;">0</span>
          <span style="color:#94a3b8">-</span>
          <span class="score-num" id="hud-sa" style="background:#f8fafc; color:#0f172a;">0</span>
          <span style="color:${this.config.awayTeam.badgeColor}; font-weight:900;">${this.config.awayTeam.shortName}</span>
        </div>
        <div style="display:flex; gap:10px; pointer-events:auto;">
          <button class="btn" id="hud-cam-btn" style="display:flex; align-items:center; gap:8px; padding:7px 14px; font-size:12px; background:rgba(8,13,28,0.88); color:#fff; border:1px solid rgba(56,189,248,0.55); box-shadow:inset 0 1px 1px rgba(255,255,255,0.25), 0 6px 18px rgba(0,0,0,0.6); backdrop-filter:blur(10px);">
            <svg width="16" height="16" viewBox="0 0 24 24"><rect x="2" y="6" width="14" height="12" rx="3" fill="#38bdf8" stroke="#e0f2fe" stroke-width="1.5"/><polygon points="16,10 22,7 22,17 16,14" fill="#0284c7" stroke="#e0f2fe" stroke-width="1.2"/></svg>
            <span id="hud-cam-label">${this.store.settings.cameraMode.toUpperCase()}</span>
          </button>
          <button class="btn" id="hud-pause-btn" style="display:grid; place-items:center; width:38px; height:36px; padding:0; background:rgba(8,13,28,0.88); color:#fff; border:1px solid rgba(250,204,21,0.55); box-shadow:inset 0 1px 1px rgba(255,255,255,0.25), 0 6px 18px rgba(0,0,0,0.6); backdrop-filter:blur(10px);">
            <svg width="15" height="15" viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1.5" fill="#facc15"/><rect x="14" y="4" width="5" height="16" rx="1.5" fill="#facc15"/></svg>
          </button>
        </div>
      </div>

      <div id="hud-ticker" style="align-self:center; background:rgba(8,13,28,0.85); padding:6px 16px; border-radius:999px; font-size:13px; border:1px solid rgba(255,255,255,0.16); display:none;"></div>

      <div class="hud-bottom">
        <div class="player-bar" style="border-left:4px solid ${this.config.homeTeam.badgeColor};">
          <div id="hud-player-name" style="font-weight:800; font-size:15px;">Player</div>
          <div class="stamina-track"><div class="stamina-fill" id="hud-stamina" style="width:100%;"></div></div>
        </div>
        <canvas class="radar-canvas" id="hud-radar" width="190" height="115"></canvas>
        <div style="width:240px;"></div>
      </div>
    `;
    viewport.appendChild(hud);

    this.scoreHomeEl = hud.querySelector('#hud-sh')!;
    this.scoreAwayEl = hud.querySelector('#hud-sa')!;
    this.clockEl = hud.querySelector('#hud-clock')!;
    this.playerBarEl = hud.querySelector('#hud-player-name')!;
    this.staminaEl = hud.querySelector('#hud-stamina')!;
    this.eventTickerEl = hud.querySelector('#hud-ticker')!;
    this.radarCanvas = hud.querySelector('#hud-radar')!;

    hud.querySelector('#hud-cam-btn')!.addEventListener('click', () => {
      const modes: Array<'broadcast' | 'dynamic' | 'tele' | 'pro' | 'drone'> = ['broadcast', 'dynamic', 'tele', 'pro', 'drone'];
      const next = modes[(modes.indexOf(this.renderer.cameraMode) + 1) % modes.length];
      this.renderer.cameraMode = next;
      const lbl = hud.querySelector('#hud-cam-label');
      if (lbl) lbl.textContent = next.toUpperCase();
    });

    hud.querySelector('#hud-pause-btn')!.addEventListener('click', () => {
      if (this.config.onlineClient) {
        this.cleanup();
        this.config.onExit();
      } else {
        this.togglePause();
      }
    });

    // Goal / Half-time Banner
    this.bannerEl = document.createElement('div');
    this.bannerEl.className = 'goal-banner display-font';
    this.bannerEl.style.display = 'none';
    viewport.appendChild(this.bannerEl);

    // Mobile Touch Controls
    if (this.store.settings.showTouchControls) {
      this.buildTouchControls(viewport);
    }

    // Pause & Tactics Modal
    this.pauseModalEl = document.createElement('div');
    this.pauseModalEl.style.cssText = 'position:absolute; inset:0; background:rgba(4,8,20,0.85); display:none; align-items:center; justify-content:center; z-index:30;';
    this.pauseModalEl.innerHTML = `
      <div class="panel" style="width:460px; max-width:92vw;">
        <h2 class="display-font" style="font-size:36px; margin-bottom:12px;">Match Pause & Tactics</h2>
        <div style="display:grid; gap:12px; margin-bottom:18px;">
          <label>Formation
            <select id="pause-form">
              <option value="4-3-3">4-3-3</option>
              <option value="4-4-2">4-4-2</option>
              <option value="3-5-2">3-5-2</option>
              <option value="4-2-3-1">4-2-3-1</option>
              <option value="5-3-2">5-3-2</option>
            </select>
          </label>
          <label>Tactic
            <select id="pause-tactic">
              <option value="balanced">Balanced</option>
              <option value="high_press">High Press</option>
              <option value="counter_attack">Counter Attack</option>
              <option value="tiki_taka">Possession</option>
              <option value="park_the_bus">Ultra Defensive</option>
            </select>
          </label>
        </div>
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button class="btn btn-danger" id="pause-quit">Quit Match</button>
          <button class="btn btn-primary" id="pause-resume">Resume</button>
        </div>
      </div>
    `;
    viewport.appendChild(this.pauseModalEl);

    this.pauseModalEl.querySelector('#pause-form')!.addEventListener('change', (e) => {
      this.engine?.setFormation('home', (e.target as HTMLSelectElement).value);
    });
    this.pauseModalEl.querySelector('#pause-tactic')!.addEventListener('change', (e) => {
      this.engine?.setTactic('home', (e.target as HTMLSelectElement).value);
    });
    this.pauseModalEl.querySelector('#pause-resume')!.addEventListener('click', () => this.togglePause());
    this.pauseModalEl.querySelector('#pause-quit')!.addEventListener('click', () => {
      this.cleanup();
      this.config.onExit();
    });

    // Full-time Summary Modal
    this.fulltimeModalEl = document.createElement('div');
    this.fulltimeModalEl.style.cssText = 'position:absolute; inset:0; background:rgba(4,8,20,0.9); display:none; align-items:center; justify-content:center; z-index:35;';
    viewport.appendChild(this.fulltimeModalEl);
  }

  private buildTouchControls(viewport: HTMLElement) {
    const tc = document.createElement('div');
    tc.className = 'touch-controls';
    tc.innerHTML = `
      <div class="joystick-zone" id="touch-joy">
        <div class="joystick-knob" id="touch-knob"></div>
      </div>
      <div class="action-arc">
        <button class="arc-btn arc-shoot" data-act="shoot" style="right:20px; bottom:138px; width:78px; height:78px;">Shoot</button>
        <button class="arc-btn arc-through" data-act="through" style="right:114px; bottom:114px; width:70px; height:70px;">Through</button>
        <button class="arc-btn arc-pass" data-act="pass" style="right:138px; bottom:24px; width:72px; height:72px;">Pass</button>
        <button class="arc-btn arc-sprint" id="btn-sprint" style="right:30px; bottom:28px; width:82px; height:82px;">Sprint<br/>&amp; Skill</button>
        <button class="arc-btn" data-act="tackle" style="right:224px; bottom:24px; width:56px; height:56px; font-size:10px;">Tackle</button>
        <button class="arc-btn" data-act="switch" style="right:214px; bottom:94px; width:56px; height:56px; font-size:10px;">Switch</button>
      </div>
    `;
    viewport.appendChild(tc);

    const joy = tc.querySelector('#touch-joy') as HTMLElement;
    const knob = tc.querySelector('#touch-knob') as HTMLElement;
    let activeTouch = false;
    const handleMove = (cx: number, cy: number) => {
      const rect = joy.getBoundingClientRect();
      const dx = cx - (rect.left + rect.width / 2);
      const dy = cy - (rect.top + rect.height / 2);
      const maxR = rect.width / 2;
      const clampedX = Math.max(-1, Math.min(1, dx / maxR));
      const clampedZ = Math.max(-1, Math.min(1, dy / maxR));
      this.input.touchMoveX = clampedX;
      this.input.touchMoveZ = clampedZ;
      knob.style.transform = `translate(${clampedX * 34}px, ${clampedZ * 34}px)`;
    };
    joy.addEventListener('pointerdown', (e) => { activeTouch = true; handleMove(e.clientX, e.clientY); });
    window.addEventListener('pointermove', (e) => { if (activeTouch) handleMove(e.clientX, e.clientY); });
    window.addEventListener('pointerup', () => {
      activeTouch = false;
      this.input.touchMoveX = 0;
      this.input.touchMoveZ = 0;
      knob.style.transform = 'translate(0px, 0px)';
    });

    const sprintBtn = tc.querySelector('#btn-sprint') as HTMLElement;
    sprintBtn.addEventListener('pointerdown', () => { this.input.touchSprint = true; });
    window.addEventListener('pointerup', () => { this.input.touchSprint = false; });

    tc.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('pointerdown', () => {
        this.input.triggerTouchAction((btn as HTMLElement).dataset.act!);
      });
    });
  }

  private loop = (now: number) => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (this.paused) return;

    let state: any = null;
    if (this.config.onlineClient) {
      const p1In = this.input.getInput('p1', dt);
      this.config.onlineClient.send({ type: 'input', input: p1In });
      state = this.remoteState;
    } else if (this.engine) {
      this.engine.setInput('p1', this.input.getInput('p1', dt));
      if (this.config.localTwoPlayer) {
        this.engine.setInput('p2', this.input.getInput('p2', dt));
      }
      this.engine.step(dt);
      state = this.engine.serializeState();
    }

    if (!state) return;

    this.renderer.render(state, dt, now / 1000);
    this.updateHUD(state);

    // Play sounds & SDK happytime on goals
    for (const s of state.soundQueue || []) {
      this.sound.play(s);
      if (s === 'goal') cgSDK.happytime();
    }

    if (state.phase === 'fulltime' && !this.finishedHandled) {
      this.finishedHandled = true;
      cgSDK.gameplayStop();
      this.showFulltimeSummary(state);
    }
  };

  private updateHUD(state: any) {
    this.scoreHomeEl.textContent = String(state.score.home);
    this.scoreAwayEl.textContent = String(state.score.away);

    if (state.mode === 'training') {
      this.clockEl.textContent = `PTS: ${state.training?.score || 0}`;
    } else if (state.mode === 'penalty_shootout') {
      this.clockEl.textContent = `PEN R${state.shootout?.round || 1}`;
    } else {
      this.clockEl.textContent = `${String(state.minute).padStart(2, '0')}'`;
    }

    // Banner
    if (state.phase === 'goal') {
      this.bannerEl.textContent = 'GOAL!';
      this.bannerEl.style.display = 'block';
    } else if (state.phase === 'halftime') {
      this.bannerEl.textContent = 'HALF-TIME';
      this.bannerEl.style.display = 'block';
    } else {
      this.bannerEl.style.display = 'none';
    }

    // Active player info
    const p = state.players.find((pl: any) => pl.id === state.controlled.home);
    if (p) {
      this.playerBarEl.textContent = `${p.number} ${p.name}`;
      this.staminaEl.style.width = `${p.stamina}%`;
    }

    // Event ticker
    if (state.events && state.events.length > 0) {
      this.eventTickerEl.style.display = 'block';
      this.eventTickerEl.textContent = state.events[0].text;
    }

    // Radar minimap
    const ctx = this.radarCanvas.getContext('2d');
    if (ctx) {
      const w = this.radarCanvas.width;
      const h = this.radarCanvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.beginPath();
      ctx.moveTo(w / 2, 2);
      ctx.lineTo(w / 2, h - 2);
      ctx.stroke();

      for (const pl of state.players) {
        if (pl.redCard) continue;
        const rx = ((pl.x + HALF_LENGTH) / (HALF_LENGTH * 2)) * w;
        const rz = ((pl.z + HALF_WIDTH) / (HALF_WIDTH * 2)) * h;
        ctx.fillStyle = pl.team === 'home' ? '#00e5ff' : '#ef4444';
        ctx.beginPath();
        ctx.arc(rx, rz, pl.id === state.controlled.home ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      const bx = ((state.ball.x + HALF_LENGTH) / (HALF_LENGTH * 2)) * w;
      const bz = ((state.ball.z + HALF_WIDTH) / (HALF_WIDTH * 2)) * h;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(bx, bz, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private showFulltimeSummary(state: any) {
    const hs = state.stats.home;
    const as = state.stats.away;
    const totalPoss = Math.max(1, hs.possessionTicks + as.possessionTicks);
    const homePoss = Math.round((hs.possessionTicks / totalPoss) * 100);

    this.fulltimeModalEl.style.display = 'flex';
    this.fulltimeModalEl.innerHTML = `
      <div class="panel" style="width:520px; max-width:94vw; text-align:center;">
        <h2 class="display-font" style="font-size:44px; color:var(--accent);">FULL-TIME</h2>
        <div style="font-size:32px; font-weight:900; margin:10px 0;">
          ${this.config.homeTeam.shortName} ${state.score.home} - ${state.score.away} ${this.config.awayTeam.shortName}
        </div>
        <table class="table-clean" style="margin:16px 0;">
          <tr><td>${homePoss}%</td><th>Possession</th><td>${100 - homePoss}%</td></tr>
          <tr><td>${hs.shots} (${hs.shotsOnTarget})</td><th>Shots (On Target)</th><td>${as.shots} (${as.shotsOnTarget})</td></tr>
          <tr><td>${hs.passesCompleted}/${hs.passes}</td><th>Passes</th><td>${as.passesCompleted}/${as.passes}</td></tr>
          <tr><td>${hs.tackles}</td><th>Tackles</th><td>${as.tackles}</td></tr>
          <tr><td>${hs.saves}</td><th>Saves</th><td>${as.saves}</td></tr>
        </table>
        <div style="font-size:13px; color:var(--gold); margin-bottom:16px;">
          Man of the Match: ${state.players.find((p: any) => p.team === (state.score.home >= state.score.away ? 'home' : 'away') && p.index === 9)?.name || 'Striker'}
        </div>
        <button class="btn btn-primary" id="ft-continue">Continue</button>
      </div>
    `;

    this.fulltimeModalEl.querySelector('#ft-continue')!.addEventListener('click', () => {
      this.config.onFinish?.({
        homeGoals: state.score.home,
        awayGoals: state.score.away,
        stats: state.stats,
        trainingScore: state.training?.score
      });
      cgSDK.showMidgameAd(
        (m) => this.sound.setMuted(m || this.store.settings.muted),
        () => {
          this.cleanup();
          this.config.onExit();
        }
      );
    });
  }

  public cleanup() {
    cgSDK.gameplayStop();
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.onGlobalKey);
    this.input.destroy();
    this.renderer.destroy();
  }
}
