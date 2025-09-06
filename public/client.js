// Socket connection
const socket = io();
let gameState = {};
let previousGameState = {};
const playerId = socket.id; // Approximate player ID for follow

// Local prediction state for own tank
let localPlayerState = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { yaw: 0 },
  velocity: { x: 0, y: 0, z: 0 }
};

// Input state
let inputState = { 
  rotate: 0, 
  move: 0, 
  shoot: false 
};

// Mobile detection
const isMobile = 'ontouchstart' in window;

// Input Handling
if (!isMobile) {
  // Desktop keyboard
  document.addEventListener('keydown', (e) => {
    switch(e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        inputState.rotate = -1;
        e.preventDefault();
        break;
      case 'ArrowRight':
      case 'KeyD':
        inputState.rotate = 1;
        e.preventDefault();
        break;
      case 'ArrowUp':
      case 'KeyW':
        inputState.move = 1;
        e.preventDefault();
        break;
      case 'ArrowDown':
      case 'KeyS':
        inputState.move = -1;
        e.preventDefault();
        break;
      case 'Space':
        inputState.shoot = true;
        e.preventDefault();
        break;
      default:
        return; // Ignore other keys
    }
    updateLocalPrediction();
  });

  document.addEventListener('keyup', (e) => {
    switch(e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        inputState.rotate = 0;
        break;
      case 'ArrowRight':
      case 'KeyD':
        inputState.rotate = 0;
        break;
      case 'ArrowUp':
      case 'KeyW':
        inputState.move = 0;
        break;
      case 'ArrowDown':
      case 'KeyS':
        inputState.move = 0;
        break;
      case 'Space':
        inputState.shoot = false;
        break;
      default:
        return; // Ignore other keys
    }
    updateLocalPrediction();
  });
} else {
  // Mobile joysticks (unchanged)
  const joystickContainerLeft = document.createElement('div');
  joystickContainerLeft.id = 'joystick-left';
  joystickContainerLeft.style.position = 'fixed';
  joystickContainerLeft.style.bottom = '20px';
  joystickContainerLeft.style.left = '20px';
  joystickContainerLeft.style.width = '150px';
  joystickContainerLeft.style.height = '150px';
  joystickContainerLeft.style.zIndex = '1000';
  document.body.appendChild(joystickContainerLeft);

  const joystickContainerRight = document.createElement('div');
  joystickContainerRight.id = 'joystick-right';
  joystickContainerRight.style.position = 'fixed';
  joystickContainerRight.style.bottom = '20px';
  joystickContainerRight.style.right = '20px';
  joystickContainerRight.style.width = '150px';
  joystickContainerRight.style.height = '150px';
  joystickContainerRight.style.zIndex = '1000';
  document.body.appendChild(joystickContainerRight);

  // Left joystick for rotation
  const managerLeft = nipplejs.create({
    zone: document.getElementById('joystick-left'),
    mode: 'static',
    position: { left: '50%', top: '50%' },
    color: 'blue'
  });
  managerLeft.on('move', (evt, data) => {
    inputState.rotate = data.vector.x || 0;
    updateLocalPrediction();
  });
  managerLeft.on('end', () => {
    inputState.rotate = 0;
    updateLocalPrediction();
  });

  // Right joystick for movement
  const managerRight = nipplejs.create({
    zone: document.getElementById('joystick-right'),
    mode: 'static',
    position: { left: '50%', top: '50%' },
    color: 'green'
  });
  managerRight.on('move', (evt, data) => {
    inputState.move = - (data.vector.y || 0);
    updateLocalPrediction();
  });
  managerRight.on('end', () => {
    inputState.move = 0;
    updateLocalPrediction();
  });

  // Shoot on touch
  document.addEventListener('touchstart', (e) => {
    if (!e.target.closest('#joystick-left') && !e.target.closest('#joystick-right')) {
      inputState.shoot = true;
      e.preventDefault();
      updateLocalPrediction();
    }
  }, { passive: false });

  document.addEventListener('touchend', () => {
    inputState.shoot = false;
    updateLocalPrediction();
  });
}

