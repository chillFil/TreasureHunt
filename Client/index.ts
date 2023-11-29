import axios from 'axios';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const ip = `http://10.131.0.14:8080`

async function wrapperAxios(url) {
    try {
        let { data } = await axios.get(url);
        return data;
    } catch (error) {
        return error.response.data;
    }
}

function signup(team, psw) {
    return wrapperAxios(`${ip}/signup?team=${team}&password=${psw}`)
}

async function dig(team, psw, x, y) {
    let map = await getMap();
    console.log(y, x)
    if (map[y][x].dug) {
        let i = { message: 'Already dug', code: 'SKIPPED' };
        console.log(i);
        return i;
    }
    let i = await wrapperAxios(`${ip}/dig?team=${team}&password=${psw}&x=${x}&y=${y}`);
    console.log(i);
    await sleep(1960);
    return i;
}

function getMap() {
    return wrapperAxios(`${ip}/map`)
}

async function findTreasure(team, psw, row, col) {
    let i;
    console.log('findTreasure');
    do {
        if (row > 0)
            row--;
        i = await dig(team, psw, row, col);
        if (i.code === 'TREASURE_FOUND')
            return;
    } while (i.code === 'VERY_CLOSE' || i.code === 'SKIPPED');
    row++;

    do {
        if (col > 0)
            col--;
        i = await dig(team, psw, row, col);
        if (i.code === 'TREASURE_FOUND')
            return;
    } while (i.code === 'VERY_CLOSE' || i.code === 'SKIPPED');
    col++;

    await dig(team, psw, row + 2, col + 2);
    console.log('findTreasure end');
}
    

const main = async () => {
    const team = 'sempregas'
    const psw = 'gas'
    
    console.log(await signup(team, psw));
    
    let map = await getMap();
    while (true) {
        let row = ~~(Math.random() * map[0].length);
        let col = ~~(Math.random() * map.length);
        let digged = await dig(team, psw, row, col);
        if (digged.code === 'VERY_CLOSE')
            await findTreasure(team, psw, row, col);
    }
}

main()