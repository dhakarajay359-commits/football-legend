import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { WebSocketServer } from 'ws';
import { FootballEngine } from '../shared/engine.js';
import { TEAMS } from '../shared/teams.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

// --- SQLite Persistent Database (Node 24 built-in) ---
const db = new DatabaseSync(path.join(__dirname, 'db.sqlite'));
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    coins INTEGER DEFAULT 1200,
    wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    goals_scored INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    clean_sheets INTEGER DEFAULT 0,
    rank_points INTEGER DEFAULT 1000,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS event_entries (
    event_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    username TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    PRIMARY KEY (event_id, profile_id)
  );
`);

const LIVE_EVENTS = [
  {
    id: 'daily_striker',
    title: 'Daily Striker Challenge',
    type: 'Daily Challenge',
    mode: 'free_kick',
    description: 'Score curling free kicks past the wall & keeper to climb the daily board.',
    entryFee: 0,
    rewardCoins: 400,
    endsAt: Date.now() + 1000 * 60 * 60 * 14
  },
  {
    id: 'weekly_champions',
    title: 'Weekly Champions Cup',
    type: 'Weekly Knockout',
    mode: 'match',
    description: 'Win matches on Professional+ difficulty to earn Championship points.',
    entryFee: 100,
    rewardCoins: 1500,
    endsAt: Date.now() + 1000 * 60 * 60 * 24 * 5
  },
  {
    id: 'penalty_masters',
    title: 'Penalty Shootout Masters',
    type: 'Penalty Tournament',
    mode: 'penalty_shootout',
    description: 'Hold your nerve from 12 yards in sudden-death penalty shootouts.',
    entryFee: 50,
    rewardCoins: 850,
    endsAt: Date.now() + 1000 * 60 * 60 * 48
  },
  {
    id: 'ranked_season_1',
    title: 'Ranked Season 1: Apex Glory',
    type: 'Ranked Season',
    mode: 'online_1v1',
    description: 'Compete in live 1v1 online ranked matches for seasonal division rewards.',
    entryFee: 0,
    rewardCoins: 3000,
    endsAt: Date.now() + 1000 * 60 * 60 * 24 * 21
  }
];

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, onlinePlayers: clients.size });
});

app.post('/api/profile/sync', (req, res) => {
  const p = req.body;
  if (!p || !p.id || !p.username) return res.status(400).json({ error: 'Invalid profile' });
  const stmt = db.prepare(`
    INSERT INTO profiles (id, username, level, xp, coins, wins, draws, losses, goals_scored, saves, clean_sheets, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      level = excluded.level,
      xp = excluded.xp,
      coins = excluded.coins,
      wins = excluded.wins,
      draws = excluded.draws,
      losses = excluded.losses,
      goals_scored = excluded.goals_scored,
      saves = excluded.saves,
      clean_sheets = excluded.clean_sheets,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    String(p.id).slice(0, 40),
    String(p.username).slice(0, 24),
    Number(p.level) || 1,
    Number(p.xp) || 0,
    Number(p.coins) || 0,
    Number(p.wins) || 0,
    Number(p.draws) || 0,
    Number(p.losses) || 0,
    Number(p.goalsScored) || 0,
    Number(p.saves) || 0,
    Number(p.cleanSheets) || 0,
    Date.now()
  );
  res.json({ ok: true });
});

app.get('/api/leaderboard', (_req, res) => {
  const rows = db.prepare(`
    SELECT id, username, level, wins, draws, losses, goals_scored, rank_points
    FROM profiles
    ORDER BY rank_points DESC, wins DESC, goals_scored DESC
    LIMIT 25
  `).all();
  res.json({ leaderboard: rows });
});

app.get('/api/events', (_req, res) => {
  const eventsWithBoard = LIVE_EVENTS.map((ev) => {
    const top = db.prepare(`
      SELECT username, score FROM event_entries
      WHERE event_id = ? ORDER BY score DESC LIMIT 5
    `).all(ev.id);
    return { ...ev, leaderboard: top };
  });
  res.json({ events: eventsWithBoard });
});

app.post('/api/events/:id/score', (req, res) => {
  const { id } = req.params;
  const { profileId, username, score } = req.body || {};
  if (!profileId || !username) return res.status(400).json({ error: 'Missing profile' });
  db.prepare(`
    INSERT INTO event_entries (event_id, profile_id, username, score)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(event_id, profile_id) DO UPDATE SET
      score = MAX(event_entries.score, excluded.score),
      username = excluded.username
  `).run(id, String(profileId), String(username).slice(0, 24), Math.max(0, Math.min(10000, Number(score) || 0)));
  res.json({ ok: true });
});