// Local prediction update (approximate server physics)
function updateLocalPrediction() {
  localPlayerState.rotation.yaw += inputState.rotate * 0.05;

  // Simplified forward (assume equatorial for demo)
  const forward = {
    x: Math.sin(localPlayerState.rotation.yaw),
    y: 0,
    z: Math.cos(localPlayerState.rotation.yaw)
  };

  if (inputState.move !== 0) {
    const moveVec = {
      x: forward.x * inputState.move * 0.02,
      y: forward.y * inputState.move * 0.02,
      z: forward.z * inputState.move * 0.02
    };
    localPlayerState.velocity.x += moveVec.x;
    localPlayerState.velocity.y += moveVec.y;
    localPlayerState.velocity.z += moveVec.z;
  }

  // Gravity (towards origin)
  const posNorm = Math.sqrt(localPlayerState.position.x**2 + localPlayerState.position.y**2 + localPlayerState.position.z**2);
  const upX = localPlayerState.position.x / posNorm;
  const upY = localPlayerState.position.y / posNorm;
  const upZ = localPlayerState.position.z / posNorm;
  localPlayerState.velocity.x += upX * -0.01;
  localPlayerState.velocity.y += upY * -0.01;
  localPlayerState.velocity.z += upZ * -0.01;

  // Update position
  localPlayerState.position.x += localPlayerState.velocity.x;
  localPlayerState.position.y += localPlayerState.velocity.y;
  localPlayerState.position.z += localPlayerState.velocity.z;

  // Project to surface
  const dist = Math.sqrt(localPlayerState.position.x**2 + localPlayerState.position.y**2 + localPlayerState.position.z**2);
  const factor = 5.5 / dist;
  localPlayerState.position.x *= factor;
  localPlayerState.position.y *= factor;
  localPlayerState.position.z *= factor;

  // Damp velocity
  localPlayerState.velocity.x *= 0.95;
  localPlayerState.velocity.y *= 0.95;
  localPlayerState.velocity.z *= 0.95;
}

// Send input to server periodically
setInterval(() => {
  socket.emit('playerInput', inputState);
}, 50);

// Three.js Setup
const canvas = document.getElementById('gameCanvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !isMobile });
renderer.setSize(canvas.width, canvas.height);
renderer.setClearColor(0x000011);

// Lights
const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Planet
const planetGeometry = new THREE.SphereGeometry(5, 32, 32);
const planetMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
const planet = new THREE.Mesh(planetGeometry, planetMaterial);
scene.add(planet);

// Track if craters have changed
let previousCraters = [];

// Groups for tanks and bullets
const tankGroups = {}; // id -> THREE.Group
const bulletMeshes = []; // array of meshes

// Particle system for explosions
let particles = [];
function createParticles(position, count = 20) {
  for (let i = 0; i < count; i++) {
    const particleGeometry = new THREE.SphereGeometry(0.05, 4, 4);
    const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true });
    const particle = new THREE.Mesh(particleGeometry, particleMaterial);
    particle.position.copy(position);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2
    );
    particle.userData = { velocity: vel, life: 1.0 };
    scene.add(particle);
    particles.push(particle);
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.position.add(p.userData.velocity);
    p.userData.velocity.y -= 0.001;
    p.userData.life -= 0.02;
    p.material.opacity = p.userData.life;
    if (p.userData.life <= 0) {
      scene.remove(p);
      particles.splice(i, 1);
    }
  }
}

// Apply deformations to planet
function applyDeformations(craters) {
  const positions = planet.geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    const vx = positions[i];
    const vy = positions[i + 1];
    const vz = positions[i + 2];
    let disp = 0;
    craters.forEach(crater => {
      const dx = vx - crater.position.x;
      const dy = vy - crater.position.y;
      const dz = vz - crater.position.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (dist < 0.5) {
        disp -= crater.depth * (1 - dist / 0.5);
      }
    });
    const radius = Math.sqrt(vx*vx + vy*vy + vz*vz);
    if (radius > 0) {
      // Clamp factor to prevent collapse
      const factor = Math.max(0.8, (5 + disp) / radius);
      positions[i] = vx * factor;
      positions[i + 1] = vy * factor;
      positions[i + 2] = vz * factor;
    }
  }
  planet.geometry.attributes.position.needsUpdate = true;
  planet.geometry.computeVertexNormals();
}

