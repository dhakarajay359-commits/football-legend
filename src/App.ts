import { GameStore } from './state/GameStore.js';
import { MatchSession, MatchConfig } from './game/MatchSession.js';
import { MultiplayerClient } from './network/MultiplayerClient.js';
import { DIFFICULTIES, FORMATIONS, STADIUMS, TACTICS } from '../shared/constants.js';
import { cgSDK } from './sdk/CrazyGamesSDK.js';

type Screen =
  | 'home'
  | 'quick_match'
  | 'online'
  | 'offline'
  | 'career'
  | 'tournament'
  | 'events'
  | 'training'
  | 'team_mgmt'
  | 'customise'
  | 'settings'
  | 'profile';

export class App {
  private root: HTMLElement;
  private store = new GameStore();
  private screen: Screen = 'home';
  private activeMatch: MatchSession | null = null;
  private mpClient: MultiplayerClient | null = null;
  private mpStatus = 'Disconnected';
  private selectedHomeId = 'madrid_royals';
  private selectedAwayId = 'manchester_blues';
  private liveEvents: any[] = [];
  private globalLeaderboard: any[] = [];

  constructor(root: HTMLElement) {
    this.root = root;
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('room');
    if (inviteCode) {
      this.screen = 'online';
      this.render();
      setTimeout(() => {
        const inp = this.root.querySelector('#mp-code-in') as HTMLInputElement | null;
        if (inp) {
          inp.value = inviteCode.toUpperCase();
          (this.root.querySelector('#mp-join') as HTMLButtonElement | null)?.click();
        }
      }, 100);
      return;
    }
    this.render();
  }

  private icon3D(type: string, gold = false): string {
    const cls = gold ? 'badge-3d gold' : 'badge-3d';
    const stroke = gold ? '#0f172a' : '#f8fafc';
    const fill = gold ? '#0f172a' : '#38bdf8';
    const svgs: Record<string, string> = {
      play: `<polygon points="9,6 21,12 9,18" fill="${stroke}"/>`,
      online: `<circle cx="12" cy="12" r="8" fill="none" stroke="${stroke}" stroke-width="2"/><ellipse cx="12" cy="12" rx="3.5" ry="8" fill="none" stroke="${stroke}" stroke-width="1.6"/><line x1="4" y1="12" x2="20" y2="12" stroke="${stroke}" stroke-width="1.6"/>`,
      offline: `<rect x="4" y="7" width="16" height="10" rx="4" fill="none" stroke="${stroke}" stroke-width="2"/><circle cx="9" cy="12" r="1.5" fill="${fill}"/><circle cx="15" cy="12" r="1.5" fill="${fill}"/>`,
      career: `<path d="M4 9h16v9H4z" fill="none" stroke="${stroke}" stroke-width="2"/><path d="M9 9V6h6v3" fill="none" stroke="${stroke}" stroke-width="2"/>`,
      cup: `<path d="M7 5h10v5a5 5 0 0 1-10 0z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/><path d="M12 15v4M8 19h8" stroke="${stroke}" stroke-width="2"/>`,
      train: `<path d="M12 4L6 19h12z" fill="none" stroke="${stroke}" stroke-width="2"/><line x1="8" y1="14" x2="16" y2="14" stroke="${fill}" stroke-width="2"/>`,
      events: `<rect x="4" y="6" width="16" height="13" rx="2" fill="none" stroke="${stroke}" stroke-width="2"/><line x1="4" y1="10" x2="20" y2="10" stroke="${fill}" stroke-width="2"/>`,
      team: `<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" fill="${fill}" fill-opacity="0.35" stroke="${stroke}" stroke-width="2"/>`
    };
    return `<div class="${cls}"><svg width="20" height="20" viewBox="0 0 24 24">${svgs[type] || svgs.play}</svg></div>`;
  }

