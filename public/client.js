// Socket connection
const socket = io();
let gameState = {};
let previousGameState = {};
let playerId = null;

socket.on('connect', () => {
    playerId = socket.id;
});

// Player object for orientation and movement
const playerObject = new THREE.Object3D();
playerObject.position.set(0, 5.5, 0); // Initial position on top of the planet
playerObject.up.set(0, 1, 0);

// Local prediction state for own tank
let localPlayerState = {
  position: playerObject.position,
  rotation: playerObject.quaternion,
  velocity: new THREE.Vector3()
};

// Input state
let inputState = { 
  rotate: 0, 
  move: 0, 
  shoot: false 
};

let cameraOrbit = {
    phi: Math.PI / 2,
    theta: 0,
    radius: 12
};
let mouse = {
    x: 0,
    y: 0,
    isDown: false
};

// Mobile detection
const isMobile = 'ontouchstart' in window;

// Input Handling
if (!isMobile) {
  // Desktop keyboard
  canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left mouse button
          mouse.isDown = true;
      }
  });

  canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
          mouse.isDown = false;
      }
  });

  canvas.addEventListener('mousemove', (e) => {
      if (mouse.isDown) {
          const dx = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
          const dy = e.movementY || e.mozMovementY || e.webkitMovementY || 0;

          cameraOrbit.theta -= dx * 0.01;
          cameraOrbit.phi -= dy * 0.01;
          cameraOrbit.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraOrbit.phi)); // Clamp phi
      }
  });

  canvas.addEventListener('wheel', (e) => {
      cameraOrbit.radius += e.deltaY * 0.01;
      cameraOrbit.radius = Math.max(5, Math.min(25, cameraOrbit.radius)); // Clamp radius
  });

  document.addEventListener('keydown', (e) => {
    switch(e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        inputState.rotate = -1;
        break;
      case 'ArrowRight':
      case 'KeyD':
        inputState.rotate = 1;
        break;
      case 'ArrowUp':
      case 'KeyW':
        inputState.move = 1;
        break;
      case 'ArrowDown':
      case 'KeyS':
        inputState.move = -1;
        break;
      case 'Space':
        inputState.shoot = true;
        break;
      default:
        return;
    }
    e.preventDefault();
  });

  document.addEventListener('keyup', (e) => {
    switch(e.code) {
      case 'ArrowLeft':
      case 'KeyA':
      case 'ArrowRight':
      case 'KeyD':
        inputState.rotate = 0;
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'ArrowDown':
      case 'KeyS':
        inputState.move = 0;
        break;
      case 'Space':
        inputState.shoot = false;
        break;
      default:
        return;
    }
    e.preventDefault();
  });
} else {
  // Mobile joysticks
  const joystickContainerMove = document.createElement('div');
  joystickContainerMove.id = 'joystick-move';
  joystickContainerMove.style.position = 'fixed';
  joystickContainerMove.style.bottom = '50px';
  joystickContainerMove.style.left = '50px';
  joystickContainerMove.style.width = '150px';
  joystickContainerMove.style.height = '150px';
  joystickContainerMove.style.zIndex = '1000';
  document.body.appendChild(joystickContainerMove);

  const joystickContainerRotate = document.createElement('div');
  joystickContainerRotate.id = 'joystick-rotate';
  joystickContainerRotate.style.position = 'fixed';
  joystickContainerRotate.style.bottom = '150px';
  joystickContainerRotate.style.right = '50px';
  joystickContainerRotate.style.width = '120px';
  joystickContainerRotate.style.height = '120px';
  joystickContainerRotate.style.zIndex = '1000';
  document.body.appendChild(joystickContainerRotate);

  const joystickContainerCamera = document.createElement('div');
  joystickContainerCamera.id = 'joystick-camera';
  joystickContainerCamera.style.position = 'fixed';
  joystickContainerCamera.style.bottom = '50px';
  joystickContainerCamera.style.right = '180px';
  joystickContainerCamera.style.width = '120px';
  joystickContainerCamera.style.height = '120px';
  joystickContainerCamera.style.zIndex = '1000';
  document.body.appendChild(joystickContainerCamera);

  // Movement joystick (left)
  const managerMove = nipplejs.create({
    zone: document.getElementById('joystick-move'),
    mode: 'static',
    position: { left: '50%', top: '50%' },
    color: 'green'
  });
  managerMove.on('move', (evt, data) => {
    inputState.move = -(data.vector.y || 0);
  });
  managerMove.on('end', () => {
    inputState.move = 0;
  });

  // Rotation joystick (right)
  const managerRotate = nipplejs.create({
    zone: document.getElementById('joystick-rotate'),
    mode: 'static',
    position: { left: '50%', top: '50%' },
    color: 'blue'
  });
  managerRotate.on('move', (evt, data) => {
    inputState.rotate = data.vector.x || 0;
  });
  managerRotate.on('end', () => {
    inputState.rotate = 0;
  });

  // Camera joystick (right)
  const managerCamera = nipplejs.create({
      zone: document.getElementById('joystick-camera'),
      mode: 'static',
      position: { left: '50%', top: '50%' },
      color: 'red'
  });
  managerCamera.on('move', (evt, data) => {
      cameraOrbit.theta -= data.vector.x * 0.05;
      cameraOrbit.phi -= data.vector.y * 0.05;
      cameraOrbit.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraOrbit.phi));
  });


  const shootButton = document.createElement('div');
  shootButton.id = 'shoot-button';
  shootButton.style.position = 'fixed';
  shootButton.style.bottom = '50px';
  shootButton.style.right = '50px';
  shootButton.style.width = '80px';
  shootButton.style.height = '80px';
  shootButton.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
  shootButton.style.borderRadius = '50%';
  shootButton.style.zIndex = '1000';
  document.body.appendChild(shootButton);

  shootButton.addEventListener('touchstart', (e) => {
    inputState.shoot = true;
    e.preventDefault();
  });

  shootButton.addEventListener('touchend', (e) => {
    inputState.shoot = false;
    e.preventDefault();
  });
}