// Update rendering from gameState
function updateRendering() {
  // Clear old bullets
  bulletMeshes.forEach(mesh => scene.remove(mesh));
  bulletMeshes.length = 0;

  // Update tanks
  Object.keys(gameState.players || {}).forEach(id => {
    const player = gameState.players[id];
    let tankGroup = tankGroups[id];
    if (!tankGroup) {
      tankGroup = new THREE.Group();
      const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8);
      const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4a4 });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.rotation.x = Math.PI / 2;
      tankGroup.add(body);
      const turretGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8);
      const turretMaterial = new THREE.MeshLambertMaterial({ color: 0x2a2 });
      const turret = new THREE.Mesh(turretGeometry, turretMaterial);
      turret.position.y = 0.4;
      turret.rotation.x = Math.PI / 2;
      tankGroup.add(turret);
      scene.add(tankGroup);
      tankGroups[id] = tankGroup;
    }
    // Interpolate other players
    if (id !== playerId) {
      const prevPos = previousGameState.players && previousGameState.players[id] ? previousGameState.players[id].position : player.position;
      const lerp = 0.1;
      tankGroup.position.x += (player.position.x - tankGroup.position.x) * lerp;
      tankGroup.position.y += (player.position.y - tankGroup.position.y) * lerp;
      tankGroup.position.z += (player.position.z - tankGroup.position.z) * lerp;
      tankGroup.rotation.y += (player.rotation.yaw - tankGroup.rotation.y) * lerp;
    } else {
      // Own tank uses predicted state
      tankGroup.position.set(localPlayerState.position.x, localPlayerState.position.y, localPlayerState.position.z);
      tankGroup.rotation.y = localPlayerState.rotation.yaw;
    }
  });

  // Remove old tanks
  Object.keys(tankGroups).forEach(id => {
    if (!gameState.players[id]) {
      scene.remove(tankGroups[id]);
      delete tankGroups[id];
    }
  });

  // Create bullets
  (gameState.bullets || []).forEach(bullet => {
    const bulletGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0 });
    const bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bulletMesh.position.set(bullet.position.x, bullet.position.y, bullet.position.z);
    scene.add(bulletMesh);
    bulletMeshes.push(bulletMesh);
  });

  // Apply deformations only if craters changed
  const currentCraters = gameState.deformationCraters || [];
  if (JSON.stringify(currentCraters) !== JSON.stringify(previousCraters)) {
    applyDeformations(currentCraters);
    previousCraters = JSON.parse(JSON.stringify(currentCraters)); // Deep copy
  }

  // Particles for craters
  if (gameState.deformationCraters) {
    gameState.deformationCraters.slice(-5).forEach(crater => {
      createParticles(new THREE.Vector3(crater.position.x, crater.position.y, crater.position.z));
    });
  }

  // Reconcile own player with server
  if (gameState.players && gameState.players[playerId]) {
    const serverPos = gameState.players[playerId].position;
    const diff = 0.05;
    localPlayerState.position.x += (serverPos.x - localPlayerState.position.x) * diff;
    localPlayerState.position.y += (serverPos.y - localPlayerState.position.y) * diff;
    localPlayerState.position.z += (serverPos.z - localPlayerState.position.z) * diff;
    localPlayerState.rotation.yaw += (gameState.players[playerId].rotation.yaw - localPlayerState.rotation.yaw) * diff;
  }

  // Camera follow predicted own position
  if (localPlayerState.position) {
    const playerPos = new THREE.Vector3(localPlayerState.position.x, localPlayerState.position.y, localPlayerState.position.z);
    const idealCameraPos = playerPos.clone().add(new THREE.Vector3(0, 5, 10));
    camera.position.lerp(idealCameraPos, 0.05);
    camera.lookAt(playerPos);
  }

  previousGameState = JSON.parse(JSON.stringify(gameState)); // Deep copy for interpolation
}

// Initial camera
camera.position.set(0, 0, 15);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  updateParticles();
  updateRendering();
  renderer.render(scene, camera);
}
animate();

socket.on('gameState', (data) => {
  gameState = data;
});