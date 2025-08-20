const WIDTH = 960;
const HEIGHT = 540;

const config = {
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: 'game',
  backgroundColor: '#1a1a1a',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 1800 }, // gravedad alta: saltos cortos y precisos
      debug: false
    }
  },
  scene: { preload, create, update }
};

new Phaser.Game(config);

// ---- Parámetros de control estilo POP ----
const MOVE_SPEED = 240;
const AIR_MOVE_SPEED = 180;
const ACCEL = 1800;
const DRAG = 1900;
const JUMP_VELOCITY = -620;
const MIN_JUMP_HOLD_MS = 40;   // pulsación mínima
const MAX_JUMP_HOLD_MS = 160;  // salto de altura variable
const COYOTE_MS = 90;          // saltar “un poquito” después de dejar el borde
const JUMP_BUFFER_MS = 110;    // si pulsas salto un poco antes de tocar suelo

let cursors, keys;

let player, ground, ledges;
let lastOnGroundTime = 0;
let jumpPressedAt = -Infinity;
let jumpStartedAt = null;
let canVariableJump = false;
let facing = 1; // 1 derecha, -1 izquierda

function preload() {
  // Usamos un sprite simple (un rectángulo) vía Graphics -> Texture
  this.textures.generate('playerBox', {
    data: [
      '11111111',
      '12222221',
      '12222221',
      '12222221',
      '12222221',
      '12222221',
      '12222221',
      '11111111'
    ],
    pixelWidth: 6,
    palette: {
      1: '#0f0',
      2: '#0a0'
    }
  });
}

function create() {
  // Controles
  cursors = this.input.keyboard.createCursorKeys();
  keys = this.input.keyboard.addKeys({
    left: Phaser.Input.Keyboard.KeyCodes.A,
    right: Phaser.Input.Keyboard.KeyCodes.D,
    up: Phaser.Input.Keyboard.KeyCodes.W,
    jump: Phaser.Input.Keyboard.KeyCodes.SPACE
  });

  // Suelo y plataformas
  ground = this.physics.add.staticGroup();
  ground.create(WIDTH/2, HEIGHT - 20, null).setDisplaySize(WIDTH, 40).refreshBody();

  ledges = this.physics.add.staticGroup();
  // Algunas plataformas “de habitación”
  addPlatform(ledges, 260, 420, 260, 20);
  addPlatform(ledges, 520, 360, 220, 20);
  addPlatform(ledges, 760, 300, 180, 20);
  addPlatform(ledges, 840, 220, 200, 20);
  addPlatform(ledges, 140, 300, 160, 20);
  addPlatform(ledges, 340, 250, 160, 20);

  // Jugador
  player = this.physics.add.sprite(100, HEIGHT - 80, 'playerBox');
  player.setCollideWorldBounds(true);
  player.setSize(40, 40);       // caja de colisión
  player.setOffset(4, 4);
  player.body.setMaxVelocityX(280);
  player.body.setDragX(DRAG);

  // Colisiones
  this.physics.add.collider(player, ground);
  this.physics.add.collider(player, ledges);

  // Cámara
  this.cameras.main.startFollow(player, true, 0.08, 0.08);
  this.cameras.main.setZoom(1.2);

  // Input listeners para salto bufferizado
  this.input.keyboard.on('keydown-SPACE', () => {
    jumpPressedAt = this.time.now;
  });
}

function addPlatform(group, x, y, w, h) {
  const p = group.create(x, y, null);
  p.setDisplaySize(w, h).refreshBody();
}

function update(time, delta) {
  const onGround = player.body.blocked.down || player.body.touching.down;

  if (onGround) lastOnGroundTime = time;

  // ---- Movimiento horizontal con aceleración/drag (control preciso) ----
  const left = cursors.left.isDown || keys.left.isDown;
  const right = cursors.right.isDown || keys.right.isDown;

  let targetSpeed = 0;
  if (left) targetSpeed = - (onGround ? MOVE_SPEED : AIR_MOVE_SPEED);
  if (right) targetSpeed = + (onGround ? MOVE_SPEED : AIR_MOVE_SPEED);
  facing = (targetSpeed !== 0) ? Math.sign(targetSpeed) : facing;

  // Aceleración hacia targetSpeed
  const vx = player.body.velocity.x;
  const ax = Phaser.Math.Clamp(targetSpeed - vx, -ACCEL, ACCEL);
  player.body.setVelocityX(vx + ax * (delta / 1000));

  // ---- Salto con coyote & jump buffer ----
  const wantsJump = (time - jumpPressedAt) <= JUMP_BUFFER_MS;
  const canCoyote = (time - lastOnGroundTime) <= COYOTE_MS;

  // Iniciar salto
  if ((onGround || canCoyote) && wantsJump) {
    player.setVelocityY(JUMP_VELOCITY);
    jumpStartedAt = time;
    canVariableJump = true;
    jumpPressedAt = -Infinity; // consumir buffer
  }

  // Altura variable: si suelta pronto, corta el salto
  const holdingJump = cursors.up.isDown || keys.up.isDown || keys.jump.isDown;
  if (canVariableJump && jumpStartedAt !== null) {
    const heldMs = time - jumpStartedAt;
    if (!holdingJump && heldMs >= MIN_JUMP_HOLD_MS) {
      if (player.body.velocity.y < -100) {
        player.setVelocityY(-100); // recorta el salto
      }
      canVariableJump = false;
    }
    if (heldMs > MAX_JUMP_HOLD_MS) {
      canVariableJump = false;
    }
  }
  if (onGround) {
    jumpStartedAt = null;
    canVariableJump = false;
  }

  // ---- (WIP) Agarre de borde / Ledge hang ----
  // Idea: detectar cuando el jugador está cayendo junto a un borde:
  // 1) Raycast corto hacia delante y hacia abajo.
  // 2) Si hay pared delante y aire abajo, “enganchar”:
  //    - congelar velocidad,
  //    - alinear a una pose de "hang",
  //    - esperar input de arriba para "climb" (subir) o abajo para soltarse.
  //
  // Aquí dejamos el hook para implementarlo en la siguiente iteración.

  // Opcional: forzar flip visual según la dirección de movimiento
  player.setFlipX(facing < 0);
}
