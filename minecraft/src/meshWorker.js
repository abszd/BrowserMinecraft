function workerLog(...args) {
    self.postMessage({
        type: "log",
        data: args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg))).join(" "),
    });
}
class MeshWorker {
    constructor() {
        this.TRANSPARENT_BLOCKS = new Set([-1, 4, 5]); // Air, Water, Leaves
        this.blockTable = null;
        this.idBlockTypeLookup = {};
    }

    initialize(blockTableData, transparentBlocks) {
        this.blockTable = blockTableData;
        this.TRANSPARENT_BLOCKS = new Set(transparentBlocks);
        this.idBlockTypeLookup = {};
        Object.entries(blockTableData).forEach(([key, value]) => {
            this.idBlockTypeLookup[value.guid] = key;
        });
    }

    createGreedyMesh(chunkData) {
        const { grid, size, height, chunkX, chunkZ } = chunkData;
        const worldOffsetX = chunkX * size;
        const worldOffsetZ = chunkZ * size;
        let rects = [];

        const chunkGrid = new Map(grid);
        for (let x = 0; x < size; x++) {
            const total = height * size;
            let maskE = new Int8Array(total);
            let maskW = new Int8Array(total);
            let maskN = new Int8Array(total);
            let maskS = new Int8Array(total);
            let found = false;
            for (let y = 0; y < height; y++) {
                for (let z = 0; z < size; z++) {
                    let blockId = chunkGrid.get(`${x} ${y} ${z}`);

                    const idx = y * size + z;
                    if (blockId !== undefined && blockId !== 5) {
                        found = true;
                        let neighbor = chunkGrid.get(`${x + 1} ${y} ${z}`) ?? -1;
                        if (this.TRANSPARENT_BLOCKS.has(neighbor) && blockId !== neighbor) {
                            maskE[idx] = blockId + 1;
                        }

                        neighbor = chunkGrid.get(`${x - 1} ${y} ${z}`) ?? -1;
                        if (this.TRANSPARENT_BLOCKS.has(neighbor) && blockId !== neighbor) {
                            maskW[idx] = blockId + 1;
                        }
                    }

                    blockId = chunkGrid.get(`${z} ${y} ${x}`);
                    if (blockId !== undefined && blockId !== 5) {
                        found = true;
                        let neighbor = chunkGrid.get(`${z} ${y} ${x + 1}`) ?? -1;
                        if (this.TRANSPARENT_BLOCKS.has(neighbor) && blockId !== neighbor) {
                            maskN[idx] = blockId + 1;
                        }

                        neighbor = chunkGrid.get(`${z} ${y} ${x - 1}`) ?? -1;
                        if (this.TRANSPARENT_BLOCKS.has(neighbor) && blockId !== neighbor) {
                            maskS[idx] = blockId + 1;
                        }
                    }
                }
            }
            if (!found) continue;

            rects.push(...this.getGreedySlice(maskE, height, size, 0, x, 0, worldOffsetX, worldOffsetZ));
            rects.push(...this.getGreedySlice(maskW, height, size, 0, x, 1, worldOffsetX, worldOffsetZ));
            rects.push(...this.getGreedySlice(maskN, height, size, 2, x, 0, worldOffsetX, worldOffsetZ));
            rects.push(...this.getGreedySlice(maskS, height, size, 2, x, 1, worldOffsetX, worldOffsetZ));
        }

        // Y-AXIS faces
        for (let y = 0; y < height; y++) {
            let maskU = new Int8Array(size * size);
            let maskD = new Int8Array(size * size);
            let found = false;
            for (let x = 0; x < size; x++) {
                for (let z = 0; z < size; z++) {
                    const idx = x * size + z;
                    const blockId = chunkGrid.get(`${x} ${y} ${z}`);

                    if (blockId !== undefined && blockId !== 5) {
                        found = true;
                        let neighbor = chunkGrid.get(`${x} ${y + 1} ${z}`) ?? -1;
                        if (this.TRANSPARENT_BLOCKS.has(neighbor) && blockId !== neighbor) {
                            maskU[idx] = blockId + 1;
                        }

                        neighbor = chunkGrid.get(`${x} ${y - 1} ${z}`) ?? -1;
                        if (this.TRANSPARENT_BLOCKS.has(neighbor) && blockId !== neighbor) {
                            maskD[idx] = blockId + 1;
                        }
                    }
                }
            }
            if (!found) continue;
            rects.push(...this.getGreedySlice(maskU, size, size, 1, y, 0, worldOffsetX, worldOffsetZ));
            rects.push(...this.getGreedySlice(maskD, size, size, 1, y, 1, worldOffsetX, worldOffsetZ));
        }

        return this.makeGreedyMeshData(rects);
    }

