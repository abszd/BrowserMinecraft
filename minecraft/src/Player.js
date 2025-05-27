import {
    BoxGeometry,
    EdgesGeometry,
    LineBasicMaterial,
    LineSegments,
    PerspectiveCamera,
    Vector3,
} from "three";
import { PointerLockControls } from "./PointerLockControls.js";
import { Inventory } from "./Inventory.js";

class Player {
    constructor(renderer, width, chunkManager) {
        this.width = 0.6;
        this.height = 1.8;
        this.depth = 0.6;

        this.mgr = chunkManager;
        this.inventory = new Inventory(this.mgr);
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
        this.moveSpeed = 4.3337;
        this.flyMult = 4;
        this.jumpForce = 7.2;
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
        this.mouseDown = false;
        this.mouseButton = 0;
        this.lastBreakTime = 0;
        this.lastPlaceTime = 0;
        this.breakInterval = 200;
        this.placeInterval = 200;
        this.epsilon = 0.01;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.controls.domElement.addEventListener("click", () => {
            this.controls.lock();
        });

        document.addEventListener("mousedown", (event) => {
            this.mouseDown = true;
            this.mouseButton = event.button;
        });

        document.addEventListener("mouseup", (event) => {
            this.mouseDown = false;
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
                    if (this.flying) {
                        this.movementState.sprint = true;
                    } else {
                        this.movementState.sprint = !this.movementState.sprint;
                    }
                    break;
                case "KeyI":
                    this.inventory.open = !this.inventory.open;
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

    updateMouse() {
        if (!this.mouseDown || !this.lookingAt) return;

        const currentTime = performance.now();

        switch (this.mouseButton) {
            case 0:
                if (currentTime - this.lastBreakTime >= this.breakInterval) {
                    const blockid = this.mgr.getBlock(
                        this.lookingAt.x - 0.5,
                        this.lookingAt.y - 0.5,
                        this.lookingAt.z - 0.5
                    );

                    if (blockid !== -1) {
                        this.mgr.setBlock(
                            this.lookingAt.x - 0.5,
                            this.lookingAt.y - 0.5,
                            this.lookingAt.z - 0.5,
                            null
                        );
                        this.lastBreakTime = currentTime;

                        this.inventory.add(blockid === 2 ? 0 : blockid);
                    }
                }
                break;

            case 1:
                const pickedBlockId = this.mgr.getBlock(
                    this.lookingAt.x - 0.5,
                    this.lookingAt.y - 0.5,
                    this.lookingAt.z - 0.5
                );

                if (pickedBlockId !== -1) {
                    this.holding = pickedBlockId;
                    this.inventory.add(pickedBlockId);
                }
                break;

            case 2:
                if (currentTime - this.lastPlaceTime >= this.placeInterval) {
                    const side = new Vector3(
                        this.lookingAt.x,
                        this.lookingAt.y,
                        this.lookingAt.z
                    )
                        .addScaledVector(this.hitNormal, 1)
                        .floor();

                    if (this.canPlaceBlock(side.x, side.y, side.z)) {
                        const heldItem =
                            this.inventory.inventory[this.inventory.holding];

                        if (heldItem && heldItem.count > 0) {
                            this.mgr.setBlock(
                                side.x,
                                side.y,
                                side.z,
                                heldItem.id
                            );

                            this.inventory.remove(this.inventory.holding);

                            this.lastPlaceTime = currentTime;
                        }
                    }
                }
                break;
        }
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

    isPointInSolid(x, y, z) {
        const blockId = this.mgr.getBlock(
            Math.floor(x),
            Math.floor(y),
            Math.floor(z)
        );
        return blockId !== -1 && blockId !== 5;
    }

    getPlayerAABB(position) {
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

    checkAABBCollision(aabb) {
        const minBlockX = Math.floor(aabb.minX);
        const maxBlockX = Math.floor(aabb.maxX);
        const minBlockY = Math.floor(aabb.minY);
        const maxBlockY = Math.floor(aabb.maxY);
        const minBlockZ = Math.floor(aabb.minZ);
        const maxBlockZ = Math.floor(aabb.maxZ);

        for (let x = minBlockX; x <= maxBlockX; x++) {
            for (let y = minBlockY; y <= maxBlockY; y++) {
                for (let z = minBlockZ; z <= maxBlockZ; z++) {
                    if (this.isPointInSolid(x + 0.5, y + 0.5, z + 0.5)) {
                        if (
                            aabb.maxX > x &&
                            aabb.minX < x + 1 &&
                            aabb.maxY > y &&
                            aabb.minY < y + 1 &&
                            aabb.maxZ > z &&
                            aabb.minZ < z + 1
                        ) {
                            return {
                                collision: true,
                                blockX: x,
                                blockY: y,
                                blockZ: z,
                            };
                        }
                    }
                }
            }
        }
        return { collision: false };
    }

    sweepAABB(startPos, endPos) {
        const direction = endPos.clone().sub(startPos);
        const distance = direction.length();

        if (distance < this.epsilon) {
            return { position: startPos.clone(), collided: false };
        }

        direction.normalize();

        let low = 0;
        let high = distance;
        let safeDistance = 0;

        for (let i = 0; i < 10; i++) {
            const mid = (low + high) / 2;
            const testPos = startPos.clone().addScaledVector(direction, mid);
            const aabb = this.getPlayerAABB(testPos);
            const collision = this.checkAABBCollision(aabb);

            if (collision.collision) {
                high = mid;
            } else {
                safeDistance = mid;
                low = mid;
            }
        }

        const finalPos = startPos
            .clone()
            .addScaledVector(direction, safeDistance);

        return {
            position: finalPos,
            collided: safeDistance < distance - this.epsilon,
            safeDistance: safeDistance,
            totalDistance: distance,
        };
    }

    resolveCollision(startPos, endPos, delta) {
        const result = this.sweepAABB(startPos, endPos);

        if (!result.collided) {
            return result.position;
        }

        const movement = endPos.clone().sub(startPos);
        let finalPos = result.position;

        if (Math.abs(movement.x) > this.epsilon) {
            const xEndPos = finalPos.clone();
            xEndPos.x = endPos.x;
            const xResult = this.sweepAABB(finalPos, xEndPos);
            if (!xResult.collided) {
                finalPos = xResult.position;
            }
        }

        if (Math.abs(movement.z) > this.epsilon) {
            const zEndPos = finalPos.clone();
            zEndPos.z = endPos.z;
            const zResult = this.sweepAABB(finalPos, zEndPos);
            if (!zResult.collided) {
                finalPos = zResult.position;
            }
        }
        if (Math.abs(movement.y) > this.epsilon) {
            const yEndPos = finalPos.clone();
            yEndPos.y = endPos.y;
            const yResult = this.sweepAABB(finalPos, yEndPos);
            if (!yResult.collided) {
                finalPos = yResult.position;
            }
        }
        return finalPos;
    }

    canPlaceBlock(x, y, z) {
        if (this.isPointInSolid(x, y, z)) {
            return false;
        }

        const testAABB = this.getPlayerAABB(this.camera.position);

        if (
            testAABB.maxX > x &&
            testAABB.minX < x + 1 &&
            testAABB.maxY > y &&
            testAABB.minY < y + 1 &&
            testAABB.maxZ > z &&
            testAABB.minZ < z + 1
        ) {
            return false;
        }

        return true;
    }

    getFloorHeight(x, z) {
        for (let y = this.camera.position.y; y >= 0; y -= 0.1) {
            if (this.isPointInSolid(x, y, z)) {
                return y + 1;
            }
        }
        return 0;
    }

    isOnGround(position) {
        const aabb = this.getPlayerAABB(position);
        const testY = aabb.minY - this.epsilon;

        const points = [
            { x: aabb.minX, z: aabb.minZ },
            { x: aabb.maxX, z: aabb.minZ },
            { x: aabb.minX, z: aabb.maxZ },
            { x: aabb.maxX, z: aabb.maxZ },
            { x: (aabb.minX + aabb.maxX) / 2, z: (aabb.minZ + aabb.maxZ) / 2 },
        ];

        for (const point of points) {
            if (this.isPointInSolid(point.x, testY, point.z)) {
                return true;
            }
        }
        return false;
    }

    updatePosition(delta) {
        if (!this.isControlsLocked()) return;

        const camera = this.camera;
        const currentPos = camera.position.clone();

        if (!this.flying) {
            this.isGrounded = this.isOnGround(currentPos);

            if (this.movementState.jump && this.isGrounded) {
                this.velocity.y = this.jumpForce;
            }

            if (!this.isGrounded) {
                this.velocity.y -= this.gravity * delta;
            } else if (this.velocity.y < 0) {
                this.velocity.y = 0;
            }
        } else {
            let moveY = 0;
            if (this.movementState.jump) moveY += 1;
            if (this.movementState.sprint) moveY -= 1;
            this.velocity.y = moveY * this.moveSpeed * this.flyMult;
        }

        let targetPos = currentPos.clone();
        //targetPos.y += this.velocity.y * delta;
        const moveVector = new Vector3(0, 0, 0);

        let moveX = 0,
            moveZ = 0;
        if (this.movementState.forward) moveZ = 1;
        if (this.movementState.backward) moveZ = -1;
        if (this.movementState.left) moveX = 1;
        if (this.movementState.right) moveX = -1;

        if (moveX !== 0 || moveZ !== 0) {
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
                    : 1) *
                (this.inWater() ? 0.5 : 1.0);

            moveVector.multiplyScalar(speed * delta);
            //console.log(this.velocity.y);
        }
        moveVector.y += this.velocity.y * delta;
        targetPos.add(moveVector);
        const finalPos = this.resolveCollision(currentPos, targetPos, delta);

        if (Math.abs(finalPos.y - targetPos.y) > this.epsilon) {
            if (this.velocity.y < 0) {
                this.velocity.y = 0;
            } else if (this.velocity.y > 0) {
                this.velocity.y = 0;
            }
        }
        camera.position.copy(finalPos);
    }
}

export { Player };