// Serve built client if present
const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// --- Authoritative Multiplayer Room Manager ---
const clients = new Map(); // ws -> { id, username, roomCode, slot, reconnectToken }
const rooms = new Map();   // code -> Room
const matchQueues = {
  ranked_1v1: [],
  casual_1v1: [],
  casual_2v2: []
};

function sanitizeInput(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const clamp = (v, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? (n < min ? min : n > max ? max : n) : 0;
  };
  return {
    moveX: clamp(raw.moveX, -1, 1),
    moveZ: clamp(raw.moveZ, -1, 1),
    sprint: Boolean(raw.sprint),
    pass: Boolean(raw.pass),
    through: Boolean(raw.through),
    shoot: Boolean(raw.shoot),
    cross: Boolean(raw.cross),
    tackle: Boolean(raw.tackle),
    skill: Boolean(raw.skill),
    switchPlayer: Boolean(raw.switchPlayer),
    power: clamp(raw.power, 0, 1)
  };
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? generateRoomCode() : code;
}

function createRoom({ code, format = '1v1', ranked = false, homeTeamId, awayTeamId }) {
  const homeTeam = TEAMS.find((t) => t.id === homeTeamId) || TEAMS[0];
  const awayTeam = TEAMS.find((t) => t.id === awayTeamId) || TEAMS[1];

  const engine = new FootballEngine({
    mode: 'match',
    matchDurationSec: 180,
    homeTeam,
    awayTeam,
    humanTeams: { home: 'p1', away: 'p2' }
  });

  const room = {
    code,
    format,
    ranked,
    engine,
    slots: new Map(), // slot ('p1', 'p2', 'p3', 'p4') -> { ws, username, profileId, reconnectToken, disconnectedAt }
    started: false,
    interval: null
  };
  rooms.set(code, room);
  return room;
}

function startRoomSimulation(room) {
  if (room.started) return;
  room.started = true;
  const teamsMeta = {
    home: room.engine.teams.home,
    away: room.engine.teams.away
  };

  broadcastRoom(room, {
    type: 'match_start',
    roomCode: room.code,
    teams: teamsMeta,
    stadiumId: room.engine.stadiumId
  });

  let tickCounter = 0;
  room.interval = setInterval(() => {
    room.engine.step(1 / 60);
    tickCounter++;

    // Broadcast authoritative state at 30Hz to save bandwidth while running physics at 60Hz
    if (tickCounter % 2 === 0) {
      broadcastRoom(room, {
        type: 'state',
        state: room.engine.serializeState()
      });
    }

    if (room.engine.phase === 'fulltime') {
      clearInterval(room.interval);
      room.interval = null;
      recordOnlineResult(room);
      broadcastRoom(room, {
        type: 'match_end',
        score: room.engine.score,
        stats: room.engine.stats
      });
      setTimeout(() => rooms.delete(room.code), 15000);
    }
  }, 1000 / 60);
}

function recordOnlineResult(room) {
  const { home, away } = room.engine.score;
  const p1 = room.slots.get('p1');
  const p2 = room.slots.get('p2');
  if (room.ranked && p1?.profileId && p2?.profileId) {
    const p1Delta = home > away ? 25 : home === away ? 5 : -15;
    const p2Delta = away > home ? 25 : home === away ? 5 : -15;
    db.prepare(`UPDATE profiles SET rank_points = MAX(100, rank_points + ?) WHERE id = ?`).run(p1Delta, p1.profileId);
    db.prepare(`UPDATE profiles SET rank_points = MAX(100, rank_points + ?) WHERE id = ?`).run(p2Delta, p2.profileId);
  }
}

function broadcastRoom(room, payload) {
  const msg = JSON.stringify(payload);
  for (const s of room.slots.values()) {
    if (s.ws && s.ws.readyState === 1) {
      s.ws.send(msg);
    }
  }
}

