import { Frustum, Group, Matrix4, Box3, Vector3 } from "three";
import { Chunk } from "./Chunk.js";
import { MeshBuffer, TerrainBuffer } from "./BufferPool.js";

class ChunkManager {
    constructor(params = {}) {
        this.worldSeed = params.seed || 17;
        this.chunkSize = params.chunkSize || 16;
        this.chunkHeight = params.chunkHeight || 128;
        this.renderDistance = params.renderDistance || 4;
        this.maxTerrainWorkers = 4;
        this.maxMeshWorkers = 4;
        this.camera = null;
        this.frustum = new Frustum();
        this.cameraMatrix = new Matrix4();
        this.cullingStats = {
            totalChunks: 0,
            visibleChunks: 0,
            culledChunks: 0,
        };

        this.TRANSPARENT_BLOCKS = new Set([-1, 4, 5]);
        this.textureArray = params.textureArray;
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

        this.maxLoadedChunks = Math.max(1024, this.renderDistance * this.renderDistance * 4);

        this.terrainBuffer;
        this.meshBuffer;
        this.workersInitialized = false;
        this.pending = [];
        this.processingMeshes = false;
        this.material = this.textureArray.getMaterial();
        this.initializeWorkerPools();
    }

    updateRenderDistances(distance) {
        const fade = Math.min(this.chunkSize, distance / 8);
        Object.values(this.blockTable).forEach((block) => {
            block.texture.side.uniforms.renderDistance.value = distance;
            block.texture.side.uniforms.renderFade.value = fade;

            if (block.texture.top) {
                block.texture.top.uniforms.renderDistance.value = distance;
                block.texture.top.uniforms.renderFade.value = fade;
            }

            if (block.texture.bottom) {
                block.texture.bottom.uniforms.renderDistance.value = distance;
                block.texture.bottom.uniforms.renderFade.value = fade;
            }
        });
        this.textureArray.material.uniforms.renderDistance.value = distance;
        this.textureArray.material.uniforms.renderFade.value = fade;
    }

    initializeWorkerPools() {
        this.terrainBuffer = new TerrainBuffer(this, { maxSize: this.maxTerrainWorkers });
        this.meshBuffer = new MeshBuffer(this, { maxSize: this.maxMeshWorkers });
    }

    getSimplifiedBlockTable() {
        const simplified = {};
        Object.entries(this.blockTable).forEach(([key, value]) => {
            simplified[key] = { guid: value.guid };
        });
        return simplified;
    }

    sendToWorkers() {
        const maxTerrainWorkers = 1024;
        const maxMeshWorkers = 1024;
        let a = 0;
        let b = 0;

        for (const chunk of this.activeChunks) {
            if (a < maxTerrainWorkers && !chunk.isGenerated && !chunk.isGenerating) {
                this.requestTerrain(chunk);
                if (chunk.isGenerating === true) a++;
            } else if (b < maxMeshWorkers && chunk.isGenerated && !chunk.isBuildingMesh && !chunk.mesh) {
                this.requestMesh(chunk);
                if (chunk.isBuildingMesh) b++;
            }
            if (a >= maxTerrainWorkers && b >= maxMeshWorkers) break;
        }
    }

    checkWorkersReady() {
        if (this.terrainBuffer?.atLeastOneWorker && this.meshBuffer.atLeastOneWorker && !this.workersInitialized) {
            this.workersInitialized = true;
        }

        //console.log("Both workers ready!");
    }

    onTerrainCompleted(data) {
        const { chunkId, chunkX, chunkZ, frameno } = data;
        //console.log("Terrain for", chunkId, this.terrainBuffer.pool[frameno]);
        const chunk = this.terrainBuffer.pool[frameno].chunk;

        if (!chunk) {
            console.warn("Received terrain for unknown chunk:", chunkId);
            return;
        }
        chunk.setChunkData(data);
        this.requestMesh(chunk);
        this.pokeWorkers();
        //console.log("terrain", data);
    }

