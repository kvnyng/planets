import * as THREE from 'three';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as posedetection from '@tensorflow-models/pose-detection';

let prevKeypoints = null;
let movementMetric = 0;

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

// Calculate movement metric from pose detection
function calculateMovementMetric(currentKeypoints) {
    if (!prevKeypoints) {
        prevKeypoints = currentKeypoints;
        return 0;
    }

    let totalMovement = 0;

    for (let i = 0; i < currentKeypoints.length; i++) {
        const prev = prevKeypoints[i];
        const curr = currentKeypoints[i];

        if (prev && curr && curr.score > 0.5 && prev.score > 0.5) {
            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            totalMovement += Math.sqrt(dx * dx + dy * dy);
        }
    }

    prevKeypoints = currentKeypoints;
    return totalMovement;
}

// Pose detection logic
async function detectPose(detector, video) {
    async function renderPoseFrame() {
        const poses = await detector.estimatePoses(video);

        if (poses.length > 0) {
            movementMetric = calculateMovementMetric(poses[0].keypoints);

            // Normalize and update solar system interactivity
            const normalizedMovement = Math.min(Math.max(movementMetric / 500, 0), 1); // Normalize to [0, 1]
            solarSystems.forEach((solarSystem) => {
                solarSystem.acceleration.add(new THREE.Vector3(
                    normalizedMovement * solarSystem.sensitivity.x,
                    normalizedMovement * solarSystem.sensitivity.y,
                    (Math.random() - 0.5) * solarSystem.sensitivity.z
                ));
            });
        }

        requestAnimationFrame(renderPoseFrame);
    }

    renderPoseFrame();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    solarSystems.forEach((solarSystem) => {
        solarSystem.velocity.add(solarSystem.acceleration);
        solarSystem.velocity.multiplyScalar(0.98); // Friction
        solarSystem.acceleration.set(0, 0, 0); // Reset acceleration

        solarSystem.group.position.add(solarSystem.velocity);
    });

    renderer.render(scene, camera);
}

// Initialize pose detection and start animation
async function main() {
    await tf.setBackend('webgl');
    await tf.ready();

    const video = document.createElement('video');
    video.style.display = 'none';
    document.body.appendChild(video);

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    await new Promise((resolve) => {
        video.onloadedmetadata = () => {
            video.play();
            resolve();
        };
    });

    const detector = await posedetection.createDetector(posedetection.SupportedModels.MoveNet);
    detectPose(detector, video);

    animate();
}

main();