import test from 'node:test';
import assert from 'node:assert/strict';
import { FootballEngine } from '../shared/engine.js';
import { HALF_LENGTH, BALL_RADIUS } from '../shared/constants.js';

test('FootballEngine initializes 22 players and ball at center', () => {
  const engine = new FootballEngine({ mode: 'match' });
  assert.equal(engine.players.length, 22);
  assert.equal(engine.ball.x, 0);
  assert.equal(engine.ball.z, 0);
});

test('FootballEngine 5v5 mode spawns 10 players (5 per team)', () => {
  const engine = new FootballEngine({ mode: 'match', teamSize: 5, matchDurationSec: 180 });
  assert.equal(engine.players.length, 10);
});

test('Human player movement, passing, and shooting work', () => {
  const engine = new FootballEngine({ mode: 'match' });
  engine.phase = 'playing';
  const p = engine.getPlayer(engine.controlled.home);
  engine.ball.ownerId = p.id;

  const startX = p.x;
  engine.setInput('p1', { moveX: 1, moveZ: 0, sprint: true });
  for (let i = 0; i < 10; i++) engine.step(1 / 60);
  assert.ok(p.x > startX, 'Player should move forward on pitch');

  engine.ball.ownerId = p.id;
  engine.setInput('p1', { moveX: 1, moveZ: 0, shoot: true, power: 0.9 });
  engine.step(1 / 60);
  assert.equal(engine.ball.ownerId, null, 'Ball should leave player on shot');
  assert.ok(engine.ball.vx > 10, 'Ball should have forward shot velocity');
});

test('Goal detection increments score and triggers goal phase', () => {
  const engine = new FootballEngine({ mode: 'match' });
  engine.phase = 'playing';
  engine.ball.ownerId = null;
  engine.ball.x = HALF_LENGTH - 0.5;
  engine.ball.y = 1.0;
  engine.ball.z = 0;
  engine.ball.vx = 25;
  engine.ball.vy = 0;
  engine.ball.vz = 0;

  for (let i = 0; i < 10; i++) engine.step(1 / 60);
  assert.equal(engine.score.home, 1);
  assert.equal(engine.phase, 'goal');
});

test('Auto-switch shifts control to teammate closest to loose ball', () => {
  const engine = new FootballEngine({ mode: 'match' });
  engine.phase = 'playing';
  engine.ball.ownerId = null;
  engine.ball.x = -30;
  engine.ball.z = -20;
  engine.controlled.home = 'home_9'; // far from (-30, -20)
  engine.step(1 / 60);
  assert.notEqual(engine.controlled.home, 'home_9', 'Control should auto-switch to closer teammate');
});

test('Close-range shot near opponent goal line always aims into goal', () => {
  const engine = new FootballEngine({ mode: 'match' });
  engine.phase = 'playing';
  const p = engine.getPlayer(engine.controlled.home);
  p.x = HALF_LENGTH - 0.3;
  p.z = 2.5;
  engine.ball.ownerId = p.id;
  engine.performShot(p, -0.5, 0, 0.8); // even with awkward aim input, shot goes into goal
  assert.ok(engine.ball.vx > 8, 'Close-range shot must travel forward toward goal');
});

test('Training drill dribbling_course tracks cone clears', () => {
  const engine = new FootballEngine({ mode: 'training', drill: 'dribbling_course' });
  assert.equal(engine.training.cones.length, 6);
  const cone0 = engine.training.cones[0];
  const p = engine.getPlayer(engine.controlled.home);
  p.x = cone0.x;
  p.z = cone0.z;
  engine.step(1 / 60);
  assert.equal(cone0.cleared, true);
  assert.ok(engine.training.score >= 100);
});
