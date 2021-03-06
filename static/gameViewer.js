
const updateSpeed = 200;
const gracePeriod = 100; // time between turn start and refresh

class GameViewer {
    constructor(id, elem, playerId) {
        this.id = id;
        this.playerId = playerId ?? -1;
        /** @type{HTMLElement} */
        this.elem = elem;
        elem.innerHTML = "";

        this.timeout = -1;
        this.destroyed = false;
        this.lastState = "lobby";
        this.refreshGame();
    }

    // events
    onStart(gameData) {}
    onFinish(gameData) {}

    async refreshGame() {
        try {
            const serverResp = await fetch("api/getGame", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    gameId: this.id,
                    playerId: this.playerId
                })
            });
            const gameData = await serverResp.json();
            if (this.destroyed) return;
            clearTimeout(this.timeout);
            if (serverResp.ok) {
                this.parseData(gameData);
                if (gameData.gameState === "lobby" && gameData.startTime > 0) {
                    this.timeout = setTimeout(this.refreshGame.bind(this), updateSpeed);
                } else if (gameData.gameState === "playing" && gameData) {
                    this.timeout = setTimeout(this.refreshGame.bind(this), Math.max(updateSpeed, gameData.nextTurnTime-Date.now()+gracePeriod));
                } else {
                    this.timeout = setTimeout(this.refreshGame.bind(this), updateSpeed);
                }
            } else {
                this.showError(gameData.error, "fetching game");
                this.timeout = setTimeout(this.refreshGame.bind(this), updateSpeed);
            }
        } catch (err) {
            this.showError(err, "fetching game");
            clearTimeout(this.timeout);
            this.timeout = setTimeout(this.refreshGame.bind(this), updateSpeed);
        }
    }

    parseData(gameData) {
        if (gameData.gameState === "playing" && this.lastState === "lobby") {
            this.onStart(gameData);
        }
        if (gameData.gameState === "finished" && this.lastState === "playing") {
            this.onFinish(gameData);
        }
        this.lastState = gameData.gameState;

        this.displayGame(gameData);
    }

    displayGame(gameData) {
        const infoPId = `game-infoP-${this.elem.id}`;
        const tableId = `game-table-${this.elem.id}`;
        const infoP = document.getElementById(infoPId) ?? document.createElement("p");
        infoP.id = infoPId;
        const table = document.getElementById(tableId) ?? document.createElement("table");
        table.id = tableId;
        if (gameData.gameState !== "lobby") {
            infoP.innerText = `Turn: ${gameData.turnNum}, Game ID: ${this.id}`;

            const board = gameData.board;

            // remove popovers
            if (document.getElementById(tableId)) {
                for (let x = 0; x < board.length; x++) {
                    for (let y = 0; y < board[x].length; y++) {
                        const tdId = `game-td-${this.elem.id}-${x}-${y}`;
                        const tdElem = document.getElementById(tdId);
                        if (!tdElem) continue;
                        const popover = bootstrap.Popover.getInstance(tdElem);
                        popover?.dispose();
                    }
                }
            }

            table.classList.add("game-table");
            table.innerHTML = "";
            for (let x = 0; x < board.length; x++) {
                const tr = document.createElement("tr");
                for (let y = 0; y < board[x].length; y++) {
                    const td = document.createElement("td");
                    td.innerText = "$"; // needs this for equal-ish spacing
                    td.id = `game-td-${this.elem.id}-${x}-${y}`;
                    if (board[x][y] === "$") {
                        td.classList.add("game-td-point");
                    } else if (board[x][y] === ".") {
                        td.classList.add("game-td-empty");
                    }
                    tr.appendChild(td);
                }
                table.appendChild(tr);
            }

            for (const p of gameData.players) {
                const posId = `#game-td-${this.elem.id}-${p.pos[0]}-${p.pos[1]}`;
                const elem = table.querySelector(posId);
                elem.innerText = "P";
                elem.classList.add("game-td-player");

                if (gameData.gameState === "finished" && gameData.winnerHashes.includes(p.idHash)) {
                    elem.classList.add("game-td-winner");
                }

                let inventStr = "";
                for (const vec of p.invented) {
                    inventStr += `(${vec[0]},${vec[1]}), `;
                }
                inventStr = inventStr.slice(0, -2); // remove comma

                const popover = new bootstrap.Popover(elem, {
                    animation: true,
                    content: `Points: ${p.points}, Invented: [${inventStr}]`,
                    placement: "top",
                    trigger: "hover"
                });
            }

            if (gameData.myPlayer) {
                const p = gameData.myPlayer;
                const posId = `#game-td-${this.elem.id}-${p.pos[0]}-${p.pos[1]}`;
                const elem = table.querySelector(posId);
                elem.innerText = "Y";
                elem.classList.add("game-td-myplayer");

                let inventStr = "";
                for (const vec of p.invented) {
                    inventStr += `(${vec[0]},${vec[1]}), `;
                }
                inventStr = inventStr.slice(0, -2); // remove comma
                infoP.innerText += `, Points: ${p.points}, Invented: [${inventStr}]`;

                if (gameData.gameState === "finished") {
                    infoP.innerText += gameData.winnerHashes.includes(p.idHash) ? ", YOU WIN!" : ", You lose";
                }

                if (!p.lastMoveStatus.ok) {
                    this.showError(p.lastMoveStatus.msg, "last move");
                }
            }
        } else {
            if (gameData.startTime === -1) {
                infoP.innerText = "In lobby, waiting for players";
            } else {
                const timeLeft = ((gameData.startTime - Date.now())/1000).toFixed(1);
                infoP.innerText = "Lobby, game starts in "+timeLeft+" seconds";
            }
        }

        if (!document.getElementById(infoPId)) this.elem.appendChild(infoP);
        if (!document.getElementById(tableId)) this.elem.appendChild(table);
    }

    destructor() {
        clearTimeout(this.timeout);
        this.destroyed = true;
    }

    showError(msg, aspect) {
        const errId = `viewer-${this.elem.id}-err`;
        if (!msg) {
            document.getElementById(errId)?.remove();
            return;
        }
        let errElem = document.getElementById(errId) ?? document.createElement("div");
        errElem.id = errId;
        errElem.classList.add("alert", "alert-danger");
        if (aspect) {
            errElem.innerText = `Error with ${aspect}: ${msg}`;
        } else {
            errElem.innerText = `Error: ${msg}`;
        }
        if (!document.getElementById(errId)) {
            this.elem.prepend(errElem);
        }
    }
}

