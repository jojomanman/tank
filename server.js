const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

// Game State Management - 3D
let players = {};
let bullets = [];
let deformationCraters = []; // Array of {position: {x,y,z}, depth: number}
const PLANET_RADIUS = 5;
const TANK_HEIGHT = 0.5;
const BULLET_SPEED = 0.1;
const SHOOT_COOLDOWN = 500; // ms
const GRAVITY = 0.01; // Scaled for small planet
const MAX_CRATERS = 50;

// Function to generate random point on sphere surface
function randomSurfacePosition() {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const x = PLANET_RADIUS * Math.sin(phi) * Math.cos(theta);
  const y = PLANET_RADIUS * Math.sin(phi) * Math.sin(theta);
  const z = PLANET_RADIUS * Math.cos(phi);
  return { x, y, z };
}

// Normalize vector
function normalizeVec(vec) {
  const mag = Math.sqrt(vec.x**2 + vec.y**2 + vec.z**2);
  if (mag > 0) {
    vec.x /= mag;
    vec.y /= mag;
    vec.z /= mag;
  }
  return vec;
}

// Add vectors
function addVec(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

// Scale vector
function scaleVec(vec, s) {
  return { x: vec.x * s, y: vec.y * s, z: vec.z * s };
}

// Handle Connections
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Create new tank for player on surface
  const startPos = randomSurfacePosition();
  players[socket.id] = {
    position: { ...startPos },
    rotation: { yaw: 0 },
    health: 100,
    inputs: { rotate: 0, move: 0, shoot: false },
    lastShootTime: 0,
    velocity: { x: 0, y: 0, z: 0 }
  };
  
  // Handle Player Input - now 3D compatible
  socket.on('playerInput', (inputData) => {
    const player = players[socket.id];
    if (player) {
      player.inputs = inputData;
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
  });
});

// Update Player Positions - Spherical Movement
function updatePlayerPositions() {
  Object.keys(players).forEach(id => {
    const player = players[id];
    if (!player) return;

    // Rotation (yaw around local up)
    player.rotation.yaw += player.inputs.rotate * 0.05;

    // Get up vector (radial)
    const up = normalizeVec({ ...player.position });

    // Forward direction (perpendicular to up and global y or based on yaw)
    const forward = {
      x: Math.sin(player.rotation.yaw) * up.z - Math.cos(player.rotation.yaw) * up.x, // Simplified for equatorial
      y: 0,
      z: -Math.sin(player.rotation.yaw) * up.x - Math.cos(player.rotation.yaw) * up.z
    };
    normalizeVec(forward);

    // Apply movement tangential
    if (player.inputs.move !== 0) {
      const moveVec = scaleVec(forward, player.inputs.move * 0.02);
      player.velocity = addVec(player.velocity, moveVec);
    }

    // Apply gravity (towards center)
    const gravityDir = scaleVec(up, -GRAVITY);
    player.velocity = addVec(player.velocity, gravityDir);

    // Update position
    player.position = addVec(player.position, player.velocity);

    // Project back to surface (simple for now)
    const dist = Math.sqrt(player.position.x**2 + player.position.y**2 + player.position.z**2);
    const factor = (PLANET_RADIUS + TANK_HEIGHT) / dist;
    player.position.x *= factor;
    player.position.y *= factor;
    player.position.z *= factor;

    // Damp velocity
    player.velocity = scaleVec(player.velocity, 0.95);

    // Shooting in 3D direction
    if (player.inputs.shoot && Date.now() - player.lastShootTime > SHOOT_COOLDOWN) {
      const dir = {
        x: Math.sin(player.rotation.yaw) * Math.cos(0), // Pitch 0
        y: Math.sin(0), // Pitch
        z: Math.cos(player.rotation.yaw) * Math.cos(0)
      };
      normalizeVec(dir);
      bullets.push({
        position: { ...player.position },
        velocity: scaleVec(dir, BULLET_SPEED),
        ownerId: id
      });
      player.lastShootTime = Date.now();
    }
  });
}

// Update Bullet Positions - 3D Trajectory with Gravity
function updateBulletPositions() {
  bullets.forEach((bullet, index) => {
    // Apply velocity
    bullet.position = addVec(bullet.position, bullet.velocity);

    // Apply gravity towards center
    const up = normalizeVec({ ...bullet.position });
    const gravityDir = scaleVec(up, -GRAVITY * 2); // Stronger for bullets
    bullet.velocity = addVec(bullet.velocity, gravityDir);

    // Check for ground hit (deformation)
    const dist = Math.sqrt(bullet.position.x**2 + bullet.position.y**2 + bullet.position.z**2);
    if (dist <= PLANET_RADIUS + 0.1) { // Hit surface
      // Create crater at impact point
      const impactPos = scaleVec(up, PLANET_RADIUS);
      deformationCraters.push({
        position: impactPos,
        depth: 0.2 + Math.random() * 0.1
      });
      if (deformationCraters.length > MAX_CRATERS) {
        deformationCraters.shift(); // Remove oldest
      }
      bullets.splice(index, 1);
      return;
    }

    // Remove if too far
    if (dist > PLANET_RADIUS * 3) {
      bullets.splice(index, 1);
    }
  });
}

// Check Collisions - 3D
function checkCollisions() {
  bullets.forEach((bullet, bulletIndex) => {
    Object.keys(players).forEach(id => {
      const player = players[id];
      if (!player || id === bullet.ownerId) return;

      const dx = bullet.position.x - player.position.x;
      const dy = bullet.position.y - player.position.y;
      const dz = bullet.position.z - player.position.z;
      const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

      if (distance < 0.5) { // Collision radius
        player.health -= 20;
        bullets.splice(bulletIndex, 1);

        if (player.health <= 0) {
          delete players[id];
          io.emit('playerDied', id);
        }
      }
    });
  });
}

// Game Loop
setInterval(() => {
  updatePlayerPositions();
  updateBulletPositions();
  checkCollisions();

  // Broadcast 3D state to clients
  io.emit('gameState', { 
    players, 
    bullets, 
    deformationCraters 
  });
}, 1000 / 60);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});