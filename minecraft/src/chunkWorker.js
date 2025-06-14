import { SplineCurve, Vector2 } from "three";

function workerLog(...args) {
    self.postMessage({
        type: "log",
        data: args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg))).join(" "),
    });
}
class ChunkWorker {
    constructor() {
        this.chunks = new Map();
        this.blockTable = null;
        this.worldSeed = 69420;
        this._globalPerm = null;
        this.continentalSpline = new SplineCurve([
            new Vector2(0, 0.01),
            new Vector2(0.1, 0.1),
            new Vector2(0.25, 0.1),
            new Vector2(0.5, 0.3),
            new Vector2(0.65, 0.4),
            new Vector2(0.7, 0.6),
            new Vector2(0.8, 0.85),
            new Vector2(1, 0.5),
        ]);
    }

    initialize(params) {
        this.worldSeed = params.worldSeed;
        this.blockTable = params.blockTable;
        this.amplitude = params.amplitude;
        this.chunkSize = params.chunkSize;
        this.chunkHeight = params.chunkHeight;
        this.TRANSPARENT_BLOCKS = new Set(params.transparentBlocks);
    }

    generateChunk(chunkX, chunkZ) {
        const chunk = new WorkerChunk(this, chunkX, chunkZ);

        chunk.generateTerrain();
        chunk.createTrees();
        chunk.buildLakes();

        const chunkId = `${chunkX},${chunkZ}`;
        this.chunks.set(chunkId, chunk);

        return {
            chunkId: chunkId,
            chunkX: chunkX,
            chunkZ: chunkZ,
            grid: Array.from(chunk.grid.entries()),
            waterBlocks: chunk.waterBlocks,
            size: chunk.size,
            height: chunk.height,
            lastAccessed: chunk.lastAccessed,
        };
    }

    updateBlock(chunkId, x, y, z, blockType, updateWaterMesh = false) {
        const chunk = this.chunks.get(chunkId);
        if (!chunk) return null;

        chunk.setBlock(x, y, z, blockType);

        if (updateWaterMesh) {
            chunk.buildLakes();
        }

        return {
            chunkId: chunkId,
            grid: Array.from(chunk.grid.entries()),
            waterBlocks: chunk.waterBlocks,
            lastAccessed: chunk.lastAccessed,
        };
    }

    getBlock(chunkId, x, y, z) {
        const chunk = this.chunks.get(chunkId);
        return chunk ? chunk.getBlock(x, y, z) : -1;
    }

    findSpawnLocation(chunkId, objHeight = 2) {
        const chunk = this.chunks.get(chunkId);
        return chunk ? chunk.findSpawnLocation(objHeight) : null;
    }

    unloadChunk(chunkId) {
        this.chunks.delete(chunkId);
    }

    generatePermTable(seed) {
        const perm = new Array(512);
        let value = seed;
        const nextRandom = () => {
            value = (value * 1664525 + 1013904223) % 4294967296;
            return value / 4294967296;
        };

        for (let i = 0; i < 256; i++) {
            perm[i] = Math.floor(nextRandom() * 256);
            perm[i + 256] = perm[i];
        }

        return perm;
    }
}

class WorkerChunk {
    constructor(worker, chunkX, chunkZ) {
        this.worker = worker;
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.size = worker.chunkSize;
        this.height = worker.chunkHeight;
        this.grid = new Map();
        this.waterBlocks = [];
        this.lastAccessed = Date.now();
        this.waterLevel = Math.floor(this.worker.amplitude / 3);
        this.TRANSPARENT_BLOCKS = new Set([-1, 4, 5]);
        this.CSpline = new SplineCurve([new Vector2(0, 0), new Vector2(0.75, 0.25), new Vector2(1, 1)]);
        this.MVSpline = new SplineCurve([
            new Vector2(0, 0.1),
            new Vector2(0.1, 0.2),
            new Vector2(0.2, 0.6),
            new Vector2(0.4, 0.2),
            new Vector2(0.5, 1),
            new Vector2(0.75, 0.6),
            new Vector2(1, 0.6),
        ]);
        this.PVSpline = new SplineCurve([
            new Vector2(0, 0.0),
            new Vector2(0.43, 0.2),
            new Vector2(0.8, 1),
            new Vector2(0.83, 0.7),
            new Vector2(1, 0.7),
        ]);
    }

