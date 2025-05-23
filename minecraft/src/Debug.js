import { Vector3 } from "three";

class Debug {
    constructor() {
        this.enabled = "block";

        this.container = document.createElement("div");
        this.container.style.position = "absolute";
        this.container.style.top = "10px";
        this.container.style.right = "10px";
        this.container.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
        this.container.style.color = "white";
        this.container.style.padding = "15px";
        this.container.style.borderRadius = "5px";
        this.container.style.fontFamily = "monospace, Arial, sans-serif";
        this.container.style.fontSize = "16px";
        this.container.style.lineHeight = "1.5";
        this.container.style.minWidth = "300px";
        this.container.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.5)";
        this.container.style.display = this.enabled;
        document.body.appendChild(this.container);

        this.lines = {
            fps: this.createLine("FPS"),
            chunk: this.createLine("Chunk"),
            activeChunks: this.createLine("Active Chunks"),
            loadedChunks: this.createLine("Loaded Chunks"),
            position: this.createLine("Position"),
            lookDirection: this.createLine("Looking"),
            seed: this.createLine("World Seed"),
        };

        document.addEventListener("keydown", (e) => {
            if (e.code === "F3") {
                this.toggle();
            }
        });
    }

    createLine(label) {
        const line = document.createElement("div");
        line.style.marginBottom = "5px";
        line.innerHTML = `<strong>${label}:</strong> <span>--</span>`;
        this.container.appendChild(line);
        return line.querySelector("span");
    }

    toggle() {
        this.enabled = !this.enabled;
        this.container.style.display = this.enabled ? "block" : "none";
    }

    update(fps, player, chunkManager) {
        if (!this.enabled) return;

        const position = player.camera.position;
        const direction = new Vector3();
        player.controls.getDirection(direction);

        const playerChunkX = Math.floor(position.x / chunkManager.chunkSize);
        const playerChunkZ = Math.floor(position.z / chunkManager.chunkSize);

        this.lines.fps.textContent = `${fps}`;
        this.lines.chunk.textContent = `${playerChunkX}, ${playerChunkZ}`;
        this.lines.activeChunks.textContent = `${chunkManager.activeChunks.size}`;
        this.lines.loadedChunks.textContent = `${chunkManager.chunks.size}`;
        this.lines.position.textContent = `${position.x.toFixed(2)}, ${(
            position.y - 0.6
        ).toFixed(2)}, ${position.z.toFixed(2)}`;
        this.lines.lookDirection.textContent = `${direction.x.toFixed(
            2
        )}, ${direction.y.toFixed(2)}, ${direction.z.toFixed(2)}`;
        this.lines.seed.textContent = `${chunkManager.worldSeed}`;
    }
}

export { Debug };
