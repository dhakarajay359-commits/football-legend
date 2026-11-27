// Shared constants for 3D football simulation (used by both client & authoritative server)

export const PITCH_LENGTH = 105; // X axis: -52.5 to +52.5
export const PITCH_WIDTH = 68;   // Z axis: -34 to +34
export const HALF_LENGTH = PITCH_LENGTH / 2;
export const HALF_WIDTH = PITCH_WIDTH / 2;

export const GOAL_WIDTH = 7.32;
export const HALF_GOAL_WIDTH = GOAL_WIDTH / 2;
export const GOAL_HEIGHT = 2.44;
export const GOAL_DEPTH = 2.2;

export const PENALTY_AREA_LENGTH = 16.5;
export const PENALTY_AREA_WIDTH = 40.32;
export const GOAL_AREA_LENGTH = 5.5;
export const GOAL_AREA_WIDTH = 18.32;
export const PENALTY_SPOT_DIST = 11;
export const CENTER_CIRCLE_RADIUS = 9.15;

export const BALL_RADIUS = 0.22; // Slightly scaled for crisp 3D visibility while keeping realistic feel
export const PLAYER_RADIUS = 0.48;
export const GRAVITY = 15.5;
export const GROUND_FRICTION = 0.985;
export const AIR_DRAG = 0.996;
export const BOUNCE_RESTITUTION = 0.62;
export const MAGNUS_FACTOR = 0.038;

export const TICK_RATE = 60;
export const FIXED_DT = 1 / TICK_RATE;

export const FORMATIONS = {
  '4-3-3': [
    { role: 'GK', x: -48, z: 0 },
    { role: 'LB', x: -34, z: -22 },
    { role: 'CB', x: -36, z: -8 },
    { role: 'CB', x: -36, z: 8 },
    { role: 'RB', x: -34, z: 22 },
    { role: 'CDM', x: -18, z: 0 },
    { role: 'CM', x: -10, z: -13 },
    { role: 'CM', x: -10, z: 13 },
    { role: 'LW', x: 18, z: -21 },
    { role: 'ST', x: 24, z: 0 },
    { role: 'RW', x: 18, z: 21 }
  ],
  '4-4-2': [
    { role: 'GK', x: -48, z: 0 },
    { role: 'LB', x: -34, z: -22 },
    { role: 'CB', x: -36, z: -8 },
    { role: 'CB', x: -36, z: 8 },
    { role: 'RB', x: -34, z: 22 },
    { role: 'LM', x: -10, z: -22 },
    { role: 'CM', x: -14, z: -7 },
    { role: 'CM', x: -14, z: 7 },
    { role: 'RM', x: -10, z: 22 },
    { role: 'ST', x: 22, z: -8 },
    { role: 'ST', x: 22, z: 8 }
  ],
  '3-5-2': [
    { role: 'GK', x: -48, z: 0 },
    { role: 'CB', x: -36, z: -16 },
    { role: 'CB', x: -38, z: 0 },
    { role: 'CB', x: -36, z: 16 },
    { role: 'LWB', x: -12, z: -24 },
    { role: 'CDM', x: -20, z: -8 },
    { role: 'CDM', x: -20, z: 8 },
    { role: 'CAM', x: 2, z: 0 },
    { role: 'RWB', x: -12, z: 24 },
    { role: 'ST', x: 23, z: -8 },
    { role: 'ST', x: 23, z: 8 }
  ],
  '4-2-3-1': [
    { role: 'GK', x: -48, z: 0 },
    { role: 'LB', x: -34, z: -22 },
    { role: 'CB', x: -36, z: -8 },
    { role: 'CB', x: -36, z: 8 },
    { role: 'RB', x: -34, z: 22 },
    { role: 'CDM', x: -20, z: -8 },
    { role: 'CDM', x: -20, z: 8 },
    { role: 'LAM', x: 4, z: -18 },
    { role: 'CAM', x: 6, z: 0 },
    { role: 'RAM', x: 4, z: 18 },
    { role: 'ST', x: 25, z: 0 }
  ],
  '5-3-2': [
    { role: 'GK', x: -48, z: 0 },
    { role: 'LWB', x: -28, z: -24 },
    { role: 'CB', x: -37, z: -14 },
    { role: 'CB', x: -39, z: 0 },
    { role: 'CB', x: -37, z: 14 },
    { role: 'RWB', x: -28, z: 24 },
    { role: 'CM', x: -14, z: -12 },
    { role: 'CM', x: -16, z: 0 },
    { role: 'CM', x: -14, z: 12 },
    { role: 'ST', x: 20, z: -8 },
    { role: 'ST', x: 20, z: 8 }
  ]
};

export const TACTICS = {
  balanced: { name: 'Balanced', attackBias: 0, pressIntensity: 0.55, lineHeight: 0 },
  high_press: { name: 'High Press', attackBias: 6, pressIntensity: 0.9, lineHeight: 8 },
  counter_attack: { name: 'Counter Attack', attackBias: -4, pressIntensity: 0.4, lineHeight: -7 },
  tiki_taka: { name: 'Possession', attackBias: 4, pressIntensity: 0.65, lineHeight: 5 },
  park_the_bus: { name: 'Ultra Defensive', attackBias: -10, pressIntensity: 0.3, lineHeight: -12 }
};

export const DIFFICULTIES = {
  amateur: { name: 'Amateur', reaction: 0.55, passAccuracy: 0.72, shotAccuracy: 0.62, pressSpeed: 0.78, gkSkill: 0.65 },
  semi_pro: { name: 'Semi-Pro', reaction: 0.72, passAccuracy: 0.80, shotAccuracy: 0.74, pressSpeed: 0.88, gkSkill: 0.76 },
  professional: { name: 'Professional', reaction: 0.85, passAccuracy: 0.88, shotAccuracy: 0.83, pressSpeed: 0.96, gkSkill: 0.85 },
  world_class: { name: 'World Class', reaction: 0.94, passAccuracy: 0.93, shotAccuracy: 0.90, pressSpeed: 1.03, gkSkill: 0.92 },
  legendary: { name: 'Legendary', reaction: 1.0, passAccuracy: 0.97, shotAccuracy: 0.95, pressSpeed: 1.08, gkSkill: 0.97 }
};

export const STADIUMS = [
  { id: 'apex_national', name: 'Apex National Arena', capacity: 82000, size: 'large', tiers: 3, roof: true, unlocked: true, cost: 0 },
  { id: 'metro_olympic', name: 'Metro Olympic Bowl', capacity: 68000, size: 'large', tiers: 2, roof: true, unlocked: true, cost: 0 },
  { id: 'harborview', name: 'Harborview Park', capacity: 24500, size: 'medium', tiers: 1, roof: true, unlocked: true, cost: 0 },
  { id: 'riverside', name: 'Riverside Community Ground', capacity: 9500, size: 'small', tiers: 1, roof: false, unlocked: true, cost: 0 },
  { id: 'crown_fortress', name: 'Crown Fortress Stadium', capacity: 90000, size: 'large', tiers: 3, roof: true, unlocked: false, cost: 2500 }
];
