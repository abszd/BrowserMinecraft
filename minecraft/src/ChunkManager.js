import { Frustum, Group, Matrix4, Box3, Vector3 } from "three";
import { Chunk } from "./Chunk.js";

class ChunkManager {
    constructor(params = {}) {
        this.worldSeed = params.seed || 69420;
        this.chunkSize = params.chunkSize || 16;
        this.chunkHeight = params.chunkHeight || 128;
        this.renderDistance = params.renderDistance || 4;
        this.camera = null;
        this.frustum = new Frustum();
        this.cameraMatrix = new Matrix4();
        this.cullingStats = {
            totalChunks: 0,
            visibleChunks: 0,
            culledChunks: 0,
        };

        this.TRANSPARENT_BLOCKS = new Set();
        this.TRANSPARENT_BLOCKS.add(-1);
        this.TRANSPARENT_BLOCKS.add(4);
        this.TRANSPARENT_BLOCKS.add(5);

        this.amplitude = params.amplitude || 64;
        this.chunks = new Map(); // "chunkX,chunkZ" -> Chunk
        this.activeChunks = new Set();
        this.dirtyChunks = new Set();
        this.blockTable = params.blockTable;
        this.idBlockTypeLookup = {};
        Object.entries(this.blockTable).forEach((key) => {
            this.idBlockTypeLookup[key[1].guid] = key[0];
        });
        this.idBlockTypeLookup[-1] = "air";
        this.scene = params.scene;
        this.chunkGroup = new Group();
        this.scene.add(this.chunkGroup);

        this.maxLoadedChunks = Math.max(
            1024,
            this.renderDistance * this.renderDistance * 4
        );

        this.chunkWorker = null; // For terrain generation
        this.meshWorker = null; // For mesh building
        this.pendingGeneration = new Map(); // chunkId -> chunk (waiting for terrain)
        this.pendingMeshes = new Map(); // chunkId -> chunk (waiting for mesh)

        this.workersInitialized = false;
        this.initializeWorkers();
    }

    updateRenderDistances(distance) {
        const fade = Math.min(this.chunkSize, distance / 8);
        Object.values(this.blockTable).forEach((block) => {
            if (
                block.texture.side &&
                block.texture.side.uniforms &&
                block.texture.side.uniforms.renderDistance
            ) {
                block.texture.side.uniforms.renderDistance.value = distance;
                block.texture.side.uniforms.renderFade.value = fade;
            }

            if (
                block.texture.top &&
                block.texture.top.uniforms &&
                block.texture.top.uniforms.renderDistance
            ) {
                block.texture.top.uniforms.renderDistance.value = distance;
                block.texture.top.uniforms.renderFade.value = fade;
            }

            if (
                block.texture.bottom &&
                block.texture.bottom.uniforms &&
                block.texture.bottom.uniforms.renderDistance
            ) {
                block.texture.bottom.uniforms.renderDistance.value = distance;
                block.texture.bottom.uniforms.renderFade.value = fade;
            }
        });
    }

    initializeWorkers() {
        try {
            this.chunkWorker = new Worker(
                new URL("./chunkWorker.js", import.meta.url)
            );
            this.chunkWorker.onmessage = (e) =>
                this.handleChunkWorkerMessage(e);
            this.chunkWorker.onerror = (error) => {
                console.error("Chunk worker error:", error);
                this.chunkWorker = null;
            };

            this.meshWorker = new Worker(
                new URL("./meshWorker.js", import.meta.url)
            );
            this.meshWorker.onmessage = (e) => this.handleMeshWorkerMessage(e);
            this.meshWorker.onerror = (error) => {
                console.error("Mesh worker error:", error);
                this.meshWorker = null;
            };

            this.initializeWorkerData();
        } catch (error) {
            console.warn("Failed to create workers:", error);
            this.chunkWorker = null;
            this.meshWorker = null;
        }
    }

    initializeWorkerData() {
        if (this.chunkWorker) {
            this.chunkWorker.postMessage({
                type: "initialize",
                params: {
                    worldSeed: this.worldSeed,
                    chunkSize: this.chunkSize,
                    chunkHeight: this.chunkHeight,
                    amplitude: this.amplitude,
                    transparentBlocks: Array.from(this.TRANSPARENT_BLOCKS),
                    blockTable: this.getSimplifiedBlockTable(),
                },
            });
        }

        if (this.meshWorker) {
            const workerBlockTable = {};
            Object.entries(this.blockTable).forEach(([key, value]) => {
                workerBlockTable[key] = {
                    guid: value.guid,
                    name: value.name,
                };
            });

            this.meshWorker.postMessage({
                type: "initialize",
                data: {
                    blockTable: workerBlockTable,
                    transparentBlocks: Array.from(this.TRANSPARENT_BLOCKS),
                },
            });
        }
    }

