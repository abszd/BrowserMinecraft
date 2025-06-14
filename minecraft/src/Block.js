import { FrontSide, DoubleSide } from "three";
import { shaderMaterial } from "./shaderHelper.js";

export class Block {
    constructor(id, name, properties = {}) {
        this.id = id;
        this.name = name;
        this.displayName = properties.displayName || name;
        this.transparent = properties.transparent || false;
        this.hardness = properties.hardness || 1.0;
        this.stackSize = properties.stackSize || 64;
        this.materialType = properties.materialType || "standard";
        this.textureFiles = properties.textureFiles || {};
        this.materialSide = properties.materialSide || FrontSide;
        this._currentRenderDistance = 0;
        this._currentRenderFade = 0;
    }

    static blocks = new Map();
    static blocksByName = new Map();
    static loadTexture = null;
    static _sharedMaterials = {};

    static initialize(loadTextureFunction) {
        Block.loadTexture = loadTextureFunction;
    }

    static register(block) {
        Block.blocks.set(block.id, block);
        Block.blocksByName.set(block.name, block);
    }

    static getById(id) {
        return Block.blocks.get(id);
    }

    static getByName(name) {
        return Block.blocksByName.get(name);
    }

    static getAllBlocks() {
        return Array.from(Block.blocks.values());
    }

    static createSharedMaterials(rd, rf) {
        Block._sharedMaterials.standard = shaderMaterial("shader.vs", "shader.fs", {
            side: FrontSide,
            uniforms: {
                colormap: { value: Block.loadTexture("textures/dirt.png") }, // Default texture
                renderDistance: { value: rd },
                renderFade: { value: rf },
            },
        });

        Block._sharedMaterials.leaf = shaderMaterial("leaf_shader.vs", "leaf_shader.fs", {
            side: FrontSide,
            transparent: true,
            uniforms: {
                colormap: { value: Block.loadTexture("textures/leaf.png") },
                time: { value: 0.0 },
                renderDistance: { value: rd },
                renderFade: { value: rf },
            },
        });

        Block._sharedMaterials.water = shaderMaterial("water_shader.vs", "water_shader.fs", {
            side: DoubleSide,
            uniforms: {
                colormap: {
                    value: Block.loadTexture("textures/water.png"),
                },
                time: { value: 0.0 },
                envMap: { value: null },
                level: { value: 0.0 },
                renderDistance: { value: rd },
                renderFade: { value: rf },
            },
            transparent: true,
            depthTest: true,
        });

        Block._sharedMaterials.slime = shaderMaterial("shader.vs", "leaf_shader.fs", {
            side: FrontSide,
            transparent: true,
            uniforms: {
                colormap: {
                    value: Block.loadTexture("textures/slime.png"),
                },
                renderDistance: { value: rd },
                renderFade: { value: rf },
            },
        });

        Block._sharedMaterials.grass_shader = shaderMaterial("shader.vs", "leaf_shader.fs", {
            side: FrontSide,
            uniforms: {
                colormap: {
                    value: Block.loadTexture("textures/grass_top.png"),
                },
                renderDistance: { value: rd },
                renderFade: { value: rf },
            },
        });
    }

    static getBlockTable(rd, rf) {
        // Create shared materials
        Block.createSharedMaterials(rd, rf);

        const blockTable = {};

        for (const [name, block] of Block.blocksByName) {
            const materials = block.getTextureMaterials();

            blockTable[name] = {
                transparent: block.transparent,
                texture: materials,
                guid: block.id,
                buid: 1,
                name: block.displayName,
            };
        }

        blockTable._materials = Block._sharedMaterials;

        return blockTable;
    }

    static updateRenderDistances(distance, fade) {
        Object.values(Block._sharedMaterials).forEach((material) => {
            if (material.uniforms) {
                if (material.uniforms.renderDistance) {
                    material.uniforms.renderDistance.value = distance;
                }
                if (material.uniforms.renderFade) {
                    material.uniforms.renderFade.value = fade;
                }
            }
        });

        for (const block of Block.blocks.values()) {
            block.updateMaterialUniforms(distance, fade);
        }
    }

    static updateTime(time) {
        if (Block._sharedMaterials.leaf && Block._sharedMaterials.leaf.uniforms.time) {
            Block._sharedMaterials.leaf.uniforms.time.value += time;
        }
        if (Block._sharedMaterials.water && Block._sharedMaterials.water.uniforms.time) {
            Block._sharedMaterials.water.uniforms.time.value += time;
        }
    }

