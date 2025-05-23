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

    getBlock(grid, x, y, z) {
        const key = `${x} ${y} ${z}`;
        const blockId = grid.get(key);
        return blockId === undefined ? -1 : blockId;
    }

    createGreedyMesh(chunkData) {
        const { grid, size, height, chunkX, chunkZ } = chunkData;
        const worldOffsetX = chunkX * size;
        const worldOffsetZ = chunkZ * size;
        let rects = [];

        const chunkGrid = new Map(grid);

        // X-AXIS faces
        for (let x = 0; x < size; x++) {
            let maskE = Array(height)
                .fill()
                .map(() => Array(size).fill(-1));
            let maskW = Array(height)
                .fill()
                .map(() => Array(size).fill(-1));

            for (let y = 0; y < height; y++) {
                for (let z = 0; z < size; z++) {
                    const blockId = this.getBlock(chunkGrid, x, y, z);

                    if (blockId !== -1 && blockId !== 5) {
                        let neighbor =
                            x === size - 1
                                ? -1
                                : this.getBlock(chunkGrid, x + 1, y, z);
                        if (
                            this.TRANSPARENT_BLOCKS.has(neighbor) &&
                            blockId !== neighbor
                        ) {
                            maskE[y][z] = blockId;
                        }

                        neighbor =
                            x === 0
                                ? -1
                                : this.getBlock(chunkGrid, x - 1, y, z);
                        if (
                            this.TRANSPARENT_BLOCKS.has(neighbor) &&
                            blockId !== neighbor
                        ) {
                            maskW[y][z] = blockId;
                        }
                    }
                }
            }

            rects.push(
                ...this.getGreedySlice(
                    maskE,
                    0,
                    x,
                    0,
                    worldOffsetX,
                    worldOffsetZ
                )
            );
            rects.push(
                ...this.getGreedySlice(
                    maskW,
                    0,
                    x,
                    1,
                    worldOffsetX,
                    worldOffsetZ
                )
            );
        }

        // Z-AXIS faces
        for (let z = 0; z < size; z++) {
            let maskN = Array(height)
                .fill()
                .map(() => Array(size).fill(-1));
            let maskS = Array(height)
                .fill()
                .map(() => Array(size).fill(-1));

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < size; x++) {
                    const blockId = this.getBlock(chunkGrid, x, y, z);

                    if (blockId !== -1 && blockId !== 5) {
                        let neighbor =
                            z === size - 1
                                ? -1
                                : this.getBlock(chunkGrid, x, y, z + 1);
                        if (
                            this.TRANSPARENT_BLOCKS.has(neighbor) &&
                            blockId !== neighbor
                        ) {
                            maskN[y][x] = blockId;
                        }

                        neighbor =
                            z === 0
                                ? -1
                                : this.getBlock(chunkGrid, x, y, z - 1);
                        if (
                            this.TRANSPARENT_BLOCKS.has(neighbor) &&
                            blockId !== neighbor
                        ) {
                            maskS[y][x] = blockId;
                        }
                    }
                }
            }

            rects.push(
                ...this.getGreedySlice(
                    maskN,
                    2,
                    z,
                    0,
                    worldOffsetX,
                    worldOffsetZ
                )
            );
            rects.push(
                ...this.getGreedySlice(
                    maskS,
                    2,
                    z,
                    1,
                    worldOffsetX,
                    worldOffsetZ
                )
            );
        }

        // Y-AXIS faces
        for (let y = 0; y < height; y++) {
            let maskU = Array(size)
                .fill()
                .map(() => Array(size).fill(-1));
            let maskD = Array(size)
                .fill()
                .map(() => Array(size).fill(-1));

            for (let x = 0; x < size; x++) {
                for (let z = 0; z < size; z++) {
                    const blockId = this.getBlock(chunkGrid, x, y, z);

                    if (blockId !== -1 && blockId !== 5) {
                        const upperNeighbor = this.getBlock(
                            chunkGrid,
                            x,
                            y + 1,
                            z
                        );
                        if (
                            this.TRANSPARENT_BLOCKS.has(upperNeighbor) &&
                            blockId !== upperNeighbor
                        ) {
                            maskU[x][z] = blockId;
                        }

                        const lowerNeighbor = this.getBlock(
                            chunkGrid,
                            x,
                            y - 1,
                            z
                        );
                        if (
                            this.TRANSPARENT_BLOCKS.has(lowerNeighbor) &&
                            blockId !== lowerNeighbor
                        ) {
                            maskD[x][z] = blockId;
                        }
                    }
                }
            }

            rects.push(
                ...this.getGreedySlice(
                    maskU,
                    1,
                    y,
                    0,
                    worldOffsetX,
                    worldOffsetZ
                )
            );
            rects.push(
                ...this.getGreedySlice(
                    maskD,
                    1,
                    y,
                    1,
                    worldOffsetX,
                    worldOffsetZ
                )
            );
        }

        return this.makeGreedyMeshData(rects);
    }

    getGreedySlice(slice, axis, pos, dir, worldOffsetX = 0, worldOffsetZ = 0) {
        let n = slice.length;
        let m = slice[0].length;
        let rectangles = [];

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < m; j++) {
                if (slice[i][j] == -1) {
                    continue;
                }

                let block = slice[i][j];
                let rx1 = j,
                    rx2 = j;
                let ry1 = i,
                    ry2 = i;

                while (++rx2 < m && slice[i][rx2] === block) {}

                while (++ry2 < n) {
                    let same = true;
                    for (let rx = rx1; rx < rx2; rx++) {
                        if (slice[ry2][rx] !== block) {
                            same = false;
                            break;
                        }
                    }
                    if (!same) {
                        break;
                    }
                }

                rectangles.push(
                    this.createRect(
                        slice,
                        rx1,
                        rx2,
                        ry1,
                        ry2,
                        axis,
                        pos,
                        dir,
                        worldOffsetX,
                        worldOffsetZ
                    )
                );
            }
        }
        return rectangles;
    }

    createRect(
        slice,
        x1,
        x2,
        y1,
        y2,
        axis,
        pos,
        dir,
        worldOffsetX = 0,
        worldOffsetZ = 0
    ) {
        const blockType = this.idBlockTypeLookup[slice[y1][x1]];
        let vertices, normal, uvs;
        const width = x2 - x1;
        const height = y2 - y1;

        for (let i = y1; i < y2; i++) {
            for (let j = x1; j < x2; j++) {
                slice[i][j] = -1;
            }
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

        let actualBlockType = blockType;
        if (blockType === "grass" && axis === 1) {
            actualBlockType = dir === 0 ? "grass_top" : "dirt";
        }

        return {
            vertices: vertices,
            normals: normals,
            uvs: uvs,
            blockType: actualBlockType,
        };
    }

    makeGreedyMeshData(rectangles) {
        if (rectangles.length === 0) {
            return {};
        }

        const rectsByType = {};

        for (const rect of rectangles) {
            const blockType = rect.blockType;
            if (!blockType || !this.blockTable[blockType]) {
                continue;
            }

            if (!rectsByType[blockType]) {
                rectsByType[blockType] = [];
            }
            rectsByType[blockType].push(rect);
        }

        const meshDataByType = {};

        for (const [blockType, rects] of Object.entries(rectsByType)) {
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

            meshDataByType[blockType] = {
                positions: positions,
                normals: normals,
                uvs: uvs,
                indices: indices,
            };
        }

        return meshDataByType;
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
                        ? meshWorker.buildWaterMesh(
                              waterBlocks,
                              chunkData.chunkX,
                              chunkData.chunkZ,
                              chunkData.size
                          )
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
