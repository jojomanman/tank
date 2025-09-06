const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

// Game State Management
let players = {};
let bullets = [];
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const TANK_SPEED = 2;
const BULLET_SPEED = 5;
const SHOOT_COOLDOWN = 500; // ms

// Handle Connections
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Create new tank for player
  players[socket.id] = {
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT,
    angle: 0,
    health: 100,
    inputs: { left: false, right: false, forward: false, shoot: false },
    lastShootTime: 0
  };
  
  // Handle Player Input
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

// Update Player Positions and Shooting
function updatePlayerPositions() {
  Object.keys(players).forEach(id => {
    const player = players[id];
    if (!player) return;

    // Rotation
    if (player.inputs.left) {
      player.angle -= 0.05;
    }
    if (player.inputs.right) {
      player.angle += 0.05;
    }

    // Movement
    if (player.inputs.forward) {
      player.x += Math.cos(player.angle) * TANK_SPEED;
      player.y += Math.sin(player.angle) * TANK_SPEED;
    }

    // Backward movement (add if needed)
    // if (player.inputs.backward) {
    //   player.x -= Math.cos(player.angle) * TANK_SPEED;
    //   player.y -= Math.sin(player.angle) * TANK_SPEED;
    // }

    // Keep in bounds
    player.x = Math.max(0, Math.min(GAME_WIDTH, player.x));
    player.y = Math.max(0, Math.min(GAME_HEIGHT, player.y));

    // Shooting
    if (player.inputs.shoot && Date.now() - player.lastShootTime > SHOOT_COOLDOWN) {
      bullets.push({
        x: player.x,
        y: player.y,
        angle: player.angle,
        ownerId: id,
        speed: BULLET_SPEED
      });
      player.lastShootTime = Date.now();
    }
  });
}

// Update Bullet Positions
function updateBulletPositions() {
  bullets.forEach((bullet, index) => {
    bullet.x += Math.cos(bullet.angle) * bullet.speed;
    bullet.y += Math.sin(bullet.angle) * bullet.speed;

    // Remove off-screen bullets
    if (bullet.x < 0 || bullet.x > GAME_WIDTH || bullet.y < 0 || bullet.y > GAME_HEIGHT) {
      bullets.splice(index, 1);
    }
  });
}

// Check Collisions
function checkCollisions() {
  bullets.forEach((bullet, bulletIndex) => {
    Object.keys(players).forEach(id => {
      const player = players[id];
      if (!player || id === bullet.ownerId) return;

      // Simple distance check for collision
      const dx = bullet.x - player.x;
      const dy = bullet.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 20) { // Collision radius
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

  // Broadcast the new state to all clients
  io.emit('gameState', { players, bullets });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});