    getSimplifiedBlockTable() {
        const simplified = {};
        Object.entries(this.blockTable).forEach(([key, value]) => {
            simplified[key] = { guid: value.guid };
        });
        return simplified;
    }

    handleChunkWorkerMessage(e) {
        const { type, data, chunkId, error } = e.data;

        switch (type) {
            case "initialized":
                console.log("Chunk worker initialized");
                this.checkWorkersReady();
                break;

            case "chunkGenerated":
                this.onChunkGenerated(data);
                break;

            case "chunkUpdated":
                this.onChunkUpdated(data);
                break;

            case "spawnFound":
                this.onSpawnFound(chunkId, data.location);
                break;

            case "error":
                console.error("Chunk worker error:", error);
                this.handleGenerationError(chunkId);
                break;
        }
    }

    handleMeshWorkerMessage(e) {
        const { type, data, error } = e.data;

        switch (type) {
            case "initialized":
                console.log("Mesh worker initialized");
                this.checkWorkersReady();
                break;

            case "meshCompleted":
                this.onMeshCompleted(data);
                break;

            case "error":
                console.error("Mesh worker error:", error);
                break;
        }
    }
    checkWorkersReady() {
        if (this.chunkWorker && this.meshWorker && !this.workersInitialized) {
            this.workersInitialized = true;

            this.chunks.forEach((chunk) => {
                if (!chunk.isGenerating && !chunk.isGenerated) {
                    this.requestChunkGeneration(chunk);
                }
            });

            console.log("Both workers ready!");
        }
    }

    onChunkGenerated(chunkData) {
        const { chunkId, chunkX, chunkZ } = chunkData;
        const chunk = this.pendingGeneration.get(chunkId);

        if (!chunk) {
            console.warn("Received terrain for unknown chunk:", chunkId);
            return;
        }

        this.pendingGeneration.delete(chunkId);

        chunk.setChunkData(chunkData);

        this.requestMesh(chunk, chunkData);
    }

    requestMesh(chunk) {
        if (!this.meshWorker) {
            return;
        }

        const chunkId = `${chunk.chunkX},${chunk.chunkZ}`;
        // console.log(
        //     `Requesting mesh ${chunkId}, pending: ${this.pendingMeshes.has(
        //         chunkId
        //     )}`
        // );
        this.pendingMeshes.set(chunkId, chunk);

        this.meshWorker.postMessage({
            type: "buildMesh",
            data: {
                chunkData: {
                    grid: Array.from(chunk.grid.entries()),
                    size: chunk.size,
                    height: chunk.height,
                    chunkX: chunk.chunkX,
                    chunkZ: chunk.chunkZ,
                },
                waterBlocks: chunk.waterBlocks,
            },
        });
    }

    onMeshCompleted(data) {
        const { chunkId, terrainMeshData, waterMeshData } = data;
        const chunk = this.pendingMeshes.get(chunkId);
        //console.log(this.pendingMeshes.size);
        if (!chunk) {
            console.warn("Received mesh for unknown chunk:", chunkId);
            this.dirtyChunks.add(chunk);
            return;
        }

        this.pendingMeshes.delete(chunkId);
        if (chunk.mesh) {
            this.chunkGroup.remove(chunk.mesh);
        }
        chunk.onMeshCompleted(terrainMeshData, waterMeshData);
        this.addChunkToScene(chunk);
    }

    addChunkToScene(chunk) {
        if (this.activeChunks.has(chunk) && chunk.mesh) {
            this.chunkGroup.add(chunk.mesh);
        }
    }

    isSpawnAreaLoaded(playerX, playerZ) {
        const playerChunkX = Math.floor(playerX / this.chunkSize);
        const playerChunkZ = Math.floor(playerZ / this.chunkSize);

        const spawnRadius = Math.min(2, this.renderDistance);

        for (let dx = -spawnRadius; dx <= spawnRadius; dx++) {
            for (let dz = -spawnRadius; dz <= spawnRadius; dz++) {
                const chunkX = playerChunkX + dx;
                const chunkZ = playerChunkZ + dz;
                const chunk = this.getChunk(chunkX, chunkZ, false);

                if (!chunk || !chunk.isGenerated || !chunk.mesh) {
                    return false;
                }
            }
        }

        return true;
    }

    onChunkUpdated(chunkData) {
        const chunk = this.chunks.get(chunkData.chunkId);
        //console.log(chunk);
        if (chunk) {
            if (chunkData.waterBlocks) {
                chunk.waterBlocks = chunkData.waterBlocks;
            }
            chunk.updateFromWorker(chunkData);

            if (this.activeChunks.has(chunk)) {
                this.dirtyChunks.add(chunk);
                //this.requestMesh(chunk, chunkData);
            }
        }
    }