    getGreedySlice(slice, n, m, axis, pos, dir, worldOffsetX = 0, worldOffsetZ = 0) {
        const rectangles = [];

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < m; j++) {
                const block = slice[i * m + j];
                if (block <= 0) {
                    continue;
                }

                let rx1 = j,
                    rx2 = j;
                let ry1 = i,
                    ry2 = i;

                while (++rx2 < m && slice[i * m + rx2] === block) {}

                while (++ry2 < n) {
                    let same = true;
                    for (let rx = rx1; rx < rx2; rx++) {
                        if (slice[ry2 * m + rx] !== block) {
                            same = false;
                            break;
                        }
                    }
                    if (!same) {
                        break;
                    }
                }
                const blockType = this.idBlockTypeLookup[block - 1];
                if (blockType === undefined) continue;
                rectangles.push(
                    this.createRect(blockType, m, rx1, rx2, ry1, ry2, axis, pos, dir, worldOffsetX, worldOffsetZ)
                );
                for (let i = ry1; i < ry2; i++) {
                    for (let j = rx1; j < rx2; j++) {
                        slice[i * m + j] = 0;
                    }
                }
            }
        }
        return rectangles;
    }

    createRect(blockType, m, x1, x2, y1, y2, axis, pos, dir, worldOffsetX = 0, worldOffsetZ = 0) {
        let vertices, normal, uvs;
        const width = x2 - x1;
        const height = y2 - y1;

        let face = "side";
        if (axis === 1) {
            face = dir === 0 ? "top" : "bottom";
        }

        if (axis === 0) {
            // X-axis
            const x = worldOffsetX + pos + 1 - dir;
            vertices =
                dir == 1
                    ? [
                          x,
                          y1,
                          worldOffsetZ + x1,
                          x,
                          y1,
                          worldOffsetZ + x2,
                          x,
                          y2,
                          worldOffsetZ + x2,
                          x,
                          y2,
                          worldOffsetZ + x1,
                      ]
                    : [
                          x,
                          y1,
                          worldOffsetZ + x2,
                          x,
                          y1,
                          worldOffsetZ + x1,
                          x,
                          y2,
                          worldOffsetZ + x1,
                          x,
                          y2,
                          worldOffsetZ + x2,
                      ];
            normal = dir === 0 ? [1, 0, 0] : [-1, 0, 0];
            uvs = [0, 0, width, 0, width, height, 0, height];
        } else if (axis === 1) {
            // Y-axis
            const y = pos + 1 - dir;
            vertices =
                dir == 1
                    ? [
                          worldOffsetX + y1,
                          y,
                          worldOffsetZ + x1,
                          worldOffsetX + y2,
                          y,
                          worldOffsetZ + x1,
                          worldOffsetX + y2,
                          y,
                          worldOffsetZ + x2,
                          worldOffsetX + y1,
                          y,
                          worldOffsetZ + x2,
                      ]
                    : [
                          worldOffsetX + y2,
                          y,
                          worldOffsetZ + x1,
                          worldOffsetX + y1,
                          y,
                          worldOffsetZ + x1,
                          worldOffsetX + y1,
                          y,
                          worldOffsetZ + x2,
                          worldOffsetX + y2,
                          y,
                          worldOffsetZ + x2,
                      ];
            normal = dir === 1 ? [0, -1, 0] : [0, 1, 0];
            uvs = [0, 0, height, 0, height, width, 0, width];
        } else {
            // Z-axis
            const z = worldOffsetZ + pos + 1 - dir;
            vertices =
                dir == 0
                    ? [
                          worldOffsetX + x1,
                          y1,
                          z,
                          worldOffsetX + x2,
                          y1,
                          z,
                          worldOffsetX + x2,
                          y2,
                          z,
                          worldOffsetX + x1,
                          y2,
                          z,
                      ]
                    : [
                          worldOffsetX + x2,
                          y1,
                          z,
                          worldOffsetX + x1,
                          y1,
                          z,
                          worldOffsetX + x1,
                          y2,
                          z,
                          worldOffsetX + x2,
                          y2,
                          z,
                      ];
            normal = dir === 0 ? [0, 0, 1] : [0, 0, -1];
            uvs = [0, 0, width, 0, width, height, 0, height];
        }

        const normals = [];
        for (let i = 0; i < 4; i++) {
            normals.push(...normal);
        }

        const meshKey = `${blockType}-${face}`;

        return {
            vertices: vertices,
            normals: normals,
            uvs: uvs,
            blockType: blockType,
            face: face,
            meshKey: meshKey,
        };
    }

    makeGreedyMeshData(rectangles) {
        if (rectangles.length === 0) {
            return {};
        }

        const rectsByMeshKey = {};

        for (const rect of rectangles) {
            const meshKey = rect.meshKey;
            if (!meshKey) continue;

            if (!rectsByMeshKey[meshKey]) {
                rectsByMeshKey[meshKey] = [];
            }
            rectsByMeshKey[meshKey].push(rect);
        }

        const meshDataByKey = {};

        for (const [meshKey, rects] of Object.entries(rectsByMeshKey)) {
            const positions = [];
            const normals = [];
            const uvs = [];
            const indices = [];
            let vertexOffset = 0;

            for (const rect of rects) {
                if (
                    !rect.vertices ||
                    rect.vertices.length !== 12 ||
                    !rect.normals ||
                    rect.normals.length !== 12 ||
                    !rect.uvs ||
                    rect.uvs.length !== 8
                ) {
                    continue;
                }

                positions.push(...rect.vertices);
                normals.push(...rect.normals);
                uvs.push(...rect.uvs);

                indices.push(
                    vertexOffset,
                    vertexOffset + 1,
                    vertexOffset + 2,
                    vertexOffset,
                    vertexOffset + 2,
                    vertexOffset + 3
                );
                vertexOffset += 4;
            }

            if (positions.length === 0) continue;

            meshDataByKey[meshKey] = {
                positions: positions,
                normals: normals,
                uvs: uvs,
                indices: indices,
            };
        }

        return meshDataByKey;
    }

    buildWaterMesh(waterBlocks, chunkX, chunkZ, size) {
        if (waterBlocks.length === 0) return null;

        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        let vertexOffset = 0;

        for (const block of waterBlocks) {
            const worldX = block.x + chunkX * size + 0.5;
            const worldY = block.y + 0.5;
            const worldZ = block.z + chunkZ * size + 0.5;

            if (block.isTopWater) {
                positions.push(
                    worldX - 0.5,
                    worldY + 0.425,
                    worldZ - 0.5,
                    worldX + 0.5,
                    worldY + 0.425,
                    worldZ - 0.5,
                    worldX + 0.5,
                    worldY + 0.425,
                    worldZ + 0.5,
                    worldX - 0.5,
                    worldY + 0.425,
                    worldZ + 0.5
                );

                normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);

                uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

                indices.push(
                    vertexOffset,
                    vertexOffset + 1,
                    vertexOffset + 2,
                    vertexOffset,
                    vertexOffset + 2,
                    vertexOffset + 3
                );
                vertexOffset += 4;
            }
        }

        if (positions.length === 0) return null;

        return {
            positions: positions,
            normals: normals,
            uvs: uvs,
            indices: indices,
        };
    }
}

const meshWorker = new MeshWorker();

self.onmessage = function (e) {
    const { type, data } = e.data;

    try {
        switch (type) {
            case "initialize":
                meshWorker.initialize(data.blockTable, data.transparentBlocks);
                self.postMessage({ type: "initialized", success: true });
                break;

            case "buildMesh":
                const { chunkData, waterBlocks } = data;

                const terrainMeshData = meshWorker.createGreedyMesh(chunkData);

                const waterMeshData =
                    waterBlocks && waterBlocks.length > 0
                        ? meshWorker.buildWaterMesh(waterBlocks, chunkData.chunkX, chunkData.chunkZ, chunkData.size)
                        : null;

                self.postMessage({
                    type: "meshCompleted",
                    data: {
                        chunkId: `${chunkData.chunkX},${chunkData.chunkZ}`,
                        terrainMeshData: terrainMeshData,
                        waterMeshData: waterMeshData,
                    },
                });
                break;

            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        self.postMessage({
            type: "error",
            error: error.message,
            stack: error.stack,
        });
    }
};
