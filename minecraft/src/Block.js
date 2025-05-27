import {
    LinearMipMapLinearFilter,
    NearestFilter,
    RepeatWrapping,
    TextureLoader,
} from "three";

export class Block {
    constructor(id, name, properties = {}) {
        this.id = id;
        this.name = name;
        this.displayName = properties.displayName || name;
        this.transparent = properties.transparent || false;
        this.hardness = properties.hardness || 1.0;
        this.stackSize = properties.stackSize || 64;
        this.uvCoords = properties.uvCoords || {
            x: 0,
            y: 0,
            width: 16,
            height: 16,
        };
        this.sides = properties.sides || {};
    }

    static blocks = new Map();
    static blocksByName = new Map();
    static atlasTexture = null;
    static atlasSize = { width: 48, height: 336 };

    static atlasConfig = {
        tileSize: 16,
        padding: 16,
    };

    static atlasCoordToUV(atlasX, atlasY) {
        const { tileSize, padding } = Block.atlasConfig;
        return {
            x: atlasX * (tileSize + padding * 2) + padding,
            y: atlasY * (tileSize + padding * 2) + padding,
            width: tileSize,
            height: tileSize,
        };
    }

    static createSides(coords) {
        const sides = {};
        for (const [side, coord] of Object.entries(coords)) {
            sides[side] = Block.atlasCoordToUV(coord.x, coord.y);
        }
        return sides;
    }

    static loadAtlas(atlasPath = "textures/atlas.png", loadingManager) {
        const loader = new TextureLoader(loadingManager);

        const texture = loader.load(
            atlasPath,
            (texture) => {
                texture.magFilter = NearestFilter;
                texture.minFilter = LinearMipMapLinearFilter;
                texture.wrapS = RepeatWrapping;
                texture.wrapT = RepeatWrapping;
                texture.generateMipmaps = true;
                Block.atlasTexture = texture;
                console.log("Atlas loaded successfully:", Block.atlasTexture);
            },
            undefined,
            (error) => {
                console.error("Failed to load atlas:", error);
            }
        );

        return texture;
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

    isTransparent() {
        return this.transparent;
    }

    getDisplayName() {
        return this.displayName;
    }

    getUVCoords(side = "default") {
        if (this.sides && this.sides[side]) {
            return this.sides[side];
        }
        return this.uvCoords;
    }

    getIcon() {
        return (
            this.getUVCoords("icon") || this.getUVCoords("top") || this.uvCoords
        );
    }

    getHardness() {
        return this.hardness;
    }

    getStackSize() {
        return this.stackSize;
    }

    getAtlasTexture() {
        return Block.atlasTexture;
    }

    getNormalizedUV(side = "default") {
        const coords = this.getUVCoords(side);
        return {
            u: coords.x / Block.atlasSize.width,
            v: coords.y / Block.atlasSize.height,
            uWidth: coords.width / Block.atlasSize.width,
            vHeight: coords.height / Block.atlasSize.height,
        };
    }

    static initializeBlocks() {
        Block.blocks.clear();
        Block.blocksByName.clear();

        const atlasLayout = {
            dirt: { x: 0, y: 5 },
            grass_top: { x: 0, y: 3 },
            stone: { x: 0, y: 0 },
            grass_side: { x: 0, y: 4 },
            oak_log_side: { x: 1, y: 1 },
            oak_log_top: { x: 0, y: 1 },
            leaf: { x: 0, y: 6 },
            water: { x: 1, y: 3 },
        };

        Block.register(
            new Block(0, "dirt", {
                displayName: "Dirt",
                uvCoords: Block.atlasCoordToUV(
                    atlasLayout.dirt.x,
                    atlasLayout.dirt.y
                ),
            })
        );

        Block.register(
            new Block(1, "stone", {
                displayName: "Stone",
                hardness: 2.0,
                uvCoords: Block.atlasCoordToUV(
                    atlasLayout.stone.x,
                    atlasLayout.stone.y
                ),
            })
        );

        Block.register(
            new Block(2, "grass", {
                displayName: "Grass Block",
                uvCoords: Block.atlasCoordToUV(
                    atlasLayout.grass_side.x,
                    atlasLayout.grass_side.y
                ),
                sides: Block.createSides({
                    top: atlasLayout.grass_top,
                    bottom: atlasLayout.dirt,
                }),
            })
        );

        Block.register(
            new Block(3, "oak_log", {
                displayName: "Oak Log",
                uvCoords: Block.atlasCoordToUV(
                    atlasLayout.oak_log_side.x,
                    atlasLayout.oak_log_side.y
                ),
                sides: Block.createSides({
                    top: atlasLayout.oak_log_top,
                    bottom: atlasLayout.oak_log_top,
                }),
            })
        );

        Block.register(
            new Block(4, "leaf", {
                displayName: "Leaf",
                transparent: true,
                uvCoords: Block.atlasCoordToUV(
                    atlasLayout.leaf.x,
                    atlasLayout.leaf.y
                ),
            })
        );

        Block.register(
            new Block(5, "water", {
                displayName: "Water",
                transparent: true,
            })
        );

        console.log("Blocks initialized with atlas coordinates:", {
            total: Block.blocks.size,
            layout: atlasLayout,
            config: Block.atlasConfig,
        });
    }
}
