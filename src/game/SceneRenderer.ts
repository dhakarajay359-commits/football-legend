import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BALL_RADIUS } from '../../shared/constants.js';
import { buildStadium, StadiumRefs } from './StadiumBuilder.js';

export type CameraMode = 'broadcast' | 'dynamic' | 'tele' | 'pro' | 'drone';

interface PlayerRig {
  root: THREE.Group;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  ring: THREE.Mesh;
  arrow: THREE.Mesh;
  nameTag: THREE.Sprite;
}

function createClothNormalMap(): THREE.CanvasTexture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgb(128,128,255)';
  ctx.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? 'rgb(128,142,255)' : 'rgb(128,114,255)';
    ctx.fillRect(0, y, s, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function createFaceTexture(skinTone: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = skinTone;
  ctx.fillRect(0, 0, 128, 128);

  // Subtle cheek/jaw shading
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, 92, 128, 36);

  // Eyes & eyebrows (centered on front UV)
  ctx.fillStyle = '#1f1b18';
  ctx.fillRect(42, 46, 12, 4);
  ctx.fillRect(74, 46, 12, 4);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(48, 56, 5, 3.2, 0, 0, Math.PI * 2);
  ctx.ellipse(80, 56, 5, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(48, 56, 2.3, 0, Math.PI * 2);
  ctx.arc(80, 56, 2.3, 0, Math.PI * 2);
  ctx.fill();

  // Nose shadow & mouth
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(62, 58, 4, 14);
  ctx.fillStyle = '#8b4a39';
  ctx.fillRect(56, 80, 16, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createJerseyTexture(primary: string, secondary: string, badgeColor: string, pattern: string, num: number, playerName = ''): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = secondary;
  if (pattern === 'stripes') {
    for (let x = 0; x < 512; x += 64) ctx.fillRect(x, 0, 30, 512);
  } else if (pattern === 'hoops') {
    for (let y = 0; y < 512; y += 64) ctx.fillRect(0, y, 512, 30);
  } else if (pattern === 'sash') {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(130, 0);
    ctx.lineTo(512, 512);
    ctx.lineTo(382, 512);
    ctx.closePath();
    ctx.fill();
  }

  // Subtle vertical fabric knit & side-panel shading
  ctx.fillStyle = 'rgba(0,0,0,0.09)';
  for (let y = 0; y < 512; y += 12) ctx.fillRect(0, y, 512, 3);

  // Collar & hem trim in badge color
  ctx.fillStyle = badgeColor;
  ctx.fillRect(0, 0, 512, 34);
  ctx.fillRect(0, 484, 512, 28);

  // Front of jersey (left half of cylinder UV ~ x=128)
  ctx.fillStyle = badgeColor;
  ctx.beginPath();
  ctx.moveTo(154, 110);
  ctx.lineTo(186, 110);
  ctx.lineTo(186, 134);
  ctx.lineTo(170, 146);
  ctx.lineTo(154, 134);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Front sponsor wordmark
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineWidth = 5;
  ctx.font = '900 26px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText('LEGENDS', 128, 225);
  ctx.fillText('LEGENDS', 128, 225);

  // Back of jersey (right half of cylinder UV ~ x=384): Player Name + Big Number
  const last = (playerName.split(' ').pop() || 'PLAYER').toUpperCase().slice(0, 10);
  ctx.font = '800 26px Inter, sans-serif';
  ctx.strokeText(last, 384, 128);
  ctx.fillText(last, 384, 128);

  ctx.font = '900 132px Inter, sans-serif';
  ctx.lineWidth = 10;
  ctx.strokeText(String(num), 384, 260);
  ctx.fillText(String(num), 384, 260);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBallTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#0f172a';
  for (let x = 20; x < 256; x += 48) {
    for (let y = 20; y < 128; y += 44) {
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 32, 256, 64);
  return new THREE.CanvasTexture(c);
}

export class SceneRenderer {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  private stadium: StadiumRefs | null = null;
  private playerRigs = new Map<string, PlayerRig>();
  private ballMesh: THREE.Mesh;
  private ballShadow: THREE.Mesh;
  private refMesh: THREE.Group;
  private trainingMeshes: THREE.Object3D[] = [];
  private blenderPlayerTemplate: THREE.Group | null = null;
  private lastInitArgs: { state: any; teams: any; stadiumId: string; timeOfDay: string; weather: string } | null = null;

  public cameraMode: CameraMode = 'broadcast';
  public cameraZoom = 1.0;
  public cameraAngle = 0.0;
  private camPos = new THREE.Vector3(0, 22, 34);
  private camTarget = new THREE.Vector3(0, 0, 0);

  constructor(container: HTMLElement) {
    const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900;
    this.renderer = new THREE.WebGLRenderer({ antialias: !isMobile || window.devicePixelRatio <= 2, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, container.clientWidth / Math.max(1, container.clientHeight), 0.5, 320);
    this.syncCameraProjection(container.clientWidth, container.clientHeight);
    this.camera.position.copy(this.camPos);

    // Ball + Shadow
    this.ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 20, 20),
      new THREE.MeshStandardMaterial({ map: createBallTexture(), roughness: 0.35 })
    );
    this.ballMesh.castShadow = true;
    this.scene.add(this.ballMesh);

    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(BALL_RADIUS * 1.35, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.y = 0.02;
    this.scene.add(this.ballShadow);

    // Referee (articulated 3D official in hi-vis ref shirt)
    this.refMesh = this.buildArticulatedReferee();
    this.scene.add(this.refMesh);

    // Preload sculpted Blender player GLB model
    const loader = new GLTFLoader();
    loader.load('./assets/player.glb', (gltf) => {
      this.blenderPlayerTemplate = gltf.scene;
      if (this.lastInitArgs) {
        const a = this.lastInitArgs;
        this.initMatchVisuals(a.state, a.teams, a.stadiumId, a.timeOfDay, a.weather);
      }
    });

    window.addEventListener('resize', this.onResize);
  }

  private syncCameraProjection(width: number, height: number) {
    const aspect = width / Math.max(1, height);
    this.camera.aspect = aspect;
    // Widen vertical FOV in portrait mode so the full pitch width remains visible on mobile phones
    this.camera.fov = aspect < 1 ? Math.min(66, 40 + (1 - aspect) * 42) : 40;
    this.camera.updateProjectionMatrix();
  }

  private onResize = () => {
    const parent = this.renderer.domElement.parentElement;
    if (!parent) return;
    this.syncCameraProjection(parent.clientWidth, parent.clientHeight);
    this.renderer.setSize(parent.clientWidth, parent.clientHeight);
  };

  public destroy() {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private buildArticulatedReferee(): THREE.Group {
    const g = new THREE.Group();
    g.scale.setScalar(1.1);
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.21, 0.34, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.7 })
    );
    torso.scale.set(1.08, 1.0, 0.72);
    torso.position.y = 1.12;
    torso.castShadow = true;
    g.add(torso);

    const shorts = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.19, 0.28, 12),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 })
    );
    shorts.position.y = 0.72;
    g.add(shorts);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 14, 14),
      new THREE.MeshStandardMaterial({ color: '#d8a47f', roughness: 0.6 })
    );
    head.position.y = 1.62;
    head.castShadow = true;
    g.add(head);

    for (const x of [-0.11, 0.11]) {
      const leg = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.075, 0.45, 6, 8),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.75 })
      );
      leg.position.set(x, 0.36, 0);
      leg.castShadow = true;
      g.add(leg);
    }
    return g;
  }

  public initMatchVisuals(state: any, teams: any, stadiumId: string, timeOfDay: string, weather: string) {
    this.lastInitArgs = { state, teams, stadiumId, timeOfDay, weather };
    if (this.stadium) {
      this.scene.remove(this.stadium.group);
    }
    for (const rig of this.playerRigs.values()) {
      this.scene.remove(rig.root);
    }
    this.playerRigs.clear();

    for (const tm of this.trainingMeshes) this.scene.remove(tm);
    this.trainingMeshes = [];

    this.stadium = buildStadium(this.scene, stadiumId, timeOfDay, weather);
    if (this.stadium.crowdMesh && state.mode === 'training') {
      this.stadium.crowdMesh.visible = false;
    }

    // Build articulated 3D player rigs
    for (const p of state.players) {
      const team = teams[p.team];
      const isGK = p.role === 'GK';
      const shirtColor = isGK ? team.kit.gkPrimary : team.kit.primary;
      const secondary = isGK ? '#111827' : team.kit.secondary;
      const shortsColor = isGK ? '#111827' : team.kit.shorts;
      const socksColor = isGK ? shirtColor : team.kit.socks;

      const root = new THREE.Group();
      root.scale.setScalar(1.38);

      const shadowDisc = new THREE.Mesh(
        new THREE.CircleGeometry(0.42, 16),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 })
      );
      shadowDisc.rotation.x = -Math.PI / 2;
      shadowDisc.position.y = 0.02;
      root.add(shadowDisc);

      const jerseyTex = createJerseyTexture(shirtColor, secondary, team.badgeColor || secondary, isGK ? 'solid' : team.kit.pattern, p.number, p.name);
      const skinMat = new THREE.MeshStandardMaterial({ color: p.skinTone || '#d8a47f', roughness: 0.6 });
      const clothNormal = createClothNormalMap();
      const jerseyMat = new THREE.MeshStandardMaterial({ map: jerseyTex, normalMap: clothNormal, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.62 });
      const shortsMat = new THREE.MeshStandardMaterial({ color: shortsColor, normalMap: clothNormal, normalScale: new THREE.Vector2(0.25, 0.25), roughness: 0.72 });
      const socksMat = new THREE.MeshStandardMaterial({ color: socksColor, normalMap: clothNormal, normalScale: new THREE.Vector2(0.2, 0.2), roughness: 0.7 });
      const hairMat = new THREE.MeshStandardMaterial({ color: p.hairColor || '#1f1b18', roughness: 0.85 });
      const bootMat = new THREE.MeshStandardMaterial({ color: p.team === 'home' ? 0x0ea5e9 : 0xf97316, roughness: 0.32 });

      let leftLeg: THREE.Object3D = new THREE.Group();
      let rightLeg: THREE.Object3D = new THREE.Group();
      let leftArm: THREE.Object3D = new THREE.Group();
      let rightArm: THREE.Object3D = new THREE.Group();

      if (this.blenderPlayerTemplate) {
        const model = this.blenderPlayerTemplate.clone(true);
        // Blender +Y forward exports as -Z in glTF; rotate 180° around Y so player faces +Z (p.facing)
        model.rotation.y = Math.PI;
        model.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const matName = child.material?.name || '';
            if (matName.includes('Mat_Jersey')) child.material = jerseyMat;
            else if (matName.includes('Mat_Shorts')) child.material = shortsMat;
            else if (matName.includes('Mat_Socks')) child.material = socksMat;
            else if (matName.includes('Mat_Skin')) child.material = skinMat;
            else if (matName.includes('Mat_Hair')) child.material = hairMat;
            else if (matName.includes('Mat_Boot')) child.material = bootMat;
          }
          if (child.name === 'LeftLeg') leftLeg = child;
          else if (child.name === 'RightLeg') rightLeg = child;
          else if (child.name === 'LeftArm') leftArm = child;
          else if (child.name === 'RightArm') rightArm = child;
        });
        root.add(model);
      } else {
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.165, 0.56, 16), jerseyMat);
        torso.position.y = 1.15;
        torso.castShadow = true;
        root.add(torso);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 16), skinMat);
        head.position.y = 1.66;
        root.add(head);
        root.add(leftLeg, rightLeg, leftArm, rightArm);
      }

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.72, 28),
        new THREE.MeshBasicMaterial({
          color: p.team === 'home' ? 0x22c55e : 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      ring.visible = false;
      root.add(ring);

      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.32, 4),
        new THREE.MeshBasicMaterial({ color: p.team === 'home' ? 0x00e5ff : 0xef4444 })
      );
      arrow.rotation.x = Math.PI;
      arrow.position.y = 2.15;
      arrow.visible = false;
      root.add(arrow);

      const nCanvas = document.createElement('canvas');
      nCanvas.width = 256;
      nCanvas.height = 64;
      const nCtx = nCanvas.getContext('2d')!;
      nCtx.font = 'bold 28px Inter, sans-serif';
      nCtx.textAlign = 'center';
      nCtx.textBaseline = 'middle';
      nCtx.strokeStyle = 'rgba(0,0,0,0.85)';
      nCtx.lineWidth = 6;
      nCtx.strokeText(p.name, 128, 32);
      nCtx.fillStyle = '#ffffff';
      nCtx.fillText(p.name, 128, 32);
      const nameTag = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(nCanvas), transparent: true, depthTest: false })
      );
      nameTag.scale.set(2.4, 0.6, 1);
      nameTag.position.y = 2.55;
      nameTag.visible = false;
      root.add(nameTag);

      this.scene.add(root);
      this.playerRigs.set(p.id, { root, leftLeg, rightLeg, leftArm, rightArm, ring, arrow, nameTag });
    }

    // Training cones / targets
    if (state.training) {
      for (const c of state.training.cones || []) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.35, 0.85, 12),
          new THREE.MeshStandardMaterial({ color: 0xf97316 })
        );
        cone.position.set(c.x, 0.42, c.z);
        cone.userData.coneId = c.id;
        this.scene.add(cone);
        this.trainingMeshes.push(cone);
      }
      for (const t of state.training.targets || []) {
        const tgt = new THREE.Mesh(
          new THREE.TorusGeometry(0.65, 0.1, 10, 24),
          new THREE.MeshBasicMaterial({ color: 0xfacc15 })
        );
        tgt.position.set(t.x, t.y, t.z);
        tgt.rotation.y = Math.PI / 2;
        tgt.userData.targetId = t.id;
        this.scene.add(tgt);
        this.trainingMeshes.push(tgt);
      }
    }
  }

  public render(state: any, dt: number, timeSec: number) {
    // Update Ball
    this.ballMesh.position.set(state.ball.x, state.ball.y, state.ball.z);
    this.ballMesh.rotation.x += state.ball.vz * dt * 2.5;
    this.ballMesh.rotation.z -= state.ball.vx * dt * 2.5;
    this.ballShadow.position.set(state.ball.x, 0.025, state.ball.z);
    const shadowScale = Math.max(0.4, 1 - state.ball.y * 0.12);
    this.ballShadow.scale.set(shadowScale, shadowScale, 1);

    // Update Referee
    if (state.referee) {
      this.refMesh.position.set(state.referee.x, 0, state.referee.z);
      this.refMesh.rotation.y = -state.referee.facing + Math.PI / 2;
    }

    // Find nearest open home teammate for secondary pass-target indicator
    const ctrlHome = state.players.find((pl: any) => pl.id === state.controlled.home);
    let nearestMateId: string | null = null;
    if (ctrlHome) {
      let bestD = Infinity;
      for (const pl of state.players) {
        if (pl.team === 'home' && pl.id !== ctrlHome.id && pl.role !== 'GK' && !pl.redCard) {
          const d = Math.hypot(pl.x - ctrlHome.x, pl.z - ctrlHome.z);
          if (d < bestD) { bestD = d; nearestMateId = pl.id; }
        }
      }
    }

    // Update Players
    for (const p of state.players) {
      const rig = this.playerRigs.get(p.id);
      if (!rig) continue;
      rig.root.visible = !p.redCard;
      if (p.redCard) continue;

      rig.root.position.set(p.x, 0, p.z);
      const speed = Math.hypot(p.vx, p.vz);
      const moveFacing = speed > 0.35 ? Math.atan2(p.vz, p.vx) : p.facing;
      const targetRotY = -moveFacing + Math.PI / 2;
      // Smooth shortest-angle human turn
      let diff = targetRotY - rig.root.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rig.root.rotation.y += diff * Math.min(1, dt * 14);

      const isControlled = state.controlled.home === p.id || state.controlled.away === p.id;
      const isPassTarget = p.id === nearestMateId;
      const isHomeMate = p.team === 'home' && p.role !== 'GK';
      rig.ring.visible = isControlled || isHomeMate;
      (rig.ring.material as THREE.MeshBasicMaterial).color.setHex(
        state.controlled.home === p.id ? 0xfacc15 : isHomeMate ? 0x00e5ff : 0xef4444
      );
      (rig.ring.material as THREE.MeshBasicMaterial).opacity = isControlled ? 0.95 : 0.35;
      rig.arrow.visible = isControlled || isPassTarget;
      (rig.arrow.material as THREE.MeshBasicMaterial).color.setHex(
        state.controlled.home === p.id ? 0xfacc15 : isPassTarget ? 0x00e5ff : 0xef4444
      );
      rig.nameTag.visible = state.controlled.home === p.id || isPassTarget;
      if (isControlled || isPassTarget) {
        rig.arrow.position.y = 2.15 + Math.sin(timeSec * 6) * 0.08;
      }

      // Procedural limb animation
      if (p.actionState === 'slide') {
        rig.root.rotation.x = -0.95;
        rig.root.position.y = 0.25;
      } else if (p.actionState === 'dive') {
        rig.root.rotation.z = (p.diveDir || 1) * 1.15;
        rig.root.position.y = 0.55;
      } else {
        rig.root.rotation.x = 0;
        rig.root.rotation.z = 0;
        const stride = speed > 0.4 ? Math.sin(timeSec * (p.actionState === 'sprint' ? 16 : 11) + p.index) * Math.min(0.7, speed * 0.1) : 0;
        rig.leftLeg.rotation.x = stride;
        rig.rightLeg.rotation.x = -stride;
        rig.leftArm.rotation.x = -stride * 0.7;
        rig.rightArm.rotation.x = stride * 0.7;
        rig.leftArm.rotation.z = 0.14;
        rig.rightArm.rotation.z = -0.14;
      }
    }

    // Training visuals
    if (state.training) {
      for (const m of this.trainingMeshes) {
        if (m.userData.coneId) {
          const c = state.training.cones.find((x: any) => x.id === m.userData.coneId);
          if (c) (m as THREE.Mesh).visible = !c.cleared;
        }
        if (m.userData.targetId) {
          const t = state.training.targets.find((x: any) => x.id === m.userData.targetId);
          if (t) (m as THREE.Mesh).visible = !t.hit;
        }
      }
    }

    // Subtle crowd cheer wave (stronger during goal celebrations)
    if (this.stadium?.crowdMesh && this.stadium.crowdMesh.visible) {
      const cheerAmp = state.phase === 'goal' ? 0.35 : 0.05;
      this.stadium.crowdMesh.position.y = Math.abs(Math.sin(timeSec * (state.phase === 'goal' ? 9 : 2.5))) * cheerAmp;
    }

    // Weather animation
    if (this.stadium?.weatherParticles) {
      const pos = this.stadium.weatherParticles.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - dt * 18;
        if (y < 0) y = 34;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

    // Update Camera
    this.updateCamera(state, dt);

    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(state: any, dt: number) {
    const bx = state.ball.x;
    const bz = state.ball.z;
    const zMul = 1 / this.cameraZoom;

    let desiredPos = new THREE.Vector3();
    let desiredTarget = new THREE.Vector3(bx, 0.8, bz);

    if (this.cameraMode === 'broadcast') {
      desiredPos.set(bx * 0.75 + this.cameraAngle * 14, 12.2 * zMul, 21.5 * zMul + bz * 0.4);
      desiredTarget.set(bx * 0.88, 1.1, bz * 0.65 - 1.2);
    } else if (this.cameraMode === 'tele') {
      desiredPos.set(bx * 0.6 + this.cameraAngle * 15, 32 * zMul, 40 * zMul + bz * 0.25);
      desiredTarget.set(bx * 0.8, 0, bz * 0.5);
    } else if (this.cameraMode === 'dynamic') {
      const p = state.players.find((pl: any) => pl.id === state.controlled.home) || state.ball;
      desiredPos.set(p.x - 16 * zMul, 11 * zMul, p.z + 14 * zMul + this.cameraAngle * 10);
      desiredTarget.set(bx, 0.8, bz);
    } else if (this.cameraMode === 'drone') {
      const orbit = Math.sin(performance.now() * 0.00018) * 14 + this.cameraAngle * 22;
      desiredPos.set(bx * 0.25 + orbit, 46 * zMul, 58 * zMul + bz * 0.15);
      desiredTarget.set(bx * 0.2, 0, bz * 0.2);
    } else if (this.cameraMode === 'pro') {
      const p = state.players.find((pl: any) => pl.id === state.controlled.home);
      if (p) {
        const fx = Math.cos(p.facing);
        const fz = Math.sin(p.facing);
        desiredPos.set(p.x - fx * 6.8 * zMul, 3.0 * zMul, p.z - fz * 6.8 * zMul);
        desiredTarget.set(p.x + fx * 16, 1.35, p.z + fz * 16);
      }
    }

    this.camPos.lerp(desiredPos, Math.min(1, dt * 5.5));
    this.camTarget.lerp(desiredTarget, Math.min(1, dt * 7.5));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }
}
