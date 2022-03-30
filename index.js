import express from "express";
const router = express.Router();
import path from "path";
import { Game, Player } from "./game.js";

const dirname = path.resolve();
const SERVER_PORT = process.env.port || 3000;
const STATIC_PATH = path.join(dirname, "/static/");
const jsonParser = express.json();

// main pages
router.use(express.static(STATIC_PATH));

router.get("/", (req, res) => {
    res.sendFile(path.join(STATIC_PATH, "/index.html"));
});

router.get("/docs", (req, res) => {
    res.sendFile(path.join(STATIC_PATH, "/docs.html"));
});

// game logic

/** @type {Game[]} */
const gameList = [];

let curId = 1;
const getId = () => { curId++; return curId-1; }
const randIdMult = 1e6;
const getRandId = () => { return getId()*randIdMult+Math.floor(Math.random()*randIdMult) }

// api functions
router.get("/api/joinGame", (req, res) => {
    const id = getRandId();
    const newPlayer = new Player(id);
    for (const game of gameList) {
        if (game.canCurrentlyJoin()) {
            game.join(newPlayer);
            res.json({
                playerId: id,
                gameId: game.gameId,
                startTime: game.gameStartTime
            });
            return;
        }
    }
    // No game found
    const newGame = new Game(getId());
    newGame.join(newPlayer);
    gameList.push(newGame);
    res.json({
        playerId: id,
        gameId: newGame.gameId,
        startTime: newGame.gameStartTime
    })
});

router.post("/api/getGame", jsonParser, (req, res) => {
    const { gameId, playerId } = req.body;
    if (!gameId) {
        res.status(400).json({ error: "ERR_NO_GAME_ID" });
        return;
    }

    const game = gameList.find(g => g.gameId === gameId);
    if (!game) {
        res.status(400).json({ error: "ERR_GAME_DOES_NOT_EXIST" });
        return;
    }

    const gameInfo = game.getGame(playerId);
    res.json(gameInfo);
});

const args = process.argv;
if (args.includes("--run-server")) {
    const app = express();
    app.use("/", router);
    app.listen(SERVER_PORT, () => {
        console.log(`Listening on port ${SERVER_PORT}`);
    });
}

export default router;