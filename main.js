import * as THREE from 'three';

// Game version
const GAME_VERSION = '1.0.4'; // Incremented for mobile fix
console.log(`Flappy Bird - Sunset Edition v${GAME_VERSION}`);

// Add CSS styles for game text
const style = document.createElement('style');
style.textContent = `
    #score, #gameOver, #version {
        position: fixed;
        color: #E8E8E8;
        font-family: Arial, sans-serif;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.6);
        text-align: center;
        z-index: 1000;
    }
    #score {
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 24px;
        font-weight: bold;
    }
    #gameOver {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 32px;
        font-weight: bold;
        display: none;
        white-space: pre-line;
        background-color: rgba(0, 0, 0, 0.6);
        padding: 20px;
        border-radius: 10px;
    }
    #version {
        bottom: env(safe-area-inset-bottom, 10px);
        right: env(safe-area-inset-right, 10px);
        font-size: 12px;
        opacity: 0.7;
    }
`;
document.head.appendChild(style);

// Create UI elements
const scoreElement = document.createElement('div');
scoreElement.id = 'score';
document.body.appendChild(scoreElement);

const gameOverElement = document.createElement('div');
gameOverElement.id = 'gameOver';
document.body.appendChild(gameOverElement);

const versionElement = document.createElement('div');
versionElement.id = 'version';
versionElement.textContent = `v${GAME_VERSION}`;
document.body.appendChild(versionElement);

console.log('Script started');

// Add device detection before any other game logic
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
console.log(`Running on ${isMobile ? 'mobile' : 'desktop'} device`);

// Game appearance constants
const GAME_APPEARANCE = {
    BIRD_SIZE: isMobile ? 1.2 : 1,  // Immediately set correct bird size based on device
    COLORS: {
        SKY_TOP: 0xFF6B6B,    // Pinkish orange for sunset
        SKY_BOTTOM: 0x4A90E2,  // Deep blue for bottom
        MOUNTAINS: 0x2C3E50,   // Dark blue for mountains
        MOUNTAINS_BACK: 0x34495E  // Slightly lighter blue for back mountains
    }
};

// Bird sprite constants
const BIRD_CONSTANTS = {
    // Sprite settings
    SPRITE_SCALE: {
        x: GAME_APPEARANCE.BIRD_SIZE,
        y: GAME_APPEARANCE.BIRD_SIZE
    },
    SPRITE_POSITION: {
        x: isMobile ? -2 : -4,
        y: 0,
        z: 0
    },
    // Animation frames duration
    FLAP_DURATION: 15,
    // Animation states
    STATES: {
        UP: 0,
        MID: 1,
        DOWN: 2
    }
};

// Game variables
let scene, camera, renderer, bird;
let birdSprites = []; // Array to hold the three bird sprite states
let currentBirdState = BIRD_CONSTANTS.STATES.MID;
let pipes = [];
let score = 0;
let gravity = 0.004;
let velocity = 0;
let isGameOver = false;
let pipeSpeed = 0.05; // Base pipe speed
let currentLevel = 0; // Track current level for speed increases
let isFlapping = false; // Track wing animation

function loadBirdSprites() {
    const textureLoader = new THREE.TextureLoader();
    const spritePromises = [
        'sprites/bluebird-upflap.png',
        'sprites/bluebird-midflap.png',
        'sprites/bluebird-downflap.png'
    ].map(url => {
        return new Promise((resolve, reject) => {
            textureLoader.load(
                url,
                texture => {
                    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
                    const sprite = new THREE.Sprite(spriteMaterial);
                    sprite.scale.set(
                        BIRD_CONSTANTS.SPRITE_SCALE.x,
                        BIRD_CONSTANTS.SPRITE_SCALE.y,
                        1
                    );
                    resolve(sprite);
                },
                undefined,
                reject
            );
        });
    });

    return Promise.all(spritePromises);
}

