// import { DoubleSide, FrontSide } from "three";
// import { shaderMaterial } from "./shaderHelper.js";

// export function getBlockTable(loadTexture, rd, rf) {
//     return {
//         dirt: {
//             transparent: true,
//             texture: {
//                 side: shaderMaterial("shader.vs", "shader.fs", {
//                     side: FrontSide,
//                     uniforms: {
//                         colormap: {
//                             value: loadTexture("textures/dirt.png"),
//                         },
//                         renderDistance: { value: rd },
//                         renderFade: { value: rf },
//                     },
//                 }),
//             },
//             guid: 0,
//             buid: 1,
//             name: "Dirt",
//         },
//         stone: {
//             texture: {
//                 side: shaderMaterial("shader.vs", "shader.fs", {
//                     side: FrontSide,
//                     uniforms: {
//                         colormap: {
//                             value: loadTexture("textures/stone.png"),
//                         },
//                         renderDistance: { value: rd },
//                         renderFade: { value: rf },
//                     },
//                 }),
//             },
//             guid: 1,
//             buid: 1,
//             name: "Stone",
//         },
//         grass: {
//             texture: {
//                 side: shaderMaterial("shader.vs", "shader.fs", {
//                     side: FrontSide,
//                     uniforms: {
//                         colormap: {
//                             value: loadTexture("textures/grass_side.png"),
//                         },
//                         renderDistance: { value: rd },
//                         renderFade: { value: rf },
//                     },
//                 }),
//                 top: shaderMaterial("shader.vs", "shader.fs", {
//                     side: FrontSide,
//                     uniforms: {
//                         colormap: {
//                             value: loadTexture("textures/grass_top_old.jpg"),
//                         },
//                         renderDistance: { value: rd },
//                         renderFade: { value: rf },
//                     },
//                 }),
//                 bottom: shaderMaterial("shader.vs", "shader.fs", {
//                     side: FrontSide,
//                     uniforms: {
//                         colormap: {
//                             value: loadTexture("textures/dirt.png"),
//                         },
//                         renderDistance: { value: rd },
//                         renderFade: { value: rf },
//                     },
//                 }),
//             },
//             guid: 2,
//             buid: 1,
//             name: "Grass",
//         },
//         oak_log: {
//             texture: {
//                 side: shaderMaterial("shader.vs", "shader.fs", {
//                     side: FrontSide,
//                     uniforms: {
//                         colormap: {
//                             value: loadTexture("textures/oak_log.png"),
//                         },
//                         renderDistance: { value: rd },
//                         renderFade: { value: rf },
//                     },
//                 }),
//                 top: shaderMaterial("shader.vs", "shader.fs", {
//                     side: FrontSide,
//                     uniforms: {
//                         colormap: {
//                             value: loadTexture("textures/oak_log_top.png"),
//                         },
//                         renderDistance: { value: rd },
//                         renderFade: { value: rf },
//                     },
//                 }),
//                 bottom: shaderMaterial("shader.vs", "shader.fs", {
//                     side: FrontSide,
//                     uniforms: {
//                         colormap: {
//                             value: loadTexture("textures/oak_log_top.png"),
//                         },
//                         renderDistance: { value: rd },
//                         renderFade: { value: rf },
//                     },
//                 }),
//             },
//             guid: 3,
//             buid: 1,
//             name: "Oak_Log",
//         },
//         leaf: {
//             texture: {
//                 side: shaderMaterial("leaf_shader.vs", "leaf_shader.fs", {
//                     side: FrontSide,
//                     transparent: true,
//                     uniforms: {
//                         colormap: {
//                             value: loadTexture("textures/leaf.png"),
//                         },
//                         time: { value: 0.0 },
//                         renderDistance: { value: rd },
//                         renderFade: { value: rf },
//                     },
//                 }),
//                 top: null,
//             },
//             guid: 4,
//             buid: 1,
//             name: "Leaf",
//         },
//         water: {
//             texture: {
//                 side: shaderMaterial("water_shader.vs", "water_shader.fs", {
//                     side: DoubleSide,
//                     uniforms: {
//                         colormap: {
//                             value: loadTexture("textures/water.png"),
//                         },
//                         time: { value: 0.0 },
//                         envMap: { value: null },
//                         level: { value: 0.0 },
//                         renderDistance: { value: rd },
//                         renderFade: { value: rf },
//                     },
//                     transparent: true,
//                     depthTest: true,
//                 }),
//                 top: null,
//             },
//             guid: 5,
//             buid: 1,
//             name: "Water",
//         },
//         slime: {
//             texture: {
//                 side: shaderMaterial("shader.vs", "leaf_shader.fs", {
//                     side: FrontSide,
//                     transparent: true,
//                     uniforms: {
//                         colormap: {
//                             value: loadTexture("textures/slime.png"),
//                         },
//                         renderDistance: { value: rd },
//                         renderFade: { value: rf },
//                     },
//                 }),
//                 top: null,
//             },
//             guid: 6,
//             buid: 1,
//             name: "Slime",
//         },
//         grass_top: {
//             texture: {
//                 side: shaderMaterial("shader.vs", "leaf_shader.fs", {
//                     side: FrontSide,
//                     uniforms: {
//                         colormap: {
//                             value: loadTexture("textures/grass_top.png"),
//                         },
//                         renderDistance: { value: rd },
//                         renderFade: { value: rf },
//                     },
//                 }),
//                 top: shaderMaterial("shader.vs", "leaf_shader.fs", {
//                     side: FrontSide,
//                     uniforms: {
//                         colormap: {
//                             value: loadTexture("textures/grass_top.png"),
//                         },
//                         renderDistance: { value: rd },
//                         renderFade: { value: rf },
//                     },
//                 }),
//                 bottom: shaderMaterial("shader.vs", "leaf_shader.fs", {
//                     side: FrontSide,
//                     uniforms: {
//                         colormap: {
//                             value: loadTexture("textures/dirt.png"),
//                         },
//                         renderDistance: { value: rd },
//                         renderFade: { value: rf },
//                     },
//                 }),
//             },
//             guid: 7,
//             buid: 1,
//             name: "Grass",
//         },
//     };
// }
import { DoubleSide, FrontSide, Vector2 } from "three";
import { shaderMaterial } from "./shaderHelper.js";
import { Block } from "./Block.js";

