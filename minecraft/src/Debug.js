import { Vector3 } from "three";

class Debug {
    constructor(chunkManager) {
        this.enabled = true;
        this.chunkManager = chunkManager;

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
        this.container.style.display = this.enabled ? "block" : "none";
        document.body.appendChild(this.container);

        this.lines = {
            fps: this.createLine("FPS"),
            chunk: this.createLine("Chunk"),
            activeChunks: this.createLine("Active Chunks"),
            loadedChunks: this.createLine("Loaded Chunks"),
            position: this.createLine("Position"),
            lookDirection: this.createLine("Looking"),
            seed: this.createLine("World Seed"),
            holding: this.createLine("Holding"),
            sprinting: this.createLine("Grounded"),
            renderDistance: this.createRenderDistanceSlider(),
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

    createRenderDistanceSlider() {
        const container = document.createElement("div");
        container.style.marginBottom = "10px";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.gap = "5px";

        const label = document.createElement("div");
        label.innerHTML = `<strong>Render Distance:</strong> <span id="renderDistanceValue">${this.chunkManager.renderDistance}</span>`;

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "2";
        slider.max = "16";
        slider.value = this.chunkManager.renderDistance;
        slider.step = "1";
        slider.style.width = "100%";
        slider.style.marginTop = "3px";

        slider.style.height = "20px";
        slider.style.background = "#333";
        slider.style.outline = "none";
        slider.style.borderRadius = "3px";

        const valueSpan = label.querySelector("#renderDistanceValue");

        slider.addEventListener("input", (e) => {
            const newRenderDistance = parseInt(e.target.value);
            valueSpan.textContent = newRenderDistance;

            this.chunkManager.renderDistance = newRenderDistance;
            this.chunkManager.updateRenderDistances(
                (newRenderDistance - 1) * this.chunkManager.chunkSize
            );
            this.debounceChunkUpdate();
        });

        container.appendChild(label);
        container.appendChild(slider);
        this.container.appendChild(container);

        return valueSpan;
    }

    debounceChunkUpdate() {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        this.updateTimeout = setTimeout(() => {
            if (this.lastPlayerPosition) {
                this.chunkManager.updateChunks(
                    this.lastPlayerPosition.x,
                    this.lastPlayerPosition.z
                );
            }
        }, 200);
    }

    toggle() {
        this.enabled = !this.enabled;
        this.container.style.display = this.enabled ? "block" : "none";
    }

    update(fps, player, chunkManager) {
        if (!this.enabled) return;

        const position = player.camera.position;
        this.lastPlayerPosition = position; // Store for debounced updates

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
        this.lines.holding.textContent = `${
            chunkManager.idBlockTypeLookup[player.holding] || "None"
        }`;
        this.lines.sprinting.textContent = `${player.isGrounded}`;
        // renderDistance value is updated by the slider directly
    }
}
export { Debug };