  private render() {
    if (this.activeMatch) return;

    const p = this.store.profile;
    if (this.screen === 'home') {
      const xpPct = Math.min(100, Math.round((p.xp / (p.level * 300)) * 100));
      const teams = this.store.getAllTeams();
      const featHome = teams.find((t) => t.id === this.selectedHomeId) || teams[0];
      const featAway = teams.find((t) => t.id === this.selectedAwayId && t.id !== featHome.id) || teams[1];
      const todayKey = new Date().toISOString().slice(0, 10);
      const claimedToday = localStorage.getItem('fl_daily_claim') === todayKey;

      this.root.innerHTML = `
        <div class="legends-home" style="background-image: linear-gradient(90deg, rgba(4, 8, 22, 0.88) 0%, rgba(4, 8, 22, 0.45) 45%, rgba(4, 8, 22, 0.55) 100%), radial-gradient(circle at 60% 25%, rgba(56, 189, 248, 0.25), transparent 55%), url('./assets/home-hero.jpg');">
          <div class="legends-topbar">
            <div class="legends-logo-wrap">
              <div style="display:flex; align-items:center; gap:14px;">
                <div class="legends-title">FOOTBALL<span>LEGENDS</span></div>
                <svg width="64" height="64" viewBox="0 0 80 80" style="filter:drop-shadow(0 8px 18px rgba(0,0,0,0.65));">
                  <defs>
                    <linearGradient id="crestGold" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stop-color="#fef08a"/><stop offset="50%" stop-color="#eab308"/><stop offset="100%" stop-color="#854d0e"/>
                    </linearGradient>
                    <radialGradient id="ball3d" cx="35%" cy="30%" r="65%">
                      <stop offset="0%" stop-color="#ffffff"/><stop offset="65%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#334155"/>
                    </radialGradient>
                  </defs>
                  <path d="M14 14 L66 14 L66 44 C66 60 40 72 40 72 C40 72 14 60 14 44 Z" fill="#0f172a" stroke="url(#crestGold)" stroke-width="4.5"/>
                  <path d="M18 18 L62 18 L62 43 C62 56 40 66 40 66 C40 66 18 56 18 43 Z" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
                  <circle cx="40" cy="40" r="15" fill="url(#ball3d)" stroke="#0f172a" stroke-width="1.5"/>
                  <polygon points="40,30 47,36 44,44 36,44 33,36" fill="#0f172a"/>
                  <polygon points="30,14 40,6 50,14" fill="url(#crestGold)"/>
                </svg>
              </div>
              <div class="legends-subtitle">PLAY • COMPETE • WIN</div>
            </div>
            <div class="legends-profile-bar">
              <div class="legends-pill" style="cursor:pointer;" id="top-prof">
                <span style="color:var(--gold); font-size:18px;">👑</span>
                <div>
                  <div>${p.username} <span style="color:var(--muted); font-size:11px;">Lv. ${p.level}</span></div>
                  <div class="xp-mini-track"><div class="xp-mini-fill" style="width:${xpPct}%;"></div></div>
                </div>
              </div>
              <div class="legends-pill" id="top-reward-ad" style="cursor:pointer; border-color:var(--gold);" title="Watch Ad for +500 Coins"><span style="color:var(--gold);">🪙</span> ${p.coins.toLocaleString()} <span class="badge-tag" style="background:var(--gold); color:#0f172a;">+500 AD</span></div>
              <div class="legends-pill"><span style="color:#c084fc;">💎</span> ${Math.max(10, p.wins * 25 + 100)}</div>
              <button class="legends-pill" id="top-settings" style="cursor:pointer; color:#fff;">⚙️</button>
            </div>
          </div>

          <div class="legends-body">
            <div class="legends-nav-col">
              <button class="nav-item-btn primary-gold" data-tile="play">
                <div class="nav-left">${this.icon3D('play', true)}<div><div class="nav-label">PLAY NOW</div><div class="nav-sub">Quick Match & 5v5 Rush</div></div></div>
                <span>›</span>
              </button>
              <button class="nav-item-btn" data-tile="online">
                <div class="nav-left">${this.icon3D('online')}<div><div class="nav-label" style="display:flex; align-items:center; gap:8px;">MULTIPLAYER <span class="badge-tag" style="background:#22c55e; color:#052e16;">LIVE</span></div><div class="nav-sub">Play Online 1v1 & 2v2</div></div></div>
                <span>›</span>
              </button>
              <button class="nav-item-btn" data-tile="offline">
                <div class="nav-left">${this.icon3D('offline')}<div><div class="nav-label">OFFLINE MODES</div><div class="nav-sub">Local 2P, Penalties & Free Kicks</div></div></div>
                <span>›</span>
              </button>
              <button class="nav-item-btn" data-tile="career">
                <div class="nav-left">${this.icon3D('career')}<div><div class="nav-label">CAREER MODE</div><div class="nav-sub">Build Your Legacy</div></div></div>
                <span>›</span>
              </button>
              <button class="nav-item-btn" data-tile="tournament">
                <div class="nav-left">${this.icon3D('cup')}<div><div class="nav-label">TOURNAMENT</div><div class="nav-sub">Compete for Glory</div></div></div>
                <span>›</span>
              </button>
              <button class="nav-item-btn" data-tile="training">
                <div class="nav-left">${this.icon3D('train')}<div><div class="nav-label">TRAINING</div><div class="nav-sub">Improve Your Skills</div></div></div>
                <span>›</span>
              </button>
              <button class="nav-item-btn" data-tile="events">
                <div class="nav-left">${this.icon3D('events')}<div><div class="nav-label">EVENTS</div><div class="nav-sub">Limited Time Challenges</div></div></div>
                <span>›</span>
              </button>
              <button class="nav-item-btn" data-tile="team_mgmt">
                <div class="nav-left">${this.icon3D('team')}<div><div class="nav-label">TEAM MANAGEMENT</div><div class="nav-sub">Formations, Tactics & Squad</div></div></div>
                <span>›</span>
              </button>
            </div>

            <div class="spotlight-pill">
              ${this.renderTeamCrest(featHome, 36)}
              <div style="text-align:center;">
                <div style="font-size:9px; color:var(--gold); font-weight:900; letter-spacing:0.12em;">FEATURED MATCHDAY</div>
                <div style="font-size:14px; font-weight:900;">${featHome.shortName} <span style="color:var(--muted);">VS</span> ${featAway.shortName}</div>
              </div>
              ${this.renderTeamCrest(featAway, 36)}
              <button class="btn btn-gold" id="quick-kickoff" style="padding:7px 14px; font-size:12px;">KICK OFF</button>
            </div>

            <div class="legends-right-col">
              <div class="promo-card promo-pass" id="promo-pass" style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
                <div style="flex:1;">
                  <div style="font-size:11px; color:#fde047; font-weight:800; letter-spacing:0.08em;">SEASON 1 • TIER ${p.level}</div>
                  <div class="display-font" style="font-size:32px; line-height:1;">FOOTBALL PASS</div>
                  <div style="font-size:12px; color:#e2e8f0; margin:4px 0 8px;">Exclusive Kits &amp; Coin Rewards</div>
                  ${claimedToday
                    ? `<div style="font-size:11px; color:#cbd5e1;">Daily Bonus Claimed ✓</div>`
                    : `<button class="btn btn-gold" id="claim-daily" style="padding:5px 12px; font-size:11px;">CLAIM +250 COINS</button>`}
                </div>
                <div style="width:66px; height:80px; border-radius:12px; background:linear-gradient(155deg,#fef08a,#eab308,#854d0e); display:grid; place-items:center; box-shadow:inset 0 2px 4px rgba(255,255,255,0.6), 0 10px 24px rgba(0,0,0,0.55); flex-shrink:0;">
                  <svg width="40" height="40" viewBox="0 0 24 24"><path d="M6 4h12v6a6 6 0 0 1-12 0z" fill="#fffbeb" stroke="#713f12" stroke-width="1.5"/><path d="M12 16v4M8 20h8" stroke="#713f12" stroke-width="2"/></svg>
                </div>
              </div>

              <div class="promo-card promo-event" id="promo-event">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-size:11px; color:var(--gold); font-weight:800;">NEXT EVENT</div>
                    <div style="font-size:22px; font-weight:900; margin:2px 0;">Dream Cup</div>
                  </div>
                  <span class="badge-tag" style="background:rgba(0,229,255,0.2); color:var(--accent); border:1px solid var(--accent);">850 COINS</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
                  <span style="font-size:11px; color:#cbd5e1;">Starts in: 2d 14h</span>
                  <button class="btn btn-gold" style="padding:6px 14px; font-size:12px;">JOIN NOW ›</button>
                </div>
              </div>
            </div>
          </div>

          <div class="legends-bottom-bar">
            <div class="dock-group">
              <button class="dock-btn" data-tile="profile"><span>🏆</span>LEADERBOARD</button>
              <button class="dock-btn" data-tile="profile"><span>🎖️</span>ACHIEVEMENTS</button>
              <button class="dock-btn" data-tile="customise"><span>👕</span>CUSTOMISE</button>
              <button class="dock-btn" id="dock-5v5"><span>⚡</span>5v5 RUSH</button>
            </div>
            <div style="font-style:italic; font-weight:700; font-size:18px; color:#e2e8f0; text-shadow:0 2px 10px rgba(0,0,0,0.8);">
              More Than Just a Game
            </div>
          </div>
        </div>
      `;
      this.bindHomeHandlers(this.root);
      return;
    }

    this.root.innerHTML = `
      <div class="menu-shell" style="background-image: linear-gradient(135deg, rgba(5, 8, 20, 0.9) 0%, rgba(11, 19, 43, 0.85) 55%, rgba(7, 16, 34, 0.92) 100%), url('./assets/home-hero.jpg');">
        <header class="top-bar">
          <div class="brand-logo" style="cursor:pointer;" id="nav-home">
            <div class="brand-badge">FL</div>
            <div>
              <div class="display-font" style="font-size:28px; line-height:1;">FOOTBALL LEGENDS</div>
              <div style="font-size:11px; color:var(--muted);">PLAY • COMPETE • WIN</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <button class="btn btn-secondary" id="back-home">← Main Menu</button>
            <div class="profile-pill">
              <span><strong>${p.username}</strong> • LVL ${p.level}</span>
              <span class="coin-badge">${p.coins} COINS</span>
              <span style="color:var(--accent-2);">${p.wins}W-${p.draws}D-${p.losses}L</span>
            </div>
          </div>
        </header>
        <main class="menu-content" id="menu-body"></main>
      </div>
    `;

    this.root.querySelector('#nav-home')?.addEventListener('click', () => this.go('home'));
    this.root.querySelector('#back-home')?.addEventListener('click', () => this.go('home'));

    const body = this.root.querySelector('#menu-body') as HTMLElement;
    switch (this.screen) {
      case 'quick_match': this.renderMatchSetup(body, false); break;
      case 'offline': this.renderOffline(body); break;
      case 'online': this.renderOnline(body); break;
      case 'career': this.renderCareer(body); break;
      case 'tournament': this.renderTournament(body); break;
      case 'events': this.renderEvents(body); break;
      case 'training': this.renderTraining(body); break;
      case 'team_mgmt': this.renderTeamMgmt(body); break;
      case 'customise': this.renderCustomise(body); break;
      case 'settings': this.renderSettings(body); break;
      case 'profile': this.renderProfile(body); break;
    }
  }

  private bindHomeHandlers(root: HTMLElement) {
    const map: Record<string, Screen> = {
      play: 'quick_match', online: 'online', offline: 'offline', career: 'career',
      tournament: 'tournament', events: 'events', training: 'training',
      team_mgmt: 'team_mgmt', customise: 'customise', settings: 'settings', profile: 'profile'
    };
    root.querySelectorAll('[data-tile]').forEach((el) => {
      el.addEventListener('click', () => this.go(map[(el as HTMLElement).dataset.tile!]));
    });
    root.querySelector('#top-prof')?.addEventListener('click', () => this.go('profile'));
    root.querySelector('#top-reward-ad')?.addEventListener('click', () => {
      cgSDK.showRewardedAd(
        () => {},
        () => {
          this.store.profile.coins += 500;
          this.store.save();
          this.render();
        }
      );
    });
    root.querySelector('#top-settings')?.addEventListener('click', () => this.go('settings'));
    root.querySelector('#claim-daily')?.addEventListener('click', (e) => {
      e.stopPropagation();
      localStorage.setItem('fl_daily_claim', new Date().toISOString().slice(0, 10));
      this.store.profile.coins += 250;
      this.store.save();
      this.render();
    });
    root.querySelector('#quick-kickoff')?.addEventListener('click', () => {
      const teams = this.store.getAllTeams();
      const home = teams.find((t) => t.id === this.selectedHomeId) || teams[0];
      const away = teams.find((t) => t.id === this.selectedAwayId && t.id !== home.id) || teams[1];
      this.startMatch({
        mode: 'match',
        teamSize: 11,
        homeTeam: home,
        awayTeam: away,
        onFinish: (res) => this.store.recordMatchResult('Quick Match', home.shortName, away.shortName, res.homeGoals, res.awayGoals, res.stats?.home?.saves || 0)
      });
    });
    root.querySelector('#promo-pass')?.addEventListener('click', () => this.go('profile'));
    root.querySelector('#promo-event')?.addEventListener('click', () => this.go('events'));
    root.querySelector('#dock-5v5')?.addEventListener('click', () => {
      const teams = this.store.getAllTeams();
      const home = teams[0];
      const away = teams.find((t) => t.id !== home.id && t.kit.primary !== home.kit.primary) || teams[1];
      this.startMatch({
        mode: 'match',
        teamSize: 5,
        homeTeam: home,
        awayTeam: away,
        onFinish: (res) => this.store.recordMatchResult('5v5 Rush', home.shortName, away.shortName, res.homeGoals, res.awayGoals, res.stats?.home?.saves || 0)
      });
    });
  }

  private go(s: Screen) {
    this.screen = s;
    this.render();
    if (s === 'events') this.fetchEvents();
    if (s === 'profile') this.fetchLeaderboard();
  }

