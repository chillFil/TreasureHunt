/* Treasure Hunt Server
    Functions:
    Map generation (mapX, mapY, treasureN) [randomly generate map mapX x mapY with treasureN treasures]
    Closest treasure (x, y) [return distance to closest treasure]

    Endpoints:
    Sigup team (teamName, teamPsw, teamIP) [cannot create team with same teamName; cannot create multiple teams from the same client(IP)]
    Leaderboard [sorted by teamScore]
    Map [return map as JSON with info for each cell if dug by who, if there was a treasure]
    Display Map [return map as HTML with images for each cell; different images for dug, treasure]
    Dig (teamName, teamPsw, X, Y) [if X, Y is a treasure, return FOUND, else return CLOSE, FAR or DUG; throttle dig to 1 dig per 2 seconds per team]

    Return CODES:
    UNREGISTERED (team not registered) [401 UNAUTHORIZED]
    WRONGPSW (wrong teamPsw) [403 FORBIDDEN]
    THROTTLED (dig throttled) [429 TOO MANY REQUESTS]
    DUG (cell already dug) [200 OK]
    FOUND (cell with treasure) [200 OK]
    CLOSE (cell with treasure nearby) [200 OK]
    FAR (cell without treasure) [200 OK]
    TAKEN (teamName already taken) [409 CONFLICT]
    SAMEIP (client already registered a team) [429 TOO MANY REQUESTS]
    REGISTERED (team registered) [200 OK]
*/

import express from 'express';

const app: any = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));


//Images
const cell: string = `cell.png`;
const dug: string = `dug.png`;
const treasure: string = `treasure.png`;




//App states
const mapX: number = 10;
const mapY: number = 10;
const treasureN: number = 10;
type Team = { name: string, psw: string, ip: string, score: number, lastDig: number};
const teams: Team[] = [];
type Cell = { dug: boolean | string, treasure: boolean | null };
const map: Cell[][] = [];




//Functions
function generateMap(): void {
    for (let x = 0; x < mapX; x++) {
        map[x] = [];
        for (let y = 0; y < mapY; y++) {
            map[x][y] = { dug: false, treasure: false };
        }
    }
    for (let i = 0; i < treasureN; i++) {
        const x = Math.floor(Math.random() * mapX);
        const y = Math.floor(Math.random() * mapY);
        if (map[x][y].treasure) 
            i--;
        map[x][y].treasure = true;
    }
}

function getClosestTreasure(x: number, y: number) {
    let closest: number = mapX + mapY;
    for (let i = 0; i < mapX; i++) {
        for (let j = 0; j < mapY; j++) {
            if (map[i][j].treasure) {
                const distance = Math.abs(x - i) + Math.abs(y - j);
                if (distance < closest)
                    closest = distance;
            }
        }
    }

    return closest;
}




//Endpoints functions
function getMap() {
    const mapJSON: Cell[][] = map;
    for (let x = 0; x < mapX; x++) {
        for (let y = 0; y < mapY; y++) {
            if (!map[x][y].dug)
                mapJSON[x][y].treasure = null;
        }
    }

    return mapJSON;
}

function getMapHTML() {
    let mapHTML: string = '';
    for (let x = 0; x < mapX; x++) {
        for (let y = 0; y < mapY; y++) {
            if (map[x][y].dug) {
                if (map[x][y].treasure)
                    mapHTML += `<img src="${treasure}" alt="treasure" width="50" height="50">`;
                else
                    mapHTML += `<img src="${dug}" alt="dug" width="50" height="50">`;
            }
            else
                mapHTML += `<img src="${cell}" alt="cell" width="50" height="50">`;
        }
        mapHTML += `<br>`;
    }

    return mapHTML;
}

function getLeaderboard() { //hide psw, ip, and lastDig
    type LeaderboardTeam = { name: string, score: number };
    const leaderboard: LeaderboardTeam[] = [];
    for (let entry of teams) {
        leaderboard.push({ name: entry.name, score: entry.score });
    }
    leaderboard.sort((a, b) => b.score - a.score);

    return leaderboard;
}

function dig(team:string, psw:string, x: number, y: number) {
    for (let entry of teams) {
        if (entry.name === team) {
            if (entry.psw !== psw)
                return 'WRONGPSW';

            if (Date.now() - entry.lastDig < 2000)
                return 'THROTTLED';

            
            entry.lastDig = Date.now();
            if (map[x][y].dug) {
                entry.score -= 10;
                return 'DUG';
            }

            map[x][y].dug = team;
            if (map[x][y].treasure) {
                entry.score += 100;
                return 'FOUND';
            }

            if (getClosestTreasure(x, y) <= 2)
                return 'CLOSE';
        
            return 'FAR';
        }
    }

    return 'UNREGISTERED';
}

function signup(team: string, psw: string, ip: string) {
    for (let entry of teams) {
        if (entry.name === team) {
            return 'TAKEN';
        }
        else if (entry.ip === ip) {
            return 'SAMEIP';
        }
    }
    teams.push({ name: team, psw: psw, ip: ip, score: 0, lastDig: 0 });

    return 'REGISTERED';
}




//Endpoints
app.get('/map', (req, res) => {
    res.send(getMap());
});

app.get('/displayMap', (req, res) => {
    res.send(getMapHTML());
});

app.get('/leaderboard', (req, res) => {
    res.send(getLeaderboard());
});

app.get('/dig', (req, res) => {
    if (!req.query.team || !req.query.psw || isNaN(parseInt(req.query.y)) || isNaN(parseInt(req.query.x))) {
        res.status(400).send('MISSING OR MALFORMED PARAMETERS');
        return;
    }
    const result = dig(req.query.team, req.query.psw, parseInt(req.query.y), parseInt(req.query.x));
    switch (result) {
        case 'UNREGISTERED':
            res.status(401).send(result);
            break;
        case 'WRONGPSW':
            res.status(403).send(result);
            break;
        case 'THROTTLED':
            res.status(429).send(result);
            break;
        default:
            res.status(200).send(result);
            break;
    }
});

app.get('/signup', (req, res) => {
    if (!req.query.team || !req.query.psw)
        res.status(400).send('MISSING PARAMETERS');
    const result = signup(req.query.team, req.query.psw, req.ip);
    switch (result) {
        case 'TAKEN':
            res.status(409).send(result);
            break;
        case 'SAMEIP':
            res.status(429).send(result);
            break;
        default:
            res.status(200).send(result);
            break;
    }
});
app.post('/signup', (req, res) => {
    if (!req.body.team || !req.body.psw)
        res.status(400).send('MISSING PARAMETERS');
    const result = signup(req.body.team, req.body.psw, req.ip);
    switch (result) {
        case 'TAKEN':
            res.status(409).send(result);
            break;
        case 'SAMEIP':
            res.status(429).send(result);
            break;
        default:
            res.status(200).send(result);
            break;
    }
});

//How to play
app.get('/', (req, res) => {
    res.send(`
    <h1>Treasure Hunt</h1>
    <p>How to play:</p>
    <ul>
        <li>Signup your team with /signup?team=teamName&psw=teamPsw</li>
        <li>Get the map with /map</li>
        <li>Get the leaderboard with /leaderboard</li>
        <li>Dig a cell with /dig?team=teamName&psw=teamPsw&x=x&y=y</li>
        <li>Display the map with /displayMap</li>
    </ul>
    `);
});

//404
app.get((req, res) => {
    res.status(404).send('404 NOT FOUND');
});

app.listen(port, () => {
    console.log(`Game online on: http://localhost:${port}`);
});

generateMap();