    generateTerrain() {
        const heightCache = new Map();
        //workerLog(this.worker.amplitude, this.waterLevel);
        const stoneSlope = 2.5;
        const dirtSlope = 1.5;

        for (let localX = -1; localX <= this.size; localX++) {
            for (let localZ = -1; localZ <= this.size; localZ++) {
                const worldX = localX + this.chunkX * this.size;
                const worldZ = localZ + this.chunkZ * this.size;
                heightCache.set(`${localX},${localZ}`, this.generateHeightAt(worldX, worldZ));
            }
        }

        for (let localX = 0; localX < this.size; localX++) {
            for (let localZ = 0; localZ < this.size; localZ++) {
                const height = heightCache.get(`${localX},${localZ}`);

                const heightR = heightCache.get(`${localX + 1},${localZ}`) || height;
                const heightF = heightCache.get(`${localX},${localZ + 1}`) || height;
                const heightL = heightCache.get(`${localX - 1},${localZ}`) || height;
                const heightB = heightCache.get(`${localX},${localZ - 1}`) || height;
                const gradientX = (heightR - heightL) / 2.0;
                const gradientZ = (heightF - heightB) / 2.0;

                const slope = (gradientX + gradientZ) / 2;

                for (let y = 0; y < height; y++) {
                    let blockType;
                    if (y < height - 4) {
                        blockType = 1; // Stone (deep)
                    } else if (y - this.waterLevel <= 1) {
                        blockType = 7;
                    } else if (y < height - 1) {
                        if (slope > dirtSlope) {
                            blockType = 1;
                        } else {
                            blockType = 0;
                        }
                    } else {
                        if (slope < dirtSlope) {
                            blockType = 2;
                        } else if (slope < stoneSlope) {
                            blockType = 0;
                        } else {
                            blockType = 1;
                        }
                        //if (Math.pow(y / this.worker.amplitude, 4) > Math.random()) blockType = 0;
                    }
                    this.setBlock(localX, y, localZ, blockType);
                }
            }
        }
    }

    generateHeightAt(worldX, worldZ) {
        const baseFreq = 0.003;
        let continentalNoise = this.getNoise(3, baseFreq, 0.5, worldX, worldZ);
        let mountainValleyNoise = this.getNoise(3, baseFreq * 2, 0.5, worldX, worldZ);
        let peakNoise = this.getNoise(3, 0.03, 0.5, worldX, worldZ);

        const cHeight = this.CSpline.getPoint(continentalNoise).y;
        const mvHeight = this.MVSpline.getPoint(mountainValleyNoise).y;
        const pvHeight = this.PVSpline.getPoint(peakNoise).y;

        const base = cHeight;
        const mountain = base + mvHeight * cHeight;
        const peaks = mountain + pvHeight * mvHeight * cHeight;
        const final = peaks * this.worker.amplitude;

        return Math.min(this.worker.chunkHeight, final);
    }

    getNoise(octaves, freq, amplitudeDif, worldX, worldZ) {
        let total = 0;
        let frequency = freq;
        let maxAmplitude = 0;
        let currentAmplitude = 1;

        for (let i = 0; i < octaves; i++) {
            const noiseValue = this.perlin2d(worldX * frequency, worldZ * frequency);
            total += noiseValue * currentAmplitude;
            maxAmplitude += currentAmplitude;
            frequency *= 2;
            currentAmplitude *= amplitudeDif;
        }
        return (total / maxAmplitude + 1) / 2;
    }

    perlin2d(x, z) {
        if (!this.worker._globalPerm) {
            this.worker._globalPerm = this.worker.generatePermTable(this.worker.worldSeed);
        }
        this._perm = this.worker._globalPerm;

        const gradients = [
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ];

        const grad = (h, x, y) => {
            const grad = gradients[h & 7];
            return grad[0] * x + grad[1] * y;
        };

        const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
        const lerp = (a, b, t) => a + t * (b - a);

        const X = Math.floor(x) & 255;
        const Z = Math.floor(z) & 255;
        const x_frac = x - Math.floor(x);
        const z_frac = z - Math.floor(z);
        const u = fade(x_frac);
        const v = fade(z_frac);

        const A = this._perm[X] + Z;
        const B = this._perm[X + 1] + Z;
        const AA = this._perm[A];
        const AB = this._perm[A + 1];
        const BA = this._perm[B];
        const BB = this._perm[B + 1];

        const g1 = grad(this._perm[AA], x_frac, z_frac);
        const g2 = grad(this._perm[BA], x_frac - 1, z_frac);
        const g3 = grad(this._perm[AB], x_frac, z_frac - 1);
        const g4 = grad(this._perm[BB], x_frac - 1, z_frac - 1);

        const x1 = lerp(g1, g2, u);
        const x2 = lerp(g3, g4, u);
        return lerp(x1, x2, v);
    }

    createTrees() {
        const treeChance = 0.01;

        for (let x = 2; x < this.size - 2; x++) {
            for (let z = 2; z < this.size - 2; z++) {
                const y = this.getHighestBlock(x, z);
                if (y === -1 || y <= this.waterLevel) continue;

                const blockId = this.getBlock(x, y, z);
                if (blockId === 2) {
                    if (Math.random() < treeChance) {
                        this.buildTree(x, y, z);
                    }
                }
            }
        }
    }

