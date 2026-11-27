import {
  PITCH_LENGTH, PITCH_WIDTH, HALF_LENGTH, HALF_WIDTH,
  GOAL_WIDTH, HALF_GOAL_WIDTH, GOAL_HEIGHT, GOAL_DEPTH,
  PENALTY_AREA_LENGTH, PENALTY_AREA_WIDTH, PENALTY_SPOT_DIST,
  BALL_RADIUS, PLAYER_RADIUS, GRAVITY, GROUND_FRICTION,
  AIR_DRAG, BOUNCE_RESTITUTION, MAGNUS_FACTOR,
  FORMATIONS, TACTICS, DIFFICULTIES
} from './constants.js';
import { TEAMS } from './teams.js';

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function dist2D(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function createEmptyStats() {
  return {
    shots: 0,
    shotsOnTarget: 0,
    possessionTicks: 0,
    passes: 0,
    passesCompleted: 0,
    tackles: 0,
    fouls: 0,
    corners: 0,
    offsides: 0,
    saves: 0
  };
}

export class FootballEngine {
  constructor(config = {}) {
    this.mode = config.mode || 'match'; // 'match' | 'penalty_shootout' | 'free_kick' | 'training'
    this.teamSize = config.teamSize === 5 ? 5 : 11;
    this.drill = config.drill || 'free_practice';
    this.difficultyKey = config.difficulty || 'professional';
    this.difficulty = DIFFICULTIES[this.difficultyKey] || DIFFICULTIES.professional;
    this.matchDurationSec = config.matchDurationSec || 180; // real seconds for full 90m match
    this.stadiumId = config.stadiumId || 'apex_national';
    this.weather = config.weather || 'clear';
    this.timeOfDay = config.timeOfDay || 'night';

    const homeTeam = config.homeTeam || TEAMS[0];
    const awayTeam = config.awayTeam || TEAMS[1];
    this.teams = {
      home: this.cloneTeam(homeTeam, config.homeFormation),
      away: this.cloneTeam(awayTeam, config.awayFormation)
    };
    this.tactics = {
      home: config.homeTactic || 'balanced',
      away: config.awayTactic || 'balanced'
    };

    // Human control slots: 'ai' or controller id ('p1', 'p2', etc.)
    this.humanTeams = config.humanTeams || { home: 'p1', away: 'ai' };

    this.resetMatch();
  }

  cloneTeam(team, formationOverride) {
    return {
      ...team,
      formation: formationOverride || team.formation || '4-3-3',
      squad: team.squad.map((p) => ({ ...p }))
    };
  }

  resetMatch() {
    this.tick = 0;
    this.elapsedSec = 0;
    this.half = 1;
    this.injuryTimeSec = 0;
    this.phase = this.mode === 'penalty_shootout' ? 'penalty' : this.mode === 'free_kick' ? 'free_kick' : 'kickoff';
    this.phaseTimer = 1.2;
    this.kickoffTeam = 'home';
    this.setPieceTeam = 'home';
    this.setPiecePos = { x: 0, z: 0 };

    this.score = { home: 0, away: 0 };
    this.stats = {
      home: createEmptyStats(),
      away: createEmptyStats()
    };

    // Penalty shootout tracking
    this.shootout = {
      round: 1,
      turn: 'home',
      homeResults: [],
      awayResults: [],
      homeScore: 0,
      awayScore: 0,
      kickerIndex: 9,
      waitingShot: true,
      shotResolved: false,
      resolveTimer: 0
    };

    // Training tracking
    this.training = {
      drill: this.drill,
      score: 0,
      attempts: 0,
      successes: 0,
      targets: [],
      cones: [],
      timer: 0
    };

    this.ball = {
      x: 0, y: BALL_RADIUS, z: 0,
      vx: 0, vy: 0, vz: 0,
      spinX: 0, spinY: 0, spinZ: 0,
      ownerId: null,
      lastTouchTeam: null,
      lastTouchPlayerId: null,
      lastPassFromId: null,
      lastPassTeam: null,
      pickupCooldown: 0
    };

    this.players = [];
    this.spawnTeamPlayers('home');
    this.spawnTeamPlayers('away');

    this.controlled = {
      home: this.getBestOutfieldId('home'),
      away: this.getBestOutfieldId('away')
    };

    this.referee = { x: -4, z: -8, facing: 0 };
    this.events = [];
    this.soundQueue = [];
    this.highlights = [];
    this.inputs = {}; // keyed by slot: 'p1', 'p2', etc.

    if (this.mode === 'penalty_shootout') {
      this.setupPenaltySpot('home');
    } else if (this.mode === 'free_kick') {
      this.setupFreeKickChallenge();
    } else if (this.mode === 'training') {
      this.setupTrainingDrill();
    } else {
      this.positionForKickoff('home');
    }
  }

  spawnTeamPlayers(side) {
    const team = this.teams[side];
    const form = FORMATIONS[team.formation] || FORMATIONS['4-3-3'];
    const dir = side === 'home' ? 1 : -1;
    const indices = this.teamSize === 5 ? [0, 2, 3, 7, 9] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      const sq = team.squad[i];
      const slot = form[i];
      const homeX = slot.x * dir;
      const homeZ = slot.z * dir;
      this.players.push({
        id: `${side}_${i}`,
        team: side,
        index: i,
        name: sq.name,
        number: sq.number,
        role: slot.role,
        ovr: sq.ovr,
        pace: sq.pace,
        shooting: sq.shooting,
        passing: sq.passing,
        dribbling: sq.dribbling,
        defending: sq.defending,
        physical: sq.physical,
        gk: sq.gk,
        skinTone: sq.skinTone,
        hairColor: sq.hairColor,
        x: homeX,
        z: homeZ,
        vx: 0,
        vz: 0,
        facing: dir > 0 ? 0 : Math.PI,
        homeX,
        homeZ,
        stamina: 100,
        yellowCards: 0,
        redCard: false,
        actionState: 'idle',
        actionTimer: 0,
        tackleCooldown: 0,
        skillCooldown: 0,
        diveDir: 0,
        diveY: 0,
        goals: 0,
        assists: 0,
        saves: 0,
        rating: 6.5
      });
    }
  }

  getAttackDir(team) {
    // Home attacks +X in 1st half, -X in 2nd half
    if (this.mode !== 'match') return team === 'home' ? 1 : -1;
    const base = team === 'home' ? 1 : -1;
    return this.half === 1 ? base : -base;
  }

  getBestOutfieldId(team) {
    const candidates = this.players.filter((p) => p.team === team && p.role !== 'GK' && !p.redCard);
    return candidates.length ? candidates[candidates.length - 1].id : `${team}_9`;
  }

  getPlayer(id) {
    return this.players.find((p) => p.id === id);
  }

  getGoalKeeper(team) {
    return this.players.find((p) => p.team === team && p.role === 'GK');
  }

  positionForKickoff(kickoffTeam) {
    this.kickoffTeam = kickoffTeam;
    this.ball.x = 0;
    this.ball.y = BALL_RADIUS;
    this.ball.z = 0;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
    this.ball.spinX = 0;
    this.ball.spinY = 0;
    this.ball.spinZ = 0;
    this.ball.ownerId = null;

    for (const p of this.players) {
      if (p.redCard) continue;
      const form = FORMATIONS[this.teams[p.team].formation] || FORMATIONS['4-3-3'];
      const slot = form[p.index];
      const dir = this.getAttackDir(p.team);
      let x = slot.x * dir;
      let z = slot.z * dir;
      // Keep everyone in their own half for kickoff
      if (dir > 0 && x > -1.5) x = -1.5 - (p.index % 3) * 2;
      if (dir < 0 && x < 1.5) x = 1.5 + (p.index % 3) * 2;

      if (p.team === kickoffTeam && p.index === 9) {
        x = -0.8 * dir;
        z = 0;
      }
      p.x = x;
      p.z = z;
      p.vx = 0;
      p.vz = 0;
      p.facing = dir > 0 ? 0 : Math.PI;
      p.actionState = 'idle';
      p.actionTimer = 0;
    }

    this.controlled.home = `${'home'}_9`;
    this.controlled.away = `${'away'}_9`;
    this.referee.x = -3;
    this.referee.z = -10;
  }

  setupPenaltySpot(kickingTeam) {
    const defTeam = kickingTeam === 'home' ? 'away' : 'home';
    const dir = kickingTeam === 'home' ? 1 : -1;
    const goalX = dir * HALF_LENGTH;
    const spotX = goalX - dir * PENALTY_SPOT_DIST;

    this.setPieceTeam = kickingTeam;
    this.ball.x = spotX;
    this.ball.y = BALL_RADIUS;
    this.ball.z = 0;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
    this.ball.ownerId = null;
    this.shootout.waitingShot = true;
    this.shootout.shotResolved = false;

    for (const p of this.players) {
      p.vx = 0;
      p.vz = 0;
      p.actionState = 'idle';
      p.diveDir = 0;
      p.diveY = 0;
      if (p.team === defTeam && p.role === 'GK') {
        p.x = goalX - dir * 0.4;
        p.z = 0;
        p.facing = dir > 0 ? Math.PI : 0;
      } else if (p.team === kickingTeam && p.index === 9) {
        p.x = spotX - dir * 2.5;
        p.z = 0;
        p.facing = dir > 0 ? 0 : Math.PI;
        this.ball.ownerId = null;
        this.controlled[kickingTeam] = p.id;
      } else {
        // Crowd at center circle
        p.x = -dir * 4 + (p.index % 4) * 1.5;
        p.z = -12 + p.index * 2.2;
        p.facing = dir > 0 ? 0 : Math.PI;
      }
    }
  }

  setupFreeKickChallenge() {
    const dir = 1;
    const spotX = HALF_LENGTH - 22 - (this.training.attempts % 3) * 3;
    const spotZ = ((this.training.attempts % 5) - 2) * 5;
    this.setPieceTeam = 'home';
    this.ball.x = spotX;
    this.ball.y = BALL_RADIUS;
    this.ball.z = spotZ;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
    this.ball.ownerId = null;
    this.phase = 'free_kick';
    this.phaseTimer = 0;

    for (const p of this.players) {
      p.vx = 0;
      p.vz = 0;
      p.actionState = 'idle';
      if (p.team === 'away' && p.role === 'GK') {
        p.x = HALF_LENGTH - 0.5;
        p.z = -Math.sign(spotZ) * 1.2;
        p.facing = Math.PI;
      } else if (p.team === 'home' && p.index === 9) {
        p.x = spotX - 2.2;
        p.z = spotZ;
        p.facing = Math.atan2(-spotZ, HALF_LENGTH - spotX);
        this.controlled.home = p.id;
      } else if (p.team === 'away' && p.index >= 1 && p.index <= 4) {
        // 4-man wall 9.15m away
        const ang = Math.atan2(-spotZ, HALF_LENGTH - spotX);
        const wallX = spotX + Math.cos(ang) * 9.5;
        const wallZ = spotZ + Math.sin(ang) * 9.5;
        const perpX = -Math.sin(ang);
        const perpZ = Math.cos(ang);
        const offset = (p.index - 2.5) * 0.85;
        p.x = wallX + perpX * offset;
        p.z = wallZ + perpZ * offset;
        p.facing = ang + Math.PI;
      } else {
        p.x = -20 + (p.index % 5) * 2;
        p.z = -20 + p.index * 3;
      }
    }
  }

  setupTrainingDrill() {
    this.phase = 'playing';
    this.phaseTimer = 0;
    this.training.timer = 0;
    this.training.targets = [];
    this.training.cones = [];

    // Place only required participants for training arena (hide unused match players)
    for (const p of this.players) {
      p.vx = 0;
      p.vz = 0;
      p.actionState = 'idle';
      p.redCard = true; // hide by default in training arena

      if (p.team === 'home' && p.index === 9) {
        p.redCard = false;
        p.x = 12;
        p.z = 0;
        p.facing = 0;
        this.controlled.home = p.id;
      } else if (p.team === 'away' && p.role === 'GK') {
        p.redCard = false;
        p.x = HALF_LENGTH - 0.5;
        p.z = 0;
        p.facing = Math.PI;
      } else if (this.drill === 'passing_practice' && p.team === 'home' && p.index >= 6 && p.index <= 8) {
        p.redCard = false;
        p.x = 22 + (p.index - 6) * 4;
        p.z = (p.index - 7) * 10;
        p.facing = Math.PI;
      } else if (this.drill === 'tackling_practice' && p.team === 'away' && p.index === 9) {
        p.redCard = false;
        p.x = 28;
        p.z = 0;
        p.facing = Math.PI;
        this.ball.ownerId = p.id;
      }
    }
    // Position Coach on the touchline observing the drill
    this.referee.x = 20;
    this.referee.z = -HALF_WIDTH - 1.2;
    this.referee.facing = Math.PI / 2;

    if (this.drill !== 'tackling_practice') {
      this.ball.x = 13.5;
      this.ball.y = BALL_RADIUS;
      this.ball.z = 0;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.vz = 0;
      this.ball.ownerId = null;
    }

    if (this.drill === 'dribbling_course') {
      for (let i = 0; i < 6; i++) {
        this.training.cones.push({
          id: `cone_${i}`,
          x: 18 + i * 4.5,
          z: (i % 2 === 0 ? 1 : -1) * 3.5,
          cleared: false
        });
      }
    } else if (this.drill === 'shooting_practice') {
      this.training.targets = [
        { id: 't1', x: HALF_LENGTH - 0.2, y: 1.8, z: -2.4, hit: false },
        { id: 't2', x: HALF_LENGTH - 0.2, y: 1.8, z: 2.4, hit: false },
        { id: 't3', x: HALF_LENGTH - 0.2, y: 0.7, z: 0, hit: false }
      ];
    }
  }

  setInput(slot, input) {
    this.inputs[slot] = input;
  }

  makeSubstitution(team, outIndex, inIndex) {
    const teamObj = this.teams[team];
    if (!teamObj || outIndex < 0 || outIndex >= 11 || inIndex < 11 || inIndex >= teamObj.squad.length) return false;
    const outSquad = teamObj.squad[outIndex];
    const inSquad = teamObj.squad[inIndex];
    teamObj.squad[outIndex] = inSquad;
    teamObj.squad[inIndex] = outSquad;

    const p = this.players.find((pl) => pl.team === team && pl.index === outIndex);
    if (p) {
      p.name = inSquad.name;
      p.number = inSquad.number;
      p.ovr = inSquad.ovr;
      p.pace = inSquad.pace;
      p.shooting = inSquad.shooting;
      p.passing = inSquad.passing;
      p.dribbling = inSquad.dribbling;
      p.defending = inSquad.defending;
      p.physical = inSquad.physical;
      p.gk = inSquad.gk;
      p.skinTone = inSquad.skinTone;
      p.hairColor = inSquad.hairColor;
      p.stamina = 100;
    }

    this.pushEvent('sub', team, inSquad.name, `SUB (${teamObj.shortName}): ${inSquad.name} replaces ${outSquad.name}`);
    return true;
  }

  setFormation(team, formationName) {
    if (!FORMATIONS[formationName]) return;
    this.teams[team].formation = formationName;
    const form = FORMATIONS[formationName];
    for (const p of this.players) {
      if (p.team === team && form[p.index]) {
        p.role = form[p.index].role;
      }
    }
  }

  setTactic(team, tacticKey) {
    if (TACTICS[tacticKey]) this.tactics[team] = tacticKey;
  }

  pushEvent(type, team, playerName, text) {
    const minute = this.getMatchMinute();
    this.events.unshift({ type, team, playerName, minute, text });
    if (this.events.length > 25) this.events.pop();
  }

  getMatchMinute() {
    const ratio = clamp(this.elapsedSec / this.matchDurationSec, 0, 1);
    return Math.min(90, Math.floor(ratio * 90));
  }

  step(dt) {
    this.tick++;
    this.soundQueue.length = 0;

    if (this.ball.pickupCooldown > 0) this.ball.pickupCooldown = Math.max(0, this.ball.pickupCooldown - dt);

    // Phase state machine
    if (this.phase === 'kickoff') {
      if (this.mode === 'match' && this.humanTeams[this.kickoffTeam] !== 'ai') {
        // Wait for human player to touch/move/pass at kickoff instead of auto-starting
        const slot = this.humanTeams[this.kickoffTeam];
        const inp = this.inputs[slot];
        const moved = inp && (Math.abs(inp.moveX) > 0.1 || Math.abs(inp.moveZ) > 0.1 || inp.pass || inp.shoot || inp.through);
        if (moved) {
          this.phase = 'playing';
          this.soundQueue.push('whistle');
        }
        return;
      }
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'playing';
        this.soundQueue.push('whistle');
      }
      return;
    }

    if (this.phase === 'goal') {
      this.phaseTimer -= dt;
      this.updateBallPhysics(dt, true);
      if (this.phaseTimer <= 0) {
        if (this.mode === 'free_kick') {
          this.training.attempts++;
          this.setupFreeKickChallenge();
        } else if (this.mode === 'training') {
          this.setupTrainingDrill();
        } else {
          this.positionForKickoff(this.kickoffTeam);
          this.phase = 'kickoff';
          this.phaseTimer = 1.0;
        }
      }
      return;
    }

    if (this.phase === 'halftime') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.half = 2;
        this.positionForKickoff('away');
        this.phase = 'kickoff';
        this.phaseTimer = 1.2;
        this.soundQueue.push('whistle');
      }
      return;
    }

    if (this.phase === 'fulltime') {
      return;
    }

    if (this.phase === 'throw_in' || this.phase === 'corner' || this.phase === 'goal_kick') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.executeSetPieceRestart();
      }
      return;
    }

    if (this.phase === 'penalty') {
      this.stepPenaltyShootout(dt);
      return;
    }

    if (this.phase === 'free_kick') {
      this.stepFreeKickChallenge(dt);
      return;
    }

    // Active 'playing' phase
    if (this.mode === 'match') {
      this.elapsedSec += dt;
      const halfTimeSec = this.matchDurationSec / 2;
      if (this.half === 1 && this.elapsedSec >= halfTimeSec) {
        this.phase = 'halftime';
        this.phaseTimer = 3.5;
        this.soundQueue.push('whistle_long');
        this.pushEvent('halftime', 'home', '', `Half-Time: ${this.teams.home.shortName} ${this.score.home} - ${this.score.away} ${this.teams.away.shortName}`);
        return;
      }
      if (this.half === 2 && this.elapsedSec >= this.matchDurationSec + this.injuryTimeSec) {
        this.phase = 'fulltime';
        this.soundQueue.push('whistle_long');
        this.pushEvent('fulltime', 'home', '', `Full-Time: ${this.teams.home.shortName} ${this.score.home} - ${this.score.away} ${this.teams.away.shortName}`);
        return;
      }
    } else if (this.mode === 'training') {
      this.training.timer += dt;
    }

    // Possession stats
    if (this.ball.ownerId) {
      const owner = this.getPlayer(this.ball.ownerId);
      if (owner) this.stats[owner.team].possessionTicks++;
    }

    // Update players (human + AI)
    this.updatePlayers(dt);

    // Update ball physics & check goals/boundaries
    this.updateBallPhysics(dt, false);

    // Update referee (in training mode, Coach stays on the touchline watching the ball)
    if (this.mode === 'training') {
      this.referee.facing = Math.atan2(this.ball.z - this.referee.z, this.ball.x - this.referee.x);
    } else {
      const targetRefX = clamp(this.ball.x * 0.7 - 4, -HALF_LENGTH + 5, HALF_LENGTH - 5);
      const targetRefZ = clamp(this.ball.z * 0.7 - 8, -HALF_WIDTH + 3, HALF_WIDTH - 3);
      this.referee.x += (targetRefX - this.referee.x) * Math.min(1, dt * 1.8);
      this.referee.z += (targetRefZ - this.referee.z) * Math.min(1, dt * 1.8);
      this.referee.facing = Math.atan2(this.ball.z - this.referee.z, this.ball.x - this.referee.x);
    }

    // Training drill checks
    if (this.mode === 'training') {
      this.updateTrainingLogic();
    }
  }

  stepPenaltyShootout(dt) {
    const kicker = this.getPlayer(`${this.setPieceTeam}_9`);
    const defTeam = this.setPieceTeam === 'home' ? 'away' : 'home';
    const gk = this.getGoalKeeper(defTeam);
    const slot = this.humanTeams[this.setPieceTeam];
    const input = slot !== 'ai' ? (this.inputs[slot] || {}) : null;

    if (this.shootout.waitingShot) {
      if (input && input.shoot) {
        const dir = this.setPieceTeam === 'home' ? 1 : -1;
        const aimZ = clamp((input.moveZ || 0) * 3.3, -3.4, 3.4);
        const power = clamp(0.65 + (input.power || 0.35), 0.5, 1.0);
        this.kickBall(kicker, dir * (24 + power * 10), 2.5 + power * 3.8, aimZ * 2.2, 0, (input.moveZ || 0) * -4);
        this.shootout.waitingShot = false;
        this.shootout.resolveTimer = 2.4;
        // GK AI dive
        const gkInput = this.humanTeams[defTeam] !== 'ai' ? this.inputs[this.humanTeams[defTeam]] : null;
        const diveChoice = gkInput ? Math.sign(gkInput.moveZ || 0) : (Math.random() < 0.45 ? Math.sign(aimZ) : (Math.random() < 0.5 ? -1 : 1));
        gk.actionState = 'dive';
        gk.actionTimer = 0.7;
        gk.diveDir = diveChoice;
        gk.vz = diveChoice * 6.5;
      } else if (!input) {
        // AI penalty kick
        this.shootout.resolveTimer += dt;
        if (this.shootout.resolveTimer > 1.1) {
          const dir = this.setPieceTeam === 'home' ? 1 : -1;
          const aimZ = (Math.random() * 2 - 1) * 3.2;
          this.kickBall(kicker, dir * 29, 4.0, aimZ * 2.1, 0, 0);
          this.shootout.waitingShot = false;
          this.shootout.resolveTimer = 2.4;
          const gkInput = this.humanTeams[defTeam] !== 'ai' ? this.inputs[this.humanTeams[defTeam]] : null;
          const diveChoice = gkInput ? Math.sign(gkInput.moveZ || 0) : (Math.random() < 0.5 ? -1 : 1);
          gk.actionState = 'dive';
          gk.actionTimer = 0.7;
          gk.diveDir = diveChoice;
          gk.vz = diveChoice * 6.5;
        }
      }
    } else {
      this.updateBallPhysics(dt, false);
      if (gk.actionState === 'dive') {
        gk.z = clamp(gk.z + gk.vz * dt, -HALF_GOAL_WIDTH, HALF_GOAL_WIDTH);
        gk.actionTimer -= dt;
        if (dist2D(gk.x, gk.z, this.ball.x, this.ball.z) < 1.25 && this.ball.y < 2.2) {
          this.ball.vx *= -0.45;
          this.ball.vz += gk.diveDir * 4;
          this.soundQueue.push('save');
        }
      }
      this.shootout.resolveTimer -= dt;
      const scored = Math.abs(this.ball.x) > HALF_LENGTH && Math.abs(this.ball.z) < HALF_GOAL_WIDTH && this.ball.y < GOAL_HEIGHT;
      if (scored && !this.shootout.shotResolved) {
        this.shootout.shotResolved = true;
        this.recordShootoutResult(true);
      } else if (this.shootout.resolveTimer <= 0 && !this.shootout.shotResolved) {
        this.shootout.shotResolved = true;
        this.recordShootoutResult(false);
      }
    }
  }

  recordShootoutResult(scored) {
    const team = this.setPieceTeam;
    if (team === 'home') {
      this.shootout.homeResults.push(scored);
      if (scored) { this.shootout.homeScore++; this.score.home++; this.soundQueue.push('goal'); }
    } else {
      this.shootout.awayResults.push(scored);
      if (scored) { this.shootout.awayScore++; this.score.away++; this.soundQueue.push('goal'); }
    }
    this.pushEvent(scored ? 'goal' : 'save', team, '', scored ? `PENALTY SCORED (${team.toUpperCase()})!` : `PENALTY SAVED/MISSED!`);

    const hLen = this.shootout.homeResults.length;
    const aLen = this.shootout.awayResults.length;
    const diff = Math.abs(this.shootout.homeScore - this.shootout.awayScore);
    const hRem = Math.max(0, 5 - hLen);
    const aRem = Math.max(0, 5 - aLen);

    const overEarly = (this.shootout.homeScore > this.shootout.awayScore + aRem) || (this.shootout.awayScore > this.shootout.homeScore + hRem);
    const overSuddenDeath = hLen >= 5 && aLen === hLen && diff > 0;

    if (overEarly || overSuddenDeath) {
      this.phase = 'fulltime';
      this.soundQueue.push('whistle_long');
      return;
    }

    const nextTeam = team === 'home' ? 'away' : 'home';
    if (nextTeam === 'home') this.shootout.round++;
    this.setupPenaltySpot(nextTeam);
  }

  stepFreeKickChallenge(dt) {
    const kicker = this.getPlayer(this.controlled.home);
    const input = this.inputs.p1 || {};
    const gk = this.getGoalKeeper('away');

    if (input.shoot && this.ball.vx === 0 && this.ball.vz === 0) {
      const dx = HALF_LENGTH - this.ball.x;
      const dz = (input.moveZ || 0) * 5.2 - this.ball.z;
      const dist = Math.hypot(dx, dz) || 1;
      const power = clamp(0.65 + (input.power || 0.35), 0.55, 1.0);
      const speed = 22 + power * 10;
      const spinY = -(input.moveZ || 0) * 7.5;
      this.kickBall(kicker, (dx / dist) * speed, 6.2 + power * 3.5, (dz / dist) * speed, 0, spinY);
      this.phase = 'playing';
      this.phaseTimer = 3.0;
    }
    // Keep GK ready
    if (gk) {
      gk.z += (clamp(this.ball.z * 0.5, -2.5, 2.5) - gk.z) * dt * 3;
    }
  }

  updateTrainingLogic() {
    const player = this.getPlayer(this.controlled.home);
    if (!player) return;

    if (this.drill === 'dribbling_course') {
      for (const cone of this.training.cones) {
        if (!cone.cleared && dist2D(player.x, player.z, cone.x, cone.z) < 2.2) {
          cone.cleared = true;
          this.training.score += 100;
          this.training.successes++;
          this.soundQueue.push('pass');
        }
      }
      if (this.training.cones.every((c) => c.cleared)) {
        this.training.score += 500;
        this.setupTrainingDrill();
      }
    } else if (this.drill === 'shooting_practice') {
      for (const t of this.training.targets) {
        if (!t.hit && dist2D(this.ball.x, this.ball.z, t.x, t.z) < 1.2 && Math.abs(this.ball.y - t.y) < 1.0) {
          t.hit = true;
          this.training.score += 250;
          this.training.successes++;
          this.soundQueue.push('goal');
        }
      }
    } else if (this.drill === 'sprint_stamina') {
      if (player.actionState === 'sprint') {
        this.training.score += 2;
      }
    }
  }

  updatePlayers(dt) {
    for (const p of this.players) {
      if (p.redCard) continue;
      if (p.actionTimer > 0) {
        p.actionTimer -= dt;
        if (p.actionTimer <= 0) {
          p.actionState = 'idle';
          p.diveDir = 0;
        }
      }
      if (p.tackleCooldown > 0) p.tackleCooldown = Math.max(0, p.tackleCooldown - dt);
      if (p.skillCooldown > 0) p.skillCooldown = Math.max(0, p.skillCooldown - dt);

      const isControlledHome = this.controlled.home === p.id && this.humanTeams.home !== 'ai';
      const isControlledAway = this.controlled.away === p.id && this.humanTeams.away !== 'ai';

      if (isControlledHome) {
        const input = this.inputs[this.humanTeams.home] || {};
        this.applyHumanControl(p, input, dt);
      } else if (isControlledAway) {
        const input = this.inputs[this.humanTeams.away] || {};
        this.applyHumanControl(p, input, dt);
      } else {
        this.applyAIControl(p, dt);
      }

      // Apply velocity & clamp to realistic football pitch bounds
      const maxX = p.role === 'GK' ? HALF_LENGTH + 0.2 : HALF_LENGTH + 0.4;
      p.x = clamp(p.x + p.vx * dt, -maxX, maxX);
      p.z = clamp(p.z + p.vz * dt, -HALF_WIDTH - 0.6, HALF_WIDTH + 0.6);

      // Stamina recovery
      if (p.actionState !== 'sprint') {
        p.stamina = Math.min(100, p.stamina + dt * 6.5);
      }

      // Ball pickup check
      this.tryPickupBall(p);
    }

    // Human player switch request + Smart Auto-Switch to player closest to the ball
    for (const team of ['home', 'away']) {
      const slot = this.humanTeams[team];
      if (slot === 'ai') continue;

      if (this.inputs[slot]?.switchPlayer) {
        this.switchToNearestPlayer(team);
        this.inputs[slot].switchPlayer = false;
        continue;
      }

      // Auto-switch when ball is loose or held by opponent and another teammate is clearly closer
      const ballOwner = this.ball.ownerId ? this.getPlayer(this.ball.ownerId) : null;
      if (!ballOwner || ballOwner.team !== team) {
        const cur = this.getPlayer(this.controlled[team]);
        const curDist = cur && !cur.redCard ? dist2D(cur.x, cur.z, this.ball.x, this.ball.z) : Infinity;
        const candidates = this.players.filter((p) => p.team === team && p.role !== 'GK' && !p.redCard);
        if (candidates.length) {
          candidates.sort((a, b) => dist2D(a.x, a.z, this.ball.x, this.ball.z) - dist2D(b.x, b.z, this.ball.x, this.ball.z));
          const best = candidates[0];
          const bestDist = dist2D(best.x, best.z, this.ball.x, this.ball.z);
          if (best.id !== this.controlled[team] && bestDist + 2.5 < curDist) {
            this.controlled[team] = best.id;
          }
        }
      }
    }

    // Player-player soft separation
    for (let i = 0; i < this.players.length; i++) {
      const a = this.players[i];
      if (a.redCard) continue;
      for (let j = i + 1; j < this.players.length; j++) {
        const b = this.players[j];
        if (b.redCard) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const minDist = PLAYER_RADIUS * 1.8;
        if (d > 0.001 && d < minDist) {
          const push = (minDist - d) * 0.5;
          const nx = dx / d;
          const nz = dz / d;
          a.x -= nx * push;
          a.z -= nz * push;
          b.x += nx * push;
          b.z += nz * push;
        }
      }
    }
  }

  switchToNearestPlayer(team) {
    const candidates = this.players.filter((p) => p.team === team && p.role !== 'GK' && !p.redCard && p.id !== this.controlled[team]);
    if (!candidates.length) return;
    candidates.sort((a, b) => dist2D(a.x, a.z, this.ball.x, this.ball.z) - dist2D(b.x, b.z, this.ball.x, this.ball.z));
    this.controlled[team] = candidates[0].id;
  }

  applyHumanControl(p, input, dt) {
    if (p.actionState === 'slide' || p.actionState === 'stunned' || p.actionState === 'dive') {
      p.vx *= 0.94;
      p.vz *= 0.94;
      return;
    }

    const mx = input.moveX || 0;
    const mz = input.moveZ || 0;
    const mag = Math.hypot(mx, mz);
    const hasBall = this.ball.ownerId === p.id;
    const sprinting = Boolean(input.sprint) && p.stamina > 8 && mag > 0.1;

    const baseSpeed = 5.4 + (p.pace / 100) * 2.4;
    const speed = sprinting ? baseSpeed * 1.38 : baseSpeed;
    const dribbleFactor = hasBall ? (0.88 + (p.dribbling / 100) * 0.09) : 1.0;

    if (mag > 0.08) {
      const nx = mx / Math.max(1, mag);
      const nz = mz / Math.max(1, mag);
      const targetVx = nx * speed * dribbleFactor;
      const targetVz = nz * speed * dribbleFactor;
      p.vx += (targetVx - p.vx) * Math.min(1, dt * 12);
      p.vz += (targetVz - p.vz) * Math.min(1, dt * 12);
      p.facing = Math.atan2(nz, nx);
      p.actionState = sprinting ? 'sprint' : (hasBall ? 'dribble' : 'run');
      if (sprinting) p.stamina = Math.max(0, p.stamina - dt * 14);
    } else {
      p.vx *= Math.pow(0.001, dt);
      p.vz *= Math.pow(0.001, dt);
      p.actionState = 'idle';
    }

    // Skill move
    if (input.skill && hasBall && p.skillCooldown <= 0) {
      p.skillCooldown = 0.9;
      p.actionState = 'dribble';
      p.vx += Math.cos(p.facing) * 3.5;
      p.vz += Math.sin(p.facing) * 3.5;
      this.soundQueue.push('skill');
    }

    // Actions with ball
    if (hasBall) {
      const aimX = mag > 0.15 ? mx / mag : Math.cos(p.facing);
      const aimZ = mag > 0.15 ? mz / mag : Math.sin(p.facing);

      if (input.shoot) {
        this.performShot(p, aimX, aimZ, input.power || 0.7);
      } else if (input.pass) {
        this.performPass(p, aimX, aimZ, false);
      } else if (input.through) {
        this.performPass(p, aimX, aimZ, true);
      } else if (input.cross) {
        this.performCross(p);
      }
    } else {
      // Defensive actions
      if (input.tackle && p.tackleCooldown <= 0) {
        this.performTackle(p, Boolean(input.sprint));
      } else if (input.shoot && dist2D(p.x, p.z, this.ball.x, this.ball.z) < 2.0 && this.ball.y > 0.4) {
        // First-time volley or header!
        const aimX = mag > 0.15 ? mx / mag : Math.cos(p.facing);
        const aimZ = mag > 0.15 ? mz / mag : Math.sin(p.facing);
        this.performShot(p, aimX, aimZ, input.power || 0.75);
      }
    }
  }

  applyAIControl(p, dt) {
    if (p.actionState === 'slide' || p.actionState === 'stunned') {
      p.vx *= 0.93;
      p.vz *= 0.93;
      return;
    }

    if (p.role === 'GK') {
      this.applyGoalkeeperAI(p, dt);
      return;
    }

    const dir = this.getAttackDir(p.team);
    const hasBall = this.ball.ownerId === p.id;
    const tactic = TACTICS[this.tactics[p.team]] || TACTICS.balanced;

    if (hasBall) {
      this.applyAICarrier(p, dir, dt);
      return;
    }

    // Off-ball AI
    const form = FORMATIONS[this.teams[p.team].formation] || FORMATIONS['4-3-3'];
    const slot = form[p.index] || { x: 0, z: 0 };

    // Shift formation toward ball
    const ballShiftX = clamp(this.ball.x * 0.35 + tactic.lineHeight * dir, -22, 22);
    const ballShiftZ = clamp(this.ball.z * 0.3, -12, 12);
    let targetX = slot.x * dir + ballShiftX;
    let targetZ = slot.z * dir + ballShiftZ;

    // Check if this AI player should press the ball
    const ballOwner = this.ball.ownerId ? this.getPlayer(this.ball.ownerId) : null;
    const teamHasBall = ballOwner && ballOwner.team === p.team;

    if (!teamHasBall) {
      // Find closest non-GK teammate to ball
      const teammates = this.players.filter((t) => t.team === p.team && t.role !== 'GK' && !t.redCard);
      teammates.sort((a, b) => dist2D(a.x, a.z, this.ball.x, this.ball.z) - dist2D(b.x, b.z, this.ball.x, this.ball.z));
      if (teammates[0]?.id === p.id || (teammates[1]?.id === p.id && tactic.pressIntensity > 0.75)) {
        targetX = this.ball.x;
        targetZ = this.ball.z;
        // Attempt tackle if close
        if (ballOwner && dist2D(p.x, p.z, ballOwner.x, ballOwner.z) < 1.35 && p.tackleCooldown <= 0) {
          if (Math.random() < this.difficulty.reaction * 0.25) {
            this.performTackle(p, false);
            return;
          }
        }
      }
    } else {
      // Attacking support run
      if (['ST', 'LW', 'RW', 'CAM'].includes(p.role)) {
        targetX += dir * (8 + tactic.attackBias);
      }
    }

    targetX = clamp(targetX, -HALF_LENGTH + 3, HALF_LENGTH - 3);
    targetZ = clamp(targetZ, -HALF_WIDTH + 3, HALF_WIDTH - 3);

    const dx = targetX - p.x;
    const dz = targetZ - p.z;
    const d = Math.hypot(dx, dz);
    const baseSpeed = (5.0 + (p.pace / 100) * 2.2) * this.difficulty.pressSpeed;

    if (d > 0.6) {
      const sprint = d > 10 && p.stamina > 25;
      const spd = sprint ? baseSpeed * 1.25 : baseSpeed * 0.92;
      p.vx += ((dx / d) * spd - p.vx) * Math.min(1, dt * 8);
      p.vz += ((dz / d) * spd - p.vz) * Math.min(1, dt * 8);
      p.facing = Math.atan2(dz, dx);
      p.actionState = sprint ? 'sprint' : 'run';
      if (sprint) p.stamina = Math.max(0, p.stamina - dt * 10);
    } else {
      p.vx *= 0.85;
      p.vz *= 0.85;
      p.actionState = 'idle';
      p.facing = Math.atan2(this.ball.z - p.z, this.ball.x - p.x);
    }
  }

  applyAICarrier(p, dir, dt) {
    const goalX = dir * HALF_LENGTH;
    const distToGoal = dist2D(p.x, p.z, goalX, 0);

    // Shoot if in good range
    if (distToGoal < 24 && Math.random() < 0.06 * this.difficulty.reaction) {
      const aimZ = ((Math.random() - 0.5) * GOAL_WIDTH * 0.78 - p.z);
      const aimX = goalX - p.x;
      const len = Math.hypot(aimX, aimZ) || 1;
      this.performShot(p, aimX / len, aimZ / len, 0.72 + Math.random() * 0.25);
      return;
    }

    // Check if pressed by opponent -> pass!
    const nearestOpp = this.players
      .filter((o) => o.team !== p.team && !o.redCard)
      .sort((a, b) => dist2D(a.x, a.z, p.x, p.z) - dist2D(b.x, b.z, p.x, p.z))[0];

    if (nearestOpp && dist2D(nearestOpp.x, nearestOpp.z, p.x, p.z) < 4.2 && Math.random() < 0.08 * this.difficulty.reaction) {
      if (Math.abs(p.z) > 20 && p.x * dir > 20) {
        this.performCross(p);
      } else {
        this.performPass(p, dir, -p.z * 0.03, Math.random() < 0.25);
      }
      return;
    }

    // Dribble toward opponent goal
    const dx = goalX - p.x;
    const dz = -p.z * 0.35;
    const d = Math.hypot(dx, dz) || 1;
    const spd = (5.2 + (p.pace / 100) * 2.0) * 0.92;
    p.vx += ((dx / d) * spd - p.vx) * Math.min(1, dt * 8);
    p.vz += ((dz / d) * spd - p.vz) * Math.min(1, dt * 8);
    p.facing = Math.atan2(dz, dx);
    p.actionState = 'dribble';
  }

  applyGoalkeeperAI(gk, dt) {
    const dir = this.getAttackDir(gk.team);
    const ownGoalX = -dir * HALF_LENGTH;

    if (this.ball.ownerId === gk.id) {
      // GK distributes ball after short pause
      gk.actionTimer -= dt;
      if (gk.actionTimer <= 0) {
        this.performPass(gk, dir, (Math.random() - 0.5) * 0.6, false);
      }
      return;
    }

    if (gk.actionState === 'dive') {
      gk.z = clamp(gk.z + gk.vz * dt, -HALF_GOAL_WIDTH - 1, HALF_GOAL_WIDTH + 1);
      gk.vx *= 0.9;
      return;
    }

    // Track ball Z along goal line, step out slightly if ball is close
    const ballNear = Math.abs(this.ball.x - ownGoalX) < 18;
    const targetX = ownGoalX + dir * (ballNear ? 3.2 : 1.3);
    const targetZ = clamp(this.ball.z * 0.45, -HALF_GOAL_WIDTH + 0.4, HALF_GOAL_WIDTH - 0.4);

    const dx = targetX - gk.x;
    const dz = targetZ - gk.z;
    const d = Math.hypot(dx, dz);
    const gkSpeed = 5.5 + (gk.gk / 100) * 2.5 * this.difficulty.gkSkill;

    if (d > 0.2) {
      gk.vx = (dx / d) * gkSpeed;
      gk.vz = (dz / d) * gkSpeed;
    } else {
      gk.vx = 0;
      gk.vz = 0;
    }
    gk.facing = Math.atan2(this.ball.z - gk.z, this.ball.x - gk.x);

    // Dive for incoming shot!
    const ballHeadingToGoal = (this.ball.vx * -dir) > 8 && Math.abs(this.ball.x - ownGoalX) < 14;
    if (ballHeadingToGoal && gk.actionState !== 'dive') {
      const timeToGoal = Math.abs(ownGoalX - this.ball.x) / Math.max(1, Math.abs(this.ball.vx));
      const predZ = this.ball.z + this.ball.vz * timeToGoal;
      if (Math.abs(predZ) < HALF_GOAL_WIDTH + 1.5) {
        gk.actionState = 'dive';
        gk.actionTimer = 0.65;
        const diveDir = Math.sign(predZ - gk.z) || 1;
        gk.diveDir = diveDir;
        gk.vz = diveDir * (6.2 + (gk.gk / 100) * 3.0 * this.difficulty.gkSkill);
      }
    }
  }

  tryPickupBall(p) {
    if (this.ball.pickupCooldown > 0) return;
    if (p.actionState === 'stunned' || p.actionState === 'slide') return;

    const d = dist2D(p.x, p.z, this.ball.x, this.ball.z);
    const reach = p.role === 'GK' ? 1.35 : 0.95;
    const maxH = p.role === 'GK' ? 2.1 : 1.15;

    if (d < reach && this.ball.y < maxH) {
      const ballSpeed = Math.hypot(this.ball.vx, this.ball.vz);
      // High-velocity shots deflect off outfield players rather than sticking to their feet
      if (this.ball.ownerId === null && p.role !== 'GK' && ballSpeed > 22 && this.ball.lastTouchTeam !== p.team) {
        this.ball.vx *= -0.35;
        this.ball.vz += (Math.random() - 0.5) * 6;
        this.ball.pickupCooldown = 0.18;
        this.soundQueue.push('kick');
        return;
      }
      if (this.ball.ownerId === null) {
        // Offside check on pass reception
        if (this.ball.lastPassTeam === p.team && this.ball.lastPassFromId !== p.id) {
          if (this.checkOffsideOnReceive(p)) return;
          this.stats[p.team].passesCompleted++;
        }
        // GK Save check
        const ballSpeed = Math.hypot(this.ball.vx, this.ball.vz);
        if (p.role === 'GK' && this.ball.lastTouchTeam && this.ball.lastTouchTeam !== p.team && ballSpeed > 12) {
          this.stats[p.team].saves++;
          p.saves++;
          this.soundQueue.push('save');
          this.pushEvent('save', p.team, p.name, `Great save by ${p.name}!`);
        }

        this.ball.ownerId = p.id;
        this.ball.lastTouchTeam = p.team;
        this.ball.lastTouchPlayerId = p.id;
        this.ball.lastPassTeam = null;
        if (p.role === 'GK') p.actionTimer = 1.1;

        if (this.humanTeams[p.team] !== 'ai') {
          this.controlled[p.team] = p.id;
        }
      }
    }
  }

  checkOffsideOnReceive(receiver) {
    if (this.mode !== 'match' || receiver.role === 'GK') return false;
    const dir = this.getAttackDir(receiver.team);
    // Must be in opponent's half
    if (receiver.x * dir <= 0) return false;
    const oppXs = this.players
      .filter((o) => o.team !== receiver.team && !o.redCard)
      .map((o) => o.x * dir)
      .sort((a, b) => b - a);
    const secondLast = oppXs[1] ?? HALF_LENGTH;
    if (receiver.x * dir > secondLast + 0.6) {
      this.stats[receiver.team].offsides++;
      this.soundQueue.push('whistle');
      this.pushEvent('offside', receiver.team, receiver.name, `Offside against ${receiver.name}`);
      this.triggerSetPiece('free_kick', receiver.team === 'home' ? 'away' : 'home', receiver.x, receiver.z);
      return true;
    }
    return false;
  }

  kickBall(player, vx, vy, vz, spinX = 0, spinY = 0) {
    this.ball.ownerId = null;
    this.ball.pickupCooldown = 0.22;
    this.ball.vx = vx;
    this.ball.vy = vy;
    this.ball.vz = vz;
    this.ball.spinX = spinX;
    this.ball.spinY = spinY;
    this.ball.lastTouchTeam = player.team;
    this.ball.lastTouchPlayerId = player.id;
    player.actionState = 'kick';
    player.actionTimer = 0.28;
    this.soundQueue.push('kick');
  }

  performPass(p, aimX, aimZ, isThrough) {
    const teammates = this.players.filter((t) => t.team === p.team && t.id !== p.id && !t.redCard);
    let best = null;
    let bestScore = -Infinity;

    for (const t of teammates) {
      const dx = t.x - p.x;
      const dz = t.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5 || d > 55) continue;
      const dot = (dx / d) * aimX + (dz / d) * aimZ;
      const score = dot * 2.2 - d * 0.025;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }

    this.stats[p.team].passes++;
    this.ball.lastPassFromId = p.id;
    this.ball.lastPassTeam = p.team;

    if (best && bestScore > -0.2) {
      const lead = isThrough ? 1.25 : 0.45;
      const tx = best.x + best.vx * lead;
      const tz = best.z + best.vz * lead;
      const dx = tx - p.x;
      const dz = tz - p.z;
      const d = Math.hypot(dx, dz) || 1;
      const speed = clamp(11 + d * 0.48 + (isThrough ? 4 : 0), 12, 27);
      const err = (1 - (p.passing / 100)) * 0.08;
      const angle = Math.atan2(dz, dx) + (Math.random() - 0.5) * err;
      this.kickBall(p, Math.cos(angle) * speed, isThrough ? 2.4 : 0.9, Math.sin(angle) * speed);
      this.soundQueue.push('pass');
      if (this.humanTeams[p.team] !== 'ai') {
        this.controlled[p.team] = best.id;
      }
    } else {
      this.kickBall(p, aimX * 16, 1.2, aimZ * 16);
      this.soundQueue.push('pass');
    }
  }

  performCross(p) {
    const dir = this.getAttackDir(p.team);
    const targetX = dir * (HALF_LENGTH - 11);
    const targetZ = 0;
    const dx = targetX - p.x;
    const dz = targetZ - p.z;
    const d = Math.hypot(dx, dz) || 1;
    this.stats[p.team].passes++;
    this.ball.lastPassFromId = p.id;
    this.ball.lastPassTeam = p.team;
    this.kickBall(p, (dx / d) * 19, 7.8, (dz / d) * 19, 0, -Math.sign(p.z) * 5.5);
    this.soundQueue.push('pass');
  }

  performShot(p, aimX, aimZ, power = 0.75) {
    const dir = this.getAttackDir(p.team);
    const goalX = dir * (HALF_LENGTH + 1.6); // Aim into the back of the net even when close to goal line
    const dx = goalX - p.x;
    const dz = clamp(aimZ * 4.0, -HALF_GOAL_WIDTH + 0.35, HALF_GOAL_WIDTH - 0.35) - p.z;
    const d = Math.hypot(dx, dz) || 1;
    let blendX = (dx / d) * 0.78 + aimX * 0.22;
    const blendZ = (dz / d) * 0.78 + aimZ * 0.22;
    // Guarantee shot always travels forward toward opponent's goal
    if (blendX * dir < 0.35) blendX = dir * 0.35;
    const len = Math.hypot(blendX, blendZ) || 1;
    const shotDirX = blendX / len;
    const shotDirZ = blendZ / len;

    // Face the goal/shot direction naturally
    p.facing = Math.atan2(shotDirZ, shotDirX);

    const shotSpeed = 20 + clamp(power, 0.3, 1.0) * 14 + (p.shooting / 100) * 4;
    const distToGoal = dist2D(p.x, p.z, dir * HALF_LENGTH, 0);
    const loft = distToGoal < 14
      ? 1.3 + clamp(power, 0.3, 1.0) * 1.9
      : 2.2 + clamp(power, 0.3, 1.0) * 4.4;
    const spinY = aimZ * -5.5;

    this.stats[p.team].shots++;
    if (Math.abs(shotDirZ * d + p.z) < HALF_GOAL_WIDTH + 0.5) {
      this.stats[p.team].shotsOnTarget++;
    }

    this.kickBall(p, shotDirX * shotSpeed, loft, shotDirZ * shotSpeed, 0, spinY);
  }

  performTackle(p, isSlide) {
    p.tackleCooldown = isSlide ? 1.1 : 0.7;
    p.actionState = isSlide ? 'slide' : 'tackle';
    p.actionTimer = isSlide ? 0.45 : 0.25;
    if (isSlide) {
      p.vx = Math.cos(p.facing) * 11.5;
      p.vz = Math.sin(p.facing) * 11.5;
    } else {
      p.vx += Math.cos(p.facing) * 3.5;
      p.vz += Math.sin(p.facing) * 3.5;
    }

    const reach = isSlide ? 1.7 : 1.25;
    const owner = this.ball.ownerId ? this.getPlayer(this.ball.ownerId) : null;

    if (owner && owner.team !== p.team && dist2D(p.x, p.z, owner.x, owner.z) < reach) {
      const winProb = 0.55 + (p.defending / 100) * 0.35 - (owner.dribbling / 100) * 0.15;
      if (Math.random() < winProb) {
        // Clean tackle!
        this.stats[p.team].tackles++;
        this.ball.ownerId = p.id;
        this.ball.lastTouchTeam = p.team;
        this.ball.lastTouchPlayerId = p.id;
        owner.actionState = 'stunned';
        owner.actionTimer = 0.55;
        this.soundQueue.push('tackle');
      } else if (isSlide) {
        // Foul!
        this.stats[p.team].fouls++;
        this.soundQueue.push('whistle');
        const dir = this.getAttackDir(owner.team);
        const inBox = Math.abs(owner.x - dir * HALF_LENGTH) < PENALTY_AREA_LENGTH && Math.abs(owner.z) < PENALTY_AREA_WIDTH / 2;

        p.yellowCards++;
        if (p.yellowCards >= 2) {
          p.redCard = true;
          this.pushEvent('red', p.team, p.name, `RED CARD! ${p.name} sent off for a reckless slide!`);
        } else {
          this.pushEvent('yellow', p.team, p.name, `Yellow Card for ${p.name}`);
        }

        if (inBox && this.mode === 'match') {
          this.pushEvent('foul', owner.team, owner.name, `PENALTY KICK awarded to ${this.teams[owner.team].name}!`);
          this.setupPenaltySpot(owner.team);
          this.phase = 'penalty';
        } else {
          this.triggerSetPiece('free_kick', owner.team, owner.x, owner.z);
        }
      }
    }
  }

  triggerSetPiece(type, team, x, z) {
    if (this.mode === 'training') {
      this.ball.x = clamp(x, -HALF_LENGTH + 2, HALF_LENGTH - 2);
      this.ball.z = clamp(z, -HALF_WIDTH + 2, HALF_WIDTH - 2);
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.vz = 0;
      this.ball.ownerId = null;
      return;
    }
    this.phase = type;
    this.phaseTimer = 1.1;
    this.setPieceTeam = team;
    this.setPiecePos = { x: clamp(x, -HALF_LENGTH + 1, HALF_LENGTH - 1), z: clamp(z, -HALF_WIDTH + 1, HALF_WIDTH - 1) };
    this.ball.ownerId = null;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
    this.ball.x = this.setPiecePos.x;
    this.ball.y = BALL_RADIUS;
    this.ball.z = this.setPiecePos.z;
    this.soundQueue.push('whistle');
  }

  executeSetPieceRestart() {
    const taker = this.players.find((p) => p.team === this.setPieceTeam && p.role !== 'GK' && !p.redCard) || this.players[0];
    taker.x = this.setPiecePos.x;
    taker.z = this.setPiecePos.z;
    const dir = this.getAttackDir(this.setPieceTeam);
    this.phase = 'playing';
    if (this.humanTeams[this.setPieceTeam] !== 'ai') {
      this.controlled[this.setPieceTeam] = taker.id;
    }
    this.performPass(taker, dir, -Math.sign(taker.z) * 0.5, false);
  }

  updateBallPhysics(dt, inGoalState) {
    const b = this.ball;
    if (b.ownerId) {
      const owner = this.getPlayer(b.ownerId);
      if (owner) {
        const bob = Math.sin(this.tick * 0.35) * 0.06;
        b.x = owner.x + Math.cos(owner.facing) * (0.62 + bob);
        b.z = owner.z + Math.sin(owner.facing) * (0.62 + bob);
        b.y = BALL_RADIUS;
        b.vx = owner.vx;
        b.vz = owner.vz;
        b.vy = 0;
        return;
      }
      b.ownerId = null;
    }

    // Magnus curve force (spinY curves horizontal flight)
    if (Math.abs(b.spinY) > 0.01) {
      b.vx += -b.vz * b.spinY * MAGNUS_FACTOR * dt;
      b.vz += b.vx * b.spinY * MAGNUS_FACTOR * dt;
      b.spinY *= Math.pow(0.8, dt);
    }

    // Gravity & drag
    b.vy -= GRAVITY * dt;
    const drag = b.y > BALL_RADIUS + 0.05 ? AIR_DRAG : GROUND_FRICTION;
    b.vx *= Math.pow(drag, dt * 60);
    b.vz *= Math.pow(drag, dt * 60);

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;

    // Ground bounce
    if (b.y < BALL_RADIUS) {
      b.y = BALL_RADIUS;
      if (b.vy < -1.2) {
        b.vy = -b.vy * BOUNCE_RESTITUTION;
        this.soundQueue.push('bounce');
      } else {
        b.vy = 0;
      }
    }

    // Goalpost & crossbar collisions
    for (const gx of [-HALF_LENGTH, HALF_LENGTH]) {
      for (const gz of [-HALF_GOAL_WIDTH, HALF_GOAL_WIDTH]) {
        if (b.y < GOAL_HEIGHT + BALL_RADIUS) {
          const d = dist2D(b.x, b.z, gx, gz);
          if (d < BALL_RADIUS + 0.08) {
            const nx = (b.x - gx) / (d || 1);
            const nz = (b.z - gz) / (d || 1);
            const dot = b.vx * nx + b.vz * nz;
            if (dot < 0) {
              b.vx -= 1.8 * dot * nx;
              b.vz -= 1.8 * dot * nz;
              this.soundQueue.push('post');
            }
          }
        }
      }
    }

    if (inGoalState) {
      // Keep ball inside goal net
      b.x = clamp(b.x, -HALF_LENGTH - GOAL_DEPTH + BALL_RADIUS, HALF_LENGTH + GOAL_DEPTH - BALL_RADIUS);
      return;
    }

    // Check Goal Scored!
    if (Math.abs(b.x) > HALF_LENGTH + BALL_RADIUS * 0.5 && Math.abs(b.z) < HALF_GOAL_WIDTH && b.y < GOAL_HEIGHT) {
      const scoringSide = b.x > 0
        ? (this.getAttackDir('home') > 0 ? 'home' : 'away')
        : (this.getAttackDir('home') < 0 ? 'home' : 'away');

      if (this.mode === 'penalty_shootout') return;

      this.score[scoringSide]++;
      const scorer = b.lastTouchPlayerId ? this.getPlayer(b.lastTouchPlayerId) : null;
      if (scorer && scorer.team === scoringSide) scorer.goals++;

      this.phase = 'goal';
      this.phaseTimer = 2.6;
      this.kickoffTeam = scoringSide === 'home' ? 'away' : 'home';
      this.soundQueue.push('goal');
      this.soundQueue.push('whistle');
      this.pushEvent('goal', scoringSide, scorer?.name || '', `GOAL! ${scorer?.name || this.teams[scoringSide].shortName} scores! (${this.teams.home.shortName} ${this.score.home} - ${this.score.away} ${this.teams.away.shortName})`);
      this.highlights.push({ minute: this.getMatchMinute(), team: scoringSide, player: scorer?.name || 'Forward', type: 'Goal' });
      return;
    }

    // Check out of bounds (Touchlines & Goal lines)
    if (Math.abs(b.z) > HALF_WIDTH + BALL_RADIUS) {
      const restartTeam = b.lastTouchTeam === 'home' ? 'away' : 'home';
      this.triggerSetPiece('throw_in', restartTeam, b.x, Math.sign(b.z) * HALF_WIDTH);
      return;
    }

    if (Math.abs(b.x) > HALF_LENGTH + BALL_RADIUS) {
      const defendingTeam = b.x > 0
        ? (this.getAttackDir('home') < 0 ? 'home' : 'away')
        : (this.getAttackDir('home') > 0 ? 'home' : 'away');

      if (b.lastTouchTeam === defendingTeam) {
        const attackingTeam = defendingTeam === 'home' ? 'away' : 'home';
        this.stats[attackingTeam].corners++;
        this.triggerSetPiece('corner', attackingTeam, Math.sign(b.x) * (HALF_LENGTH - 0.5), Math.sign(b.z) * (HALF_WIDTH - 0.5));
      } else {
        this.triggerSetPiece('goal_kick', defendingTeam, Math.sign(b.x) * (HALF_LENGTH - 5.5), 0);
      }
    }
  }

  serializeState() {
    return {
      tick: this.tick,
      mode: this.mode,
      drill: this.drill,
      phase: this.phase,
      half: this.half,
      minute: this.getMatchMinute(),
      score: this.score,
      stats: this.stats,
      ball: {
        x: +this.ball.x.toFixed(2),
        y: +this.ball.y.toFixed(2),
        z: +this.ball.z.toFixed(2),
        vx: +this.ball.vx.toFixed(2),
        vy: +this.ball.vy.toFixed(2),
        vz: +this.ball.vz.toFixed(2),
        ownerId: this.ball.ownerId
      },
      controlled: this.controlled,
      players: this.players.map((p) => ({
        id: p.id,
        team: p.team,
        index: p.index,
        name: p.name,
        number: p.number,
        role: p.role,
        x: +p.x.toFixed(2),
        z: +p.z.toFixed(2),
        vx: +p.vx.toFixed(2),
        vz: +p.vz.toFixed(2),
        facing: +p.facing.toFixed(2),
        stamina: Math.round(p.stamina),
        actionState: p.actionState,
        diveDir: p.diveDir,
        redCard: p.redCard
      })),
      referee: this.referee,
      events: this.events.slice(0, 6),
      soundQueue: [...this.soundQueue],
      shootout: this.mode === 'penalty_shootout' ? this.shootout : null,
      training: this.mode === 'training' ? this.training : null
    };
  }
}