wss.on('connection', (ws) => {
  const clientInfo = {
    id: Math.random().toString(36).slice(2, 10),
    username: 'Player',
    profileId: null,
    roomCode: null,
    slot: null,
    lastInputAt: 0
  };
  clients.set(ws, clientInfo);

  ws.on('message', (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      return;
    }

    if (msg.type === 'hello') {
      clientInfo.username = String(msg.username || 'Player').slice(0, 24);
      clientInfo.profileId = msg.profileId || null;
      ws.send(JSON.stringify({ type: 'welcome', clientId: clientInfo.id }));
      return;
    }

    if (msg.type === 'create_room') {
      const code = generateRoomCode();
      const room = createRoom({
        code,
        format: msg.format || '1v1',
        ranked: false,
        homeTeamId: msg.teamId
      });
      const token = Math.random().toString(36).slice(2, 12);
      room.slots.set('p1', {
        ws,
        username: clientInfo.username,
        profileId: clientInfo.profileId,
        reconnectToken: token,
        disconnectedAt: null
      });
      clientInfo.roomCode = code;
      clientInfo.slot = 'p1';
      ws.send(JSON.stringify({ type: 'room_joined', roomCode: code, slot: 'p1', reconnectToken: token, players: 1, needed: room.format === '2v2' ? 4 : 2 }));
      return;
    }

    if (msg.type === 'join_room') {
      const code = String(msg.roomCode || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: `Room ${code} not found.` }));
        return;
      }
      const needed = room.format === '2v2' ? 4 : 2;
      if (room.slots.size >= needed) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room is already full.' }));
        return;
      }
      const slot = room.slots.size === 1 ? 'p2' : room.slots.size === 2 ? 'p3' : 'p4';
      const token = Math.random().toString(36).slice(2, 12);
      room.slots.set(slot, {
        ws,
        username: clientInfo.username,
        profileId: clientInfo.profileId,
        reconnectToken: token,
        disconnectedAt: null
      });
      clientInfo.roomCode = code;
      clientInfo.slot = slot;
      ws.send(JSON.stringify({ type: 'room_joined', roomCode: code, slot, reconnectToken: token, players: room.slots.size, needed }));

      if (room.slots.size >= needed) {
        startRoomSimulation(room);
      }
      return;
    }

    if (msg.type === 'reconnect') {
      const room = rooms.get(msg.roomCode);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'Match no longer active.' }));
        return;
      }
      for (const [slot, info] of room.slots.entries()) {
        if (info.reconnectToken === msg.reconnectToken) {
          info.ws = ws;
          info.disconnectedAt = null;
          clientInfo.roomCode = room.code;
          clientInfo.slot = slot;
          ws.send(JSON.stringify({
            type: 'match_start',
            roomCode: room.code,
            slot,
            teams: { home: room.engine.teams.home, away: room.engine.teams.away },
            stadiumId: room.engine.stadiumId
          }));
          return;
        }
      }
      return;
    }

    if (msg.type === 'queue') {
      const qName = msg.queue === 'ranked_1v1' ? 'ranked_1v1' : msg.queue === 'casual_2v2' ? 'casual_2v2' : 'casual_1v1';
      const q = matchQueues[qName];
      if (!q.includes(ws)) q.push(ws);
      ws.send(JSON.stringify({ type: 'queued', queue: qName, waiting: q.length }));

      const needed = qName === 'casual_2v2' ? 4 : 2;
      if (q.length >= needed) {
        const matched = q.splice(0, needed);
        const code = generateRoomCode();
        const room = createRoom({
          code,
          format: qName === 'casual_2v2' ? '2v2' : '1v1',
          ranked: qName === 'ranked_1v1'
        });
        const slotNames = ['p1', 'p2', 'p3', 'p4'];
        matched.forEach((mws, idx) => {
          const ci = clients.get(mws);
          if (!ci) return;
          const slot = slotNames[idx];
          const token = Math.random().toString(36).slice(2, 12);
          room.slots.set(slot, {
            ws: mws,
            username: ci.username,
            profileId: ci.profileId,
            reconnectToken: token,
            disconnectedAt: null
          });
          ci.roomCode = code;
          ci.slot = slot;
          mws.send(JSON.stringify({ type: 'room_joined', roomCode: code, slot, reconnectToken: token, players: needed, needed }));
        });
        startRoomSimulation(room);
      }
      return;
    }

    if (msg.type === 'input') {
      const now = Date.now();
      if (now - clientInfo.lastInputAt < 10) return; // Anti-cheat rate limit
      clientInfo.lastInputAt = now;

      const room = rooms.get(clientInfo.roomCode);
      if (!room || !clientInfo.slot) return;
      const clean = sanitizeInput(msg.input);
      // Map p3->p1 (home co-op) and p4->p2 (away co-op) if 2v2
      const engineSlot = clientInfo.slot === 'p3' ? 'p1' : clientInfo.slot === 'p4' ? 'p2' : clientInfo.slot;
      room.engine.setInput(engineSlot, clean);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    for (const q of Object.values(matchQueues)) {
      const idx = q.indexOf(ws);
      if (idx !== -1) q.splice(idx, 1);
    }
    if (clientInfo.roomCode && clientInfo.slot) {
      const room = rooms.get(clientInfo.roomCode);
      if (room && room.slots.has(clientInfo.slot)) {
        room.slots.get(clientInfo.slot).disconnectedAt = Date.now();
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Apex Pitch Server listening on http://localhost:${PORT}`);
});