export function getBlockTable(rd, rf) {
    Block.initializeBlocks();
    console.log(Block.atlasTexture);
    const atlasTexture = Block.atlasTexture;
    const atlasSize = new Vector2(
        Block.atlasSize.width,
        Block.atlasSize.height
    );
    const tileSize = new Vector2(16, 16);

    const standardMaterial = shaderMaterial("shader.vs", "shader.fs", {
        side: FrontSide,
        uniforms: {
            colormap: { value: atlasTexture },
            renderDistance: { value: rd },
            renderFade: { value: rf },
            atlasSize: { value: atlasSize },
            tileSize: { value: tileSize },
        },
    });

    const leafMaterial = shaderMaterial("leaf_shader.vs", "leaf_shader.fs", {
        side: FrontSide,
        transparent: true,
        uniforms: {
            colormap: { value: atlasTexture },
            time: { value: 0.0 },
            renderDistance: { value: rd },
            renderFade: { value: rf },
            atlasSize: { value: atlasSize },
            tileSize: { value: tileSize },
        },
    });

    const waterMaterial = shaderMaterial("water_shader.vs", "water_shader.fs", {
        side: DoubleSide,
        uniforms: {
            time: { value: 0.0 },
            envMap: { value: null },
            level: { value: 0.0 },
            renderDistance: { value: rd },
            renderFade: { value: rf },
            atlasSize: { value: atlasSize },
            tileSize: { value: tileSize },
        },
        transparent: true,
        depthTest: true,
    });

    return {
        dirt: {
            transparent: false,
            material: standardMaterial,
            guid: 0,
            buid: 1,
            name: "Dirt",
        },
        stone: {
            transparent: false,
            material: standardMaterial,
            guid: 1,
            buid: 1,
            name: "Stone",
        },
        grass: {
            transparent: false,
            material: standardMaterial,
            guid: 2,
            buid: 1,
            name: "Grass",
        },
        oak_log: {
            transparent: false,
            material: standardMaterial,
            guid: 3,
            buid: 1,
            name: "Oak_Log",
        },
        leaf: {
            transparent: true,
            material: leafMaterial,
            guid: 4,
            buid: 1,
            name: "Leaf",
        },
        water: {
            transparent: true,
            material: waterMaterial,
            guid: 5,
            buid: 1,
            name: "Water",
        },
        grass_top: {
            transparent: false,
            material: standardMaterial,
            guid: 7,
            buid: 1,
            name: "Grass",
        },

        _materials: {
            standard: standardMaterial,
            leaf: leafMaterial,
            water: waterMaterial,
        },
    };
}
