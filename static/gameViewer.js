
let gameData = {};
let curViewId = -1, curViewTimeout = -1;

async function refreshGame(id, elem) {
    if (id !== curViewId) {
        clearTimeout(curViewTimeout);
        curViewId = id;
    }
    const serverResp = await fetch("api/getGame", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            gameId: id
        })
    });
    if (serverResp.ok) {
        gameData = await serverResp.json();
    
        displayGame(elem);
    } else {
        elem.innerHTML = "Error fetching game: "+serverResp.statusText;
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
                if (board[x][y] !== ".") td.innerText = board[x][y];
                td.id = `game-td-${x}-${y}`;
                if (board[x][y] === "$") {
                    td.classList.add("game-td-point");
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
        elem.innerText = "Lobby";
    }
}

