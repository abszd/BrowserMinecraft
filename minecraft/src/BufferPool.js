export class BufferPool {
    constructor(mgr, params = {}) {
        this.maxSize = params.maxSize;
        console.log("Starting BufferPool constructor");
        this.pool = Array(this.maxSize);
        this.initBufferPool();
        this.poolOffset = 0;
        this.mgr = mgr;
        this.pending = new Object();
        this.atLeastOneWorker = false;
        //console.log(this.pool);
    }

    initBufferPool() {
        //console.log("initializing BufferPool");
        //console.log(this.maxSize);
        for (let i = 0; i < this.maxSize; i++) {
            this.pool[i] = {};
            this.pool[i].chunk = null;
            this.pool[i].state = -1;
            this.pool[i].worker = null;
            //console.log("Frame ", i, ": ", this.pool[i]);
        }
    }

    findFreeFrame() {
        const n = this.maxSize;
        for (let i = 0; i < n; i++) {
            const slotno = (i + this.poolOffset) % n;
            if (this.pool[slotno].state === -1) {
                //console.log("found free frame at ", (i + this.poolOffset) % n, this.pool[(i + this.poolOffset) % n]);
                const out = (i + this.poolOffset) % n;
                this.poolOffset = (out + 1) % n;
                return out;
            }
        }
        return -1;
    }

    add(chunk, message) {
        const key = `${chunk.chunkX},${chunk.chunkZ}`;
        //console.log("Adding ", key, chunk);
        // if (this.pending.hasOwnProperty(key)) {
        //     return false;
        // }
        this.pending[key] = { message: message, chunk: chunk };
        return true;
    }

    flushFrame(frameno) {
        if (frameno === undefined) {
            console.log(`Undefined Flush - ${frameno}`);
            return;
        }
        this.pool[frameno].chunk = null;
        this.pool[frameno].state = -1;
    }

    updateWorkers() {
        const queue = Object.entries(this.pending);
        let i;
        //console.log("queue", queue);
        while ((i = this.findFreeFrame()) !== -1 && queue.length > 0) {
            if (this.pool[i].state !== -1) {
                continue;
            }
            const req = queue.shift();
            //console.log(`Adding to ${i} `, req[0]);
            if (!this.setup(i, req[1].chunk, req[1].message)) {
                this.pool[i].state = -1;
            }
            //console.log(`Added to ${i}`, this.pool[i]);
            delete this.pending[req[0]];
        }
        return;
    }

    setup(frameno, chunk, message) {
        //console.log(`${frameno} - sending: `, message, chunk);
        const slot = this.pool[frameno];
        slot.state = 0;
        this.pool[frameno].chunk = chunk;
        if (!this.sendDataToWorker(frameno, message)) {
            return false;
        }

        slot.state = 1;
        return true;
    }

    sendDataToWorker(frameno, message) {
        const slot = this.pool[frameno];
        if (!slot.worker) {
            if (!this.createWorker(frameno)) return false;
        }
        message.frameno = frameno;
        slot.worker.postMessage(message);
        //console.log(`sent ${frameno} - ${message.type}`);
        return true;
    }

    createWorker(frameno) {
        throw new Error("Must implement createWorker() in derived class");
    }

    handleWorkerResponse(data) {
        throw new Error("Must implement handleWorkerResponse() in derived class");
    }
}

export class TerrainBuffer extends BufferPool {
    constructor(mgr, params = {}) {
        super(mgr, params);
    }

    createWorker(frameno) {
        const slot = this.pool[frameno];
        slot.worker = new Worker(new URL("./chunkWorker.js", import.meta.url), { type: "module" });
        slot.worker.onmessage = (e) => {
            this.handleWorkerResponse(e.data);
        };

        slot.worker.postMessage({
            type: "initialize",
            params: {
                worldSeed: this.mgr.worldSeed,
                chunkSize: this.mgr.chunkSize,
                chunkHeight: this.mgr.chunkHeight,
                amplitude: this.mgr.amplitude,
                transparentBlocks: Array.from(this.mgr.TRANSPARENT_BLOCKS),
                blockTable: this.mgr.getSimplifiedBlockTable(),
            },
            frameno: frameno,
        });
        return true;
    }

    flushFrame(frameno) {
        //console.log(`Terrain - flushing ${frameno}`);
        super.flushFrame(frameno);
    }

    searchAndDestroyChunk(chunkId) {
        for (let i = 0; i < this.maxSize; i++) {
            this.pool[i].worker.postMessage({ type: "unloadChunk", chunkId: chunkId });
        }
    }
    handleWorkerResponse(d) {
        const { type, data, chunkId, error, frameno } = d;
        //console.log("terrain response - ", type);
        switch (type) {
            case "log":
                console.log("Worker:", data);
                break;
            case "initialized":
                //console.log("Chunk worker initialized");
                this.atLeastOneWorker = true;
                this.mgr.checkWorkersReady();
                break;

            case "chunkGenerated":
                //this.onChunkGenerated(data);
                this.mgr.onTerrainCompleted(data);
                this.flushFrame(data.frameno);
                break;

            case "chunkUpdated":
                //console.log(data);
                this.mgr.onChunkUpdated(data);
                this.flushFrame(frameno);
                break;

            case "spawnFound":
                this.onSpawnFound(chunkId, data.location);
                break;

            case "error":
                console.error("Chunk worker error:", d);
                this.flushFrame(d.frameno);
                break;
        }
    }
}

export class MeshBuffer extends BufferPool {
    constructor(mgr, params = {}) {
        super(mgr, params);
    }

    createWorker(frameno) {
        const slot = this.pool[frameno];
        slot.worker = new Worker(new URL("./meshWorker.js", import.meta.url));
        slot.worker.onmessage = (e) => {
            this.handleWorkerResponse(e.data);
        };
        const workerBlockTable = {};
        Object.entries(this.mgr.blockTable).forEach(([key, value]) => {
            workerBlockTable[key] = {
                guid: value.guid,
                name: value.name,
            };
        });

        slot.worker.postMessage({
            type: "initialize",
            data: {
                blockTable: workerBlockTable,
                transparentBlocks: Array.from(this.mgr.TRANSPARENT_BLOCKS),
            },
            frameno: frameno,
        });

        return true;
    }

    handleWorkerResponse(d) {
        const { type, data, error, frameno } = d;
        const slot = this.pool[frameno];
        //console.log("Mesh Response ", type);
        switch (type) {
            case "log":
                console.log("Worker:", data);
                break;

            case "initialized":
                //console.log("Mesh worker initialized");
                this.atLeastOneWorker = true;
                this.mgr.checkWorkersReady();
                break;

            case "meshCompleted":
                this.mgr.onMeshCompleted(data);
                //console.log(d);
                this.flushFrame(data.frameno);
                break;

            case "error":
                console.error("Mesh worker error:", error);
                break;
        }
    }

    flushFrame(frameno) {
        //console.log(`Mesh - flushing ${frameno}`);
        super.flushFrame(frameno);
    }
}
