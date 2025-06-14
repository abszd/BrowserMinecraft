export class Inventory {
    constructor(chunkManager, params = {}) {
        this.width = params.width || 9;
        this.height = params.height || 4;
        this.stackSize = params.stackSize || 64;
        this.mgr = chunkManager;
        this.inventory = new Array(this.width * this.height).fill(null);
        this.scrollInterval = 50;
        this.lastScroll = 0;
        this.holding = 0;
        this.blockInHand = null;
        this.open = false;

        // Simplified state management
        this.selectedSlot = null;
        this.heldItem = null;
        this.isMouseDown = false;

        this.setupEventListeners();
        this.createHotbarOutline();
        this.createInventoryMenu();
    }

    setupEventListeners() {
        document.addEventListener("wheel", (event) => {
            if (!this.open) {
                if (event.deltaY > 0) {
                    this.holding = (this.holding + 1) % this.width;
                } else {
                    this.holding = (this.holding - 1 + this.width) % this.width;
                }
                this.updateHotbarOutline();
            }
        });

        document.addEventListener("mousedown", (event) => {
            this.isMouseDown = true;
        });

        document.addEventListener("mouseup", (event) => {
            this.isMouseDown = false;
        });

        document.addEventListener("keydown", (event) => {
            if (event.code === "KeyE" || event.code === "Escape") {
                this.toggleInventory();
            }
        });
    }

    toggleInventory() {
        this.open = !this.open;
        this.inventoryMenu.style.display = this.open ? "block" : "none";

        if (this.open) {
            document.exitPointerLock();
        } else {
            // Return any held item to inventory when closing
            if (this.heldItem) {
                this.returnHeldItem();
            }
        }
    }

    createInventoryMenu() {
        this.inventoryMenu = document.createElement("div");
        this.inventoryMenu.id = "inventory-menu";
        this.inventoryMenu.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 540px;
            height: 320px;
            background: linear-gradient(135deg, rgba(30, 30, 30, 0.95), rgba(40, 40, 40, 0.95));
            border: 2px solid #555;
            border-radius: 12px;
            display: none;
            padding: 24px;
            z-index: 2000;
            font-family: 'Courier New', monospace;
            color: white;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
        `;

        // Title
        const title = document.createElement("div");
        title.textContent = "Inventory";
        title.style.cssText = `
            font-size: 20px;
            margin-bottom: 20px;
            text-align: center;
            color: #fff;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        `;
        this.inventoryMenu.appendChild(title);

        // Inventory grid
        this.inventoryGrid = document.createElement("div");
        this.inventoryGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(${this.width}, 52px);
            grid-template-rows: repeat(${this.height}, 52px);
            gap: 4px;
            justify-content: center;
            margin-bottom: 20px;
        `;

        this.createInventorySlots();
        this.inventoryMenu.appendChild(this.inventoryGrid);

        // Close button
        const closeButton = document.createElement("button");
        closeButton.textContent = "Close (E)";
        closeButton.style.cssText = `
            display: block;
            margin: 0 auto;
            padding: 10px 20px;
            background: linear-gradient(135deg, #555, #666);
            border: 1px solid #777;
            border-radius: 6px;
            color: white;
            cursor: pointer;
            font-family: inherit;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.2s ease;
        `;
        closeButton.addEventListener("mouseenter", () => {
            closeButton.style.background = "linear-gradient(135deg, #666, #777)";
        });
        closeButton.addEventListener("mouseleave", () => {
            closeButton.style.background = "linear-gradient(135deg, #555, #666)";
        });
        closeButton.addEventListener("click", () => this.toggleInventory());
        this.inventoryMenu.appendChild(closeButton);

        document.body.appendChild(this.inventoryMenu);
    }

    createInventorySlots() {
        for (let i = 0; i < this.width * this.height; i++) {
            const slot = document.createElement("div");
            slot.className = "inventory-slot";
            slot.dataset.index = i;
            slot.style.cssText = `
                width: 52px;
                height: 52px;
                border: 2px solid #555;
                background: linear-gradient(135deg, rgba(50, 50, 50, 0.8), rgba(60, 60, 60, 0.8));
                display: flex;
                align-items: flex-end;
                justify-content: flex-end;
                border-radius: 6px;
                position: relative;
                cursor: pointer;
                font-size: 11px;
                color: white;
                font-weight: bold;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
                padding: 2px;
                transition: all 0.15s ease;
                box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
            `;

            this.setupSlotEvents(slot, i);
            this.inventoryGrid.appendChild(slot);
        }
    }

    setupSlotEvents(slot, index) {
        slot.addEventListener("mouseenter", () => {
            if (!this.heldItem) {
                slot.style.borderColor = "#777";
                slot.style.transform = "scale(1.05)";
            }
        });

        slot.addEventListener("mouseleave", () => {
            slot.style.borderColor = "#555";
            slot.style.transform = "scale(1)";
        });

        slot.addEventListener("click", (event) => {
            event.preventDefault();
            this.handleSlotClick(index, event.button === 2);
        });

        slot.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            this.handleSlotClick(index, true);
        });
    }

    handleSlotClick(index, isRightClick) {
        const slotItem = this.inventory[index];

        if (!this.heldItem && !slotItem) {
            // Clicking empty slot with empty hand - do nothing
            return;
        }

        if (!this.heldItem && slotItem) {
            // Pick up item from slot
            if (isRightClick) {
                // Right click - pick up half
                const halfCount = Math.ceil(slotItem.count / 2);
                this.heldItem = { id: slotItem.id, count: halfCount };
                slotItem.count -= halfCount;

                if (slotItem.count === 0) {
                    this.inventory[index] = null;
                }
            } else {
                // Left click - pick up all
                this.heldItem = { ...slotItem };
                this.inventory[index] = null;
            }
            this.selectedSlot = index;
        } else if (this.heldItem && !slotItem) {
            // Place item in empty slot
            if (isRightClick) {
                // Right click - place one
                this.inventory[index] = { id: this.heldItem.id, count: 1 };
                this.heldItem.count--;

                if (this.heldItem.count === 0) {
                    this.heldItem = null;
                    this.selectedSlot = null;
                }
            } else {
                // Left click - place all
                this.inventory[index] = { ...this.heldItem };
                this.heldItem = null;
                this.selectedSlot = null;
            }
        } else if (this.heldItem && slotItem) {
            // Both hand and slot have items
            if (this.heldItem.id === slotItem.id) {
                // Same item type - try to stack
                const canAdd = Math.min(this.heldItem.count, this.stackSize - slotItem.count);
                slotItem.count += canAdd;
                this.heldItem.count -= canAdd;

                if (this.heldItem.count === 0) {
                    this.heldItem = null;
                    this.selectedSlot = null;
                }
            } else {
                // Different items - swap
                const tempItem = { ...slotItem };
                this.inventory[index] = { ...this.heldItem };
                this.heldItem = tempItem;
            }
        }

        this.updateDisplay();
        this.updateHotbarOutline();
    }

    returnHeldItem() {
        if (!this.heldItem) return;

        // Try to return to original slot first
        if (this.selectedSlot !== null && !this.inventory[this.selectedSlot]) {
            this.inventory[this.selectedSlot] = this.heldItem;
            this.heldItem = null;
            this.selectedSlot = null;
            this.updateDisplay();
            return;
        }

        // Find any empty slot
        for (let i = 0; i < this.inventory.length; i++) {
            if (!this.inventory[i]) {
                this.inventory[i] = this.heldItem;
                this.heldItem = null;
                this.selectedSlot = null;
                this.updateDisplay();
                return;
            }
        }

        // Try to stack with existing items
        for (let i = 0; i < this.inventory.length; i++) {
            const item = this.inventory[i];
            if (item && item.id === this.heldItem.id && item.count < this.stackSize) {
                const canAdd = Math.min(this.heldItem.count, this.stackSize - item.count);
                item.count += canAdd;
                this.heldItem.count -= canAdd;

                if (this.heldItem.count === 0) {
                    this.heldItem = null;
                    this.selectedSlot = null;
                    this.updateDisplay();
                    return;
                }
            }
        }
    }

    add(itemId) {
        let emptyIndex = -1;
        let found = false;
        for (let i = 0; i < this.width * this.height; i++) {
            if (!this.inventory[i]) {
                if (emptyIndex === -1) {
                    emptyIndex = i;
                } else {
                    continue;
                }
            } else if (this.inventory[i].id === itemId) {
                if (this.inventory[i].count < this.stackSize) {
                    this.inventory[i].count++;
                    found = true;
                    break;
                } else {
                    continue;
                }
            }
        }
        if (!found && emptyIndex !== -1) {
            this.inventory[emptyIndex] = { id: itemId, count: 1 };
            found = true;
        }
        if (found) {
            this.updateHotbarOutline();
            this.updateDisplay();
        }
        return found;
    }

    remove(index, all = false) {
        if (!this.inventory[index]) {
            return false;
        }
        if (this.inventory[index].count === 1 || all) {
            this.inventory[index] = null;
        } else {
            this.inventory[index].count--;
        }
        this.updateHotbarOutline();
        this.updateDisplay();
        return true;
    }

    updateDisplay() {
        if (!this.inventoryGrid) return;

        for (let i = 0; i < this.width * this.height; i++) {
            const slot = this.inventoryGrid.children[i];
            const item = this.inventory[i];

            if (item) {
                slot.style.backgroundImage = `url('icons/${this.mgr.idBlockTypeLookup[item.id]}.png')`;
                slot.style.backgroundSize = "36px 36px";
                slot.style.backgroundRepeat = "no-repeat";
                slot.style.backgroundPosition = "center";
                slot.textContent = item.count > 1 ? item.count : "";
            } else {
                slot.style.backgroundImage = "none";
                slot.textContent = "";
            }

            // Highlight selected slot
            if (this.selectedSlot === i && this.heldItem) {
                slot.style.borderColor = "#ffaa00";
                slot.style.boxShadow = "inset 0 0 8px rgba(255, 170, 0, 0.5)";
            } else {
                slot.style.borderColor = "#555";
                slot.style.boxShadow = "inset 0 1px 3px rgba(0, 0, 0, 0.3)";
            }
        }
    }

    updateHotbarOutline() {
        for (let i = 0; i < this.width; i++) {
            if (i === this.holding) {
                this.blockInHand = this.inventory[this.holding] ? this.inventory[this.holding].id : null;
            }
            this.hotbar.childNodes[i].style.border = i === this.holding ? "2px solid #fff" : "2px solid #666";

            if (this.inventory[i]) {
                this.hotbar.childNodes[i].style.backgroundImage = `url('icons/${
                    this.mgr.idBlockTypeLookup[this.inventory[i].id]
                }.png')`;
                this.hotbar.childNodes[i].style.backgroundSize = "contain";
                this.hotbar.childNodes[i].style.backgroundRepeat = "no-repeat";
                this.hotbar.childNodes[i].style.backgroundPosition = "center";
                this.hotbar.childNodes[i].textContent = this.inventory[i].count;
                this.hotbar.childNodes[i].style.display = "flex";
                this.hotbar.childNodes[i].style.alignItems = "flex-end";
                this.hotbar.childNodes[i].style.justifyContent = "flex-end";
                this.hotbar.childNodes[i].style.fontSize = "12px";
                this.hotbar.childNodes[i].style.color = "#fff";
                this.hotbar.childNodes[i].style.fontWeight = "bold";
                this.hotbar.childNodes[i].style.textShadow = "1px 1px 0px #000";
            } else {
                this.hotbar.childNodes[i].style.backgroundImage = "none";
                this.hotbar.childNodes[i].textContent = "";
                this.hotbar.childNodes[i].style.display = "flex";
                this.hotbar.childNodes[i].style.alignItems = "center";
                this.hotbar.childNodes[i].style.justifyContent = "center";
            }
        }
    }

    createHotbarOutline() {
        const hotbar = document.createElement("div");
        hotbar.id = "hotbar";
        hotbar.style.position = "fixed";
        hotbar.style.bottom = "20px";
        hotbar.style.left = "50%";
        hotbar.style.transform = "translateX(-50%)";
        hotbar.style.display = "flex";
        hotbar.style.gap = "2px";
        hotbar.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        hotbar.style.padding = "8px";
        hotbar.style.borderRadius = "4px";
        hotbar.style.zIndex = "1000";

        for (let i = 0; i < this.width; i++) {
            const slot = document.createElement("div");
            slot.className = "hotbar-slot";
            slot.style.width = "50px";
            slot.style.height = "50px";
            slot.style.border = i === this.holding ? "2px solid #fff" : "2px solid #666";
            slot.style.display = "flex";
            slot.style.alignItems = "center";
            slot.style.justifyContent = "center";
            slot.style.fontSize = "12px";
            slot.style.color = "#fff";
            slot.dataset.index = i;

            hotbar.appendChild(slot);
        }

        document.body.appendChild(hotbar);
        this.hotbar = hotbar;
    }
}