    static setEnvironmentMap(envMap) {
        if (Block._sharedMaterials.water && Block._sharedMaterials.water.uniforms.envMap) {
            Block._sharedMaterials.water.uniforms.envMap.value = envMap;
        }
    }

    isTransparent() {
        return this.transparent;
    }

    getDisplayName() {
        return this.displayName;
    }

    getHardness() {
        return this.hardness;
    }

    getStackSize() {
        return this.stackSize;
    }

    getTextureMaterials() {
        const materials = {};

        materials.side = this.createMaterialForSide("side");

        if (this.textureFiles.top) {
            materials.top = this.createMaterialForSide("top");
        }

        if (this.textureFiles.bottom) {
            materials.bottom = this.createMaterialForSide("bottom");
        }

        return materials;
    }

    createMaterialForSide(side) {
        const baseMaterial = Block._sharedMaterials[this.materialType];

        if (!baseMaterial) {
            console.warn(`Material type '${this.materialType}' not found for block '${this.name}'`);
            return Block._sharedMaterials.standard;
        }

        if (!this.textureFiles[side]) {
            return baseMaterial;
        }

        const texture = Block.loadTexture(this.textureFiles[side]);

        const materialConfig = {
            side: this.materialSide,
            transparent: this.transparent,
            uniforms: {
                colormap: { value: texture },
                renderDistance: {
                    value: baseMaterial.uniforms?.renderDistance?.value || 0,
                },
                renderFade: {
                    value: baseMaterial.uniforms?.renderFade?.value || 0,
                },
            },
        };

        if (this.materialType === "leaf") {
            materialConfig.uniforms.time = {
                value: baseMaterial.uniforms?.time?.value || 0,
            };
            return shaderMaterial("leaf_shader.vs", "leaf_shader.fs", materialConfig);
        } else if (this.materialType === "water") {
            materialConfig.side = DoubleSide;
            materialConfig.depthTest = true;
            materialConfig.uniforms.time = {
                value: baseMaterial.uniforms?.time?.value || 0,
            };
            materialConfig.uniforms.envMap = {
                value: baseMaterial.uniforms?.envMap?.value || null,
            };
            materialConfig.uniforms.level = {
                value: baseMaterial.uniforms?.level?.value || 0,
            };
            return shaderMaterial("water_shader.vs", "water_shader.fs", materialConfig);
        } else {
            return shaderMaterial("shader.vs", "shader.fs", materialConfig);
        }
    }

    updateMaterialUniforms(distance, fade) {
        this._currentRenderDistance = distance;
        this._currentRenderFade = fade;
    }

    static initializeBlocks() {
        Block.blocks.clear();
        Block.blocksByName.clear();

        Block.register(
            new Block(0, "dirt", {
                displayName: "Dirt",
                transparent: true,
                materialType: "standard",
                textureFiles: {
                    side: "textures/dirt.png",
                },
            })
        );

        Block.register(
            new Block(1, "stone", {
                displayName: "Stone",
                hardness: 2.0,
                transparent: false,
                materialType: "standard",
                textureFiles: {
                    side: "textures/stone.png",
                },
            })
        );

        Block.register(
            new Block(2, "grass", {
                displayName: "Grass Block",
                transparent: false,
                materialType: "standard",
                textureFiles: {
                    side: "textures/grass_side.png",
                    top: "textures/grass_top_old.jpg",
                    bottom: "textures/dirt.png",
                },
            })
        );

        Block.register(
            new Block(3, "oak_log", {
                displayName: "Oak Log",
                transparent: false,
                materialType: "standard",
                textureFiles: {
                    side: "textures/oak_log.png",
                    top: "textures/oak_log_top.png",
                    bottom: "textures/oak_log_top.png",
                },
            })
        );

        Block.register(
            new Block(4, "leaf", {
                displayName: "Leaf",
                transparent: true,
                materialType: "leaf",
                textureFiles: {
                    side: "textures/leaf.png",
                },
            })
        );

        Block.register(
            new Block(5, "water", {
                displayName: "Water",
                transparent: true,
                materialType: "water",
                materialSide: DoubleSide,
                textureFiles: {
                    side: "textures/water.png",
                },
            })
        );

        console.log("Blocks initialized:", {
            total: Block.blocks.size,
        });
    }
}

// Export the getBlockTable function that replaces your old BlockTable.js
export function getBlockTable(rd, rf) {
    Block.initializeBlocks();
    return Block.getBlockTable(rd, rf);
}