  private startMatch(cfg: Omit<MatchConfig, 'onExit'>) {
    this.activeMatch = new MatchSession(this.root, this.store, {
      ...cfg,
      onExit: () => {
        this.activeMatch = null;
        this.render();
      }
    });
  }

  private renderHome(body: HTMLElement) {
    body.innerHTML = `
      <div class="hero-banner">
        <div class="hero-card">
          <div>
            <div style="color:var(--accent); font-weight:800; font-size:13px; letter-spacing:0.1em;">NEXT-GEN 3D SIMULATION</div>
            <h1 class="display-font">KICK OFF YOUR SEASON</h1>
            <p style="color:var(--muted); max-width:520px; font-size:14px;">
              Real-time 3D stadium football with 60Hz ball physics, curved shots, tactical AI, career progression, and authoritative online multiplayer.
            </p>
          </div>
          <div style="display:flex; gap:12px; margin-top:16px;">
            <button class="btn btn-primary" id="hero-play">Play 11v11 Match</button>
            <button class="btn btn-secondary" id="hero-5v5">Play 5v5 Rush (3m)</button>
            <button class="btn btn-success" id="hero-online">Online Multiplayer</button>
          </div>
        </div>
        <div class="panel" style="display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div style="font-size:12px; color:var(--gold); font-weight:800;">CLUB STATUS</div>
            <h3 style="font-size:22px; margin:6px 0;">${this.store.customTeam.enabled ? this.store.customTeam.name : 'Madrid Royals'}</h3>
            <p style="font-size:13px; color:var(--muted);">Difficulty: ${DIFFICULTIES[this.store.settings.difficulty as keyof typeof DIFFICULTIES]?.name || 'Professional'} • ${Math.round(this.store.settings.matchDurationSec / 60)}m Match</p>
          </div>
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:16px;">
            <div class="panel" style="padding:10px; text-align:center;">
              <div style="font-size:20px; font-weight:800; color:var(--accent);">${this.store.profile.goalsScored}</div>
              <div style="font-size:11px; color:var(--muted);">Goals</div>
            </div>
            <div class="panel" style="padding:10px; text-align:center;">
              <div style="font-size:20px; font-weight:800; color:var(--accent-2);">${this.store.profile.cleanSheets}</div>
              <div style="font-size:11px; color:var(--muted);">Clean Sheets</div>
            </div>
            <div class="panel" style="padding:10px; text-align:center;">
              <div style="font-size:20px; font-weight:800; color:var(--gold);">${this.store.profile.saves}</div>
              <div style="font-size:11px; color:var(--muted);">Saves</div>
            </div>
          </div>
        </div>
      </div>

      <div class="menu-grid">
        ${this.tile('play', 'Play Match', 'Jump straight into a 3D exhibition match vs AI')}
        ${this.tile('online', 'Online Multiplayer', '1v1, 2v2, Ranked, Private Rooms & Reconnect')}
        ${this.tile('offline', 'Offline Matches', 'Local 2P, Penalties, Free Kicks & Training Match')}
        ${this.tile('career', 'Career Mode', 'Manage a club or play as a rising football star')}
        ${this.tile('tournament', 'Tournament Mode', 'Knockout Cups & Full League Seasons')}
        ${this.tile('events', 'Events', 'Daily & Weekly challenges with live leaderboards')}
        ${this.tile('training', 'Practice & Training', '10 interactive 3D drills: Dribble, Shoot, GK & more')}
        ${this.tile('team_mgmt', 'Team Management', 'Formations (4-3-3, 4-4-2, 3-5-2), Tactics & Squads')}
        ${this.tile('customise', 'Player Customisation', 'Custom club, kits, badges & upgradeable star')}
        ${this.tile('settings', 'Settings', 'Camera, difficulty, stadium, weather & controls')}
        ${this.tile('profile', 'Profile & Statistics', 'Career stats, achievements, history & rankings')}
      </div>
    `;

    body.querySelector('#hero-play')?.addEventListener('click', () => this.go('quick_match'));
    body.querySelector('#hero-5v5')?.addEventListener('click', () => {
      const teams = this.store.getAllTeams();
      const home = teams[0];
      const away = teams.find((t) => t.id !== home.id && t.kit.primary !== home.kit.primary) || teams[1];
      this.startMatch({
        mode: 'match',
        teamSize: 5,
        homeTeam: home,
        awayTeam: away,
        onFinish: (res) => this.store.recordMatchResult('5v5 Rush', home.shortName, away.shortName, res.homeGoals, res.awayGoals, res.stats?.home?.saves || 0)
      });
    });
    body.querySelector('#hero-online')?.addEventListener('click', () => this.go('online'));

    const map: Record<string, Screen> = {
      play: 'quick_match', online: 'online', offline: 'offline', career: 'career',
      tournament: 'tournament', events: 'events', training: 'training',
      team_mgmt: 'team_mgmt', customise: 'customise', settings: 'settings', profile: 'profile'
    };
    body.querySelectorAll('[data-tile]').forEach((el) => {
      el.addEventListener('click', () => {
        const key = (el as HTMLElement).dataset.tile!;
        this.go(map[key]);
      });
    });
  }

  private tile(id: string, title: string, sub: string) {
    return `<button class="tile-btn" data-tile="${id}"><div class="tile-title">${title}</div><div class="tile-sub">${sub}</div></button>`;
  }