class GamePlayer extends GameViewer {
    constructor(gameId, elem, playerId) {
        super(gameId, elem, playerId);
        this.moveEnabled = true;
    }

    // events
    onMoveDisable(gameData) {} // fires every turn it is disabled
    onMoveEnable(gameData) {} // fires when it is possible to move again

    parseData(gameData) {
        super.parseData(gameData);

        // must subtract one since moves happen at the beginning of the turn
        if (gameData.gameState === "playing") {
            if (gameData.myPlayer.nextMoveTurn-1 <= gameData.turnNum && !this.moveEnabled) {
                this.onMoveEnable(gameData);
                this.moveEnabled = true;
            } else if (gameData.myPlayer.nextMoveTurn-1 > gameData.turnNum) {
                this.onMoveDisable(gameData);
                this.moveEnabled = false;
            }
        } else if (gameData.gameState === "finished" && this.moveEnabled) {
            this.onMoveDisable(gameData);
            this.moveEnabled = false;
        }
    }

    async sendMove(type, vec) {
        try {
            const serverResp = await fetch("api/move", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    gameId: this.id,
                    playerId: this.playerId,
                    move: {
                        type: type,
                        vec: vec
                    }
                })
            });
            const res = await serverResp.json();
            if (this.destroyed) return;
            if (!serverResp.ok) {
                const err = res.error;
                this.showError(err, `${type} move`);
            } else {
                this.showError("");
            }
        } catch (err) {
            this.showError(err, `${type} move`);
        }
    }
}
