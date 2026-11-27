// Unified Keyboard + Gamepad + Touch Virtual Joystick Input Manager
// Supports both Single Player (WASD or Arrows) and Local 2-Player Split Controls

export interface PlayerInput {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  pass: boolean;
  through: boolean;
  shoot: boolean;
  cross: boolean;
  tackle: boolean;
  skill: boolean;
  switchPlayer: boolean;
  power: number;
}

export class InputManager {
  private keys = new Set<string>();
  private oneShotP1 = new Set<string>();
  private oneShotP2 = new Set<string>();
  private shootChargeP1 = 0;
  private shootChargeP2 = 0;
  public localTwoPlayer = false;

  // Touch virtual joystick & buttons
  public touchMoveX = 0;
  public touchMoveZ = 0;
  public touchSprint = false;
  private touchActions = new Set<string>();

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  public destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (!this.keys.has(code)) {
      this.oneShotP1.add(code);
      this.oneShotP2.add(code);
    }
    this.keys.add(code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  public triggerTouchAction(action: string) {
    this.touchActions.add(action);
  }

  public getInput(slot: 'p1' | 'p2', dt: number): PlayerInput {
    if (slot === 'p2') return this.getP2Input(dt);
    return this.getP1Input(dt);
  }

  private getP1Input(dt: number): PlayerInput {
    let moveX = 0;
    let moveZ = 0;

    if (this.keys.has('KeyW') || (!this.localTwoPlayer && this.keys.has('ArrowUp'))) moveZ -= 1;
    if (this.keys.has('KeyS') || (!this.localTwoPlayer && this.keys.has('ArrowDown'))) moveZ += 1;
    if (this.keys.has('KeyA') || (!this.localTwoPlayer && this.keys.has('ArrowLeft'))) moveX -= 1;
    if (this.keys.has('KeyD') || (!this.localTwoPlayer && this.keys.has('ArrowRight'))) moveX += 1;

    // Touch joystick merge
    if (Math.abs(this.touchMoveX) > 0.05 || Math.abs(this.touchMoveZ) > 0.05) {
      moveX = this.touchMoveX;
      moveZ = this.touchMoveZ;
    }

    // Gamepad 0
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (gp) {
      if (Math.abs(gp.axes[0]) > 0.18) moveX = gp.axes[0];
      if (Math.abs(gp.axes[1]) > 0.18) moveZ = gp.axes[1];
    }

    const sprint =
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.touchSprint ||
      Boolean(gp && (gp.buttons[7]?.pressed || gp.buttons[5]?.pressed));

    const shootHeld = this.keys.has('Space') || this.keys.has('KeyJ') || Boolean(gp && gp.buttons[2]?.pressed);
    if (shootHeld) {
      this.shootChargeP1 = Math.min(1, this.shootChargeP1 + dt * 1.4);
    }

    const shoot =
      this.oneShotP1.has('Space') ||
      this.oneShotP1.has('KeyJ') ||
      this.touchActions.has('shoot') ||
      Boolean(gp && gp.buttons[2]?.pressed);

    const pass =
      this.oneShotP1.has('KeyK') ||
      this.oneShotP1.has('KeyX') ||
      this.touchActions.has('pass') ||
      Boolean(gp && gp.buttons[0]?.pressed);

    const through =
      this.oneShotP1.has('KeyI') ||
      this.oneShotP1.has('KeyZ') ||
      this.touchActions.has('through') ||
      Boolean(gp && gp.buttons[3]?.pressed);

    const cross =
      this.oneShotP1.has('KeyL') ||
      this.oneShotP1.has('KeyC') ||
      this.touchActions.has('cross') ||
      Boolean(gp && gp.buttons[1]?.pressed);

    const tackle =
      this.oneShotP1.has('KeyU') ||
      this.oneShotP1.has('KeyF') ||
      this.touchActions.has('tackle') ||
      Boolean(gp && gp.buttons[2]?.pressed);

    const skill =
      this.oneShotP1.has('KeyE') ||
      this.touchActions.has('skill') ||
      Boolean(gp && gp.buttons[6]?.pressed);

    const switchPlayer =
      this.oneShotP1.has('KeyQ') ||
      this.oneShotP1.has('Tab') ||
      this.touchActions.has('switch') ||
      Boolean(gp && gp.buttons[4]?.pressed);

    const power = Math.max(0.55, this.shootChargeP1 || 0.72);
    if (!shootHeld) this.shootChargeP1 = 0;

    this.oneShotP1.clear();
    this.touchActions.clear();

    return { moveX, moveZ, sprint, pass, through, shoot, cross, tackle, skill, switchPlayer, power };
  }

  private getP2Input(dt: number): PlayerInput {
    let moveX = 0;
    let moveZ = 0;
    if (this.keys.has('ArrowUp')) moveZ -= 1;
    if (this.keys.has('ArrowDown')) moveZ += 1;
    if (this.keys.has('ArrowLeft')) moveX -= 1;
    if (this.keys.has('ArrowRight')) moveX += 1;

    const gp = navigator.getGamepads ? navigator.getGamepads()[1] : null;
    if (gp) {
      if (Math.abs(gp.axes[0]) > 0.18) moveX = gp.axes[0];
      if (Math.abs(gp.axes[1]) > 0.18) moveZ = gp.axes[1];
    }

    const sprint = this.keys.has('Numpad0') || this.keys.has('ControlRight') || Boolean(gp && gp.buttons[7]?.pressed);
    const shoot = this.oneShotP2.has('Enter') || this.oneShotP2.has('Numpad1');
    const pass = this.oneShotP2.has('Numpad2') || this.oneShotP2.has('Slash');
    const through = this.oneShotP2.has('Numpad3') || this.oneShotP2.has('Period');
    const cross = this.oneShotP2.has('Numpad4');
    const tackle = this.oneShotP2.has('Numpad5') || this.oneShotP2.has('Comma');
    const skill = this.oneShotP2.has('Numpad6');
    const switchPlayer = this.oneShotP2.has('Backslash') || this.oneShotP2.has('NumpadPlus');

    if (shoot) this.shootChargeP2 = Math.min(1, this.shootChargeP2 + dt * 1.4);
    const power = Math.max(0.55, this.shootChargeP2 || 0.72);
    if (!shoot) this.shootChargeP2 = 0;

    this.oneShotP2.clear();

    return { moveX, moveZ, sprint, pass, through, shoot, cross, tackle, skill, switchPlayer, power };
  }
}
