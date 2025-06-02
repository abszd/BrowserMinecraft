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
        this.mousedown = false;
        this.mouseButton = -1;

        this.draggedItem = null;
        this.draggedFromSlot = null;
        this.dragElement = null;
        this.isDragging = false;

        this.craftingGrid = new Array(9).fill(null);
        this.craftingResult = null;

        this.recipes = this.initializeRecipes();

        this.setupEventListeners();
        this.createHotbarOutline();
        this.createInventoryMenu();
    }

    initializeRecipes() {
        // Define crafting recipes (simplified examples)
        return [
            {
                pattern: [
                    [0, 0, 0], // dirt, dirt, null
                    [0, 0, 0], // dirt, dirt, null
                    [null, null, null],
                ],
                result: { id: 1, count: 4 }, // 4 stone
            },
            {
                pattern: [
                    [3, 3, null], // oak_log, oak_log
                    [3, 3, null], // oak_log, oak_log
                    [null, null, null],
                ],
                result: { id: 0, count: 8 }, // 8 dirt
            },
            {
                pattern: [
                    [1, null, null], // stone
                    [1, null, null], // stone
                    [1, null, null], // stone
                ],
                result: { id: 3, count: 2 }, // 2 oak_log
            },
        ];
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
            this.mousedown = true;
            this.mouseButton = event.button;
            if (this.isDragging && this.dragElement) {
                this.dragElement.style.left = event.clientX - 25 + "px";
                this.dragElement.style.top = event.clientY - 25 + "px";
            }
        });

        document.addEventListener("mouseup", (event) => {
            this.mousedown = false;
            if (this.isDragging) {
                this.stopDragging(event);
            }
        });

        document.addEventListener("mousemove", (event) => {
            if (this.isDragging && this.dragElement) {
                this.dragElement.style.left = event.clientX - 25 + "px";
                this.dragElement.style.top = event.clientY - 25 + "px";
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.code === "KeyE" || event.code === "Escape") {
                this.toggleInventory();
            }
        });
    }

    toggleInventory() {
        this.open = !this.open;
        this.inventoryMenu.style.display = this.open ? "flex" : "none";

        // Lock/unlock pointer controls
        if (this.open) {
            document.exitPointerLock();
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
            width: 800px;
            height: 400px;
            background: rgba(40, 40, 40, 0.95);
            border: 3px solid #666;
            border-radius: 8px;
            display: none;
            flex-direction: column;
            padding: 20px;
            z-index: 2000;
            font-family: monospace;
            color: white;
        `;

        // Title
        const title = document.createElement("div");
        title.textContent = "Inventory";
        title.style.cssText = `
            font-size: 18px;
            margin-bottom: 15px;
            text-align: center;
            color: #fff;
        `;
        this.inventoryMenu.appendChild(title);

        // Main container
        const mainContainer = document.createElement("div");
        mainContainer.style.cssText = `
            display: flex;
            gap: 20px;
            flex: 1;
        `;

        // Inventory grid container
        const inventoryContainer = document.createElement("div");
        inventoryContainer.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
        `;

        // Inventory label
        const inventoryLabel = document.createElement("div");
        inventoryLabel.textContent = "Inventory";
        inventoryLabel.style.cssText = `
            font-size: 14px;
            margin-bottom: 10px;
            color: #ccc;
        `;
        inventoryContainer.appendChild(inventoryLabel);

        // Inventory grid
        this.inventoryGrid = document.createElement("div");
        this.inventoryGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(${this.width}, 50px);
            grid-template-rows: repeat(${this.height}, 50px);
            gap: 2px;
            margin-bottom: 20px;
        `;
        this.createInventorySlots();
        inventoryContainer.appendChild(this.inventoryGrid);

        // Crafting container
        const craftingContainer = document.createElement("div");
        craftingContainer.style.cssText = `
            width: 200px;
            display: flex;
            flex-direction: column;
        `;

        // Crafting label
        const craftingLabel = document.createElement("div");
        craftingLabel.textContent = "Crafting";
        craftingLabel.style.cssText = `
            font-size: 14px;
            margin-bottom: 10px;
            color: #ccc;
        `;
        craftingContainer.appendChild(craftingLabel);

        // Crafting area
        const craftingArea = document.createElement("div");
        craftingArea.style.cssText = `
            display: flex;
            gap: 15px;
            align-items: center;
        `;

        // Crafting grid (3x3)
        this.craftingGridElement = document.createElement("div");
        this.craftingGridElement.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 40px);
            grid-template-rows: repeat(3, 40px);
            gap: 2px;
            background: rgba(60, 60, 60, 0.8);
            padding: 5px;
            border-radius: 4px;
        `;
        this.createCraftingSlots();

        // Arrow
        const arrow = document.createElement("div");
        arrow.textContent = "→";
        arrow.style.cssText = `
            font-size: 24px;
            color: #fff;
        `;

        // Result slot
        this.resultSlot = document.createElement("div");
        this.resultSlot.className = "result-slot";
        this.resultSlot.style.cssText = `
            width: 50px;
            height: 50px;
            border: 2px solid #666;
            background: rgba(80, 80, 80, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            position: relative;
            cursor: pointer;
        `;
        this.setupSlotEvents(this.resultSlot, "result", 0);

        craftingArea.appendChild(this.craftingGridElement);
        craftingArea.appendChild(arrow);
        craftingArea.appendChild(this.resultSlot);
        craftingContainer.appendChild(craftingArea);

        mainContainer.appendChild(inventoryContainer);
        mainContainer.appendChild(craftingContainer);
        this.inventoryMenu.appendChild(mainContainer);

        // Close button
        const closeButton = document.createElement("button");
        closeButton.textContent = "Close (E)";
        closeButton.style.cssText = `
            padding: 8px 16px;
            background: #666;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            align-self: center;
            margin-top: 15px;
        `;
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
                width: 50px;
                height: 50px;
                border: 2px solid #666;
                background: rgba(60, 60, 60, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                position: relative;
                cursor: pointer;
                font-size: 12px;
                color: white;
                font-weight: bold;
                text-shadow: 1px 1px 0px #000;
            `;
            this.setupSlotEvents(slot, "inventory", i);
            this.inventoryGrid.appendChild(slot);
        }
    }

    createCraftingSlots() {
        for (let i = 0; i < 9; i++) {
            const slot = document.createElement("div");
            slot.className = "crafting-slot";
            slot.dataset.index = i;
            slot.style.cssText = `
                width: 40px;
                height: 40px;
                border: 2px solid #666;
                background: rgba(80, 80, 80, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                position: relative;
                cursor: pointer;
                font-size: 10px;
                color: white;
                font-weight: bold;
                text-shadow: 1px 1px 0px #000;
            `;
            this.setupSlotEvents(slot, "crafting", i);
            this.craftingGridElement.appendChild(slot);
        }
    }

    setupSlotEvents(slot, type, index) {
        slot.addEventListener("mousedown", (event) => {
            event.preventDefault();
            if (this.mouseButton === 0) {
                // Left click
                this.startDragging(type, index, event);
            } else if (this.mouseButton === 2) {
                // Right click
                this.splitStack(type, index);
            }
        });

        slot.addEventListener("mouseup", (event) => {
            if (this.isDragging) {
                this.dropItem(type, index);
            }
        });

        slot.addEventListener("dragover", (event) => {
            event.preventDefault();
        });
    }

    startDragging(type, index, event) {
        let item = null;

        if (type === "inventory") {
            item = this.inventory[index];
        } else if (type === "crafting") {
            item = this.craftingGrid[index];
        } else if (type === "result") {
            item = this.craftingResult;
        }

        if (!item) return;

        this.isDragging = true;
        this.draggedItem = { ...item };
        this.draggedFromSlot = { type, index };

        // Clear the original slot
        if (type === "inventory") {
            this.inventory[index] = null;
        } else if (type === "crafting") {
            this.craftingGrid[index] = null;
            this.updateCraftingResult();
        }

        // Create drag element
        this.dragElement = document.createElement("div");
        this.dragElement.style.cssText = `
            position: fixed;
            width: 50px;
            height: 50px;
            background-image: url('icons/${
                this.mgr.idBlockTypeLookup[item.id]
            }.png');
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            pointer-events: none;
            z-index: 3000;
            border-radius: 4px;
            display: flex;
            align-items: flex-end;
            justify-content: flex-end;
            font-size: 12px;
            color: white;
            font-weight: bold;
            text-shadow: 1px 1px 0px #000;
            padding: 2px;
        `;
        this.dragElement.textContent = item.count > 1 ? item.count : "";
        document.body.appendChild(this.dragElement);

        this.updateDisplay();
    }

    stopDragging(event) {
        if (this.dragElement) {
            document.body.removeChild(this.dragElement);
            this.dragElement = null;
        }

        // If dragging ended without dropping on a valid slot, return item to original position
        if (this.isDragging && this.draggedItem && this.draggedFromSlot) {
            const { type, index } = this.draggedFromSlot;
            if (type === "inventory") {
                this.inventory[index] = this.draggedItem;
            } else if (type === "crafting") {
                this.craftingGrid[index] = this.draggedItem;
                this.updateCraftingResult();
            }
        }

        this.isDragging = false;
        this.draggedItem = null;
        this.draggedFromSlot = null;
        this.updateDisplay();
    }

    dropItem(targetType, targetIndex) {
        if (!this.isDragging || !this.draggedItem) return;

        let targetArray = null;
        if (targetType === "inventory") {
            targetArray = this.inventory;
        } else if (targetType === "crafting") {
            targetArray = this.craftingGrid;
        } else if (targetType === "result") {
            // Can't drop on result slot
            return;
        }

        const existingItem = targetArray[targetIndex];

        if (!existingItem) {
            // Empty slot - place item
            targetArray[targetIndex] = this.draggedItem;
        } else if (existingItem.id === this.draggedItem.id) {
            // Same item type - try to stack
            const totalCount = existingItem.count + this.draggedItem.count;
            if (totalCount <= this.stackSize) {
                existingItem.count = totalCount;
            } else {
                existingItem.count = this.stackSize;
                this.draggedItem.count = totalCount - this.stackSize;
                // Return excess to original slot
                const { type, index } = this.draggedFromSlot;
                if (type === "inventory") {
                    this.inventory[index] = this.draggedItem;
                } else if (type === "crafting") {
                    this.craftingGrid[index] = this.draggedItem;
                }
            }
        } else {
            // Different item - swap
            targetArray[targetIndex] = this.draggedItem;
            const { type, index } = this.draggedFromSlot;
            if (type === "inventory") {
                this.inventory[index] = existingItem;
            } else if (type === "crafting") {
                this.craftingGrid[index] = existingItem;
            }
        }

        if (targetType === "crafting") {
            this.updateCraftingResult();
        }

        // Clear dragging state
        this.isDragging = false;
        this.draggedItem = null;
        this.draggedFromSlot = null;

        if (this.dragElement) {
            document.body.removeChild(this.dragElement);
            this.dragElement = null;
        }

        this.updateDisplay();
    }

    splitStack(type, index) {
        let item = null;
        let array = null;

        if (type === "inventory") {
            item = this.inventory[index];
            array = this.inventory;
        } else if (type === "crafting") {
            item = this.craftingGrid[index];
            array = this.craftingGrid;
        }

        if (!item || item.count <= 1) return;

        const halfCount = Math.floor(item.count / 2);
        item.count -= halfCount;

        const newItem = { id: item.id, count: halfCount };
        if (type === "inventory") {
            const emptyIndex = this.inventory.findIndex((slot) => !slot);
            if (emptyIndex !== -1) {
                this.inventory[emptyIndex] = newItem;
            }
        }

        this.updateDisplay();
        if (type === "crafting") {
            this.updateCraftingResult();
        }
    }

    updateCraftingResult() {
        this.craftingResult = null;

        // Convert crafting grid to pattern
        const pattern = [];
        for (let row = 0; row < 3; row++) {
            pattern[row] = [];
            for (let col = 0; col < 3; col++) {
                const index = row * 3 + col;
                const item = this.craftingGrid[index];
                pattern[row][col] = item ? item.id : null;
            }
        }

        // Check against recipes
        for (const recipe of this.recipes) {
            if (this.patternsMatch(pattern, recipe.pattern)) {
                this.craftingResult = { ...recipe.result };
                break;
            }
        }

        this.updateResultSlot();
    }

    patternsMatch(pattern1, pattern2) {
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                if (pattern1[row][col] !== pattern2[row][col]) {
                    return false;
                }
            }
        }
        return true;
    }

    updateResultSlot() {
        if (this.craftingResult) {
            this.resultSlot.style.backgroundImage = `url('icons/${
                this.mgr.idBlockTypeLookup[this.craftingResult.id]
            }.png')`;
            this.resultSlot.style.backgroundSize = "contain";
            this.resultSlot.style.backgroundRepeat = "no-repeat";
            this.resultSlot.style.backgroundPosition = "center";
            this.resultSlot.textContent =
                this.craftingResult.count > 1 ? this.craftingResult.count : "";
        } else {
            this.resultSlot.style.backgroundImage = "none";
            this.resultSlot.textContent = "";
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
        // Update inventory grid
        for (let i = 0; i < this.width * this.height; i++) {
            const slot = this.inventoryGrid.children[i];
            const item = this.inventory[i];

            if (item) {
                slot.style.backgroundImage = `url('icons/${
                    this.mgr.idBlockTypeLookup[item.id]
                }.png')`;
                slot.style.backgroundSize = "contain";
                slot.style.backgroundRepeat = "no-repeat";
                slot.style.backgroundPosition = "center";
                slot.textContent = item.count > 1 ? item.count : "";
            } else {
                slot.style.backgroundImage = "none";
                slot.textContent = "";
            }
        }

        // Update crafting grid
        for (let i = 0; i < 9; i++) {
            const slot = this.craftingGridElement.children[i];
            const item = this.craftingGrid[i];

            if (item) {
                slot.style.backgroundImage = `url('icons/${
                    this.mgr.idBlockTypeLookup[item.id]
                }.png')`;
                slot.style.backgroundSize = "contain";
                slot.style.backgroundRepeat = "no-repeat";
                slot.style.backgroundPosition = "center";
                slot.textContent = item.count > 1 ? item.count : "";
            } else {
                slot.style.backgroundImage = "none";
                slot.textContent = "";
            }
        }
    }

    updateHotbarOutline() {
        for (let i = 0; i < this.width; i++) {
            if (i === this.holding) {
                this.blockInHand = this.inventory[this.holding]
                    ? this.inventory[this.holding].id
                    : null;
            }
            this.hotbar.childNodes[i].style.border =
                i === this.holding ? "2px solid #fff" : "2px solid #666";

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
            slot.style.border =
                i === this.holding ? "2px solid #fff" : "2px solid #666";
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
