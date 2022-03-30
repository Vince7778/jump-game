
let gameData = {};
let curViewId = -1, curViewTimeout = -1;

async function refreshGame(id, elem) {
    if (id !== curViewId) {
        clearTimeout(curViewTimeout);
        curViewId = id;
    }
    try {
        const serverResp = await fetch("api/getGame", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                gameId: id
            })
        });
        gameData = await serverResp.json();
        if (serverResp.ok) {
            displayGame(elem);
        } else {
            elem.innerHTML = "Error fetching game: "+gameData.error;
        }
    } catch (err) {
        elem.innerHTML = "Error fetching game: "+err;
    }
    curViewTimeout = setTimeout(() => refreshGame(id, elem), 1000);
}

// Displays the game with parent element elem
/** @param {HTMLElement} elem */
function displayGame(elem) {
    elem.innerHTML = "";

    if (gameData.gameState !== "lobby") {
        const table = document.createElement("table");
        table.classList.add("table", "table-bordered", "table-sm", "game-table");
        const board = gameData.board;
        for (let x = 0; x < board.length; x++) {
            const tr = document.createElement("tr");
            for (let y = 0; y < board[x].length; y++) {
                const td = document.createElement("td");
                td.innerText = "$"; // needs this for equal-ish spacing
                td.id = `game-td-${x}-${y}`;
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
            const posId = `#game-td-${p.pos[0]}-${p.pos[1]}`;
            const elem = table.querySelector(posId);
            elem.innerText = "P";
            elem.classList.add("game-td-player");
        }

        elem.appendChild(table);
    } else {
        if (gameData.startTime === -1) {
            elem.innerText = "In lobby, waiting for players";
        } else {
            const timeLeft = ((gameData.startTime - Date.now())/1000).toFixed(1);
            elem.innerText = "Lobby, game starts in "+timeLeft+" seconds";
        }
    }
}

