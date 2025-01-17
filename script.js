import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 200;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Parameters
const proximityThreshold = 30; // Maximum distance for connecting planets
const minimumDistance = 5;     // Minimum distance for connecting planets
const boundary = { x: 250, y: 150, z: 150 }; // Visible frame boundary
const solarSystemCount = THREE.MathUtils.randInt(90, 100); // Randomize number of solar systems

const solarSystems = [];
const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });

// Create solar systems
for (let s = 0; s < solarSystemCount; s++) {
    const star = new THREE.Mesh(
        new THREE.SphereGeometry(5, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );

    const solarSystem = {
        star,
        planets: [],
        group: new THREE.Group(),
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5
        ),
        acceleration: new THREE.Vector3(),
        sensitivity: new THREE.Vector3(
            Math.random() * 0.2 + 0.1,
            Math.random() * 0.2 + 0.1,
            Math.random() * 0.2 + 0.1
        ),
        hoverOffset: new THREE.Vector3(0, 0, 0),
        hoverSpeed: new THREE.Vector3(
            Math.random() * 0.01 - 0.005,
            Math.random() * 0.01 - 0.005,
            Math.random() * 0.01 - 0.005
        ),
        radius: 50 + Math.random() * 20, // Radius of the solar system (includes planets)
    };

    solarSystem.group.add(star);
    scene.add(solarSystem.group);

    // Add planets with random count (3 to 8)
    const planetCount = THREE.MathUtils.randInt(3, 8);
    for (let p = 0; p < planetCount; p++) {
        const planet = new THREE.Mesh(
            new THREE.SphereGeometry(1, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );

        const radiusX = 10 + p * 5;
        const radiusY = 10 + p * 3;
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.01 + p * 0.005;

        planet.userData = { radiusX, radiusY, angle, speed, inclination: Math.random() * Math.PI / 8 };

        planet.position.set(
            Math.cos(angle) * radiusX,
            Math.sin(angle) * radiusY,
            0
        );

        solarSystem.planets.push(planet);
        solarSystem.group.add(planet);
    }

    // Position the solar system randomly
    solarSystem.group.position.set(
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200
    );

    solarSystems.push(solarSystem);
}

// Background flecks
const fleckGeometry = new THREE.BufferGeometry();
const fleckCount = 1000;
const fleckPositions = [];
for (let i = 0; i < fleckCount; i++) {
    fleckPositions.push((Math.random() - 0.5) * 500);
    fleckPositions.push((Math.random() - 0.5) * 500);
    fleckPositions.push((Math.random() - 0.5) * 500);
}
fleckGeometry.setAttribute('position', new THREE.Float32BufferAttribute(fleckPositions, 3));
const fleckMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 });
const flecks = new THREE.Points(fleckGeometry, fleckMaterial);
scene.add(flecks);

// Mouse interactivity
const mouse = new THREE.Vector2();
document.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    solarSystems.forEach((solarSystem) => {
        solarSystem.acceleration.add(new THREE.Vector3(
            mouse.x * solarSystem.sensitivity.x,
            mouse.y * solarSystem.sensitivity.y,
            (Math.random() - 0.5) * solarSystem.sensitivity.z
        ));
    });
});

// Helper function to check boundaries and bounce
function checkBoundaries(solarSystem) {
    const position = solarSystem.group.position;

    if (Math.abs(position.x) > boundary.x) {
        position.x = Math.sign(position.x) * boundary.x;
        solarSystem.velocity.x *= -1;
    }
    if (Math.abs(position.y) > boundary.y) {
        position.y = Math.sign(position.y) * boundary.y;
        solarSystem.velocity.y *= -1;
    }
    if (Math.abs(position.z) > boundary.z) {
        position.z = Math.sign(position.z) * boundary.z;
        solarSystem.velocity.z *= -1;
    }
}