function createBird() {
    // Create bird group to hold the current active sprite
    const birdGroup = new THREE.Group();
    const pos = BIRD_CONSTANTS.SPRITE_POSITION;
    birdGroup.position.set(pos.x, pos.y, pos.z);
    
    // Load all sprites
    loadBirdSprites().then(sprites => {
        birdSprites = sprites;
        // Add the middle flap sprite initially
        bird.add(birdSprites[BIRD_CONSTANTS.STATES.MID]);
    });

    return birdGroup;
}

function createBackground() {
    // Create gradient background
    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        uniform vec3 colorTop;
        uniform vec3 colorBottom;
        varying vec2 vUv;
        void main() {
            gl_FragColor = vec4(mix(colorBottom, colorTop, vUv.y), 1.0);
        }
    `;

    const bgGeometry = new THREE.PlaneGeometry(40, 20);
    const bgMaterial = new THREE.ShaderMaterial({
        uniforms: {
            colorTop: { value: new THREE.Color(GAME_APPEARANCE.COLORS.SKY_TOP) },
            colorBottom: { value: new THREE.Color(GAME_APPEARANCE.COLORS.SKY_BOTTOM) }
        },
        vertexShader,
        fragmentShader,
    });
    const background = new THREE.Mesh(bgGeometry, bgMaterial);
    background.position.z = -5;
    scene.add(background);

    // Create back mountains
    const backMountainShape = new THREE.Shape();
    backMountainShape.moveTo(-20, -10);
    backMountainShape.lineTo(-15, -2);
    backMountainShape.lineTo(-10, -5);
    backMountainShape.lineTo(-5, 0);
    backMountainShape.lineTo(0, -3);
    backMountainShape.lineTo(5, 1);
    backMountainShape.lineTo(10, -2);
    backMountainShape.lineTo(15, -1);
    backMountainShape.lineTo(20, -4);
    backMountainShape.lineTo(20, -10);
    
    const backMountains = new THREE.Mesh(
        new THREE.ShapeGeometry(backMountainShape),
        new THREE.MeshBasicMaterial({ color: GAME_APPEARANCE.COLORS.MOUNTAINS_BACK })
    );
    backMountains.position.z = -4;
    scene.add(backMountains);

    // Create front mountains
    const frontMountainShape = new THREE.Shape();
    frontMountainShape.moveTo(-20, -10);
    frontMountainShape.lineTo(-17, -1);
    frontMountainShape.lineTo(-12, -4);
    frontMountainShape.lineTo(-7, 0);
    frontMountainShape.lineTo(-2, -3);
    frontMountainShape.lineTo(3, -1);
    frontMountainShape.lineTo(8, -4);
    frontMountainShape.lineTo(13, -2);
    frontMountainShape.lineTo(18, -5);
    frontMountainShape.lineTo(20, -3);
    frontMountainShape.lineTo(20, -10);

    const frontMountains = new THREE.Mesh(
        new THREE.ShapeGeometry(frontMountainShape),
        new THREE.MeshBasicMaterial({ color: GAME_APPEARANCE.COLORS.MOUNTAINS })
    );
    frontMountains.position.z = -3;
    scene.add(frontMountains);
}

// Initialize the scene
function init() {
    console.log('Initializing scene');
    
    // Create scene
    scene = new THREE.Scene();
    
    // Create camera with responsive FOV
    const aspectRatio = window.innerWidth / window.innerHeight;
    const fov = isMobile ? 90 : 60; // Wider FOV for mobile
    camera = new THREE.PerspectiveCamera(fov, aspectRatio, 0.1, 1000);
    
    // Adjust camera position based on screen size and orientation
    if (isMobile) {
        const isPortrait = window.innerHeight > window.innerWidth;
        camera.position.z = isPortrait ? 12 : 8;
        console.log(`Mobile camera position set to ${camera.position.z} (${isPortrait ? 'portrait' : 'landscape'})`);
    } else {
        camera.position.z = 12;
    }
    
    camera.lookAt(0, 0, 0);

    // Create renderer with pixel ratio consideration
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Create background
    createBackground();

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Create bird
    bird = createBird();
    scene.add(bird);

    // Event listeners
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onWindowResize);
    
    // Add touch events for mobile
    if (isMobile) {
        window.addEventListener('touchstart', onTouch, { passive: false });
        window.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
        window.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
        
        // Force an initial resize to ensure correct layout
        onWindowResize();
    }
    
    // Update score display
    updateScoreDisplay();
    
    createInitialPipes();
}

function updateBirdSprite(state) {
    // Remove current sprite
    while(bird.children.length > 0) {
        bird.remove(bird.children[0]);
    }
    // Add new sprite
    bird.add(birdSprites[state]);
    currentBirdState = state;
}

// Animate wing flap
function flapWings() {
    if (isFlapping) return;
    isFlapping = true;
    
    let flapProgress = 0;
    const flapDuration = BIRD_CONSTANTS.FLAP_DURATION;
    
    function animateFlap() {
        if (flapProgress < flapDuration) {
            // Up flap
            if (flapProgress < flapDuration * 0.3) {
                updateBirdSprite(BIRD_CONSTANTS.STATES.UP);
            } 
            // Down flap
            else if (flapProgress < flapDuration * 0.6) {
                updateBirdSprite(BIRD_CONSTANTS.STATES.DOWN);
            }
            // Return to middle
            else {
                updateBirdSprite(BIRD_CONSTANTS.STATES.MID);
            }
            flapProgress++;
            requestAnimationFrame(animateFlap);
        } else {
            isFlapping = false;
        }
    }
    
    animateFlap();
}

// Update score display
function updateScoreDisplay() {
    document.getElementById('score').textContent = `Score: ${score} (Level ${currentLevel + 1})`;
}

// Handle key press
function onKeyDown(event) {
    if (event.code === 'Space') {
        if (isGameOver) {
            resetGame();
        } else {
            velocity = 0.1;
            // Increase immediate upward rotation when flapping
            bird.rotation.z = 2;
            // Animate wings without TWEEN
            if (!isFlapping) {
                flapWings();
            }
        }
    }
}

// Handle window resize
function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = width / height;
    
    camera.aspect = aspectRatio;
    
    if (isMobile) {
        const isPortrait = height > width;
        camera.position.z = isPortrait ? 12 : 8;
        camera.fov = isPortrait ? 90 : 75;
    }
    
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    console.log(`Resized to ${width}x${height}, FOV: ${camera.fov}, Z: ${camera.position.z}`);
}

// Handle touch events
function onTouch(event) {
    event.preventDefault();
    if (isGameOver) {
        resetGame();
    } else {
        velocity = 0.12; // Slightly reduced jump height for better mobile control
        bird.rotation.z = Math.PI / 4; // Reduced rotation angle
        if (!isFlapping) {
            flapWings();
        }
    }
}

// Create a pair of pipes with adjusted gap for mobile
function createPipes() {
    const baseGap = 5;
    const gap = isMobile ? baseGap * 1.4 : baseGap; // 40% larger gap on mobile
    const gapPosition = Math.random() * 4 - 2; // Reduced range for more centered pipes

    // Create top pipe
    const topPipeGeometry = new THREE.BoxGeometry(1, 10, 1);
    const pipeMaterial = new THREE.MeshPhongMaterial({ color: 0x98D8B1 });
    const topPipe = new THREE.Mesh(topPipeGeometry, pipeMaterial);
    topPipe.position.set(15, gapPosition + gap/2 + 5, 0);
    topPipe.castShadow = true;
    scene.add(topPipe);

    // Create bottom pipe
    const bottomPipeGeometry = new THREE.BoxGeometry(1, 10, 1);
    const bottomPipe = new THREE.Mesh(bottomPipeGeometry, pipeMaterial);
    bottomPipe.position.set(15, gapPosition - gap/2 - 5, 0);
    bottomPipe.castShadow = true;
    scene.add(bottomPipe);

    pipes.push({ top: topPipe, bottom: bottomPipe, scored: false });
}

// Create initial set of pipes
function createInitialPipes() {
    createPipes();
}

// Update game state
function update() {
    if (isGameOver) return;

    // More dynamic rotation based on velocity
    const targetRotation = velocity > 0 
        ? THREE.MathUtils.lerp(0, Math.PI / 3, velocity * 8) // Steeper upward (60 degrees)
        : THREE.MathUtils.lerp(0, -Math.PI / 3, -velocity * 6); // Steeper downward (-60 degrees)

    bird.rotation.z = THREE.MathUtils.lerp(
        bird.rotation.z,
        targetRotation,
        0.2 // Faster rotation transition
    );

    // Update bird position
    velocity -= gravity;
    bird.position.y += velocity;

    // Check if bird hits the boundaries
    if (bird.position.y > 8 || bird.position.y < -8) {
        gameOver();
        return;
    }

    // Update pipes
    if (pipes.length > 0 && pipes[pipes.length - 1].top.position.x < 7) { // Adjusted trigger for new pipes
        createPipes();
    }

    pipes.forEach((pipe, index) => {
        pipe.top.position.x -= pipeSpeed;
        pipe.bottom.position.x -= pipeSpeed;

        // Check collision
        if (checkCollision(bird, pipe.top) || checkCollision(bird, pipe.bottom)) {
            gameOver();
            return;
        }

        // Update score
        if (!pipe.scored && pipe.top.position.x < bird.position.x) {
            score++;
            
            // Check for level up (every 10 points)
            if (score % 10 === 0) {
                currentLevel = Math.floor(score / 10);
                pipeSpeed = 0.05 + (currentLevel * 0.01);
                console.log(`Level up! Speed increased to ${pipeSpeed}`);
            }
            
            updateScoreDisplay();
            pipe.scored = true;
        }

        // Remove pipes that are off screen (much further left)
        if (pipe.top.position.x < -15) {
            scene.remove(pipe.top);
            scene.remove(pipe.bottom);
            pipes.splice(index, 1);
        }
    });
}

// Check collision between bird and pipe
function checkCollision(bird, pipe) {
    const birdBox = new THREE.Box3().setFromObject(bird);
    const pipeBox = new THREE.Box3().setFromObject(pipe);
    
    // Make collision more forgiving by shrinking the pipe's collision box
    const center = new THREE.Vector3();
    pipeBox.getCenter(center);
    const size = new THREE.Vector3();
    pipeBox.getSize(size);
    
    // Shrink the pipe's collision box by 20%
    size.multiply(new THREE.Vector3(0.8, 0.8, 0.8));
    
    // Create new box with reduced size
    const forgivingBox = new THREE.Box3(
        new THREE.Vector3(
            center.x - size.x/2,
            center.y - size.y/2,
            center.z - size.z/2
        ),
        new THREE.Vector3(
            center.x + size.x/2,
            center.y + size.y/2,
            center.z + size.z/2
        )
    );
    
    return birdBox.intersectsBox(forgivingBox);
}

// Game over
function gameOver() {
    isGameOver = true;
    document.getElementById('gameOver').style.display = 'block';
    document.getElementById('gameOver').textContent = `GAME OVER\nFinal Score: ${score}\nLevel ${currentLevel + 1}\nPress SPACE to restart`;
}

// Reset game
function resetGame() {
    isGameOver = false;
    score = 0;
    currentLevel = 0;
    pipeSpeed = 0.05; // Reset pipe speed
    updateScoreDisplay();
    document.getElementById('gameOver').style.display = 'none';
    
    // Reset bird position and velocity
    bird.position.set(-4, 0, 0);
    velocity = 0;
    
    // Remove all pipes
    pipes.forEach(pipe => {
        scene.remove(pipe.top);
        scene.remove(pipe.bottom);
    });
    pipes = [];
    
    // Create new pipes
    createInitialPipes();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    update();
    renderer.render(scene, camera);
}

// Start game
console.log('Starting game');
init();
animate();
console.log('Animation loop started'); 