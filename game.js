import settings from "./settings.json";

// Check whether a (T[][]) includes b (T[])
function includesArray(a, b) {
    for (const el of a) {
        if (el.every((v, i) => v === b[i])) return true;
    }
    return false;
}

export class Player {
    constructor(id) {
        this.id = id;

        this.invented = [];
        this.pos = [0, 0];
        this.nextMoveTurn = -1;
        this.points = 0;

        // Possible types: "none", "jump", "invent"
        this.move = {
            type: "none",
            vec: [-1, -1]
        }
        this.lastMoveStatus = {
            ok: true,
            msg: ""
        }
    }

    resetMove() {
        this.move.type = "none";
        this.move.vec = [-1, -1];
    }

    setMoveStatus(ok, msg) {
        this.lastMoveStatus.ok = ok;
        this.lastMoveStatus.msg = msg;
    }
}

function isInBounds(pos) {
    const { width, height } = settings;
    return pos[0] >= 0 && pos[1] >= 0 && pos[0] < width && pos[1] < height;
}

// Note: All timed functions are evaluated lazily. This includes starting the game, turns, etc.
export class Game {
    constructor(id) {
        this.gameState = "lobby";
        this.gameId = id;

        /** @type {Player[]} */
        this.players = [];

        this.board = [];
        this.invents = []; // list of all invented jumps
        this.turnNum = -1;
        this.gameStartTime = -1; // Time of first turn start
    }

    // Needs to run before any API operations (join, getGame)
    update() {
        if (this.shouldStartGame()) {
            this.startGame();
        }

        const newTurnNum = Math.floor((Date.now()-this.gameStartTime)/settings.turnDelay)+1;
        if (newTurnNum > this.turnNum) {
            if (this.gameState !== "lobby") {
                this.runMoves();
            }
        }

        this.turnNum = newTurnNum;
    }

    prelimMoveCheck(p, move) {
        if (move.type === "jump") {
            if (!includesArray(p.invented, move.vec)) {
                return [false, "ERR_NOT_INVENTED"];
            }

            const destPos = [p.pos[0]+move.vec[0], p.pos[1]+move.vec[1]];
            if (!isInBounds(destPos)) {
                return [false, "ERR_JUMP_OUT_OF_BOUNDS"];
            }
        } else if (move.type === "invent") {
            if (includesArray(this.invents, move.vec)) {
                return [false, "ERR_ALREADY_INVENTED"];
            }
        }
        return [true, "SUCCESS"];
    }

    // Assumes that current turn is turnNum+1
    runMoves() {
        // remove pre-emptive turns
        for (const p of this.players) {
            if (p.move.type !== "none" && p.nextMoveTurn > this.turnNum+1) {
                p.setMoveStatus(false, "ERR_MOVE_DELAY");
                p.resetMove();
            }
        }

        const destList = []; // list of endpoints of jumps
        const invalidDest = [];

        // can't move to occupied space
        for (const p of this.players) {
            destList.push(p.pos);
        }

        const inventList = []; // list of new inventions
        const invalidInvent = [];
        for (const p of this.players) {
            if (p.move.type === "jump") {
                if (!includesArray(p.invented, p.move.vec)) {
                    p.setMoveStatus(false, "ERR_NOT_INVENTED");
                    p.resetMove();
                    continue;
                }

                const destPos = [p.pos[0]+p.move.vec[0], p.pos[1]+p.move.vec[1]];
                if (!isInBounds(destPos)) {
                    p.setMoveStatus(false, "ERR_JUMP_OUT_OF_BOUNDS");
                    p.resetMove();
                    continue;
                }
                if (includesArray(destList, destPos)) {
                    p.setMoveStatus(false, "ERR_JUMP_CONFLICT");
                    invalidDest.push(destPos);
                    p.resetMove();
                    continue;
                }
                destList.push(destPos);
            } else if (p.move.type === "invent") {
                if (includesArray(this.invents, p.move.vec)) {
                    p.setMoveStatus(false, "ERR_ALREADY_INVENTED");
                    p.resetMove();
                    continue;
                }

                if (includesArray(inventList, p.move.vec)) {
                    p.setMoveStatus(false, "ERR_INVENT_CONFLICT");
                    invalidInvent.push(p.move.vec);
                    p.resetMove();
                    continue;
                }
                inventList.push(p.move.vec);
            }
        }

        // erase invalid moves and carry out successful moves
        for (const p of this.players) {
            if (p.move.type === "jump") {
                const destPos = [p.pos[0]+p.move.vec[0], p.pos[1]+p.move.vec[1]];
                if (includesArray(invalidDest, destPos)) {
                    p.setMoveStatus(false, "ERR_JUMP_CONFLICT");
                    p.resetMove();
                    continue;
                }

                p.pos = destPos;
                p.nextMoveTurn = this.turnNum+1+settings.jumpTurns;
                p.setMoveStatus(true, "JUMP_SUCCESS");
                p.resetMove();
                if (this.board[p.pos[0]][p.pos[1]] === "$") {
                    p.points++;
                    this.board[p.pos[0]][p.pos[1]] = ".";
                }
            } else if (p.move.type === "invent") {
                if (includesArray(invalidInvent, p.move.vec)) {
                    p.setMoveStatus(false, "ERR_INVENT_CONFLICT");
                    p.resetMove();
                    continue;
                }

                this.invents.push(p.move.vec);
                p.invented.push(p.move.vec);
                p.nextMoveTurn = this.turnNum+1+settings.inventTurns;
                p.setMoveStatus(true, "INVENT_SUCCESS");
                p.resetMove();
            }
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
            while (includesArray(usedPos, tryPos)) tryPos = genPos(); // prevent overlaps
            p.pos = tryPos;
        }

        // Fill board
        for (let x = 0; x < height; x++) {
            const tempRow = [];
            for (let y = 0; y < width; y++) {
                if (!includesArray(usedPos, [x, y]) && Math.random() < settings.pointDensity) {
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
                invented: p.invented,
                points: p.points
            };
        });
        const nextTurnTime = this.gameStartTime + settings.turnDelay*this.turnNum;
        const ret = {
            gameState: this.gameState,
            board: board,
            startTime: this.gameStartTime,
            nextTurnTime: nextTurnTime,
            turnDelay: settings.turnDelay,
            turnNum: this.turnNum,
            players: players,
        }
        if (playerId) {
            const myPlayer = this.players.find(p => p.id === playerId);
            if (!myPlayer) return ret;
            ret.myPlayer = {
                pos: myPlayer.pos,
                invented: myPlayer.invented,
                points: myPlayer.points,
                nextMoveTurn: myPlayer.nextMoveTurn,
                lastMoveStatus: myPlayer.lastMoveStatus
            };
        }
        return ret;
    }

    setMove(playerId, move) {
        this.update();
        const player = this.players.find(p => p.id === playerId);
        if (!player) {
            throw new Error("ERR_PLAYER_NOT_IN_GAME");
        }

        const prelimChk = this.prelimMoveCheck(player, move);
        if (!prelimChk[0]) throw new Error(prelimChk[1]);

        player.move.type = move.type;
        player.move.vec[0] = move.vec[0];
        player.move.vec[1] = move.vec[1];

        return {
            ok: true,
            turnNum: this.turnNum
        }
    }

}