    handleGenerationError(chunkId) {
        const chunk = this.pendingGeneration.get(chunkId);
        if (chunk) {
            this.pendingGeneration.delete(chunkId);
            console.warn("Error With Chunk:", chunkId);
        }
    }

    worldToChunkCoords(x, y, z) {
        return {
            chunkX: Math.floor(x / this.chunkSize),
            chunkZ: Math.floor(z / this.chunkSize),
            localX: ((x % this.chunkSize) + this.chunkSize) % this.chunkSize,
            localY: y,
            localZ: ((z % this.chunkSize) + this.chunkSize) % this.chunkSize,
        };
    }

    getChunk(chunkX, chunkZ, autoLoad = false) {
        const key = `${chunkX},${chunkZ}`;
        let chunk = this.chunks.get(key);

        if (!chunk && autoLoad) {
            chunk = new Chunk(this, chunkX, chunkZ);
            this.chunks.set(key, chunk);

            this.requestChunkGeneration(chunk);
        }

        return chunk;
    }

    getChunkBounds(chunk) {
        const worldX = chunk.chunkX * this.chunkSize;
        const worldZ = chunk.chunkZ * this.chunkSize;

        return new Box3(
            new Vector3(worldX, 0, worldZ),
            new Vector3(
                worldX + this.chunkSize,
                this.chunkHeight,
                worldZ + this.chunkSize
            )
        );
    }

    requestChunkGeneration(chunk) {
        const chunkId = `${chunk.chunkX},${chunk.chunkZ}`;
        if (!this.chunkWorker || !this.workersInitialized) {
            console.warn("Error With Chunk:", chunkId);
            return;
        }

        chunk.isGenerating = true;
        this.pendingGeneration.set(chunkId, chunk);

        this.chunkWorker.postMessage({
            type: "generateChunk",
            chunkX: chunk.chunkX,
            chunkZ: chunk.chunkZ,
        });
    }

    getBlock(x, y, z) {
        const { chunkX, chunkZ, localX, localY, localZ } =
            this.worldToChunkCoords(x, y, z);
        const chunk = this.getChunk(chunkX, chunkZ, false);
        return chunk ? chunk.getBlock(localX, localY, localZ) : -1;
    }

    setBlock(x, y, z, blockType) {
        const { chunkX, chunkZ, localX, localY, localZ } =
            this.worldToChunkCoords(x, y, z);
        const chunk = this.getChunk(chunkX, chunkZ, true);
        const chunkId = `${chunkX},${chunkZ}`;

        if (!chunk.isGenerated) {
            return;
        }

        const waterGuid = 5;
        const adjacentPositions = [
            [x + 1, y, z],
            [x - 1, y, z],
            [x, y + 1, z],
            [x, y - 1, z],
            [x, y, z + 1],
            [x, y, z - 1],
        ];

        const adjacentChunks = new Set();
        for (const [adjX, adjY, adjZ] of adjacentPositions) {
            if (this.getBlock(adjX, adjY, adjZ) === waterGuid) {
                const { chunkX: adjChunkX, chunkZ: adjChunkZ } =
                    this.worldToChunkCoords(adjX, adjY, adjZ);
                const adjChunk = this.getChunk(adjChunkX, adjChunkZ, false);
                if (adjChunk) {
                    adjacentChunks.add(adjChunk);
                }
            }
        }

        if (this.chunkWorker && this.workersInitialized) {
            this.chunkWorker.postMessage({
                type: "updateBlock",
                chunkId: chunkId,
                x: localX,
                y: localY,
                z: localZ,
                blockType: blockType,
                updateWaterMesh: adjacentChunks.size > 0,
            });
        }

        for (const adjChunk of adjacentChunks) {
            this.dirtyChunks.add(adjChunk);
        }

        if (localX === 0) {
            const neighbor = this.getChunk(chunkX - 1, chunkZ, false);
            if (neighbor) this.dirtyChunks.add(neighbor);
        } else if (localX === this.chunkSize - 1) {
            const neighbor = this.getChunk(chunkX + 1, chunkZ, false);
            if (neighbor) this.dirtyChunks.add(neighbor);
        }

        if (localZ === 0) {
            const neighbor = this.getChunk(chunkX, chunkZ - 1, false);
            if (neighbor) this.dirtyChunks.add(neighbor);
        } else if (localZ === this.chunkSize - 1) {
            const neighbor = this.getChunk(chunkX, chunkZ + 1, false);
            if (neighbor) this.dirtyChunks.add(neighbor);
        }
    }

    findSpawnLocation(objHeight = 2) {
        let chunk = this.getChunk(0, 0, true);

        if (!chunk.isGenerated) {
            return [
                this.chunkSize / 2,
                this.chunkHeight / 2,
                this.chunkSize / 2,
            ];
        }

        return chunk.findSpawnLocation(objHeight) || [0, this.chunkHeight, 0];
    }

