import settings from "./settings.json";

export class Player {
    constructor(id) {
        this.id = id;

        this.invented = [];
        this.pos = [0, 0];
    }
}

// Note: All timed functions are evaluated lazily. This includes starting the game, turns, etc.
export class Game {
    constructor(id) {
        this.gameState = "lobby";
        this.gameId = id;

        /** @type {Player[]} */
        this.players = [];

        this.board = [];
        this.turnNum = -1;
        this.gameStartTime = -1; // Time of first turn start
    }

    // Needs to run before any API operations (join, getGame)
    update() {
        if (this.shouldStartGame()) {
            this.startGame();
        }
    }

    isJoined(id) {
        return this.players.find(p => p.id === id) !== undefined;
    }

    // Checks if game can be joined right now
    canCurrentlyJoin() {
        return this.gameState === "lobby" && this.players.length < settings.maxPlayers;
    }

    join(player) {
        this.update();
        if (!this.canCurrentlyJoin()) {
            throw new Error("ERR_LATE_JOIN");
        }

        if (this.players.length >= settings.maxPlayers) {
            throw new Error("ERR_PLAYER_LIMIT");
        }

        if (this.isJoined(player.id)) {
            return;
        }

        this.players.push(player);
        if (this.players.length >= settings.minPlayers) {
            this.setGameStart();
        }
    }

    // Sets the game start time, since there are enough players.
    setGameStart() {
        this.gameStartTime = Date.now() + settings.startDelay;
    }

    shouldStartGame() {
        return this.gameState === "lobby" && this.gameStartTime >= 0 && Date.now() >= this.gameStartTime;
    }

    startGame() {
        // Randomly move players around
        const { width, height } = settings;
        const usedPos = [];
        const genPos = () => { return [Math.floor(Math.random()*width), Math.floor(Math.random()*height)]}
        for (const p of this.players) {
            let tryPos = genPos();
            while (usedPos.includes(tryPos)) tryPos = genPos(); // prevent overlaps
            p.pos = tryPos;
        }

        // Fill board
        for (let x = 0; x < height; x++) {
            const tempRow = [];
            for (let y = 0; y < width; y++) {
                if (!usedPos.includes([x, y]) && Math.random() < settings.pointDensity) {
                    tempRow.push("$");
                } else {
                    tempRow.push(".");
                }
            }
            this.board.push(tempRow);
        }

        this.turnNum = 1;

        this.gameState = "playing";
    }

    getGame(playerId) {
        this.update();
        if (this.gameState === "lobby") {
            return {
                gameState: "lobby",
                startTime: this.gameStartTime
            };
        }
        const board = this.board.map(r => r.join(""));
        const players = this.players.map(p => {
            return {
                pos: p.pos,
                invented: p.invented
            };
        })
        const ret = {
            gameState: this.gameState,
            board: board,
            startTime: this.gameStartTime,
            turnNum: this.turnNum,
            players: players
        }
        if (playerId) {
            const myPlayer = this.players.find(p => p.id === playerId);
            if (!myPlayer) return ret;
            ret.myPlayer = {
                pos: myPlayer.pos,
                invented: myPlayer.invented
            };
        }
        return ret;
    }

}


