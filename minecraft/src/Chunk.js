import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from "three";

export class Chunk {
    constructor(chunkManager, chunkX, chunkZ, size = 16) {
        this.mgr = chunkManager;
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.size = size;
        this.height = this.mgr.chunkHeight;

        this.grid = new Map();
        this.waterBlocks = [];
        this.mesh = null;
        this.lastAccessed = Date.now();

        this.isGenerating = false;
        this.isGenerated = false;
        this.isBuildingMesh = false;
        this.isDirty = false;
    }

    setChunkData(workerData) {
        this.grid = new Map(workerData.grid);
        //this.waterBlocks = workerData.waterBlocks || [];
        this.lastAccessed = workerData.lastAccessed;
        this.isGenerated = true;
        this.isGenerating = false;
        this.isDirty = true;
    }

    updateFromWorker(workerData) {
        this.grid = new Map(workerData.grid);
        this.lastAccessed = workerData.lastAccessed;
        this.isDirty = true;
    }

    onMeshCompleted(terrainMeshData, waterMeshData) {
        this.isBuildingMesh = false;
        this.isDirty = false;

        if (this.mesh) {
            this.disposeCurrentMesh();
        }

        this.mesh = new Group();

        if (terrainMeshData && Object.keys(terrainMeshData).length > 0) {
            const meshes = Object.entries(terrainMeshData);
            for (let i = 0; i < meshes.length; i++) {
                if (meshes[i][1].positions.length === 0) return;
                const [blockType, face = "side"] = meshes[i][0].split("-");

                const geometry = new BufferGeometry();
                geometry.setAttribute("position", new Float32BufferAttribute(meshes[i][1].positions, 3));
                geometry.setAttribute("normal", new Float32BufferAttribute(meshes[i][1].normals, 3));
                geometry.setAttribute("uv", new Float32BufferAttribute(meshes[i][1].uvs, 2));
                geometry.setIndex(meshes[i][1].indices);

                let toUse;
                if (blockType == "water" || blockType == "leaf") {
                    toUse = this.getBlockMaterial(blockType, face);
                } else {
                    let depth = this.mgr.textureArray.getTextureDepth(blockType, face);
                    const textureLayer = Array(meshes[i][1].positions.length / 3).fill(depth);
                    geometry.setAttribute("depth", new Float32BufferAttribute(textureLayer, 1));
                    toUse = this.mgr.textureArray.material;
                }
                const mesh = new Mesh(geometry, toUse);
                this.mesh.add(mesh);
            }
        }
        this.update();
        //console.log(this.mesh);

        // if (waterMeshData && waterMeshData.positions.length > 0) {
        //     const waterGeometry = new BufferGeometry();
        //     waterGeometry.setAttribute("position", new Float32BufferAttribute(waterMeshData.positions, 3));
        //     waterGeometry.setAttribute("normal", new Float32BufferAttribute(waterMeshData.normals, 3));
        //     waterGeometry.setAttribute("uv", new Float32BufferAttribute(waterMeshData.uvs, 2));
        //     waterGeometry.setIndex(waterMeshData.indices);
        //     const waterMesh = new Mesh(waterGeometry, this.mgr.blockTable.water.texture.side);
        //     this.mesh.add(waterMesh);
        // }
        return this.mesh;
    }

    getBlockMaterial(blockType, face) {
        const blockData = this.mgr.blockTable[blockType];
        if (!blockData) return null;

        if (blockData.texture[face]) {
            return blockData.texture[face];
        }

        return blockData.texture.side || null;
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
        if (!this.isGenerated) return null;

        const attempts = 10;
        for (let i = 0; i < attempts; i++) {
            const x = Math.floor(Math.random() * (this.size - 2)) + 1;
            const z = Math.floor(Math.random() * (this.size - 2)) + 1;

            const y = this.getHighestBlock(x, z);
            if (y === -1) continue;

            const blockId = this.getBlock(x, y, z);
            if (blockId !== -1 && !this.mgr.TRANSPARENT_BLOCKS.has(blockId)) {
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

        return [8, 64, 8];
    }

    disposeCurrentMesh() {
        if (!this.mesh) return;

        if (this.mesh.children) {
            this.mesh.children.forEach((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat) => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }

        this.mesh = null;
    }

    activate() {
        if (this.isActive) return;
        this.isActive = true;
        this.lastAccessed = Date.now();
    }

    deactivate() {
        if (!this.isActive) return;
        this.isActive = false;
        this.disposeCurrentMesh();
    }

    update() {
        if (this.isActive) {
            this.lastAccessed = Date.now();
        }
    }
}