  private renderTeamCrest(team: any, size = 44): string {
    const uid = `g_${team.id}_${size}`;
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 64 64" style="flex-shrink:0; filter:drop-shadow(0 5px 10px rgba(0,0,0,0.55));">
        <defs>
          <linearGradient id="${uid}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.45"/>
            <stop offset="50%" stop-color="#ffffff" stop-opacity="0.05"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0.35"/>
          </linearGradient>
        </defs>
        <path d="M10 10 L54 10 L54 34 C54 48 32 58 32 58 C32 58 10 48 10 34 Z" fill="${team.kit.primary}" stroke="${team.badgeColor}" stroke-width="4.5"/>
        <path d="M10 26 L54 26 L54 34 C54 41 44 48 32 54 C20 48 10 41 10 34 Z" fill="${team.kit.secondary}" opacity="0.9"/>
        <path d="M10 10 L54 10 L54 34 C54 48 32 58 32 58 C32 58 10 48 10 34 Z" fill="url(#${uid})"/>
        <path d="M14 14 L50 14 L50 33 C50 44 32 53 32 53 C32 53 14 44 14 33 Z" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.2"/>
        <text x="32" y="37" text-anchor="middle" font-family="Teko, sans-serif" font-weight="700" font-size="18" fill="#ffffff" stroke="#0f172a" stroke-width="2.5" paint-order="stroke">${team.shortName}</text>
      </svg>
    `;
  }

  private renderStarCard(team: any): string {
    const star = team.squad[9] || team.squad[0];
    return `
      <div class="fut-card">
        <div class="fut-card-top">
          <span style="font-size:24px; line-height:1;">${star.ovr}</span>
          <span style="font-size:12px;">${star.role}</span>
        </div>
        <div style="margin:4px 0;">${this.renderTeamCrest(team, 36)}</div>
        <div style="font-weight:900; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${star.name}</div>
        <div class="fut-card-stats">
          <span>${star.pace} PAC</span><span>${star.dribbling} DRI</span>
          <span>${star.shooting} SHO</span><span>${star.defending} DEF</span>
          <span>${star.passing} PAS</span><span>${star.physical} PHY</span>
        </div>
      </div>
    `;
  }

  private renderMatchSetup(body: HTMLElement, localTwoPlayer: boolean) {
    const teams = this.store.getAllTeams();
    const home = teams.find((t) => t.id === this.selectedHomeId) || teams[0];
    const away = teams.find((t) => t.id === this.selectedAwayId) || teams[1];

    body.innerHTML = `
      <div class="panel">
        <div class="setup-header">
          <h2 class="display-font" style="font-size:38px; line-height:1;">${localTwoPlayer ? 'Local 2-Player Match' : 'Quick Match Setup'}</h2>
          <div class="setup-actions">
            <button class="btn btn-secondary" id="launch-5v5">Play 5v5 Rush</button>
            <button class="btn btn-gold" id="launch-match">Kick Off 11v11 →</button>
          </div>
        </div>

        <div class="matchup-banner">
          <div style="display:flex; align-items:center; gap:16px;">
            ${this.renderStarCard(home)}
            <div>
              <div style="font-size:11px; color:var(--accent); font-weight:800;">HOME</div>
              <div style="display:flex; align-items:center; gap:8px; margin:4px 0;">
                ${this.renderTeamCrest(home, 36)}
                <div style="font-size:22px; font-weight:900;">${home.name}</div>
              </div>
              <div style="font-size:12px; color:var(--muted);">ATT ${home.attack} • MID ${home.midfield} • DEF ${home.defense} • ${home.formation}</div>
            </div>
          </div>

          <div class="display-font" style="font-size:44px; color:var(--gold); padding:0 12px;">VS</div>

          <div style="display:flex; align-items:center; justify-content:flex-end; gap:16px; text-align:right;">
            <div>
              <div style="font-size:11px; color:var(--danger); font-weight:800;">AWAY</div>
              <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px; margin:4px 0;">
                <div style="font-size:22px; font-weight:900;">${away.name}</div>
                ${this.renderTeamCrest(away, 36)}
              </div>
              <div style="font-size:12px; color:var(--muted);">ATT ${away.attack} • MID ${away.midfield} • DEF ${away.defense} • ${away.formation}</div>
            </div>
            ${this.renderStarCard(away)}
          </div>
        </div>

        <div class="grid-2">
          <div>
            <h3 style="margin-bottom:10px; color:var(--accent);">Select Home Club / Nation</h3>
            <div class="custom-scroll" style="display:grid; grid-template-columns:repeat(2,1fr); gap:8px; max-height:310px; overflow-y:auto; padding-right:6px;">
              ${teams.map((t) => `
                <div class="team-card ${t.id === home.id ? 'selected' : ''}" data-home="${t.id}">
                  ${this.renderTeamCrest(t, 40)}
                  <div>
                    <div style="font-weight:800; font-size:14px;">${t.name}</div>
                    <div style="font-size:11px; color:var(--muted);">OVR ${t.rating} • ${t.formation}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <div>
            <h3 style="margin-bottom:10px; color:var(--danger);">Select Away Club / Nation</h3>
            <div class="custom-scroll" style="display:grid; grid-template-columns:repeat(2,1fr); gap:8px; max-height:310px; overflow-y:auto; padding-right:6px;">
              ${teams.map((t) => `
                <div class="team-card ${t.id === away.id ? 'selected' : ''}" data-away="${t.id}">
                  ${this.renderTeamCrest(t, 40)}
                  <div>
                    <div style="font-weight:800; font-size:14px;">${t.name}</div>
                    <div style="font-size:11px; color:var(--muted);">OVR ${t.rating} • ${t.formation}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    body.querySelectorAll('[data-home]').forEach((el) => {
      el.addEventListener('click', () => {
        this.selectedHomeId = (el as HTMLElement).dataset.home!;
        this.renderMatchSetup(body, localTwoPlayer);
      });
    });
    body.querySelectorAll('[data-away]').forEach((el) => {
      el.addEventListener('click', () => {
        this.selectedAwayId = (el as HTMLElement).dataset.away!;
        this.renderMatchSetup(body, localTwoPlayer);
      });
    });
    const launch = (teamSize: 5 | 11) => {
      const finalAway = away.id === home.id ? teams.find((t) => t.id !== home.id) || teams[1] : away;
      this.startMatch({
        mode: 'match',
        teamSize,
        homeTeam: home,
        awayTeam: finalAway,
        localTwoPlayer,
        onFinish: (res) => {
          this.store.recordMatchResult(localTwoPlayer ? 'Local 2P' : `${teamSize}v${teamSize} Match`, home.shortName, finalAway.shortName, res.homeGoals, res.awayGoals, res.stats?.home?.saves || 0);
        }
      });
    };
    body.querySelector('#launch-match')?.addEventListener('click', () => launch(11));
    body.querySelector('#launch-5v5')?.addEventListener('click', () => launch(5));
  }

  private renderOffline(body: HTMLElement) {
    const teams = this.store.getAllTeams();
    const home = teams[0];
    const away = teams[1];

    const modeCard = (id: string, icon: string, tag: string, title: string, sub: string, accent: string, gold = false) => `
      <button class="tile-btn" id="${id}" style="background:linear-gradient(155deg, rgba(16,24,48,0.92), rgba(10,16,34,0.96)); border-color:${accent}; justify-content:space-between; min-height:190px;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            ${this.icon3D(icon, gold)}
            <span class="badge-tag" style="background:rgba(255,255,255,0.08); color:${accent}; border:1px solid ${accent};">${tag}</span>
          </div>
          <div class="tile-title" style="margin-bottom:6px;">${title}</div>
          <div class="tile-sub">${sub}</div>
        </div>
        <div style="margin-top:14px; font-size:12px; font-weight:800; color:${gold ? 'var(--gold)' : 'var(--accent)'};">PLAY MODE →</div>
      </button>
    `;

    body.innerHTML = `
      <div style="display:flex; align-items:center; gap:14px; margin-bottom:20px;">
        ${this.icon3D('offline', true)}
        <div>
          <h2 class="display-font" style="font-size:42px; line-height:1;">OFFLINE GAME MODES</h2>
          <div style="font-size:13px; color:var(--muted);">Play solo against AI, challenge a friend locally, or master set pieces</div>
        </div>
      </div>
      <div class="menu-grid" style="grid-template-columns:repeat(auto-fill, minmax(250px, 1fr));">
        ${modeCard('off-quick', 'play', '11v11 / 5v5', 'Quick Match vs AI', 'Full match with custom teams, stadiums & difficulty', '#facc15', true)}
        ${modeCard('off-local2p', 'offline', '2 PLAYERS', 'Local 2-Player', 'Play on same device (WASD vs Arrows + Numpad)', '#38bdf8')}
        ${modeCard('off-pen', 'cup', '12 YARDS', 'Penalty Shootout', '5-kick shootout + sudden death from the penalty spot', '#22c55e')}
        ${modeCard('off-fk', 'events', 'SET PIECE', 'Free Kick Challenge', 'Curl shots over the 4-man wall & beat the keeper', '#c084fc')}
        ${modeCard('off-train-match', 'train', 'PRACTICE', 'Training Match', 'Practice full match tactics against Amateur AI', '#f97316')}
      </div>
    `;

    body.querySelector('#off-quick')?.addEventListener('click', () => this.renderMatchSetup(body, false));
    body.querySelector('#off-local2p')?.addEventListener('click', () => this.renderMatchSetup(body, true));
    body.querySelector('#off-pen')?.addEventListener('click', () => {
      this.startMatch({
        mode: 'penalty_shootout',
        homeTeam: home,
        awayTeam: away,
        onFinish: (res) => this.store.recordMatchResult('Penalty Shootout', home.shortName, away.shortName, res.homeGoals, res.awayGoals)
      });
    });
    body.querySelector('#off-fk')?.addEventListener('click', () => {
      this.startMatch({ mode: 'free_kick', homeTeam: home, awayTeam: away });
    });
    body.querySelector('#off-train-match')?.addEventListener('click', () => {
      this.store.settings.difficulty = 'amateur';
      this.startMatch({ mode: 'match', homeTeam: home, awayTeam: away });
    });
  }

  private renderOnline(body: HTMLElement) {
    const savedReconn = localStorage.getItem('apex_reconnect');
    const teams = this.store.getAllTeams();
    const selectedTeam = teams.find((t) => t.id === this.selectedHomeId) || teams[0];

    body.innerHTML = `
      <div class="panel" style="background:linear-gradient(145deg, rgba(13,20,38,0.92), rgba(15,23,42,0.88));">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; margin-bottom:20px; border-bottom:1px solid var(--border); padding-bottom:16px;">
          <div style="display:flex; align-items:center; gap:14px;">
            ${this.icon3D('online')}
            <div>
              <h2 class="display-font" style="font-size:38px; line-height:1;">Online Multiplayer Hub</h2>
              <div style="font-size:13px; display:flex; align-items:center; gap:8px; margin-top:4px;">
                <span id="mp-dot" style="width:9px; height:9px; border-radius:50%; background:${this.mpClient?.connected ? '#22c55e' : '#eab308'}; display:inline-block;"></span>
                <span id="mp-status" style="color:var(--accent); font-weight:700;">${this.mpClient?.connected ? 'Connected (60Hz Authoritative Server)' : 'Connecting to Server...'}</span>
              </div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.05); padding:8px 14px; border-radius:12px; border:1px solid var(--border);">
            ${this.renderTeamCrest(selectedTeam, 38)}
            <div>
              <div style="font-size:10px; color:var(--muted); font-weight:800;">YOUR ONLINE CLUB</div>
              <select id="mp-team-sel" style="padding:4px 8px; font-size:13px; font-weight:700; margin-top:2px;">
                ${teams.map((t) => `<option value="${t.id}" ${t.id === selectedTeam.id ? 'selected' : ''}>${t.name} (${t.rating})</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="grid-3">
          <div class="panel" style="border-color:rgba(56,189,248,0.35);">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
              ${this.icon3D('cup', true)}
              <h3 style="font-size:18px;">Live Matchmaking</h3>
            </div>
            <p style="font-size:12px; color:var(--muted); margin-bottom:14px;">Play real opponents on our 60Hz server-authoritative engine.</p>
            <div style="display:grid; gap:9px;">
              <button class="btn btn-gold" id="q-ranked">Ranked 1v1 Match</button>
              <button class="btn btn-primary" id="q-casual">Casual 1v1 Match</button>
              <button class="btn btn-secondary" id="q-2v2">2v2 Co-op Match</button>
            </div>
          </div>

          <div class="panel" style="border-color:rgba(34,197,94,0.35);">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
              ${this.icon3D('team')}
              <h3 style="font-size:18px;">Play With Friends</h3>
            </div>
            <p style="font-size:12px; color:var(--muted); margin-bottom:14px;">Match waits in the lobby until your friend joins via code or link.</p>
            <button class="btn btn-success" id="mp-create" style="width:100%; margin-bottom:10px;">Create Private Room</button>
            <div id="mp-invite-box" style="display:none; background:rgba(0,229,255,0.1); border:1px solid var(--accent); border-radius:10px; padding:10px; margin-bottom:10px; text-align:center;">
              <div style="font-size:10px; color:var(--muted); font-weight:800;">ROOM CODE (WAITING FOR FRIEND)</div>
              <div id="mp-room-code" style="font-size:26px; font-weight:900; letter-spacing:0.16em; color:var(--gold); margin:4px 0;"></div>
              <button class="btn btn-primary" id="mp-copy-link" style="padding:5px 12px; font-size:12px;">Copy Friend Invite Link</button>
            </div>
            <div style="display:flex; gap:8px;">
              <input id="mp-code-in" placeholder="Room Code (e.g. A7K2P9)" />
              <button class="btn btn-primary" id="mp-join">Join</button>
            </div>
          </div>

          <div class="panel">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
              ${this.icon3D('play')}
              <h3 style="font-size:18px;">Reconnection</h3>
            </div>
            <p style="font-size:12px; color:var(--muted); margin-bottom:14px;">Lost connection mid-match? Rejoin your active match slot within 45s.</p>
            <button class="btn btn-secondary" id="mp-reconn" style="width:100%;" ${savedReconn ? '' : 'disabled'}>Reconnect Last Match</button>
          </div>
        </div>
      </div>
    `;

    body.querySelector('#mp-team-sel')?.addEventListener('change', (e) => {
      this.selectedHomeId = (e.target as HTMLSelectElement).value;
      this.renderOnline(body);
    });

    const ensureConnected = (cb: () => void) => {
      if (this.mpClient?.connected) { cb(); return; }
      this.mpClient = new MultiplayerClient();
      this.mpClient.connect(this.store.profile.username, this.store.profile.id, (msg) => {
        const stEl = this.root.querySelector('#mp-status');
        const dotEl = this.root.querySelector('#mp-dot') as HTMLElement | null;
        if (msg.type === 'welcome') {
          this.mpStatus = 'Connected (60Hz Authoritative Server)';
          if (stEl) stEl.textContent = this.mpStatus;
          if (dotEl) dotEl.style.background = '#22c55e';
          cb();
        } else if (msg.type === 'queued') {
          this.mpStatus = `Searching ${msg.queue.replace('_', ' ')} (${msg.waiting} waiting)...`;
          if (stEl) stEl.textContent = this.mpStatus;
        } else if (msg.type === 'room_joined') {
          this.mpStatus = `Room ${msg.roomCode} (${msg.players}/${msg.needed} players) — Waiting for friend...`;
          if (stEl) stEl.textContent = this.mpStatus;
          const invBox = this.root.querySelector('#mp-invite-box') as HTMLElement | null;
          const codeEl = this.root.querySelector('#mp-room-code');
          if (invBox && codeEl) {
            invBox.style.display = 'block';
            codeEl.textContent = msg.roomCode;
          }
          this.root.querySelector('#mp-copy-link')?.addEventListener('click', () => {
            const url = `${window.location.origin}/?room=${msg.roomCode}`;
            navigator.clipboard?.writeText(url);
            const btn = this.root.querySelector('#mp-copy-link');
            if (btn) btn.textContent = 'Copied Invite Link!';
          });
        } else if (msg.type === 'match_start') {
          this.startMatch({
            mode: 'match',
            homeTeam: msg.teams.home,
            awayTeam: msg.teams.away,
            onlineClient: this.mpClient!,
            onlineSlot: this.mpClient!.slot || 'p1'
          });
        } else if (msg.type === 'state') {
          this.activeMatch?.receiveOnlineState(msg.state);
        } else if (msg.type === 'error') {
          this.mpStatus = `Error: ${msg.message}`;
          if (stEl) stEl.textContent = this.mpStatus;
        }
      });
    };

    // Auto-connect immediately on opening Online Multiplayer
    ensureConnected(() => {});

    body.querySelector('#q-ranked')?.addEventListener('click', () => ensureConnected(() => this.mpClient!.send({ type: 'queue', queue: 'ranked_1v1' })));
    body.querySelector('#q-casual')?.addEventListener('click', () => ensureConnected(() => this.mpClient!.send({ type: 'queue', queue: 'casual_1v1' })));
    body.querySelector('#q-2v2')?.addEventListener('click', () => ensureConnected(() => this.mpClient!.send({ type: 'queue', queue: 'casual_2v2' })));
    body.querySelector('#mp-create')?.addEventListener('click', () => ensureConnected(() => this.mpClient!.send({ type: 'create_room', format: '1v1', teamId: this.selectedHomeId })));
    body.querySelector('#mp-join')?.addEventListener('click', () => {
      const code = (body.querySelector('#mp-code-in') as HTMLInputElement).value;
      ensureConnected(() => this.mpClient!.send({ type: 'join_room', roomCode: code }));
    });
    body.querySelector('#mp-reconn')?.addEventListener('click', () => {
      if (!savedReconn) return;
      const { roomCode, token } = JSON.parse(savedReconn);
      ensureConnected(() => this.mpClient!.send({ type: 'reconnect', roomCode, reconnectToken: token }));
    });
  }

  private renderCareer(body: HTMLElement) {
    const teams = this.store.getAllTeams();
    if (!this.store.career) {
      body.innerHTML = `
        <div class="panel">
          <h2 class="display-font" style="font-size:40px; margin-bottom:10px;">Start Career Mode</h2>
          <p style="color:var(--muted); margin-bottom:18px;">Choose your club and lead them to the League Title.</p>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px,1fr)); gap:10px;">
            ${teams.slice(0, 8).map((t) => `
              <button class="team-card" data-car-team="${t.id}" style="text-align:left; color:#fff;">
                <div style="font-weight:800;">${t.name}</div>
                <div style="font-size:12px; color:var(--muted);">OVR ${t.rating}</div>
              </button>
            `).join('')}
          </div>
        </div>
      `;
      body.querySelectorAll('[data-car-team]').forEach((el) => {
        el.addEventListener('click', () => {
          const cid = (el as HTMLElement).dataset.carTeam!;
          const clubList = teams.slice(0, 8);
          this.store.career = {
            clubId: cid,
            budget: 50000000,
            matchday: 1,
            table: clubList.map((c) => ({ id: c.id, name: c.name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }))
          };
          this.store.save();
          this.renderCareer(body);
        });
      });
      return;
    }

    const car = this.store.career;
    const myClub = teams.find((t) => t.id === car.clubId) || teams[0];
    const oppClub = teams.filter((t) => t.id !== myClub.id)[car.matchday % 7];
    const sorted = [...car.table].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));

    body.innerHTML = `
      <div class="grid-2">
        <div class="panel">
          <h2 class="display-font" style="font-size:36px;">${myClub.name} — Matchday ${car.matchday}</h2>
          <p style="color:var(--gold); font-weight:700; margin-bottom:14px;">Transfer Budget: $${(car.budget / 1e6).toFixed(1)}M</p>
          <div class="panel" style="margin-bottom:14px;">
            <div style="font-size:12px; color:var(--muted);">NEXT LEAGUE FIXTURE</div>
            <div style="font-size:20px; font-weight:800; margin:6px 0;">${myClub.name} vs ${oppClub.name}</div>
            <button class="btn btn-primary" id="car-play">Play Match</button>
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-success" id="car-train">Train Squad (+1 OVR • $5M)</button>
            <button class="btn btn-danger" id="car-reset">New Career</button>
          </div>
        </div>
        <div class="panel">
          <h3 style="margin-bottom:10px;">League Standings</h3>
          <table class="table-clean">
            <tr><th>Club</th><th>P</th><th>W</th><th>GD</th><th>PTS</th></tr>
            ${sorted.map((r) => `
              <tr style="${r.id === myClub.id ? 'color:var(--accent); font-weight:800;' : ''}">
                <td>${r.name}</td><td>${r.p}</td><td>${r.w}</td><td>${r.gf - r.ga}</td><td>${r.pts}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      </div>
    `;

    body.querySelector('#car-play')?.addEventListener('click', () => {
      this.startMatch({
        mode: 'match',
        homeTeam: myClub,
        awayTeam: oppClub,
        onFinish: (res) => {
          const updateRow = (id: string, gf: number, ga: number) => {
            const row = car.table.find((x: any) => x.id === id);
            if (!row) return;
            row.p++; row.gf += gf; row.ga += ga;
            if (gf > ga) { row.w++; row.pts += 3; } else if (gf === ga) { row.d++; row.pts += 1; } else { row.l++; }
          };
          updateRow(myClub.id, res.homeGoals, res.awayGoals);
          updateRow(oppClub.id, res.awayGoals, res.homeGoals);
          car.matchday++;
          this.store.recordMatchResult('Career', myClub.shortName, oppClub.shortName, res.homeGoals, res.awayGoals);
        }
      });
    });

    body.querySelector('#car-train')?.addEventListener('click', () => {
      if (car.budget >= 5000000) {
        car.budget -= 5000000;
        myClub.rating = Math.min(95, myClub.rating + 1);
        this.store.save();
        this.renderCareer(body);
      }
    });

    body.querySelector('#car-reset')?.addEventListener('click', () => {
      this.store.career = null;
      this.store.save();
      this.renderCareer(body);
    });
  }

  private renderTournament(body: HTMLElement) {
    const teams = this.store.getAllTeams();
    if (!this.store.tournament) {
      this.store.tournament = {
        round: 'Quarter-Final',
        clubs: teams.slice(0, 8).map((t) => t.id),
        eliminated: false,
        won: false
      };
      this.store.save();
    }

    const t = this.store.tournament;
    const myTeam = teams.find((x) => x.id === t.clubs[0]) || teams[0];
    const oppTeam = teams.find((x) => x.id === t.clubs[1]) || teams[1];

    body.innerHTML = `
      <div class="panel">
        <h2 class="display-font" style="font-size:40px;">Apex Knockout Cup</h2>
        <p style="color:var(--accent); font-weight:700; margin:8px 0;">Current Stage: ${t.won ? 'CHAMPION!' : t.eliminated ? 'Eliminated' : t.round}</p>
        ${!t.won && !t.eliminated ? `
          <div style="font-size:22px; font-weight:800; margin:16px 0;">${myTeam.name} vs ${oppTeam.name}</div>
          <button class="btn btn-primary" id="tour-play">Play ${t.round}</button>
        ` : `<button class="btn btn-success" id="tour-new">Start New Cup</button>`}
      </div>
    `;

    body.querySelector('#tour-play')?.addEventListener('click', () => {
      this.startMatch({
        mode: 'match',
        homeTeam: myTeam,
        awayTeam: oppTeam,
        onFinish: (res) => {
          if (res.homeGoals >= res.awayGoals) {
            if (t.round === 'Quarter-Final') { t.round = 'Semi-Final'; t.clubs = [myTeam.id, teams[3].id]; }
            else if (t.round === 'Semi-Final') { t.round = 'Final'; t.clubs = [myTeam.id, teams[5].id]; }
            else { t.won = true; this.store.profile.coins += 2000; }
          } else {
            t.eliminated = true;
          }
          this.store.recordMatchResult('Tournament', myTeam.shortName, oppTeam.shortName, res.homeGoals, res.awayGoals);
        }
      });
    });
    body.querySelector('#tour-new')?.addEventListener('click', () => {
      this.store.tournament = null;
      this.store.save();
      this.renderTournament(body);
    });
  }

  private async fetchEvents() {
    try {
      const r = await fetch('/api/events');
      const data = await r.json();
      this.liveEvents = data.events || [];
      if (this.screen === 'events') this.render();
    } catch {
      // offline fallback
    }
  }

  private renderEvents(body: HTMLElement) {
    const events = this.liveEvents.length ? this.liveEvents : [
      { id: 'daily_striker', title: 'Daily Striker Challenge', type: 'Daily', mode: 'free_kick', description: 'Score curling free kicks.', rewardCoins: 400, leaderboard: [] },
      { id: 'penalty_masters', title: 'Penalty Shootout Masters', type: 'Cup', mode: 'penalty_shootout', description: 'Win penalty shootouts.', rewardCoins: 850, leaderboard: [] }
    ];

    body.innerHTML = `
      <h2 class="display-font" style="font-size:40px; margin-bottom:16px;">Live Events & Competitions</h2>
      <div class="grid-2">
        ${events.map((ev) => `
          <div class="panel">
            <div style="color:var(--gold); font-size:12px; font-weight:800;">${ev.type} • REWARD: ${ev.rewardCoins} COINS</div>
            <h3 style="font-size:22px; margin:6px 0;">${ev.title}</h3>
            <p style="font-size:13px; color:var(--muted); margin-bottom:14px;">${ev.description}</p>
            <button class="btn btn-primary" data-ev="${ev.id}" data-mode="${ev.mode}">Enter Event</button>
          </div>
        `).join('')}
      </div>
    `;

    const teams = this.store.getAllTeams();
    body.querySelectorAll('[data-ev]').forEach((el) => {
      el.addEventListener('click', () => {
        const mode = (el as HTMLElement).dataset.mode!;
        if (mode === 'online_1v1') { this.go('online'); return; }
        this.startMatch({
          mode: (mode === 'free_kick' || mode === 'penalty_shootout') ? mode : 'match',
          homeTeam: teams[0],
          awayTeam: teams[1],
          onFinish: (res) => this.store.recordMatchResult('Event', teams[0].shortName, teams[1].shortName, res.homeGoals, res.awayGoals)
        });
      });
    });
  }

  private renderTraining(body: HTMLElement) {
    const drills = [
      { id: 'free_practice', tag: 'OPEN PITCH', icon: 'play', title: 'Free Practice', sub: 'Open pitch with ball & goalkeeper' },
      { id: 'dribbling_course', tag: 'DRIBBLING', icon: 'train', title: 'Dribbling Obstacle Course', sub: 'Weave through cones at pace' },
      { id: 'passing_practice', tag: 'PASSING', icon: 'online', title: 'Passing Practice', sub: 'Short & through-ball accuracy' },
      { id: 'shooting_practice', tag: 'FINISHING', icon: 'cup', title: 'Shooting Targets', sub: 'Hit top-corner targets' },
      { id: 'penalty_practice', tag: 'SET PIECE', icon: 'events', title: 'Penalty Practice', sub: 'Master placement & power' },
      { id: 'free_kick_practice', tag: 'SET PIECE', icon: 'events', title: 'Free Kick Practice', sub: 'Bend it around the 4-man wall' },
      { id: 'gk_training', tag: 'GOALKEEPER', icon: 'team', title: 'Goalkeeper Training', sub: 'Reaction saves & distribution' },
      { id: 'tackling_practice', tag: 'DEFENSE', icon: 'team', title: 'Defensive Tackling', sub: 'Time standing & sliding tackles' },
      { id: 'skill_tutorial', tag: 'SKILLS', icon: 'offline', title: 'Skill Move Tutorial', sub: 'Use E to beat defenders' },
      { id: 'sprint_stamina', tag: 'PHYSICAL', icon: 'play', title: 'Sprint & Stamina', sub: 'Build pace & endurance' }
    ];

    const teams = this.store.getAllTeams();
    body.innerHTML = `
      <div style="display:flex; align-items:center; gap:14px; margin-bottom:20px;">
        ${this.icon3D('train', true)}
        <div>
          <h2 class="display-font" style="font-size:42px; line-height:1;">PRACTICE &amp; TRAINING CENTRE</h2>
          <div style="font-size:13px; color:var(--muted);">Sharpen your dribbling, passing, shooting, tackling &amp; set pieces</div>
        </div>
      </div>
      <div class="menu-grid">
        ${drills.map((d) => `
          <button class="tile-btn" data-drill="${d.id}" style="background:linear-gradient(155deg, rgba(16,24,48,0.92), rgba(10,16,34,0.96)); justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                ${this.icon3D(d.icon)}
                <span class="badge-tag" style="background:rgba(0,229,255,0.12); color:var(--accent); border:1px solid rgba(0,229,255,0.35);">${d.tag}</span>
              </div>
              <div class="tile-title">${d.title}</div>
              <div class="tile-sub">${d.sub}</div>
            </div>
            <div style="margin-top:12px; font-size:12px; font-weight:800; color:var(--accent);">START DRILL →</div>
          </button>
        `).join('')}
      </div>
    `;

    body.querySelectorAll('[data-drill]').forEach((el) => {
      el.addEventListener('click', () => {
        const drill = (el as HTMLElement).dataset.drill!;
        const mode = drill === 'penalty_practice' ? 'penalty_shootout' : drill === 'free_kick_practice' ? 'free_kick' : 'training';
        this.startMatch({ mode, drill, homeTeam: teams[0], awayTeam: teams[1] });
      });
    });
  }

  private renderTeamMgmt(body: HTMLElement) {
    const teams = this.store.getAllTeams();
    const team = teams.find((t) => t.id === this.selectedHomeId) || teams[0];

    body.innerHTML = `
      <div class="panel">
        <h2 class="display-font" style="font-size:38px; margin-bottom:14px;">Team Management — ${team.name}</h2>
        <div class="grid-2" style="margin-bottom:18px;">
          <label>Formation
            <select id="tm-form">
              ${Object.keys(FORMATIONS).map((f) => `<option value="${f}" ${team.formation === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </label>
          <label>Tactical Strategy
            <select id="tm-tactic">
              ${Object.entries(TACTICS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}
            </select>
          </label>
        </div>
        <table class="table-clean">
          <tr><th>#</th><th>Player</th><th>Pos</th><th>OVR</th><th>PAC</th><th>SHO</th><th>PAS</th><th>DRI</th></tr>
          ${team.squad.slice(0, 11).map((pl: any) => `
            <tr>
              <td>${pl.number}</td><td><strong>${pl.name}</strong></td><td>${pl.role}</td>
              <td style="color:var(--accent); font-weight:800;">${pl.ovr}</td>
              <td>${pl.pace}</td><td>${pl.shooting}</td><td>${pl.passing}</td><td>${pl.dribbling}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;

    body.querySelector('#tm-form')?.addEventListener('change', (e) => {
      team.formation = (e.target as HTMLSelectElement).value;
    });
  }

  private renderCustomise(body: HTMLElement) {
    const c = this.store.customTeam;
    const ovr = Math.round((c.playerPace + c.playerShooting + c.playerPassing + c.playerDribbling) / 4);
    const previewTeam = {
      id: 'custom_preview',
      shortName: (c.shortName || 'APX').toUpperCase().slice(0, 3),
      badgeColor: c.primary,
      kit: { primary: c.primary, secondary: c.secondary, shorts: c.shorts, pattern: c.pattern }
    };

    const statBar = (label: string, val: number, col: string) => `
      <div style="margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; margin-bottom:3px;">
          <span>${label}</span><span style="color:${col};">${val}</span>
        </div>
        <div class="stamina-track"><div class="stamina-fill" style="width:${val}%; background:${col};"></div></div>
      </div>
    `;

    body.innerHTML = `
      <div class="panel">
        <div style="display:flex; align-items:center; gap:14px; margin-bottom:18px; border-bottom:1px solid var(--border); padding-bottom:14px;">
          ${this.icon3D('team', true)}
          <div>
            <h2 class="display-font" style="font-size:38px; line-height:1;">CLUB &amp; PLAYER CUSTOMISATION</h2>
            <div style="font-size:12px; color:var(--muted);">Design your custom club crest, match kit, and upgrade your star striker</div>
          </div>
        </div>

        <div class="grid-3" style="align-items:start;">
          <div class="panel" style="display:grid; gap:12px;">
            <label style="display:flex; align-items:center; gap:10px; font-weight:700; color:var(--gold); cursor:pointer;">
              <input type="checkbox" id="cu-en" style="width:auto;" ${c.enabled ? 'checked' : ''} /> Use Custom Club in Matches
            </label>
            <label>Club Name <input id="cu-name" value="${c.name}" /></label>
            <div class="grid-2" style="gap:10px;">
              <label>Short Code <input id="cu-short" maxlength="3" value="${c.shortName}" /></label>
              <label>Kit Pattern
                <select id="cu-pat">
                  <option value="solid" ${c.pattern === 'solid' ? 'selected' : ''}>Solid</option>
                  <option value="stripes" ${c.pattern === 'stripes' ? 'selected' : ''}>Stripes</option>
                  <option value="hoops" ${c.pattern === 'hoops' ? 'selected' : ''}>Hoops</option>
                  <option value="sash" ${c.pattern === 'sash' ? 'selected' : ''}>Diagonal Sash</option>
                </select>
              </label>
            </div>
            <div class="grid-3" style="gap:10px;">
              <label style="font-size:12px;">Primary <input type="color" id="cu-prim" value="${c.primary}" style="height:40px; padding:2px;" /></label>
              <label style="font-size:12px;">Secondary <input type="color" id="cu-sec" value="${c.secondary}" style="height:40px; padding:2px;" /></label>
              <label style="font-size:12px;">Shorts <input type="color" id="cu-shorts" value="${c.shorts}" style="height:40px; padding:2px;" /></label>
            </div>
          </div>

          <div class="panel" style="display:flex; flex-direction:column; align-items:center; gap:14px; background:linear-gradient(155deg, rgba(15,23,42,0.95), rgba(30,41,59,0.85));">
            <div style="font-size:11px; color:var(--accent); font-weight:800; letter-spacing:0.1em;">LIVE CLUB &amp; KIT PREVIEW</div>
            <div style="display:flex; align-items:center; gap:18px;">
              ${this.renderTeamCrest(previewTeam, 76)}
              <svg width="86" height="106" viewBox="0 0 100 120" style="filter:drop-shadow(0 8px 16px rgba(0,0,0,0.55));">
                <path d="M25 14 L38 8 L62 8 L75 14 L90 32 L78 44 L70 36 L70 72 L30 72 L30 36 L22 44 L10 32 Z" fill="${c.primary}" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
                ${c.pattern === 'stripes' ? `<rect x="40" y="10" width="8" height="61" fill="${c.secondary}"/><rect x="54" y="10" width="8" height="61" fill="${c.secondary}"/>` : ''}
                ${c.pattern === 'hoops' ? `<rect x="30" y="26" width="40" height="10" fill="${c.secondary}"/><rect x="30" y="46" width="40" height="10" fill="${c.secondary}"/>` : ''}
                ${c.pattern === 'sash' ? `<polygon points="30,14 42,14 70,66 70,72 58,72 30,22" fill="${c.secondary}"/>` : ''}
                <rect x="30" y="74" width="18" height="24" rx="2" fill="${c.shorts}"/>
                <rect x="52" y="74" width="18" height="24" rx="2" fill="${c.shorts}"/>
                <text x="50" y="50" text-anchor="middle" font-family="Teko, sans-serif" font-weight="700" font-size="24" fill="#fff" stroke="#0f172a" stroke-width="2" paint-order="stroke">${c.playerNumber}</text>
              </svg>
            </div>
            <div class="fut-card" style="width:150px;">
              <div class="fut-card-top">
                <span style="font-size:26px; line-height:1;">${ovr}</span>
                <span style="font-size:12px;">ST</span>
              </div>
              <div style="font-weight:900; font-size:13px; margin:4px 0;">${c.playerName}</div>
              <div class="fut-card-stats">
                <span>${c.playerPace} PAC</span><span>${c.playerDribbling} DRI</span>
                <span>${c.playerShooting} SHO</span><span>${c.playerPassing} PAS</span>
              </div>
            </div>
          </div>

          <div class="panel" style="display:grid; gap:12px;">
            <label>Star Striker Name <input id="cu-pname" value="${c.playerName}" /></label>
            <label>Jersey Number <input type="number" min="1" max="99" id="cu-pnum" value="${c.playerNumber}" /></label>
            <div style="margin-top:4px;">
              ${statBar('Pace', c.playerPace, '#00e5ff')}
              ${statBar('Shooting', c.playerShooting, '#facc15')}
              ${statBar('Passing', c.playerPassing, '#22c55e')}
              ${statBar('Dribbling', c.playerDribbling, '#c084fc')}
            </div>
            <button class="btn btn-success" id="cu-upgrade">Upgrade Star (+1 All Stats • 200 Coins)</button>
            <button class="btn btn-gold" id="cu-save">Save Customisation</button>
          </div>
        </div>
      </div>
    `;

    body.querySelector('#cu-save')?.addEventListener('click', () => {
      c.enabled = (body.querySelector('#cu-en') as HTMLInputElement).checked;
      c.name = (body.querySelector('#cu-name') as HTMLInputElement).value;
      c.shortName = (body.querySelector('#cu-short') as HTMLInputElement).value;
      c.pattern = (body.querySelector('#cu-pat') as HTMLSelectElement).value as any;
      c.primary = (body.querySelector('#cu-prim') as HTMLInputElement).value;
      c.secondary = (body.querySelector('#cu-sec') as HTMLInputElement).value;
      c.shorts = (body.querySelector('#cu-shorts') as HTMLInputElement).value;
      c.playerName = (body.querySelector('#cu-pname') as HTMLInputElement).value;
      c.playerNumber = Number((body.querySelector('#cu-pnum') as HTMLInputElement).value) || 10;
      this.store.save();
      this.renderCustomise(body);
    });

    body.querySelector('#cu-upgrade')?.addEventListener('click', () => {
      if (this.store.profile.coins >= 200) {
        this.store.profile.coins -= 200;
        c.playerPace = Math.min(99, c.playerPace + 1);
        c.playerShooting = Math.min(99, c.playerShooting + 1);
        c.playerPassing = Math.min(99, c.playerPassing + 1);
        c.playerDribbling = Math.min(99, c.playerDribbling + 1);
        this.store.save();
        this.render();
        this.renderCustomise(this.root.querySelector('#menu-body') as HTMLElement);
      }
    });
  }

  private renderSettings(body: HTMLElement) {
    const s = this.store.settings;
    body.innerHTML = `
      <div class="panel">
        <h2 class="display-font" style="font-size:38px; margin-bottom:16px;">Game Settings</h2>
        <div class="grid-2">
          <label>AI Difficulty
            <select id="st-diff">
              ${Object.entries(DIFFICULTIES).map(([k, v]) => `<option value="${k}" ${s.difficulty === k ? 'selected' : ''}>${v.name}</option>`).join('')}
            </select>
          </label>
          <label>Match Duration
            <select id="st-dur">
              <option value="120" ${s.matchDurationSec === 120 ? 'selected' : ''}>2 Minutes</option>
              <option value="180" ${s.matchDurationSec === 180 ? 'selected' : ''}>3 Minutes</option>
              <option value="300" ${s.matchDurationSec === 300 ? 'selected' : ''}>5 Minutes</option>
              <option value="480" ${s.matchDurationSec === 480 ? 'selected' : ''}>8 Minutes</option>
            </select>
          </label>
          <label>Camera Angle
            <select id="st-cam">
              <option value="broadcast" ${s.cameraMode === 'broadcast' ? 'selected' : ''}>Broadcast</option>
              <option value="drone" ${s.cameraMode === 'drone' ? 'selected' : ''}>Drone (Whole Ground)</option>
              <option value="dynamic" ${s.cameraMode === 'dynamic' ? 'selected' : ''}>Dynamic 3rd-Person</option>
              <option value="tele" ${s.cameraMode === 'tele' ? 'selected' : ''}>Tele Tactical</option>
              <option value="pro" ${s.cameraMode === 'pro' ? 'selected' : ''}>Pro Camera</option>
            </select>
          </label>
          <label>Stadium
            <select id="st-stad">
              ${STADIUMS.map((st) => `<option value="${st.id}" ${s.stadiumId === st.id ? 'selected' : ''}>${st.name}</option>`).join('')}
            </select>
          </label>
          <label>Time of Day
            <select id="st-time">
              <option value="night" ${s.timeOfDay === 'night' ? 'selected' : ''}>Night (Floodlights)</option>
              <option value="day" ${s.timeOfDay === 'day' ? 'selected' : ''}>Daytime</option>
              <option value="sunset" ${s.timeOfDay === 'sunset' ? 'selected' : ''}>Sunset</option>
            </select>
          </label>
          <label>Weather
            <select id="st-weath">
              <option value="clear" ${s.weather === 'clear' ? 'selected' : ''}>Clear</option>
              <option value="rain" ${s.weather === 'rain' ? 'selected' : ''}>Rain</option>
              <option value="snow" ${s.weather === 'snow' ? 'selected' : ''}>Snow</option>
            </select>
          </label>
        </div>
        <div style="margin-top:16px; display:flex; gap:20px;">
          <label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" id="st-touch" style="width:auto;" ${s.showTouchControls ? 'checked' : ''} /> Show Mobile Touch Controls</label>
          <label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" id="st-mute" style="width:auto;" ${s.muted ? 'checked' : ''} /> Mute Audio</label>
        </div>
      </div>
    `;

    const bind = (id: string, fn: (v: any) => void) => {
      body.querySelector(id)?.addEventListener('change', (e) => {
        const t = e.target as HTMLInputElement | HTMLSelectElement;
        fn(t.type === 'checkbox' ? (t as HTMLInputElement).checked : t.value);
        this.store.save();
      });
    };
    bind('#st-diff', (v) => (s.difficulty = v));
    bind('#st-dur', (v) => (s.matchDurationSec = Number(v)));
    bind('#st-cam', (v) => (s.cameraMode = v));
    bind('#st-stad', (v) => (s.stadiumId = v));
    bind('#st-time', (v) => (s.timeOfDay = v));
    bind('#st-weath', (v) => (s.weather = v));
    bind('#st-touch', (v) => (s.showTouchControls = v));
    bind('#st-mute', (v) => (s.muted = v));
  }

  private async fetchLeaderboard() {
    try {
      const r = await fetch('/api/leaderboard');
      const d = await r.json();
      this.globalLeaderboard = d.leaderboard || [];
      if (this.screen === 'profile') this.render();
    } catch {
      // ignore
    }
  }

  private renderProfile(body: HTMLElement) {
    const p = this.store.profile;
    const xpPct = Math.min(100, Math.round((p.xp / (p.level * 300)) * 100));
    const achList = [
      { id: 'first_goal', title: 'First Goal', desc: 'Score your first goal' },
      { id: 'first_win', title: 'First Victory', desc: 'Win a match' },
      { id: 'clean_sheet', title: 'Clean Sheet', desc: 'Win without conceding' },
      { id: 'hat_trick_team', title: 'Goal Machine', desc: 'Score 3+ goals in a match' }
    ];

    body.innerHTML = `
      <div class="panel" style="margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
        <div style="display:flex; align-items:center; gap:16px;">
          ${this.icon3D('cup', true)}
          <div>
            <h2 class="display-font" style="font-size:40px; line-height:1;">${p.username} — LEVEL ${p.level}</h2>
            <div style="display:flex; align-items:center; gap:12px; margin-top:4px;">
              <div class="stamina-track" style="width:180px; margin-top:0;"><div class="stamina-fill" style="width:${xpPct}%; background:linear-gradient(90deg, var(--gold), #fde047);"></div></div>
              <span style="font-size:12px; color:var(--muted);">${p.xp} / ${p.level * 300} XP • <strong style="color:var(--gold);">${p.coins.toLocaleString()} COINS</strong></span>
            </div>
          </div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <input id="pr-name" value="${p.username}" style="width:170px;" />
          <button class="btn btn-primary" id="pr-save">Save Name</button>
          <button class="btn btn-gold" id="pr-sync">Sync Online</button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:12px; margin-bottom:18px;">
        ${[
          ['WINS', p.wins, '#22c55e'],
          ['DRAWS', p.draws, '#facc15'],
          ['LOSSES', p.losses, '#ef4444'],
          ['GOALS', p.goalsScored, '#00e5ff'],
          ['CLEAN SHEETS', p.cleanSheets, '#38bdf8'],
          ['SAVES', p.saves, '#c084fc']
        ].map(([lbl, val, col]) => `
          <div class="panel" style="padding:14px; text-align:center; border-top:3px solid ${col};">
            <div style="font-size:26px; font-weight:900; color:${col};">${val}</div>
            <div style="font-size:10px; color:var(--muted); font-weight:800; letter-spacing:0.08em;">${lbl}</div>
          </div>
        `).join('')}
      </div>

      <div class="grid-2">
        <div class="panel">
          <h3 style="margin-bottom:12px;">Achievements</h3>
          <div class="grid-2" style="gap:10px; margin-bottom:18px;">
            ${achList.map((a) => {
              const unlocked = p.achievements.includes(a.id);
              return `
                <div style="display:flex; align-items:center; gap:10px; padding:10px; border-radius:10px; background:rgba(255,255,255,0.04); border:1px solid ${unlocked ? 'var(--gold)' : 'var(--border)'}; opacity:${unlocked ? 1 : 0.48};">
                  ${this.icon3D('cup', unlocked)}
                  <div>
                    <div style="font-weight:800; font-size:13px;">${a.title}</div>
                    <div style="font-size:11px; color:var(--muted);">${a.desc}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          <h3 style="margin-bottom:8px;">Recent Match History</h3>
          <table class="table-clean">
            <tr><th>Mode</th><th>Fixture</th><th>Score</th><th>Res</th></tr>
            ${p.matchHistory.slice(0, 6).map((m) => {
              const rc = m.result === 'W' ? '#22c55e' : m.result === 'D' ? '#facc15' : '#ef4444';
              return `<tr><td>${m.mode}</td><td>${m.home} vs ${m.away}</td><td><strong>${m.score}</strong></td><td><span class="badge-tag" style="background:${rc}; color:#0f172a;">${m.result}</span></td></tr>`;
            }).join('') || '<tr><td colspan="4" style="color:var(--muted);">Play a match to record your history.</td></tr>'}
          </table>
        </div>

        <div class="panel">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
            ${this.icon3D('online')}
            <h3>Online Global Leaderboard</h3>
          </div>
          <table class="table-clean">
            <tr><th>#</th><th>Player</th><th>LVL</th><th>W</th><th>Goals</th><th>Rank Pts</th></tr>
            ${this.globalLeaderboard.map((r, idx) => `
              <tr>
                <td style="font-weight:900; color:${idx === 0 ? 'var(--gold)' : idx === 1 ? '#e2e8f0' : idx === 2 ? '#f97316' : 'var(--muted)'};">#${idx + 1}</td>
                <td><strong>${r.username}</strong></td><td>${r.level}</td><td>${r.wins}</td><td>${r.goals_scored}</td>
                <td style="color:var(--accent); font-weight:800;">${r.rank_points}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="color:var(--muted);">Click "Sync Online" or play online to appear on the leaderboard.</td></tr>'}
          </table>
        </div>
      </div>
    `;

    body.querySelector('#pr-save')?.addEventListener('click', () => {
      p.username = (body.querySelector('#pr-name') as HTMLInputElement).value || 'StrikerOne';
      this.store.save();
      this.render();
      this.renderProfile(this.root.querySelector('#menu-body') as HTMLElement);
    });
    body.querySelector('#pr-sync')?.addEventListener('click', async () => {
      await fetch('/api/profile/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      }).catch(() => {});
      this.fetchLeaderboard();
    });
  }
}
