import { ChunkManager } from "./ChunkManager.js";
import { getBlockTable } from "./BlockTable.js";

import {
    TextureLoader,
    EquirectangularReflectionMapping,
    Scene,
    WebGLRenderer,
    Clock,
    LoadingManager,
} from "three";
import { Player } from "./Player.js";
import { Debug } from "./Debug.js";
import { Block } from "./Block.js";

const renderer = new WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.domElement.style.position = "absolute";
renderer.domElement.style.top = "0";
renderer.domElement.style.left = "0";
renderer.domElement.style.width = "100vw";
renderer.domElement.style.height = "100vh";
renderer.domElement.style.display = "block";

const crosshair = document.createElement("div");
crosshair.style.position = "fixed";
crosshair.style.top = "50%";
crosshair.style.left = "50%";
crosshair.style.width = "4px";
crosshair.style.height = "4px";
crosshair.style.backgroundColor = "white";
crosshair.style.borderRadius = "50%";
crosshair.style.transform = "translate(-50%, -50%)";
crosshair.style.pointerEvents = "none";
crosshair.style.zIndex = "1000";
crosshair.style.boxShadow = "0 0 2px rgba(0, 0, 0, 0.8)";
document.body.appendChild(crosshair);

document.body.appendChild(renderer.domElement);

const scene = new Scene();

// Create loading manager FIRST
let loadingManager = new LoadingManager();
let resourcesLoaded = false;

loadingManager.onLoad = function () {
    resourcesLoaded = true;
    console.log("All resources loaded!");
};

loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
    console.log(`Loading progress: ${itemsLoaded}/${itemsTotal} - ${url}`);
};

loadingManager.onError = function (url) {
    console.error("Failed to load:", url);
};

// Constants
const chunkSize = 16;
const renderDistance = 10;
const renderFade = Math.min(renderDistance / 8, 1);
const worldSeed = null;

// Initialize blocks first
Block.initializeBlocks();

// Load atlas using the loading manager
Block.loadAtlas("textures/atlas.png", loadingManager);

// Load other textures with the same loading manager
const textureLoader = new TextureLoader(loadingManager);
let bkg_img = textureLoader.load("textures/sky.png");
bkg_img.mapping = EquirectangularReflectionMapping;

let env_img = bkg_img.clone();
env_img.mapping = EquirectangularReflectionMapping;

scene.environment = env_img;
scene.background = bkg_img;

// Wait for atlas to be ready before creating block table
async function waitForAtlas() {
    return new Promise((resolve) => {
        const check = () => {
            if (Block.atlasTexture) {
                resolve();
            } else {
                setTimeout(check, 10);
            }
        };
        check();
    });
}

// Initialize everything after atlas loads
await waitForAtlas();

const blockTable = getBlockTable(0, renderFade * chunkSize);

const chunkManager = new ChunkManager({
    scene: scene,
    seed: worldSeed,
    chunkSize: chunkSize,
    chunkHeight: 128,
    renderDistance: renderDistance,
    blockTable: blockTable,
    amplitude: 48,
});

const debug = new Debug(chunkManager);

// Set up materials
blockTable.water.material.uniforms.envMap.value = scene.environment;
blockTable.leaf.material.uniforms.time.value = 0;
blockTable.water.material.uniforms.time.value = 0;

scene.add(chunkManager.chunkGroup);

// Initialize player
const player = new Player(
    renderer,
    chunkSize * renderDistance * 2,
    chunkManager
);
chunkManager.camera = player.camera;

renderer.domElement.addEventListener("click", () => {
    player.controls.lock();
});

const selectionBox = player.drawSelectBox();
selectionBox.visible = false;
scene.add(selectionBox);

// Loading screen
const loadingScreen = document.createElement("div");
loadingScreen.style.position = "absolute";
loadingScreen.style.top = "0";
loadingScreen.style.left = "0";
loadingScreen.style.width = "100%";
loadingScreen.style.height = "100%";
loadingScreen.style.backgroundColor = "black";
loadingScreen.style.color = "white";
loadingScreen.style.display = "flex";
loadingScreen.style.alignItems = "center";
loadingScreen.style.justifyContent = "center";
loadingScreen.style.fontSize = "24px";
loadingScreen.style.zIndex = "1000";
loadingScreen.textContent = "Loading world...";
document.body.appendChild(loadingScreen);

// Animation variables
const clock = new Clock();
let currentRenderDistance = 0;
const targetRenderDistance = (renderDistance - 1) * chunkSize;
const introDuration = 5.0;
let introStartTime = null;
let introCompleted = false;
let now = 0;
let iter = -1;
let fps = 0;
let last = 0;
const fpsUpdate = 5;

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    now += delta;

    // Handle loading screen removal
    if (resourcesLoaded && loadingScreen.parentNode) {
        if (introStartTime === null) {
            introStartTime = now + 0.5;
            document.body.removeChild(loadingScreen);
            console.log("Loading screen removed, starting intro");
        }
    }

    // Handle intro animation
    if (!introCompleted && resourcesLoaded) {
        if (now >= introStartTime) {
            const elapsed = now - introStartTime;
            const progress = Math.min(elapsed / introDuration, 1.0);
            const easedProgress = 1 - Math.pow(1 - progress, 3);

            currentRenderDistance = easedProgress * targetRenderDistance;
            chunkManager.updateRenderDistances(currentRenderDistance);

            if (progress >= 1.0) {
                introCompleted = true;
                console.log("Intro completed");
            }
        }
    }

    // Update game systems
    if (resourcesLoaded) {
        blockTable.leaf.material.uniforms.time.value += delta * 0.5;
        blockTable.water.material.uniforms.time.value += delta * 0.5;

        chunkManager.updateChunks(
            player.camera.position.x,
            player.camera.position.z
        );
        player.updatePosition(delta);
        player.updateSelectBox(selectionBox, 5);
        player.updateMouse();
    }

    renderer.render(scene, player.camera);

    // FPS calculation
    if (iter++ % fpsUpdate === 0) {
        last = Math.round(fpsUpdate / fps);
        fps = 0;
    }
    fps += delta;
    debug.update(last, player, chunkManager);
}

function onWindowResize() {
    player.camera.aspect = window.innerWidth / window.innerHeight;
    player.camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize, false);

async function waitForSpawnChunks() {
    console.log("Waiting for spawn chunks to load...");
    chunkManager.updateChunks(0, 0);

    while (!chunkManager.isSpawnAreaLoaded(0, 0)) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        chunkManager.updateChunks(0, 0);
    }

    const spawnLocation = chunkManager.findSpawnLocation(2);
    player.camera.position.set(
        spawnLocation[0],
        spawnLocation[1] + 2,
        spawnLocation[2]
    );
    console.log("Spawn chunks loaded! Starting game...");
}

// Start the game
waitForSpawnChunks().then(() => {
    console.log("Starting animation loop");
    animate();
});
