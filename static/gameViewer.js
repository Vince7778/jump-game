
class GameViewer {
    constructor(id, elem, playerId) {
        this.id = id;
        this.playerId = playerId ?? -1;
        /** @type{HTMLElement} */
        this.elem = elem;

        this.timeout = -1;
        this.destroyed = false;
        this.refreshGame();
    }

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
            if (serverResp.ok) {
                this.displayGame(gameData);
                this.timeout = setTimeout(this.refreshGame.bind(this), gameData.nextTurnTime-Date.now());
            } else {
                this.elem.innerHTML = "Error fetching game: "+gameData.error;
                this.timeout = setTimeout(this.refreshGame.bind(this), 1000);
            }
        } catch (err) {
            this.elem.innerHTML = "Error fetching game: "+err;
            this.timeout = setTimeout(this.refreshGame.bind(this), 1000);
        }
    }

    displayGame(gameData) {
        this.elem.innerHTML = "";
        if (gameData.gameState !== "lobby") {
            const infoP = document.createElement("p");
            infoP.innerText = `Turn: ${gameData.turnNum}`;
            this.elem.appendChild(infoP);

            const table = document.createElement("table");
            table.classList.add("game-table");
            const board = gameData.board;
            for (let x = 0; x < board.length; x++) {
                const tr = document.createElement("tr");
                for (let y = 0; y < board[x].length; y++) {
                    const td = document.createElement("td");
                    td.innerText = "$"; // needs this for equal-ish spacing
                    td.id = `game-td-${this.id}-${x}-${y}`;
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
                const posId = `#game-td-${this.id}-${p.pos[0]}-${p.pos[1]}`;
                const elem = table.querySelector(posId);
                elem.innerText = "P";
                elem.classList.add("game-td-player");
            }

            if (gameData.myPlayer) {
                const p = gameData.myPlayer;
                const posId = `#game-td-${this.id}-${p.pos[0]}-${p.pos[1]}`;
                const elem = table.querySelector(posId);
                elem.innerText = "Y";
                elem.classList.add("game-td-myplayer");
            }

            this.elem.appendChild(table);
        } else {
            if (gameData.startTime === -1) {
                this.elem.innerText = "In lobby, waiting for players";
            } else {
                const timeLeft = ((gameData.startTime - Date.now())/1000).toFixed(1);
                this.elem.innerText = "Lobby, game starts in "+timeLeft+" seconds";
            }
        }
    }

    destructor() {
        clearTimeout(this.timeout);
        this.destroyed = true;
    }
}