    buildTree(x, y, z) {
        const treeHeight = 5 + Math.floor(Math.random() * 4);

        for (let i = 1; i <= treeHeight; i++) {
            if (y + i >= this.height) break;
            this.setBlock(x, y + i, z, 3);
        }

        const leafStart = Math.max(3, treeHeight - 3);
        const leafTop = treeHeight + 1;

        for (let ly = leafStart; ly <= leafTop; ly++) {
            let radius = 2;
            if (ly === leafTop) radius = 1;

            for (let lx = -radius; lx <= radius; lx++) {
                for (let lz = -radius; lz <= radius; lz++) {
                    if (Math.abs(lx) === 2 && Math.abs(lz) === 2) continue;
                    if (lx === 0 && lz === 0 && ly !== leafTop) continue;

                    const worldX = x + lx;
                    const worldZ = z + lz;

                    if (
                        worldX >= 0 &&
                        worldX < this.size &&
                        worldZ >= 0 &&
                        worldZ < this.size &&
                        y + ly < this.height
                    ) {
                        if (this.getBlock(worldX, y + ly, worldZ) === -1) {
                            this.setBlock(worldX, y + ly, worldZ, 4);
                        }
                    }
                }
            }
        }
    }

    buildLakes() {
        this.waterBlocks = [];

        for (let x = 0; x < this.size; x++) {
            for (let z = 0; z < this.size; z++) {
                for (let y = 0; y < this.height; y++) {
                    const blockId = this.getBlock(x, y, z);
                    if (blockId === 5) {
                        const blockAbove = this.getBlock(x, y + 1, z);
                        const isTopWater = blockAbove !== 5;

                        this.waterBlocks.push({ x, y, z, isTopWater });
                    }
                    if (y >= 3 && y <= this.waterLevel && blockId === -1) {
                        this.setBlock(x, y, z, 5);
                        const isTopWater = y === this.waterLevel;
                        this.waterBlocks.push({ x, y, z, isTopWater });
                    }
                }
            }
        }
    }

    setBlock(x, y, z, blockType) {
        this.lastAccessed = Date.now();
        const key = `${x} ${y} ${z}`;

        if (blockType === -1 || blockType === null) {
            this.grid.delete(key);
        } else {
            this.grid.set(key, blockType);
            if (this.grid.get(`${x} ${y - 1} ${z}`) === 2 && !this.TRANSPARENT_BLOCKS.has(blockType)) {
                this.grid.set(`${x} ${y - 1} ${z}`, 0);
            }
        }
    }

    getBlock(x, y, z) {
        this.lastAccessed = Date.now();
        const blockId = this.grid.get(`${x} ${y} ${z}`);
        return blockId === undefined ? -1 : blockId;
    }

    getHighestBlock(x, z) {
        for (let y = this.height - 1; y >= 0; y--) {
            if (this.getBlock(x, y, z) !== -1) {
                return y;
            }
        }
        return -1;
    }

    findSpawnLocation(objHeight = 2) {
        const attempts = 100;

        for (let i = 0; i < attempts; i++) {
            const x = Math.floor(Math.random() * (this.size - 2)) + 1;
            const z = Math.floor(Math.random() * (this.size - 2)) + 1;

            const y = this.getHighestBlock(x, z);
            if (y === -1) continue;

            const blockId = this.getBlock(x, y, z);
            if (blockId !== -1 && !this.worker.TRANSPARENT_BLOCKS.has(blockId)) {
                let hasSpace = true;
                for (let j = 1; j <= objHeight; j++) {
                    if (this.getBlock(x, y + j, z) !== -1) {
                        hasSpace = false;
                        break;
                    }
                }

                if (hasSpace) {
                    return [x + this.chunkX * this.size + 0.5, y + objHeight / 2, z + this.chunkZ * this.size + 0.5];
                }
            }
        }

        return [this.chunkX * this.size + this.size / 2, this.height / 2, this.chunkZ * this.size + this.size / 2];
    }
}

const chunkWorker = new ChunkWorker();

self.onmessage = function (e) {
    const { type, chunkX, chunkZ, params, chunkId, x, y, z, blockType, objHeight } = e.data;

    try {
        switch (type) {
            case "initialize":
                chunkWorker.initialize(params);
                self.postMessage({
                    type: "initialized",
                    success: true,
                });
                break;

            case "generateChunk":
                const chunkData = chunkWorker.generateChunk(chunkX, chunkZ);
                self.postMessage({
                    type: "chunkGenerated",
                    data: chunkData,
                });
                break;

            case "updateBlock":
                const updatedData = chunkWorker.updateBlock(chunkId, x, y, z, blockType, e.data.updateWaterMesh);
                if (updatedData) {
                    self.postMessage({
                        type: "chunkUpdated",
                        data: updatedData,
                    });
                }
                break;

            case "getBlock":
                const blockId = chunkWorker.getBlock(chunkId, x, y, z);
                self.postMessage({
                    type: "blockResult",
                    chunkId: chunkId,
                    blockId: blockId,
                });
                break;

            case "findSpawn":
                const spawnLocation = chunkWorker.findSpawnLocation(chunkId, objHeight);
                self.postMessage({
                    type: "spawnFound",
                    chunkId: chunkId,
                    location: spawnLocation,
                });
                break;

            case "unloadChunk":
                chunkWorker.unloadChunk(chunkId);
                self.postMessage({
                    type: "chunkUnloaded",
                    chunkId: chunkId,
                });
                break;

            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        self.postMessage({
            type: "error",
            chunkId: chunkId,
            error: error.message,
            stack: error.stack,
        });
    }
};
