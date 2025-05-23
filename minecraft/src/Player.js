import {
    BoxGeometry,
    EdgesGeometry,
    LineBasicMaterial,
    LineSegments,
    PerspectiveCamera,
    Vector3,
} from "three";
import { PointerLockControls } from "./PointerLockControls.js";

class Player {
    constructor(renderer, width, chunkManager) {
        this.width = 0.6;
        this.height = 1.8;
        this.depth = 0.6;

        this.mgr = chunkManager;

        this.zoomfov = 10;
        this.fov = 80;
        this.camera = new PerspectiveCamera(
            this.fov,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(width / 2, width, width / 2);

        this.direction = new Vector3();

        this.controls = new PointerLockControls(
            this.camera,
            renderer.domElement
        );
        this.controls.rotateSpeed = 0.3;
        this.controls.panSpeed = 0.5;
        this.controls.zoomSpeed = 0.5;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;

        this.movementState = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            sprint: false,
        };
        this.reach = 5;
        this.velocity = new Vector3(0, 0, 0);
        this.moveSpeed = 4.3;
        this.flyMult = 4;
        this.jumpForce = 8.1;
        this.isGrounded = false;
        this.gravity = 24.0;
        this.stepHeight = 1.333;
        this.eyeHeight = 1.6;
        this.jumpCooldown = 0.3;
        this.jumpTimer = 0;
        this.swimForce = 3;
        this.flying = false;
        this.lookingAt = null;
        this.holding = null;
        this.hitNormal = new Vector3(0, 0, 0);
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.controls.domElement.addEventListener("click", () => {
            this.controls.lock();
        });

        document.addEventListener("mousedown", (event) => {
            if (!this.lookingAt) return;
            switch (event.button) {
                case 0:
                    this.mgr.setBlock(
                        this.lookingAt.x - 0.5,
                        this.lookingAt.y - 0.5,
                        this.lookingAt.z - 0.5,
                        null
                    );
                    break;
                case 1:
                    this.holding = this.mgr.getBlock(
                        this.lookingAt.x - 0.5,
                        this.lookingAt.y - 0.5,
                        this.lookingAt.z - 0.5
                    );
                    break;
                case 2:
                    const side = new Vector3(
                        this.lookingAt.x,
                        this.lookingAt.y,
                        this.lookingAt.z
                    )
                        .addScaledVector(this.hitNormal, 1)
                        .floor();

                    if (
                        !(
                            side.x === Math.floor(this.camera.position.x) &&
                            side.z === Math.floor(this.camera.position.z) &&
                            (side.y ===
                                Math.floor(this.camera.position.y - 1.6) ||
                                side.y ===
                                    Math.floor(this.camera.position.y - 0.6)) &&
                            this.mgr.TRANSPARENT_BLOCKS.has(
                                this.mgr.getBlock(side.x, side.y, side.z)
                            )
                        )
                    ) {
                        this.mgr.setBlock(side.x, side.y, side.z, this.holding);
                    }
            }
        });
        document.addEventListener("keydown", (event) => {
            switch (event.code) {
                case "KeyW":
                    this.movementState.forward = true;
                    break;
                case "KeyA":
                    this.movementState.left = true;
                    break;
                case "KeyS":
                    this.movementState.backward = true;
                    break;
                case "KeyD":
                    this.movementState.right = true;
                    break;
                case "KeyC":
                    this.camera.fov = this.zoomfov;
                    this.camera.updateProjectionMatrix();
                    this.controls.rotateSpeed = 0.3;
                    this.controls.panSpeed = 0.5;
                    this.controls.zoomSpeed = 0.5;
                    this.controls.enableDamping = true;
                    break;
                case "KeyF":
                    this.flying = !this.flying;
                    if (this.flying) this.movementState.sprint = false;
                    break;
                case "Space":
                    this.movementState.jump = true;
                    break;
                case "ShiftLeft":
                    if (this.flying || this.isGrounded)
                        this.movementState.sprint = true;
                    break;
            }
        });

        document.addEventListener("keyup", (event) => {
            switch (event.code) {
                case "KeyW":
                    this.movementState.forward = false;
                    break;
                case "KeyA":
                    this.movementState.left = false;
                    break;
                case "KeyS":
                    this.movementState.backward = false;
                    break;
                case "KeyD":
                    this.movementState.right = false;
                    break;
                case "KeyC":
                    this.camera.fov = this.fov;
                    this.camera.updateProjectionMatrix();
                    this.controls.rotateSpeed = 1;
                    this.controls.panSpeed = 1;
                    this.controls.zoomSpeed = 1;
                    this.controls.enableDamping = false;
                    break;
                case "Space":
                    this.movementState.jump = false;
                    break;
                case "ShiftLeft":
                    if (this.flying) this.movementState.sprint = false;
                    break;
            }
        });

        window.addEventListener("resize", () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        });
    }

    getCamera() {
        return this.camera;
    }

    getControls() {
        return this.controls;
    }

    isControlsLocked() {
        return this.controls.isLocked;
    }

    getPosition() {
        return this.camera.position;
    }

    getBounds() {
        const position = this.camera.position;
        const halfWidth = this.width / 2;
        const halfDepth = this.depth / 2;
        const feetY = position.y - this.eyeHeight;

        return {
            minX: position.x - halfWidth,
            maxX: position.x + halfWidth,
            minY: feetY,
            maxY: feetY + this.height,
            minZ: position.z - halfDepth,
            maxZ: position.z + halfDepth,
        };
    }

    isBlockSolid(x, y, z) {
        const blockId = this.mgr.getBlock(
            Math.floor(x),
            Math.floor(y),
            Math.floor(z)
        );
        //console.log(blockId);
        return !(blockId === -1 || blockId === 5);
    }

    collideBox(posX, posY, posZ) {
        const halfWidth = this.width / 2;
        const halfDepth = this.depth / 2;
        const feetY = posY - this.eyeHeight;

        const minX = Math.floor(posX - halfWidth);
        const maxX = Math.floor(posX + halfWidth);
        const minY = Math.floor(feetY);
        const maxY = Math.floor(feetY + this.height);
        const minZ = Math.floor(posZ - halfDepth);
        const maxZ = Math.floor(posZ + halfDepth);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (this.isBlockSolid(x, y, z)) {
                        //console.log(x, y, z);
                        return true;
                    }
                }
            }
        }

        return false;
    }

    inWater() {
        return (
            this.mgr.getBlock(
                Math.floor(this.camera.position.x),
                Math.floor(this.camera.position.y - this.eyeHeight),
                Math.floor(this.camera.position.z)
            ) === 5
        );
    }

    getFloorHeight(x, z) {
        const halfWidth = this.width / 2;
        const halfDepth = this.depth / 2;
        let maxFloorHeight = 0;

        const checkPoints = [
            [x - halfWidth, z - halfDepth], // back left
            [x, z - halfDepth], // back center
            [x + halfWidth, z - halfDepth], // back right
            [x - halfWidth, z], // middle left
            [x, z], // center
            [x + halfWidth, z], // middle right
            [x - halfWidth, z + halfDepth], // front left
            [x, z + halfDepth], // front center
            [x + halfWidth, z + halfDepth], // front right
        ];

        for (const [pointX, pointZ] of checkPoints) {
            for (let y = Math.floor(this.camera.position.y - 1); y >= 0; y--) {
                if (this.isBlockSolid(pointX, y, pointZ)) {
                    maxFloorHeight = Math.max(maxFloorHeight, y + 1);
                    break;
                }
            }
        }

        return maxFloorHeight;
    }

    checkDirectionalCollision(startPos, endPos, axis) {
        const halfWidth = this.width / 2;
        const halfDepth = this.depth / 2;
        const startFeetY = startPos.y - this.eyeHeight;
        const endFeetY = endPos.y - this.eyeHeight;

        let minX, maxX, minY, maxY, minZ, maxZ;

        if (axis === "y") {
            minX = Math.floor(startPos.x - halfWidth);
            maxX = Math.floor(startPos.x + halfWidth);
            minY = Math.floor(Math.min(startFeetY, endFeetY));
            maxY = Math.floor(
                Math.max(startFeetY + this.height, endFeetY + this.height)
            );
            minZ = Math.floor(startPos.z - halfDepth);
            maxZ = Math.floor(startPos.z + halfDepth);
        } else if (axis === "x") {
            const direction = Math.sign(endPos.x - startPos.x);
            minX =
                direction > 0
                    ? Math.floor(startPos.x + halfWidth)
                    : Math.floor(endPos.x - halfWidth);
            maxX =
                direction > 0
                    ? Math.floor(endPos.x + halfWidth)
                    : Math.floor(startPos.x - halfWidth);
            minY = Math.floor(startFeetY);
            maxY = Math.floor(startFeetY + this.height);
            minZ = Math.floor(startPos.z - halfDepth);
            maxZ = Math.floor(startPos.z + halfDepth);
        } else {
            // axis === 'z'
            // For Z movement, check blocks in our path
            const direction = Math.sign(endPos.z - startPos.z);
            minX = Math.floor(startPos.x - halfWidth);
            maxX = Math.floor(startPos.x + halfWidth);
            minY = Math.floor(startFeetY);
            maxY = Math.floor(startFeetY + this.height);
            minZ =
                direction > 0
                    ? Math.floor(startPos.z + halfDepth)
                    : Math.floor(endPos.z - halfDepth);
            maxZ =
                direction > 0
                    ? Math.floor(endPos.z + halfDepth)
                    : Math.floor(startPos.z - halfDepth);
        }

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (this.isBlockSolid(x, y, z)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    drawSelectBox() {
        const size = 1.001;
        const boxGeometry = new BoxGeometry(size, size, size);
        const edges = new EdgesGeometry(boxGeometry);
        const material = new LineBasicMaterial({
            color: 0x000000,
        });

        const wireframe = new LineSegments(edges, material);

        return wireframe;
    }

    updateSelectBox(box, distance = this.reach) {
        if (!this.controls.isLocked) {
            box.visible = false;
            return null;
        }

        this.controls.getDirection(this.direction);
        this.direction.normalize();

        let targetBlock = null;
        let hitPoint = null;

        for (let i = 0; i <= distance; i += 0.05) {
            const target = this.camera.position
                .clone()
                .addScaledVector(this.direction, i);
            const blockX = Math.floor(target.x);
            const blockY = Math.floor(target.y);
            const blockZ = Math.floor(target.z);
            let blockId = this.mgr.getBlock(blockX, blockY, blockZ);
            if (!(blockId === -1 || blockId === 5)) {
                targetBlock = {
                    x: blockX + 0.5,
                    y: blockY + 0.5,
                    z: blockZ + 0.5,
                };
                hitPoint = target;
                break;
            }
        }

        if (targetBlock && hitPoint) {
            const blockCenter = new Vector3(
                targetBlock.x,
                targetBlock.y,
                targetBlock.z
            );
            const relativeHit = hitPoint.clone().sub(blockCenter);

            let maxComponent = 0;
            let faceNormal = new Vector3(0, 0, 0);

            if (Math.abs(relativeHit.x) > maxComponent) {
                maxComponent = Math.abs(relativeHit.x);
                faceNormal.set(Math.sign(relativeHit.x), 0, 0);
            }
            if (Math.abs(relativeHit.y) > maxComponent) {
                maxComponent = Math.abs(relativeHit.y);
                faceNormal.set(0, Math.sign(relativeHit.y), 0);
            }
            if (Math.abs(relativeHit.z) > maxComponent) {
                maxComponent = Math.abs(relativeHit.z);
                faceNormal.set(0, 0, Math.sign(relativeHit.z));
            }

            box.position.set(targetBlock.x, targetBlock.y, targetBlock.z);
            box.visible = true;
            this.lookingAt = targetBlock;
            this.hitNormal = faceNormal;
            return targetBlock;
        } else {
            box.visible = false;
            this.lookingAt = null;
            this.hitNormal = null;
            return null;
        }
    }

    updatePosition(delta) {
        if (!this.isControlsLocked()) return;
        if (
            (this.movementState.sprint || this.flying) &&
            this.camera.fov !== this.zoomfov &&
            this.camera.fov < this.fov + 12
        ) {
            this.camera.fov += 2;
            this.camera.updateProjectionMatrix();
        } else if (
            !this.movementState.sprint &&
            !this.flying &&
            this.camera.fov > this.fov
        ) {
            this.camera.fov -= 2;
            this.camera.updateProjectionMatrix();
        }
        const camera = this.camera;
        const position = camera.position.clone();
        const feetY = position.y - this.eyeHeight;

        const floorHeight = this.getFloorHeight(position.x, position.z);
        const groundLevel = floorHeight + this.eyeHeight;

        if (this.flying) {
            let moveY = 0;
            if (this.movementState.jump) moveY += 1;
            if (this.movementState.sprint) moveY -= 1;
            this.velocity.y = moveY * this.moveSpeed * this.flyMult;
        } else {
            this.isGrounded =
                feetY <= floorHeight + 0.1 && this.velocity.y <= 0;
            const inWater = this.inWater();

            if (this.movementState.jump && this.isGrounded && !inWater) {
                this.velocity.y = this.jumpForce;
                this.isGrounded = false;
            }

            if (!this.isGrounded) {
                this.velocity.y -= this.gravity * delta;
            } else {
                this.velocity.y = 0;

                if (Math.abs(groundLevel - position.y) <= 0.5) {
                    position.y = groundLevel;
                } else {
                    this.isGrounded = false;
                }
            }
            if (inWater) {
                if (
                    this.movementState.jump &&
                    this.mgr.getBlock(
                        Math.floor(this.camera.position.x),
                        Math.floor(this.camera.position.y),
                        Math.floor(this.camera.position.z)
                    ) === 5
                ) {
                    this.velocity.y = Math.max(this.velocity.y, this.swimForce);
                }
                this.velocity.y = Math.max(this.velocity.y, -4);
            }
        }

        const newPosY = position.y + this.velocity.y * delta;

        if (!this.collideBox(position.x, newPosY, position.z)) {
            position.y = newPosY;
        } else {
            if (this.velocity.y > 0) {
                this.velocity.y = 0;
            }
            if (this.velocity.y < 0) {
                position.y = floorHeight + this.eyeHeight;
                this.velocity.y = 0;
                this.isGrounded = true;
            }
        }

        let moveX = 0;
        let moveZ = 0;

        if (this.movementState.forward) {
            moveZ = 1;
        }
        if (this.movementState.backward) {
            moveZ = -1;
        }
        if (this.movementState.left) {
            moveX = 1;
        }
        if (this.movementState.right) {
            moveX = -1;
        }

        if (moveX !== 0 || moveZ !== 0) {
            const moveVector = new Vector3();

            if (moveZ !== 0) {
                const forwardVector = new Vector3();
                this.controls.getDirection(forwardVector);
                forwardVector.y = 0;
                forwardVector.normalize();
                moveVector.add(forwardVector.multiplyScalar(moveZ));
            }

            if (moveX !== 0) {
                const sideVector = new Vector3(
                    -camera.matrix.elements[0],
                    0,
                    -camera.matrix.elements[2]
                );
                sideVector.normalize();
                moveVector.add(sideVector.multiplyScalar(moveX));
            }

            moveVector.normalize();
            const speed =
                this.moveSpeed *
                (this.flying
                    ? this.flyMult
                    : this.movementState.sprint
                    ? 1.5
                    : 1.0) *
                (this.inWater() ? 0.5 : 1.0);
            moveVector.multiplyScalar(speed * delta);

            let newPosX = position.x + moveVector.x;
            const collideX = this.collideBox(newPosX, position.y, position.z);
            let newPosZ = position.z + moveVector.z;
            const collideZ = this.collideBox(position.x, position.y, newPosZ);

            if (!collideX) {
                position.x = newPosX;
            } else if (
                this.movementState.sprint &&
                !this.flying &&
                Math.abs(
                    moveVector.clone().normalize().dot(new Vector3(1, 0, 0))
                ) > Math.cos((Math.PI * 45) / 180)
            ) {
                this.movementState.sprint = false;
                console.log("not sprinting");
            }

            if (!collideZ) {
                position.z = newPosZ;
            } else if (
                this.movementState.sprint &&
                !this.flying &&
                Math.abs(
                    moveVector.clone().normalize().dot(new Vector3(0, 0, 1))
                ) > Math.cos((Math.PI * 45) / 180)
            ) {
                this.movementState.sprint = false;
                console.log("not sprinting");
            }

            if (this.inWater() && (collideX || collideZ)) {
                this.velocity.y = this.swimForce;
            }

            if (this.isBlockSolid(position.x, position.y - 1, position.z)) {
                position.y = Math.ceil(position.y + 0.01);
            } else if (
                collideX &&
                collideZ &&
                !this.isBlockSolid(
                    position.x + moveVector.x / Math.abs(moveVector.x),
                    position.y - this.eyeHeight,
                    position.z
                ) &&
                !this.isBlockSolid(
                    position.x,
                    position.y - this.eyeHeight,
                    position.z + moveVector.z / Math.abs(moveVector.z)
                )
            ) {
                if (Math.abs(moveVector.z) < Math.abs(moveVector.x)) {
                    position.z -= moveVector.z * 0.3;
                } else {
                    position.x -= moveVector.x * 0.3;
                }
            }
        }

        camera.position.copy(position);
    }
}

export { Player };