// Local prediction update with proper spherical physics
function updateLocalPrediction() {
    const ROTATION_SPEED = 0.05;
    const ACCELERATION = 0.005;
    const GRAVITY = -0.01;
    const DAMPING = 0.95;
    const PLANET_RADIUS = 5.5;

    // Handle rotation around the local 'up' axis
    if (inputState.rotate !== 0) {
        const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(playerObject.up, -inputState.rotate * ROTATION_SPEED);
        playerObject.quaternion.multiplyQuaternions(rotationQuaternion, playerObject.quaternion);
    }

    // Handle forward/backward movement
    if (inputState.move !== 0) {
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(playerObject.quaternion);
        localPlayerState.velocity.add(forward.multiplyScalar(inputState.move * ACCELERATION));
    }

    // Apply gravity towards the planet's center
    const gravityDirection = playerObject.position.clone().normalize().multiplyScalar(GRAVITY);
    localPlayerState.velocity.add(gravityDirection);

    // Update position based on velocity
    playerObject.position.add(localPlayerState.velocity);

    // Project player back onto the planet's surface
    playerObject.position.normalize().multiplyScalar(PLANET_RADIUS);

    // Update the 'up' vector based on the new position
    const newUp = playerObject.position.clone().normalize();
    playerObject.up.copy(newUp);

    // Re-orient the player object to align with the surface normal
    // We get the forward vector and then use it to point the object correctly
    const forwardVector = new THREE.Vector3(0, 0, 1).applyQuaternion(playerObject.quaternion);
    const lookAtTarget = playerObject.position.clone().add(forwardVector);
    playerObject.lookAt(lookAtTarget, newUp);


    // Dampen velocity to simulate friction
    localPlayerState.velocity.multiplyScalar(DAMPING);

    // Update local state from the player object
    localPlayerState.position.copy(playerObject.position);
    localPlayerState.rotation.copy(playerObject.quaternion);
}