    pokeWorkers() {
        this.terrainBuffer.updateWorkers();
        this.meshBuffer.updateWorkers();
        //console.log("Mesh Buffer", this.meshBuffer.pool);
    }
    requestTerrain(chunk) {
        //console.log("Requesting terrain", chunk.chunkX, chunk.chunkZ);
        if (
            this.terrainBuffer.add(chunk, {
                type: "generateChunk",
                frameno: null,
                chunkX: chunk.chunkX,
                chunkZ: chunk.chunkZ,
            })
        )
            chunk.isGenerating = true;
    }

    requestMesh(chunk) {
        //console.log("Requesting mesh", chunk.chunkX, chunk.chunkZ);
        if (
            this.meshBuffer.add(chunk, {
                type: "buildMesh",
                data: {
                    chunkData: {
                        grid: Array.from(chunk.grid.entries()),
                        size: chunk.size,
                        height: chunk.height,
                        chunkX: chunk.chunkX,
                        chunkZ: chunk.chunkZ,
                    },
                    //waterBlocks: chunk.waterBlocks,
                },
            })
        )
            chunk.isBuildingMesh = true;
    }

    onMeshCompleted(data) {
        const { chunkId, terrainMeshData, frameno } = data;
        const chunk = this.meshBuffer.pool[frameno].chunk;
        if (!chunk) {
            console.warn("Received mesh for unknown chunk:", chunkId);
            return;
        }
        this.pending.push({ chunk, data: terrainMeshData });
        this.scheduleMesh();
    }

    scheduleMesh() {
        if (this.processingMeshes) return;
        this.processingMeshes = true;

        requestIdleCallback(
            (deadline) => {
                while (deadline.timeRemaining() > 0 && this.pending.length > 0) {
                    const { chunk, data } = this.pending.shift();
                    if (chunk.mesh) {
                        this.chunkGroup.remove(chunk.mesh);
                    }
                    chunk.onMeshCompleted(data);
                    this.addChunkToScene(chunk);
                    this.pokeWorkers();
                }
                this.processingMeshes = false;
                if (this.pending.length > 0) {
                    this.scheduleMesh();
                }
            },
            { timeout: 50 }
        );
    }

    onChunkUpdated(data) {
        const chunk = this.terrainBuffer.pool[data.frameno].chunk;
        if (chunk) {
            chunk.updateFromWorker(data);
            if (this.activeChunks.has(chunk)) this.dirtyChunks.add(chunk);
        }
    }
    addChunkToScene(chunk) {
        if (this.activeChunks.has(chunk) && chunk.mesh) {
            //console.log("Adding chunk to scene", chunk.chunkX, chunk.chunkZ);
            this.chunkGroup.add(chunk.mesh);
        }
    }

    isSpawnAreaLoaded(playerX, playerZ) {
        const playerChunkX = Math.floor(playerX / this.chunkSize);
        const playerChunkZ = Math.floor(playerZ / this.chunkSize);

        const spawnRadius = Math.max(2, this.renderDistance - 1);

        for (let dx = -spawnRadius; dx <= spawnRadius; dx++) {
            for (let dz = -spawnRadius; dz <= spawnRadius; dz++) {
                if (Math.floor(Math.sqrt(dx * dx + dz * dz)) > spawnRadius) {
                    continue;
                }
                const chunkX = playerChunkX + dx;
                const chunkZ = playerChunkZ + dz;
                const chunk = this.getChunk(chunkX, chunkZ, false);

                if (!chunk || !chunk.isGenerated || !chunk.mesh) {
                    //console.log(dx, dz, !chunk.isGenerated, !chunk.mesh);
                    //console.log(chunk);
                    return false;
                }
            }
        }

        return true;
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

            //this.requestChunkGeneration(chunk);
        }

