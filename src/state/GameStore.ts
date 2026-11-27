import { TEAMS } from '../../shared/teams.js';

export interface UserProfile {
  id: string;
  username: string;
  level: number;
  xp: number;
  coins: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  assists: number;
  saves: number;
  cleanSheets: number;
  unlockedStadiums: string[];
  achievements: string[];
  matchHistory: Array<{
    date: string;
    mode: string;
    home: string;
    away: string;
    score: string;
    result: 'W' | 'D' | 'L';
  }>;
}

export interface CustomTeamConfig {
  enabled: boolean;
  name: string;
  shortName: string;
  primary: string;
  secondary: string;
  shorts: string;
  pattern: 'solid' | 'stripes' | 'hoops' | 'sash';
  playerName: string;
  playerNumber: number;
  playerPace: number;
  playerShooting: number;
  playerPassing: number;
  playerDribbling: number;
}

export interface GameSettings {
  difficulty: string;
  matchDurationSec: number;
  cameraMode: 'broadcast' | 'dynamic' | 'tele' | 'pro' | 'drone';
  cameraZoom: number;
  cameraAngle: number;
  weather: 'clear' | 'rain' | 'snow';
  timeOfDay: 'night' | 'day' | 'sunset';
  stadiumId: string;
  muted: boolean;
  commentary: boolean;
  showTouchControls: boolean;
}

const STORAGE_KEY = 'apex_pitch_save_v1';

export class GameStore {
  public profile: UserProfile;
  public customTeam: CustomTeamConfig;
  public settings: GameSettings;
  public career: any = null;
  public tournament: any = null;
  public league: any = null;

  constructor() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        this.profile = parsed.profile || this.defaultProfile();
        this.customTeam = parsed.customTeam || this.defaultCustomTeam();
        this.settings = parsed.settings || this.defaultSettings();
        this.career = parsed.career || null;
        this.tournament = parsed.tournament || null;
        this.league = parsed.league || null;
        return;
      } catch {
        // fallback to defaults
      }
    }
    this.profile = this.defaultProfile();
    this.customTeam = this.defaultCustomTeam();
    this.settings = this.defaultSettings();
  }

  private defaultProfile(): UserProfile {
    return {
      id: 'usr_' + Math.random().toString(36).slice(2, 10),
      username: 'StrikerOne',
      level: 1,
      xp: 0,
      coins: 1200,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsScored: 0,
      assists: 0,
      saves: 0,
      cleanSheets: 0,
      unlockedStadiums: ['apex_national', 'metro_olympic', 'harborview', 'riverside'],
      achievements: [],
      matchHistory: []
    };
  }

  private defaultCustomTeam(): CustomTeamConfig {
    return {
      enabled: false,
      name: 'Apex United',
      shortName: 'APX',
      primary: '#0ea5e9',
      secondary: '#facc15',
      shorts: '#0f172a',
      pattern: 'sash',
      playerName: 'A. Striker',
      playerNumber: 10,
      playerPace: 86,
      playerShooting: 85,
      playerPassing: 84,
      playerDribbling: 87
    };
  }

  private defaultSettings(): GameSettings {
    return {
      difficulty: 'professional',
      matchDurationSec: 180,
      cameraMode: 'broadcast',
      cameraZoom: 1.0,
      cameraAngle: 0.0,
      weather: 'clear',
      timeOfDay: 'day',
      stadiumId: 'apex_national',
      muted: false,
      commentary: true,
      showTouchControls: true
    };
  }

  public save() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        profile: this.profile,
        customTeam: this.customTeam,
        settings: this.settings,
        career: this.career,
        tournament: this.tournament,
        league: this.league
      })
    );
  }

  public getAllTeams() {
    if (!this.customTeam.enabled) return TEAMS;
    const base = TEAMS[0];
    const custom = {
      ...base,
      id: 'custom_fc',
      name: this.customTeam.name,
      shortName: this.customTeam.shortName.slice(0, 3).toUpperCase(),
      type: 'club',
      league: 'Custom Club',
      rating: 86,
      attack: 87,
      midfield: 86,
      defense: 84,
      kit: {
        primary: this.customTeam.primary,
        secondary: this.customTeam.secondary,
        shorts: this.customTeam.shorts,
        socks: this.customTeam.primary,
        pattern: this.customTeam.pattern,
        gkPrimary: '#22c55e'
      },
      badgeColor: this.customTeam.primary,
      squad: base.squad.map((p, idx) =>
        idx === 9
          ? {
              ...p,
              name: this.customTeam.playerName,
              number: this.customTeam.playerNumber,
              pace: this.customTeam.playerPace,
              shooting: this.customTeam.playerShooting,
              passing: this.customTeam.playerPassing,
              dribbling: this.customTeam.playerDribbling,
              ovr: Math.round(
                (this.customTeam.playerPace +
                  this.customTeam.playerShooting +
                  this.customTeam.playerPassing +
                  this.customTeam.playerDribbling) /
                  4
              )
            }
          : { ...p }
      )
    };
    return [custom, ...TEAMS];
  }

  public recordMatchResult(mode: string, homeName: string, awayName: string, homeGoals: number, awayGoals: number, saves = 0) {
    const res: 'W' | 'D' | 'L' = homeGoals > awayGoals ? 'W' : homeGoals === awayGoals ? 'D' : 'L';
    if (res === 'W') {
      this.profile.wins++;
      this.profile.coins += 250;
      this.profile.xp += 180;
    } else if (res === 'D') {
      this.profile.draws++;
      this.profile.coins += 100;
      this.profile.xp += 90;
    } else {
      this.profile.losses++;
      this.profile.coins += 50;
      this.profile.xp += 50;
    }

    this.profile.goalsScored += homeGoals;
    this.profile.saves += saves;
    if (awayGoals === 0) this.profile.cleanSheets++;

    while (this.profile.xp >= this.profile.level * 300) {
      this.profile.xp -= this.profile.level * 300;
      this.profile.level++;
      this.profile.coins += 500;
    }

    // Achievements
    if (homeGoals >= 1 && !this.profile.achievements.includes('first_goal')) {
      this.profile.achievements.push('first_goal');
    }
    if (res === 'W' && !this.profile.achievements.includes('first_win')) {
      this.profile.achievements.push('first_win');
    }
    if (awayGoals === 0 && res === 'W' && !this.profile.achievements.includes('clean_sheet')) {
      this.profile.achievements.push('clean_sheet');
    }
    if (homeGoals >= 3 && !this.profile.achievements.includes('hat_trick_team')) {
      this.profile.achievements.push('hat_trick_team');
    }

    this.profile.matchHistory.unshift({
      date: new Date().toLocaleDateString(),
      mode,
      home: homeName,
      away: awayName,
      score: `${homeGoals} - ${awayGoals}`,
      result: res
    });
    if (this.profile.matchHistory.length > 20) this.profile.matchHistory.pop();
    this.save();

    // Sync to server if online
    fetch('/api/profile/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.profile)
    }).catch(() => {});
  }
}
