import { Scene } from "three";
import { Player } from "./Player";

export class PlayerSceneManager {
    constructor(player, mainScene) {
        this.player = player;
        this.mainScene = mainScene;
        this.playerScene = new Scene();
    }
}
