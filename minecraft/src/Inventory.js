export class Inventory {
    constructor(params = {}) {
        this.width = params.width || 9;
        this.height = params.height || 4;
        this.stackSize = params.stackSize || 64;
        this.inventory = new Array(this.width * this.height).fill(null);
        this.scrollInterval = 50;
        this.lastScroll = 0;
        this.holding = 0;
        this.open = false;
        this.setupEventListeners();
        this.createHotbarOutline();
    }

    setupEventListeners() {
        document.addEventListener("wheel", (event) => {
            if (event.deltaY < 0) {
                this.holding = (this.holding + 1) % this.width;
            } else {
                this.holding = (this.holding - 1 + this.width) % this.width;
            }
            this.updateHotbarOutline();
        });
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
        if (found) this.updateHotbarOutline();
        //console.log(this.inventory);
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
        return true;
    }

    updateHotbarOutline() {
        for (let i = 0; i < this.width; i++) {
            this.hotbar.childNodes[i].style.border =
                i === this.holding ? "2px solid #fff" : "2px solid #666";
            this.hotbar.childNodes[i].style.backgroundColor = this.inventory[i]
                ? "rgba(50, 200, 50, 0.7)"
                : "rgba(50, 50, 50, 0.7)";
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
        hotbar.style.backgroundColor = "rgba(0, 0, 0, 0.3)";
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
            slot.style.backgroundColor = this.inventory[i]
                ? "rgba(50, 50, 50, 0.7)"
                : "rgba(50, 50, 50, 0.7)";
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