    performFrustumCulling() {
        this.cullingStats.totalChunks = this.activeChunks.size;
        this.cullingStats.visibleChunks = 0;
        this.cullingStats.culledChunks = 0;

        for (const chunk of this.activeChunks) {
            if (!chunk.mesh) continue;

            const chunkBounds = this.getChunkBounds(chunk);
            const isVisible = this.frustum.intersectsBox(chunkBounds);

            chunk.mesh.visible = isVisible;

            if (isVisible) {
                this.cullingStats.visibleChunks++;
            } else {
                this.cullingStats.culledChunks++;
            }
        }
    }

    updateChunks(playerX, playerZ) {
        const playerChunkX = Math.floor(playerX / this.chunkSize);
        const playerChunkZ = Math.floor(playerZ / this.chunkSize);

        const newActiveChunks = new Set();
        const maxDistSq = this.renderDistance * this.renderDistance;

        for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
            for (
                let dz = -this.renderDistance;
                dz <= this.renderDistance;
                dz++
            ) {
                if (dx * dx + dz * dz > maxDistSq) continue;

                const chunkX = playerChunkX + dx;
                const chunkZ = playerChunkZ + dz;

                let chunk = this.getChunk(chunkX, chunkZ, true);
                newActiveChunks.add(chunk);

                if (!this.activeChunks.has(chunk)) {
                    this.activateChunk(chunk);
                }
            }
        }

        for (const chunk of this.activeChunks) {
            if (!newActiveChunks.has(chunk)) {
                this.deactivateChunk(chunk);
            }
        }

        this.activeChunks = newActiveChunks;
        this.enforceChunkLimit();
        this.updateDirtyChunks();
        if (this.camera) {
            this.cameraMatrix.multiplyMatrices(
                this.camera.projectionMatrix,
                this.camera.matrixWorldInverse
            );
            this.frustum.setFromProjectionMatrix(this.cameraMatrix);
            this.performFrustumCulling();
        }
    }

    activateChunk(chunk) {
        if (chunk.mesh) {
            this.chunkGroup.add(chunk.mesh);
        }
    }

    deactivateChunk(chunk) {
        if (chunk.isGenerating || chunk.isBuildingMesh) {
            return;
        }

        if (chunk.mesh) {
            this.chunkGroup.remove(chunk.mesh);
        }

        const chunkId = `${chunk.chunkX},${chunk.chunkZ}`;
        //console.log(`Pending Mesh Deleted ${chunkId}`);
    }

    updateDirtyChunks() {
        for (const chunk of this.dirtyChunks) {
            if (this.activeChunks.has(chunk) && chunk.isGenerated) {
                this.requestMesh(chunk, {
                    grid: Array.from(chunk.grid.entries()),
                    waterBlocks: chunk.waterBlocks,
                    size: chunk.size,
                    height: chunk.height,
                    chunkX: chunk.chunkX,
                    chunkZ: chunk.chunkZ,
                });
            }
        }

        this.dirtyChunks.clear();
    }

    enforceChunkLimit() {
        if (this.chunks.size <= this.maxLoadedChunks) return;

        const chunksArray = Array.from(this.chunks.values());
        const sortedChunks = chunksArray
            .filter(
                (c) =>
                    !this.activeChunks.has(c) &&
                    !c.isGenerating &&
                    !c.isBuildingMesh
            )
            .sort((a, b) => a.lastAccessed - b.lastAccessed);

        const toRemove = sortedChunks.slice(
            0,
            this.chunks.size - this.maxLoadedChunks
        );

        for (const chunk of toRemove) {
            this.unloadChunk(chunk);
        }
    }

    unloadChunk(chunk) {
        if (chunk.isGenerating || chunk.isBuildingMesh) {
            return;
        }
        const key = `${chunk.chunkX},${chunk.chunkZ}`;

        this.pendingGeneration.delete(key);
        this.pendingMeshes.delete(key);

        if (this.chunkWorker) {
            this.chunkWorker.postMessage({
                type: "unloadChunk",
                chunkId: key,
            });
        }

        if (chunk.mesh) {
            chunk.disposeCurrentMesh();
        }

        this.chunks.delete(key);
    }

    dispose() {
        if (this.chunkWorker) {
            this.chunkWorker.terminate();
            this.chunkWorker = null;
        }

        if (this.meshWorker) {
            this.meshWorker.terminate();
            this.meshWorker = null;
        }

        for (const chunk of this.chunks.values()) {
            chunk.disposeCurrentMesh();
        }
        this.chunks.clear();
        this.activeChunks.clear();
        this.dirtyChunks.clear();
        this.pendingGeneration.clear();
        this.pendingMeshes.clear();
    }
}

export { ChunkManager };