// Send input to server periodically
setInterval(() => {
  if (!playerId) return;
  // We still send yaw to the server as it expects it.
  // This is a temporary measure until the server is updated.
  const euler = new THREE.Euler().setFromQuaternion(localPlayerState.rotation, 'YXZ');
  const yaw = euler.y;
  socket.emit('playerInput', { ...inputState, yaw });
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
  const originalPositions = planet.geometry.attributes.position.clone().array;

  for (let i = 0; i < positions.length; i += 3) {
      const originalVec = new THREE.Vector3(originalPositions[i], originalPositions[i+1], originalPositions[i+2]);
      let displacement = 0;

      craters.forEach(crater => {
          const craterPos = new THREE.Vector3(crater.position.x, crater.position.y, crater.position.z);
          const dist = originalVec.distanceTo(craterPos);
          const radius = 0.5;
          if (dist < radius) {
              displacement -= crater.depth * (1 - dist / radius);
          }
      });

      const newVec = originalVec.clone().normalize().multiplyScalar(5 + displacement);
      positions[i] = newVec.x;
      positions[i+1] = newVec.y;
      positions[i+2] = newVec.z;
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

    if (id !== playerId) {
      // Interpolate other players
      const prevPlayerState = previousGameState.players && previousGameState.players[id]
          ? previousGameState.players[id]
          : player;

      const pos = new THREE.Vector3(prevPlayerState.position.x, prevPlayerState.position.y, prevPlayerState.position.z);
      const targetPos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
      pos.lerp(targetPos, 0.1);
      tankGroup.position.copy(pos);

      // Interpolate rotation (yaw)
      const euler = new THREE.Euler(0, prevPlayerState.rotation.yaw, 0, 'YXZ');
      const quat = new THREE.Quaternion().setFromEuler(euler);
      const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, player.rotation.yaw, 0, 'YXZ'));
      quat.slerp(targetQuat, 0.1);
      tankGroup.quaternion.copy(quat);

    } else {
      // Own tank uses predicted state
      tankGroup.position.copy(localPlayerState.position);
      tankGroup.quaternion.copy(localPlayerState.rotation);
    }
  });

  // Remove old tanks
  Object.keys(tankGroups).forEach(id => {
    if (!gameState.players || !gameState.players[id]) {
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

  // Reconcile own player with server state
  if (playerId && gameState.players && gameState.players[playerId]) {
      const serverState = gameState.players[playerId];
      const serverPos = new THREE.Vector3(serverState.position.x, serverState.position.y, serverState.position.z);

      // We receive yaw, so we create a quaternion from it.
      const serverEuler = new THREE.Euler(0, serverState.rotation.yaw, 0, 'YXZ');
      const serverQuat = new THREE.Quaternion().setFromEuler(serverEuler);

      const diff = 0.1; // Reconciliation strength

      localPlayerState.position.lerp(serverPos, diff);
      localPlayerState.rotation.slerp(serverQuat, diff);

      playerObject.position.copy(localPlayerState.position);
      playerObject.quaternion.copy(localPlayerState.rotation);
  }

  // Camera follow and orbit
  if (localPlayerState.position) {
    const playerPos = localPlayerState.position;

    const offset = new THREE.Vector3();
    offset.x = cameraOrbit.radius * Math.sin(cameraOrbit.phi) * Math.sin(cameraOrbit.theta);
    offset.y = cameraOrbit.radius * Math.cos(cameraOrbit.phi);
    offset.z = cameraOrbit.radius * Math.sin(cameraOrbit.phi) * Math.cos(cameraOrbit.theta);

    const idealCameraPos = playerPos.clone().add(offset);
    camera.position.lerp(idealCameraPos, 0.1);
    camera.lookAt(playerPos);
  }

  previousGameState = JSON.parse(JSON.stringify(gameState)); // Deep copy for interpolation
}

// Initial camera
camera.position.set(0, 10, -20);
camera.lookAt(scene.position);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  updateLocalPrediction();
  updateParticles();
  updateRendering();
  renderer.render(scene, camera);
}
animate();

socket.on('gameState', (data) => {
  gameState = data;
});
  if (posNorm > 0) {
    const upX = localPlayerState.position.x / posNorm;
    const upY = localPlayerState.position.y / posNorm;
    const upZ = localPlayerState.position.z / posNorm;
    localPlayerState.velocity.x += upX * -0.01;
    localPlayerState.velocity.y += upY * -0.01;
    localPlayerState.velocity.z += upZ * -0.01;
  }

  // Update position
  localPlayerState.position.x += localPlayerState.velocity.x;
  localPlayerState.position.y += localPlayerState.velocity.y;
  localPlayerState.position.z += localPlayerState.velocity.z;

  // Project to surface
  const dist = Math.sqrt(localPlayerState.position.x**2 + localPlayerState.position.y**2 + localPlayerState.position.z**2);
  if (dist > 0) {
    const factor = 5.5 / dist;
    localPlayerState.position.x *= factor;
    localPlayerState.position.y *= factor;
    localPlayerState.position.z *= factor;
  }

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