// Function to handle collisions between solar systems
function handleCollisions() {
    for (let i = 0; i < solarSystems.length; i++) {
        const solarSystem1 = solarSystems[i];
        const pos1 = solarSystem1.group.position;

        for (let j = i + 1; j < solarSystems.length; j++) {
            const solarSystem2 = solarSystems[j];
            const pos2 = solarSystem2.group.position;

            const distance = pos1.distanceTo(pos2);
            const minDistance = solarSystem1.radius + solarSystem2.radius;

            if (distance < minDistance) {
                // Collision detected, calculate repulsion
                const repulsion = pos1.clone().sub(pos2).normalize().multiplyScalar(0.05);

                // Apply repulsion to velocities
                solarSystem1.velocity.add(repulsion);
                solarSystem2.velocity.sub(repulsion);
            }
        }
    }
}

// Proximity line optimization
let proximityLineGeometry = new THREE.BufferGeometry();
const proximityLinePositions = [];
let proximityLineSegments = new THREE.LineSegments(proximityLineGeometry, lineMaterial);

// Function to update proximity lines
function updateProximityLines() {
    proximityLinePositions.length = 0;

    for (let i = 0; i < solarSystems.length; i++) {
        const solarSystem1 = solarSystems[i];
        for (let planet1 of solarSystem1.planets) {
            const planet1WorldPosition = new THREE.Vector3();
            planet1.getWorldPosition(planet1WorldPosition);

            for (let j = i + 1; j < solarSystems.length; j++) {
                const solarSystem2 = solarSystems[j];
                for (let planet2 of solarSystem2.planets) {
                    const planet2WorldPosition = new THREE.Vector3();
                    planet2.getWorldPosition(planet2WorldPosition);

                    const distance = planet1WorldPosition.distanceTo(planet2WorldPosition);

                    // Only draw lines for distances within the allowed range
                    if (distance >= minimumDistance && distance < proximityThreshold) {
                        proximityLinePositions.push(
                            planet1WorldPosition.x, planet1WorldPosition.y, planet1WorldPosition.z,
                            planet2WorldPosition.x, planet2WorldPosition.y, planet2WorldPosition.z
                        );
                    }
                }
            }
        }
    }

    proximityLineGeometry.dispose(); // Dispose old geometry
    proximityLineGeometry = new THREE.BufferGeometry();
    proximityLineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(proximityLinePositions, 3));

    if (proximityLineSegments) scene.remove(proximityLineSegments);
    proximityLineSegments = new THREE.LineSegments(proximityLineGeometry, lineMaterial);
    scene.add(proximityLineSegments);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    handleCollisions(); // Handle solar system collisions

    solarSystems.forEach((solarSystem) => {
        solarSystem.velocity.add(solarSystem.acceleration);
        solarSystem.velocity.multiplyScalar(0.98); // Friction
        solarSystem.acceleration.set(0, 0, 0); // Reset acceleration

        solarSystem.group.position.add(solarSystem.velocity);
        checkBoundaries(solarSystem);

        solarSystem.hoverOffset.add(solarSystem.hoverSpeed);
        solarSystem.group.position.add(solarSystem.hoverOffset.clone().multiplyScalar(0.1));

        solarSystem.hoverSpeed.add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.0005,
            (Math.random() - 0.5) * 0.0005,
            (Math.random() - 0.5) * 0.0005
        ));
    });

    solarSystems.forEach((solarSystem) => {
        solarSystem.planets.forEach((planet) => {
            planet.userData.angle += planet.userData.speed;
            planet.position.set(
                Math.cos(planet.userData.angle) * planet.userData.radiusX,
                Math.sin(planet.userData.angle) * planet.userData.radiusY,
                Math.sin(planet.userData.inclination) * planet.userData.radiusX
            );
        });
    });

    updateProximityLines(); // Update on every frame
    renderer.render(scene, camera);
}

animate();

// Clean up resources on window unload
window.addEventListener('beforeunload', () => {
    renderer.dispose();
});