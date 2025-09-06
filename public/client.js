const socket = io();
let gameState = {};

socket.on('gameState', (data) => {
  gameState = data;
});

// Input Handling
const keyboardState = { 
  left: false, 
  right: false, 
  forward: false, 
  shoot: false 
};

document.addEventListener('keydown', (e) => {
  switch(e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      keyboardState.left = true;
      e.preventDefault();
      break;
    case 'ArrowRight':
    case 'KeyD':
      keyboardState.right = true;
      e.preventDefault();
      break;
    case 'ArrowUp':
    case 'KeyW':
      keyboardState.forward = true;
      e.preventDefault();
      break;
    case 'Space':
      keyboardState.shoot = true;
      e.preventDefault();
      break;
  }
});

document.addEventListener('keyup', (e) => {
  switch(e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      keyboardState.left = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      keyboardState.right = false;
      break;
    case 'ArrowUp':
    case 'KeyW':
      keyboardState.forward = false;
      break;
    case 'Space':
      keyboardState.shoot = false;
      break;
  }
});

// Send input to server periodically
setInterval(() => {
  socket.emit('playerInput', keyboardState);
}, 50);

// Rendering
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function draw() {
  // Clear canvas
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw players (tanks)
  Object.values(gameState.players || {}).forEach(player => {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    // Tank body
    ctx.fillStyle = '#4a4';
    ctx.fillRect(-10, -5, 20, 10);
    // Turret
    ctx.fillStyle = '#2a2';
    ctx.fillRect(-2, -15, 4, 10);
    ctx.restore();

    // Health bar
    ctx.fillStyle = '#f00';
    ctx.fillRect(player.x - 15, player.y - 25, 30, 3);
    ctx.fillStyle = '#0f0';
    ctx.fillRect(player.x - 15, player.y - 25, (player.health / 100) * 30, 3);
  });

  // Draw bullets
  (gameState.bullets || []).forEach(bullet => {
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 3, 0, 2 * Math.PI);
    ctx.fill();
  });

  requestAnimationFrame(draw);
}

draw();