import { ChunkManager } from "./ChunkManager.js";
import { getBlockTable } from "./BlockTable.js";

import {
    TextureLoader,
    EquirectangularReflectionMapping,
    Scene,
    WebGLRenderer,
    Clock,
    NearestFilter,
    NearestMipmapLinearFilter,
    RepeatWrapping,
    LoadingManager,
    LinearMipMapNearestFilter,
} from "three";
import { Player } from "./Player.js";
import { Debug } from "./Debug.js";

const renderer = new WebGLRenderer({ antialias: true });
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
const debug = new Debug();

const chunkSize = 16;
const renderDistance = 12;
const renderFade = Math.min(renderDistance / 8, 1);
const worldSeed = 173869420;

let loadingManager = new LoadingManager();

const textureLoader = new TextureLoader(loadingManager);
const loadTexture = (path) => {
    const texture = textureLoader.load(path);
    texture.generateMipmaps = true;
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestMipmapLinearFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    return texture;
};

renderer.domElement.addEventListener("click", () => {
    player.controls.lock();
});

let bkg_img = new TextureLoader().load("textures/sky.png");
bkg_img.mapping = EquirectangularReflectionMapping;

let env_img = bkg_img.clone();
env_img.mapping = EquirectangularReflectionMapping;

scene.environment = env_img;
scene.background = bkg_img;

const blockTable = getBlockTable(loadTexture, 0, renderFade * chunkSize);

const chunkManager = new ChunkManager({
    scene: scene,
    seed: worldSeed,
    chunkSize: chunkSize,
    chunkHeight: 128,
    renderDistance: renderDistance,
    blockTable: blockTable,
    amplitude: 48,
});

blockTable.water.texture.side.uniforms.envMap.value = scene.environment;
blockTable.leaf.texture.side.uniforms.time.value = 0;
blockTable.water.texture.side.uniforms.time.value = 0;

const spawnLocation = chunkManager.findSpawnLocation();

scene.add(chunkManager.chunkGroup);

const clock = new Clock();

function updateRenderDistances(distance) {
    Object.values(blockTable).forEach((block) => {
        if (
            block.texture.side &&
            block.texture.side.uniforms &&
            block.texture.side.uniforms.renderDistance
        ) {
            block.texture.side.uniforms.renderDistance.value = distance;
        }

        if (
            block.texture.top &&
            block.texture.top.uniforms &&
            block.texture.top.uniforms.renderDistance
        ) {
            block.texture.top.uniforms.renderDistance.value = distance;
        }

        if (
            block.texture.bottom &&
            block.texture.bottom.uniforms &&
            block.texture.bottom.uniforms.renderDistance
        ) {
            block.texture.bottom.uniforms.renderDistance.value = distance;
        }
    });
}

let currentRenderDistance = 0;
const targetRenderDistance = (renderDistance - 1) * chunkSize;
const introDuration = 5.0;
let introStartTime = null;
let introCompleted = false;
let now = 0;
let resourcesLoaded = false;

const player = new Player(
    renderer,
    chunkSize * renderDistance * 2,
    chunkManager
);
loadingManager.onLoad = function () {
    resourcesLoaded = true;
    console.log("All resources loaded!");
};

const selectionBox = player.drawSelectBox();
selectionBox.visible = false;
scene.add(selectionBox);

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

let fpsTime = 1;
let fpsIter = 60;
let lastfps = 60;

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    now += delta;
    fpsTime += delta;
    fpsIter++;

    if (resourcesLoaded && loadingScreen.parentNode) {
        if (introStartTime === null) {
            introStartTime = now + 0.5;
            document.body.removeChild(loadingScreen);
        }
    }

    if (!introCompleted && resourcesLoaded) {
        if (now >= introStartTime) {
            const elapsed = now - introStartTime;
            const progress = Math.min(elapsed / introDuration, 1.0);

            const easedProgress = 1 - Math.pow(1 - progress, 3);

            currentRenderDistance = easedProgress * targetRenderDistance;
            updateRenderDistances(currentRenderDistance);

            if (progress >= 1.0) {
                introCompleted = true;
            }
        }
    }
    player.updatePosition(delta);
    player.updateSelectBox(selectionBox, 5);
    player.updateMouse();

    if (fpsTime > 1) {
        debug.update(fpsIter, player, chunkManager);
        lastfps = fpsIter;
        fpsTime = 0;
        fpsIter = 0;
    } else {
        debug.update(lastfps, player, chunkManager);
    }

    blockTable.leaf.texture.side.uniforms.time.value += delta * 0.5;
    blockTable.water.texture.side.uniforms.time.value += delta * 0.5;

    chunkManager.updateChunks(
        player.camera.position.x,
        player.camera.position.z
    );

    renderer.render(scene, player.camera);
}

function onWindowResize() {
    player.camera.aspect = window.innerWidth / window.innerHeight;
    player.camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize, false);

async function waitForSpawnChunks() {
    chunkManager.updateChunks(0, 0);

    //console.log("Waiting for spawn chunks to load...");

    while (!chunkManager.isSpawnAreaLoaded(0, 0)) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const spawnLocation = chunkManager.findSpawnLocation(2);
    player.camera.position.set(
        spawnLocation[0],
        spawnLocation[1] + 2,
        spawnLocation[2]
    );
    //console.log("Spawn chunks loaded! Starting game...");
}

waitForSpawnChunks().then(() => {
    animate();
});