        return chunk;
    }

    getChunkBounds(chunk) {
        const worldX = chunk.chunkX * this.chunkSize;
        const worldZ = chunk.chunkZ * this.chunkSize;

        return new Box3(
            new Vector3(worldX, 0, worldZ),
            new Vector3(worldX + this.chunkSize, this.chunkHeight, worldZ + this.chunkSize)
        );
    }

    requestChunkGeneration(chunk) {
        const chunkId = `${chunk.chunkX},${chunk.chunkZ}`;
        if (!this.chunkWorker || !this.workersInitialized) {
            //console.warn("Error With Chunk:", chunkId);
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
        const { chunkX, chunkZ, localX, localY, localZ } = this.worldToChunkCoords(x, y, z);
        const chunk = this.getChunk(chunkX, chunkZ, false);
        return chunk ? chunk.getBlock(localX, localY, localZ) : -1;
    }

    setBlock(x, y, z, blockType) {
        const { chunkX, chunkZ, localX, localY, localZ } = this.worldToChunkCoords(x, y, z);
        const chunk = this.getChunk(chunkX, chunkZ, true);
        const chunkId = `${chunkX},${chunkZ}`;

        if (!chunk.isGenerated) {
            console.log(`chunk ${chunkId} not generated yet!`);
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
                const { chunkX: adjChunkX, chunkZ: adjChunkZ } = this.worldToChunkCoords(adjX, adjY, adjZ);
                const adjChunk = this.getChunk(adjChunkX, adjChunkZ, false);
                if (adjChunk) {
                    adjacentChunks.add(adjChunk);
                }
            }
        }

        if (blockType === null) {
            chunk.grid.delete(`${localX} ${localY} ${localZ}`);
        } else {
            chunk.grid.set(`${localX} ${localY} ${localZ}`, blockType);
            if (!this.TRANSPARENT_BLOCKS.has(blockType) && chunk.grid.get(`${localX} ${localY - 1} ${localZ}`) === 2) {
                chunk.grid.set(`${localX} ${localY - 1} ${localZ}`, 0);
            }
        }
        this.dirtyChunks.add(chunk);

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

    findSpawnLocation(x = 0, z = 0, objHeight = 2) {
        if (Math.abs(x) > 4 || Math.abs(z) > 4) return null;

        let chunk = this.getChunk(x, z, true);
        if (!chunk.isGenerated) return null;

        let spawn = chunk.findSpawnLocation(objHeight);
        if (spawn) return spawn;

        const offsets = [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1],
        ];
        for (const [dx, dz] of offsets) {
            spawn = this.findSpawnLocation(x + dx, z + dz, objHeight);
            if (spawn) return spawn;
        }

        return [8, 64, 8];
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
            for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
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

        this.sendToWorkers();

        this.pokeWorkers();
        this.enforceChunkLimit();

        this.updateDirtyChunks();
        if (this.camera) {
            this.cameraMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
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
                    //waterBlocks: chunk.waterBlocks,
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
            .filter((c) => !this.activeChunks.has(c) && !c.isGenerating && !c.isBuildingMesh)
            .sort((a, b) => a.lastAccessed - b.lastAccessed);

        const toRemove = sortedChunks.slice(0, this.chunks.size - this.maxLoadedChunks);
        //console.log(this.chunkGroup.children.length);
        for (const chunk of toRemove) {
            this.unloadChunk(chunk);
        }
    }

    unloadChunk(chunk) {
        if (chunk.isGenerating || chunk.isBuildingMesh) {
            return;
        }
        const key = `${chunk.chunkX},${chunk.chunkZ}`;
        //console.log(`unloading ${key}`);
        //console.log(this.terrainBuffer);
        delete this.terrainBuffer.pending[key];
        delete this.meshBuffer.pending[key];

        //this.terrainBuffer.searchAndDestroyChunk(key);
        // this.terrainBuffer.add(chunk, {
        //     type: "unloadChunk",
        //     chunkId: key,
        // });

        if (chunk.mesh) {
            chunk.disposeCurrentMesh();
        }

        this.chunks.delete(key);
    }

    dispose() {
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
