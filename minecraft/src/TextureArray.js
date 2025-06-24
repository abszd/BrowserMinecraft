import {
    DataArrayTexture,
    FrontSide,
    NearestFilter,
    NearestMipMapLinearFilter,
    NearestMipmapLinearFilter,
    NearestMipmapNearestFilter,
    RGBAFormat,
    RepeatWrapping,
    TextureLoader,
    UnsignedByteType,
} from "three";
import { shaderMaterial } from "./shaderHelper";

export class TextureArray {
    constructor(renderer, textureLoader, params = {}) {
        this.size = params.size || 16;
        this.textureLoader = textureLoader;
        this.renderer = renderer;
        this.gl = renderer.getContext();
        this.textures = new Map();
        this.texturePaths = [];
        this.ptr = 0;
        this.addBlocks();
        this.initTextureArray().then((ta) => {
            this.textureArray = ta;
            this.material = this.getMaterial(params.rd, params.rf);
        });
    }

    getMaterial(rd, rf) {
        return shaderMaterial("shader.vs", "shader.fs", {
            side: FrontSide,
            uniforms: {
                textureArray: { value: this.textureArray },
                renderDistance: { value: rd },
                renderFade: { value: rf },
            },
        });
    }

    addBlocks() {
        this.add("dirt-side", "textures/dirt.png");
        this.add("stone-side", "textures/stone.png");
        this.add("grass-side", "textures/grass_side.png");
        this.add("grass-top", "textures/grass_top_old.jpg");
        this.add("grass-bottom", "textures/dirt.png");
        this.add("oak_log-side", "textures/oak_log.png");
        this.add("oak_log-top", "textures/oak_log_top.png");
        this.add("oak_log-bottom", "textures/oak_log_top.png");
        this.add("sand-side", "textures/sand.png");
        // Animated textures (will need separate array)
        this.add("leaf-side", "textures/leaf.png");
        this.add("water-side", "textures/water.png");
    }

    add(name, path) {
        const idx = this.ptr++;
        this.textures.set(name, idx);
        this.texturePaths[idx] = path;
        return idx;
    }

    getTextureDepth(blockType, face = "side") {
        return this.textures.get(`${blockType}-${face}`) ?? this.textures.get(`${blockType}-side`) ?? 0;
    }

    async loadTexture(path) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                console.log(`Direct image load: ${path}, size: ${img.width}x${img.height}`);

                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");

                ctx.imageSmoothingEnabled = false;
                ctx.webkitImageSmoothingEnabled = false;
                ctx.mozImageSmoothingEnabled = false;
                ctx.msImageSmoothingEnabled = false;

                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, img.width, img.height);

                const data = imageData.data;
                resolve(data);
            };
            img.onerror = reject;
            img.src = path;
        });
    }

    async initTextureArray() {
        const data = new Array(this.ptr);

        const bitsPerImage = this.size * this.size * 4;
        const textureData = new Uint8Array(bitsPerImage * this.ptr);
        for (let i = 0; i < this.ptr; i++) {
            const texture = await this.loadTexture(this.texturePaths[i]);

            textureData.set(texture, i * bitsPerImage);
            // console.log("IMAGE AT LAYER :", i);
            for (let j = 0; j < bitsPerImage; j += 4) {
                // console.log(
                //     `pixel: R${textureData[i * bitsPerImage + j]} G${textureData[i * bitsPerImage + j + 1]} B${
                //         textureData[i * bitsPerImage + j + 2]
                //     } A${textureData[i * bitsPerImage + j + 3]}`
                // );
            }
        }
        const textureArray = new DataArrayTexture(textureData, this.size, this.size, this.ptr);
        console.log("texture array", textureArray);
        textureArray.minFilter = NearestMipmapNearestFilter;
        textureArray.magFilter = NearestFilter;
        textureArray.wrapS = RepeatWrapping;
        textureArray.wrapT = RepeatWrapping;
        textureArray.generateMipmaps = true;
        textureArray.needsUpdate = true;

        return textureArray;
    }
}

export class TransparentTextureArray {
    constructor(params = {}) {
        s;
    }
}
