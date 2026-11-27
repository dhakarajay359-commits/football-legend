import * as THREE from 'three';
import {
  PITCH_LENGTH, PITCH_WIDTH, HALF_LENGTH, HALF_WIDTH,
  GOAL_WIDTH, HALF_GOAL_WIDTH, GOAL_HEIGHT, GOAL_DEPTH,
  PENALTY_AREA_LENGTH, PENALTY_AREA_WIDTH,
  GOAL_AREA_LENGTH, GOAL_AREA_WIDTH,
  CENTER_CIRCLE_RADIUS, PENALTY_SPOT_DIST, STADIUMS
} from '../../shared/constants.js';

export interface StadiumRefs {
  group: THREE.Group;
  crowdMesh: THREE.InstancedMesh | null;
  weatherParticles: THREE.Points | null;
  flags: THREE.Mesh[];
  sunLight: THREE.DirectionalLight;
}

function createGrassNormalMap(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgb(128,128,255)';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 6000; i++) {
    const r = 110 + Math.floor(Math.random() * 36);
    const g = 110 + Math.floor(Math.random() * 36);
    ctx.fillStyle = `rgb(${r},${g},255)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(32, 22);
  return tex;
}

function createCrowdTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#090e1a';
  ctx.fillRect(0, 0, 1024, 512);
  const jackets = ['#1e293b', '#0f172a', '#e2e8f0', '#334155', '#15803d', '#1d4ed8', '#dc2626', '#475569', '#facc15', '#cbd5e1'];
  const skins = ['#f1c29b', '#d8a47f', '#b67852', '#6f422b'];
  const hairs = ['#111827', '#3b281d', '#6e4c2a', '#9ca3af'];

  for (let y = 10; y < 512; y += 12) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, y + 6, 1024, 3);
    for (let x = 2; x < 1024; x += 8) {
      const h = (x * 17 + y * 31) >>> 0;
      // Torso / Jacket
      ctx.fillStyle = jackets[h % jackets.length];
      ctx.fillRect(x, y - 5, 7, 8);
      // Head & Hair
      ctx.fillStyle = skins[h % skins.length];
      ctx.fillRect(x + 1, y - 9, 4, 4);
      ctx.fillStyle = hairs[(h >> 3) % hairs.length];
      ctx.fillRect(x + 1, y - 10, 4, 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 2);
  return tex;
}

function createLEDBoardTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 1024, 0);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.25, '#1d4ed8');
  grad.addColorStop(0.5, '#a21caf');
  grad.addColorStop(0.75, '#0284c7');
  grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('FOOTBALL LEGENDS     •     FOOTBALL LEGENDS', 36, 33);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(0, 0, 1024, 4);
  ctx.fillRect(0, 60, 1024, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  return tex;
}

function createPitchTexture(): THREE.CanvasTexture {
  const w = 2048;
  const h = 1328;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Mowed grass alternating stripes (deep, rich, realistic emerald pitch green)
  const numStripes = 18;
  const stripeW = w / numStripes;
  for (let i = 0; i < numStripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#276b1f' : '#1f5918';
    ctx.fillRect(i * stripeW, 0, stripeW + 1, h);
  }

  // Subtle turf blade grain & realistic grass variation
  for (let i = 0; i < 24000; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,25,0,0.045)';
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 4);
  }

  // Convert meters to canvas coords
  const pad = 60;
  const pw = w - pad * 2;
  const ph = h - pad * 2;
  const mx = (x: number) => pad + ((x + HALF_LENGTH) / PITCH_LENGTH) * pw;
  const mz = (z: number) => pad + ((z + HALF_WIDTH) / PITCH_WIDTH) * ph;
  const sx = (len: number) => (len / PITCH_LENGTH) * pw;
  const sz = (len: number) => (len / PITCH_WIDTH) * ph;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = 4;

  // Outer touchlines & goal lines
  ctx.strokeRect(mx(-HALF_LENGTH), mz(-HALF_WIDTH), sx(PITCH_LENGTH), sz(PITCH_WIDTH));

  // Halfway line
  ctx.beginPath();
  ctx.moveTo(mx(0), mz(-HALF_WIDTH));
  ctx.lineTo(mx(0), mz(HALF_WIDTH));
  ctx.stroke();

  // Center circle & spot
  ctx.beginPath();
  ctx.arc(mx(0), mz(0), sx(CENTER_CIRCLE_RADIUS), 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(mx(0), mz(0), 6, 0, Math.PI * 2);
  ctx.fill();

  // Penalty & Goal areas (left and right)
  for (const dir of [-1, 1]) {
    const gx = dir === -1 ? -HALF_LENGTH : HALF_LENGTH - PENALTY_AREA_LENGTH;
    ctx.strokeRect(mx(gx), mz(-PENALTY_AREA_WIDTH / 2), sx(PENALTY_AREA_LENGTH), sz(PENALTY_AREA_WIDTH));

    const boxX = dir === -1 ? -HALF_LENGTH : HALF_LENGTH - GOAL_AREA_LENGTH;
    ctx.strokeRect(mx(boxX), mz(-GOAL_AREA_WIDTH / 2), sx(GOAL_AREA_LENGTH), sz(GOAL_AREA_WIDTH));

    // Penalty spot
    const spotX = dir === -1 ? -HALF_LENGTH + PENALTY_SPOT_DIST : HALF_LENGTH - PENALTY_SPOT_DIST;
    ctx.beginPath();
    ctx.arc(mx(spotX), mz(0), 5, 0, Math.PI * 2);
    ctx.fill();

    // Penalty arc
    ctx.beginPath();
    if (dir === -1) {
      ctx.arc(mx(spotX), mz(0), sx(CENTER_CIRCLE_RADIUS), -0.65, 0.65);
    } else {
      ctx.arc(mx(spotX), mz(0), sx(CENTER_CIRCLE_RADIUS), Math.PI - 0.65, Math.PI + 0.65);
    }
    ctx.stroke();
  }

  // Corner arcs
  const cr = sx(1.2);
  ctx.beginPath(); ctx.arc(mx(-HALF_LENGTH), mz(-HALF_WIDTH), cr, 0, Math.PI / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(mx(-HALF_LENGTH), mz(HALF_WIDTH), cr, -Math.PI / 2, 0); ctx.stroke();
  ctx.beginPath(); ctx.arc(mx(HALF_LENGTH), mz(-HALF_WIDTH), cr, Math.PI / 2, Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(mx(HALF_LENGTH), mz(HALF_WIDTH), cr, Math.PI, Math.PI * 1.5); ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  return tex;
}

function createGoalMesh(dir: number): THREE.Group {
  const goal = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.4 });
  const postRadius = 0.07;

  // Left & Right Posts
  const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, GOAL_HEIGHT, 12);
  const leftPost = new THREE.Mesh(postGeo, postMat);
  leftPost.position.set(0, GOAL_HEIGHT / 2, -HALF_GOAL_WIDTH);
  leftPost.castShadow = true;
  goal.add(leftPost);

  const rightPost = new THREE.Mesh(postGeo, postMat);
  rightPost.position.set(0, GOAL_HEIGHT / 2, HALF_GOAL_WIDTH);
  rightPost.castShadow = true;
  goal.add(rightPost);

  // Crossbar
  const barGeo = new THREE.CylinderGeometry(postRadius, postRadius, GOAL_WIDTH + postRadius * 2, 12);
  const crossbar = new THREE.Mesh(barGeo, postMat);
  crossbar.rotation.x = Math.PI / 2;
  crossbar.position.set(0, GOAL_HEIGHT, 0);
  crossbar.castShadow = true;
  goal.add(crossbar);

  // Netting (back, top, sides)
  const netMat = new THREE.MeshBasicMaterial({
    color: 0xe2e8f0,
    wireframe: true,
    transparent: true,
    opacity: 0.45
  });
  const backNet = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_WIDTH, GOAL_HEIGHT, 16, 8), netMat);
  backNet.position.set(dir * GOAL_DEPTH, GOAL_HEIGHT / 2, 0);
  backNet.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  goal.add(backNet);

  const topNet = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_DEPTH, GOAL_WIDTH, 6, 16), netMat);
  topNet.position.set(dir * (GOAL_DEPTH / 2), GOAL_HEIGHT, 0);
  topNet.rotation.x = Math.PI / 2;
  goal.add(topNet);

  for (const side of [-1, 1]) {
    const sideNet = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_DEPTH, GOAL_HEIGHT, 6, 8), netMat);
    sideNet.position.set(dir * (GOAL_DEPTH / 2), GOAL_HEIGHT / 2, side * HALF_GOAL_WIDTH);
    goal.add(sideNet);

    // Back stanchion support pole
    const backPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, GOAL_HEIGHT, 8), postMat);
    backPole.position.set(dir * GOAL_DEPTH, GOAL_HEIGHT / 2, side * HALF_GOAL_WIDTH);
    goal.add(backPole);
  }

  goal.position.set(dir * HALF_LENGTH, 0, 0);
  return goal;
}

export function buildStadium(
  scene: THREE.Scene,
  stadiumId: string,
  timeOfDay: string,
  weather: string
): StadiumRefs {
  const group = new THREE.Group();
  const stadiumMeta = STADIUMS.find((s) => s.id === stadiumId) || STADIUMS[0];

  // Sky & Fog + Sky Dome
  const skyColor = timeOfDay === 'night' ? 0x071024 : timeOfDay === 'sunset' ? 0x3b223a : 0x60a5fa;
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.FogExp2(skyColor, weather === 'rain' ? 0.003 : 0.00065);

  if (timeOfDay === 'day') {
    const skyGeo = new THREE.SphereGeometry(220, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, side: THREE.BackSide });
    group.add(new THREE.Mesh(skyGeo, skyMat));
  }

  // Lighting (balanced natural contrast so grass stays deep emerald, never washed out)
  const hemi = new THREE.HemisphereLight(timeOfDay === 'night' ? 0x93c5fd : 0xe0f2fe, 0x163814, 0.45);
  group.add(hemi);

  const ambient = new THREE.AmbientLight(timeOfDay === 'night' ? 0x94a3b8 : 0xffffff, timeOfDay === 'night' ? 0.35 : 0.42);
  group.add(ambient);

  const sunLight = new THREE.DirectionalLight(
    timeOfDay === 'night' ? 0xf0f9ff : timeOfDay === 'sunset' ? 0xffb37b : 0xfffbeb,
    timeOfDay === 'night' ? 1.35 : 1.18
  );
  sunLight.position.set(35, 65, 28);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 180;
  sunLight.shadow.camera.left = -68;
  sunLight.shadow.camera.right = 68;
  sunLight.shadow.camera.top = 50;
  sunLight.shadow.camera.bottom = -50;
  group.add(sunLight);

  // Pitch ground + outer apron
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(PITCH_LENGTH + 36, PITCH_WIDTH + 30),
    new THREE.MeshStandardMaterial({ color: 0x1a4d22, roughness: 0.95 })
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  apron.receiveShadow = true;
  group.add(apron);

  const pitchMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PITCH_LENGTH + 7, PITCH_WIDTH + 5),
    new THREE.MeshStandardMaterial({
      map: createPitchTexture(),
      normalMap: createGrassNormalMap(),
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.78,
      metalness: 0.04
    })
  );
  pitchMesh.rotation.x = -Math.PI / 2;
  pitchMesh.receiveShadow = true;
  group.add(pitchMesh);

  // Goals
  group.add(createGoalMesh(-1));
  group.add(createGoalMesh(1));

  // Corner Flags
  const flags: THREE.Mesh[] = [];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xef4444, side: THREE.DoubleSide });
  for (const cx of [-HALF_LENGTH, HALF_LENGTH]) {
    for (const cz of [-HALF_WIDTH, HALF_WIDTH]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8), poleMat);
      pole.position.set(cx, 0.75, cz);
      group.add(pole);

      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.3), flagMat);
      flag.position.set(cx + 0.22, 1.35, cz);
      group.add(flag);
      flags.push(flag);
    }
  }

  // LED Advertising Boards with glowing sponsor graphics
  const ledTex = createLEDBoardTexture();
  const adMat = new THREE.MeshStandardMaterial({
    map: ledTex,
    emissiveMap: ledTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.85,
    roughness: 0.3
  });
  for (const sz of [-HALF_WIDTH - 3.5, HALF_WIDTH + 3.5]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(PITCH_LENGTH + 6, 1.0, 0.2), adMat);
    board.position.set(0, 0.5, sz);
    group.add(board);
  }
  for (const sx of [-HALF_LENGTH - 5.5, HALF_LENGTH + 5.5]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, PITCH_WIDTH + 6), adMat);
    board.position.set(sx, 0.5, 0);
    group.add(board);
  }

  // Touchline Stewards & Photographers (orange hi-vis vests along the pitch)
  const vestMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.7 });
  for (let sx = -42; sx <= 42; sx += 9) {
    const steward = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.55, 4, 8), vestMat);
    steward.position.set(sx, 0.55, -HALF_WIDTH - 2.4);
    group.add(steward);
  }

  // Stadium Sloped Crowd Terraces (angled toward the pitch so the broadcast camera sees a packed stadium)
  const tiers = stadiumMeta.tiers;
  const crowdTex = createCrowdTexture();
  const slopeMat = new THREE.MeshStandardMaterial({
    map: crowdTex,
    roughness: 0.75,
    emissive: 0x1e293b,
    emissiveIntensity: 0.45,
    side: THREE.DoubleSide
  });

  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.PlaneGeometry(PITCH_LENGTH + 32, 24), slopeMat);
    slope.position.set(0, 7.8, side * (HALF_WIDTH + 11.5));
    // Tilt top backward away from pitch so the crowd face looks directly at the pitch & camera
    slope.rotation.x = side < 0 ? -0.68 : 0.68;
    group.add(slope);

    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(PITCH_LENGTH + 26, 0.9, 0.4), adMat);
    ribbon.position.set(0, 8.2, side * (HALF_WIDTH + 11.2));
    group.add(ribbon);
  }

  for (const side of [-1, 1]) {
    const endSlope = new THREE.Mesh(new THREE.PlaneGeometry(PITCH_WIDTH + 26, 24), slopeMat);
    endSlope.position.set(side * (HALF_LENGTH + 13.5), 7.8, 0);
    endSlope.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    endSlope.rotation.order = 'YXZ';
    endSlope.rotation.x = -0.68;
    group.add(endSlope);
  }

  // Concrete stair aisles on North & South slopes
  const aisleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
  for (const side of [-1, 1]) {
    for (let ax = -48; ax <= 48; ax += 14) {
      const aisle = new THREE.Mesh(new THREE.BoxGeometry(0.9, 24, 0.25), aisleMat);
      aisle.position.set(ax, 7.8, side * (HALF_WIDTH + 11.3));
      aisle.rotation.x = side < 0 ? -0.68 : 0.68;
      group.add(aisle);
    }
  }

  // Stadium Canopy Roof, Steel Trusses & Ring of Floodlight Pods
  if (stadiumMeta.roof) {
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.65, roughness: 0.35 });
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 });
    const podMat = new THREE.MeshBasicMaterial({ color: timeOfDay === 'night' ? 0xfef9c3 : 0xffffff });
    const roofH = 9.5 + tiers * 5.2;

    for (const side of [-1, 1]) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(PITCH_LENGTH + 38, 0.9, 16), roofMat);
      roof.position.set(0, roofH, side * (HALF_WIDTH + 10 + tiers * 5));
      group.add(roof);

      // Ring of floodlight pods along inner roof edge
      for (let fx = -48; fx <= 48; fx += 12) {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 0.8), podMat);
        pod.position.set(fx, roofH - 0.6, side * (HALF_WIDTH + 2.5 + tiers * 5));
        group.add(pod);

        const truss = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 15), trussMat);
        truss.position.set(fx, roofH - 0.5, side * (HALF_WIDTH + 10 + tiers * 5));
        group.add(truss);
      }
    }

    for (const side of [-1, 1]) {
      const endRoof = new THREE.Mesh(new THREE.BoxGeometry(16, 0.9, PITCH_WIDTH + 34), roofMat);
      endRoof.position.set(side * (HALF_LENGTH + 12 + tiers * 5), roofH, 0);
      group.add(endRoof);

      for (let fz = -30; fz <= 30; fz += 12) {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 2.6), podMat);
        pod.position.set(side * (HALF_LENGTH + 4.5 + tiers * 5), roofH - 0.6, fz);
        group.add(pod);
      }
    }
  }

  // Stadium Jumbotron Screens (above both behind-goal stands)
  const jCanvas = document.createElement('canvas');
  jCanvas.width = 512;
  jCanvas.height = 256;
  const jCtx = jCanvas.getContext('2d')!;
  jCtx.fillStyle = '#0f172a';
  jCtx.fillRect(0, 0, 512, 256);
  jCtx.strokeStyle = '#38bdf8';
  jCtx.lineWidth = 8;
  jCtx.strokeRect(8, 8, 496, 240);
  jCtx.fillStyle = '#facc15';
  jCtx.font = 'bold 48px Inter, sans-serif';
  jCtx.textAlign = 'center';
  jCtx.fillText('FOOTBALL', 256, 118);
  jCtx.fillStyle = '#ffffff';
  jCtx.fillText('LEGENDS', 256, 178);
  const jTex = new THREE.CanvasTexture(jCanvas);

  for (const side of [-1, 1]) {
    const jumbo = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 7.5, 15),
      new THREE.MeshBasicMaterial({ map: jTex })
    );
    jumbo.position.set(side * (HALF_LENGTH + 9.5), 16.5, 0);
    group.add(jumbo);
  }

  // Floodlight towers
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: timeOfDay === 'night' ? 0xfef9c3 : 0xe2e8f0 });
  for (const tx of [-HALF_LENGTH - 15, HALF_LENGTH + 15]) {
    for (const tz of [-HALF_WIDTH - 14, HALF_WIDTH + 14]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 32, 8), towerMat);
      pole.position.set(tx, 16, tz);
      group.add(pole);

      const head = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 1.2), bulbMat);
      head.position.set(tx, 32, tz);
      head.lookAt(0, 0, 0);
      group.add(head);
    }
  }

  // Two-part 3D Human Audience (sculpted shouldered torsos + distinct skin-toned heads)
  const crowdCount = Math.min(4800, Math.floor(stadiumMeta.capacity / 15));
  const torsoGeo = new THREE.CylinderGeometry(0.21, 0.16, 0.48, 8);
  const torsoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 });
  const crowdMesh = new THREE.InstancedMesh(torsoGeo, torsoMat, crowdCount);

  const headGeo = new THREE.SphereGeometry(0.12, 8, 8);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const crowdHeads = new THREE.InstancedMesh(headGeo, headMat, crowdCount);

  const dummy = new THREE.Object3D();
  const hDummy = new THREE.Object3D();
  const color = new THREE.Color();
  const hColor = new THREE.Color();
  const palette = [0x1e293b, 0x0f172a, 0xe2e8f0, 0x334155, 0x15803d, 0x1d4ed8, 0x991b1b, 0x64748b, 0xfacc15];
  const skinPalette = [0xf1c29b, 0xd8a47f, 0xb67852, 0x6f422b, 0xe5b88f];

  const slopeAngle = 0.68;
  for (let i = 0; i < crowdCount; i++) {
    const rowIdx = i % 14;
    const u = -9.5 + (rowIdx / 13) * 19.0;
    const y = 7.8 + u * Math.cos(slopeAngle) + 0.35;
    const distFromCenter = 11.5 + u * Math.sin(slopeAngle);
    const side = i % 2 === 0 ? -1 : 1;
    const isEnd = i % 4 === 0;

    let px = 0;
    let pz = 0;
    if (isEnd) {
      px = side * (HALF_LENGTH + 13.5 + u * Math.sin(slopeAngle));
      pz = (Math.random() - 0.5) * (PITCH_WIDTH + 18);
    } else {
      px = (Math.random() - 0.5) * (PITCH_LENGTH + 20);
      pz = side * (HALF_WIDTH + distFromCenter);
    }

    dummy.position.set(px, y, pz);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    crowdMesh.setMatrixAt(i, dummy.matrix);
    color.setHex(palette[i % palette.length]);
    crowdMesh.setColorAt(i, color);

    hDummy.position.set(px, y + 0.34, pz);
    hDummy.updateMatrix();
    crowdHeads.setMatrixAt(i, hDummy.matrix);
    hColor.setHex(skinPalette[i % skinPalette.length]);
    crowdHeads.setColorAt(i, hColor);
  }
  crowdMesh.add(crowdHeads);
  group.add(crowdMesh);

  // Weather Particles (Rain / Snow)
  let weatherParticles: THREE.Points | null = null;
  if (weather === 'rain' || weather === 'snow') {
    const count = 1500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 130;
      positions[i * 3 + 1] = Math.random() * 35;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: weather === 'snow' ? 0xffffff : 0x93c5fd,
      size: weather === 'snow' ? 0.28 : 0.14,
      transparent: true,
      opacity: 0.7
    });
    weatherParticles = new THREE.Points(pGeo, pMat);
    group.add(weatherParticles);
  }

  scene.add(group);
  return { group, crowdMesh, weatherParticles, flags, sunLight };
}
