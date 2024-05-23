const socket = io();

const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const opponentCanvas = document.getElementById('opponent');
const opponentContext = opponentCanvas.getContext('2d');
const opponentSmallCanvas = document.getElementById('opponent-small');
const opponentSmallContext = opponentSmallCanvas.getContext('2d');

canvas.width = 240;
canvas.height = 400;
opponentCanvas.width = 240;
opponentCanvas.height = 400;
opponentSmallCanvas.width = 120;
opponentSmallCanvas.height = 200;

const menu = document.getElementById('menu');
const gameContainer = document.querySelector('.game-container');
const roomNameInput = document.getElementById('roomName');
const createRoomButton = document.getElementById('createRoom');
const joinRoomButton = document.getElementById('joinRoom');
const statusMessage = document.getElementById('statusMessage');

createRoomButton.addEventListener('click', () => {
    const roomName = roomNameInput.value.trim();
    if (roomName) {
        socket.emit('createRoom', roomName);
        statusMessage.textContent = `Creating room ${roomName}...`;
    }
});

joinRoomButton.addEventListener('click', () => {
    const roomName = roomNameInput.value.trim();
    if (roomName) {
        socket.emit('joinRoom', roomName);
        statusMessage.textContent = `Joining room ${roomName}...`;
    }
});

socket.on('roomExists', (roomName) => {
    statusMessage.textContent = `Room ${roomName} already exists.`;
});

socket.on('roomCreated', (roomName) => {
    statusMessage.textContent = `Room ${roomName} created! Waiting for opponent...`;
});

socket.on('roomJoined', (roomName) => {
    statusMessage.textContent = `Joined room ${roomName}! Starting game...`;
    startGame();
});

socket.on('roomFull', (roomName) => {
    statusMessage.textContent = `Room ${roomName} is full!`;
});

socket.on('startGame', () => {
    menu.style.display = 'none';
    gameContainer.style.display = 'flex';
    startGame();
});

socket.on('move', (data) => {
    opponentContext.clearRect(0, 0, opponentCanvas.width, opponentCanvas.height);
    drawMatrix(opponentContext, data.matrix, data.pos);
    opponentSmallContext.clearRect(0, 0, opponentSmallCanvas.width, opponentSmallCanvas.height);
    drawMatrix(opponentSmallContext, data.matrix, data.pos, 0.5);
});

socket.on('gameOver', () => {
    alert('Game Over!');
    resetGame();
});

socket.on('opponentLeft', () => {
    alert('Opponent left the game.');
    resetGame();
});

const colors = [
    null,
    'red',
    'blue',
    'violet',
    'green',
    'orange',
    'cyan',
    'yellow'
];

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

function drawMatrix(context, matrix, offset, scale = 1) {
    context.scale(scale, scale);
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = colors[value];
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
    context.setTransform(1, 0, 0, 1, 0, 0); // Reset transform after scaling
}

function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawMatrix(context, player.matrix, player.pos);
    drawMatrix(context, arena, {x: 0, y: 0});
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function playerReset() {
    const pieces = 'ILJOTSZ';
    player.matrix = createPiece(pieces[(pieces.length * Math.random()) | 0]);
    player.pos.y = 0;
    player.pos.x = ((arena[0].length / 2) | 0) - ((player.matrix[0].length / 2) | 0);
    if (collide(arena, player)) {
        arena.forEach(row => row.fill(0));
        player.score = 0;
        updateScore();
    }
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
        updateScore();
    }
    dropCounter = 0;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    }
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [
                matrix[x][y],
                matrix[y][x],
            ] = [
                matrix[y][x],
                matrix[x][y],
            ];
        }
    }

    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

let dropCounter = 0;
let dropInterval = 1000;

let lastTime = 0;

function update(time = 0) {
    const deltaTime = time - lastTime;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    lastTime = time;

    draw();
    requestAnimationFrame(update);
}

function updateScore() {
    document.getElementById('score').innerText = player.score;
}

const arena = createMatrix(12, 20);

const player = {
    pos: {x: 0, y: 0},
    matrix: null,
    score: 0,
};

document.addEventListener('keydown', event => {
    if (event.keyCode === 37) {
        playerMove(-1);
        socket.emit('move', player);
    } else if (event.keyCode === 39) {
        playerMove(1);
        socket.emit('move', player);
    } else if (event.keyCode === 40) {
        playerDrop();
        socket.emit('move', player);
    } else if (event.keyCode === 81) {
        playerRotate(-1);
        socket.emit('move', player);
    } else if (event.keyCode === 87) {
        playerRotate(1);
        socket.emit('move', player);
    }
    draw();
});

function startGame() {
    playerReset();
    updateScore();
    update();
}

function resetGame() {
    arena.forEach(row => row.fill(0));
    player.score = 0;
    playerReset();
    updateScore();
}

function createPiece(type) {
    if (type === 'T') {
        return [
            [0,0,0],
            [1,1,1],
            [0,1,0],
        ];
    } else if (type === 'O') {
        return [
            [2,2],
            [2,2],
        ];
    } else if (type === 'L') {
        return [
            [0,3,0],
            [0,3,0],
            [0,3,3],
        ];
    } else if (type === 'J') {
        return [
            [0,4,0],
            [0,4,0],
            [4,4,0],
        ];
    } else if (type === 'I') {
        return [
            [0,0,5,0],
            [0,0,5,0],
            [0,0,5,0],
            [0,0,5,0],
        ];
    } else if (type === 'S') {
        return [
            [0,6,6],
            [6,6,0],
            [0,0,0],
        ];
    } else if (type === 'Z') {
        return [
            [7,7,0],
            [0,7,7],
            [0,0,0],
        ];
    }
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
               (arena[y + o.y] &&
                arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function arenaSweep() {
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) {
                continue outer;
            }
        }

        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;

        player.score += 10;
    }
}
