// Mobile detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               (navigator.maxTouchPoints > 0);

if (isMobile) {
    document.body.classList.add('is-mobile');
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Constants for internal game resolution
const INTERNAL_WIDTH = 600;
const INTERNAL_HEIGHT = 900;
const HEADER_HEIGHT = 50;
const BUBBLE_RADIUS = 30;
const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
const GRID_COLS = Math.floor(INTERNAL_WIDTH / BUBBLE_DIAMETER);
const GRID_ROWS = 15;

// Scaling variables
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Game State
let gameState = 'START'; // START, PLAYING, GAME_OVER, WIN
let grid = {};
let fallingBubbles = [];
let projectile = null;
let score = 0;
let level = 1;
let startTime = 0;
let gameWon = false;
let gameOver = false;

// Shooter
let shooterAngle = Math.PI / 2;
let currentIon = null;
let nextIon = null;
let next2Ion = null;
let nextIsCation = true;

// Level 3 Timer
let lastSpawnTime = 0;

// Data (Keep identical to original)
const IONS = {
    'K': { charge: 1, color: [148, 0, 211], formula: 'K', charge_disp: '＋' },
    'Na': { charge: 1, color: [255, 215, 0], formula: 'Na', charge_disp: '＋' },
    'Mg': { charge: 2, color: [50, 205, 50], formula: 'Mg', charge_disp: '２＋' },
    'Ba': { charge: 2, color: [0, 255, 127], formula: 'Ba', charge_disp: '２＋' },
    'Ag': { charge: 1, color: [192, 192, 192], formula: 'Ag', charge_disp: '＋' },
    'Cu': { charge: 2, color: [0, 100, 255], formula: 'Cu', charge_disp: '２＋' },
    'Pb': { charge: 2, color: [70, 70, 70], formula: 'Pb', charge_disp: '２＋' },
    'Zn': { charge: 2, color: [100, 149, 237], formula: 'Zn', charge_disp: '２＋' },
    'Cu1': { charge: 1, color: [255, 140, 0], formula: 'Cu', charge_disp: '＋' },
    'NO3': { charge: -1, color: [255, 182, 193], formula: 'NO3', charge_disp: '－' },
    'SO4': { charge: -2, color: [255, 255, 0], formula: 'SO4', charge_disp: '２－' },
    'Cl': { charge: -1, color: [144, 238, 144], formula: 'Cl', charge_disp: '－' },
    'CO3': { charge: -2, color: [128, 128, 128], formula: 'CO3', charge_disp: '２－' },
    'I': { charge: -1, color: [75, 0, 130], formula: 'I', charge_disp: '－' },
    'S': { charge: -2, color: [255, 255, 102], formula: 'S', charge_disp: '２－' },
    'OH': { charge: -1, color: [0, 255, 255], formula: 'OH', charge_disp: '－' },
    'Br': { charge: -1, color: [139, 0, 0], formula: 'Br', charge_disp: '－' },
};

const LEVEL1_CATIONS = ['Na', 'Ag', 'Cu1', 'Cu', 'Pb'];
const LEVEL1_ANIONS = ['Cl', 'Br', 'I', 'NO3', 'SO4'];
const LEVEL2_CATIONS = ['Na', 'Mg', 'Ba', 'Ag', 'Cu', 'Pb'];
const LEVEL2_ANIONS = ['Cl', 'NO3', 'S', 'CO3', 'SO4', 'OH'];

// Classes (Keep identical)
class Bubble {
    constructor(ion, r, c) {
        this.ion = ion;
        this.r = r;
        this.c = c;
        this.x = 0;
        this.y = 0;
        this.state = 'normal';
        this.popTimer = 0;
        this.scale = 1.0;
        this.updatePos();
    }

    updatePos() {
        const offset = (this.r % 2 === 1) ? BUBBLE_RADIUS : 0;
        this.x = this.c * BUBBLE_DIAMETER + BUBBLE_RADIUS + offset;
        this.y = this.r * (BUBBLE_DIAMETER * 0.85) + BUBBLE_RADIUS + HEADER_HEIGHT;
    }

    draw() {
        if (this.state === 'popping') {
            this.scale = 1.0 + (30 - this.popTimer) / 30 * 0.5;
        }
        drawBubble(this.x, this.y, BUBBLE_RADIUS * this.scale, this.ion);
    }
}

class Projectile {
    constructor(ion, x, y, angle) {
        this.ion = ion;
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = 30; // Fast!
        this.dx = Math.cos(angle) * this.speed;
        this.dy = -Math.sin(angle) * this.speed;
        this.scale = 0.7;
    }

    move() {
        this.x += this.dx;
        this.y += this.dy;

        const r = BUBBLE_RADIUS * this.scale;

        // Wall
        if (this.x < r) {
            this.x = r;
            this.dx *= -1;
        } else if (this.x > INTERNAL_WIDTH - r) {
            this.x = INTERNAL_WIDTH - r;
            this.dx *= -1;
        }
    }

    draw() {
        drawBubble(this.x, this.y, BUBBLE_RADIUS * this.scale, this.ion);
    }
}

class FallingBubble {
    constructor(ion, x, y) {
        this.ion = ion;
        this.x = x;
        this.y = y;
        this.dy = -2;
        this.gravity = 0.5;
    }

    update() {
        this.dy += this.gravity;
        this.y += this.dy;
        this.x += (Math.random() - 0.5) * 2;
    }

    draw() {
        drawBubble(this.x, this.y, BUBBLE_RADIUS, this.ion);
    }
}

// Canvas Sizing & Scaling Logic
function resizeCanvas() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowRatio = windowWidth / windowHeight;
    const gameRatio = INTERNAL_WIDTH / INTERNAL_HEIGHT;

    if (windowRatio > gameRatio) {
        // Window is wider than game aspect ratio
        canvas.height = windowHeight;
        canvas.width = windowHeight * gameRatio;
    } else {
        // Window is narrower than game aspect ratio
        canvas.width = windowWidth;
        canvas.height = windowWidth / gameRatio;
    }

    // Set scale for drawing and input mapping
    scale = canvas.width / INTERNAL_WIDTH;
    
    // Position canvas exactly in center if needed (CSS already does this basic stuff)
}

// Coordinate Mapping: DOM (Touch) -> Game logical coords
function getGameCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const x = (touch.clientX - rect.left) / scale;
    const y = (touch.clientY - rect.top) / scale;
    return { x, y };
}

// Render Functions (Wrapped with ctx.scale)
function drawBubble(cx, cy, radius, ionName) {
    const data = IONS[ionName];
    if (!data) return;
    const color = data.color;

    const gradient = ctx.createRadialGradient(cx - radius / 3, cy - radius / 3, radius / 10, cx, cy, radius);

    const lr = Math.min(255, color[0] * 1.5);
    const lg = Math.min(255, color[1] * 1.5);
    const lb = Math.min(255, color[2] * 1.5);

    const dr = color[0] * 0.4;
    const dg = color[1] * 0.4;
    const db = color[2] * 0.4;

    gradient.addColorStop(0, `rgb(${lr},${lg},${lb})`);
    gradient.addColorStop(1, `rgb(${dr},${dg},${db})`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    drawIonText(cx, cy, data.formula, data.charge_disp, radius);
}

function drawIonText(cx, cy, formula, charge, radius) {
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const symbolSize = radius * 0.6;
    const subSize = radius * 0.4;
    const chargeSize = radius * 0.35;

    ctx.font = `bold ${symbolSize}px "Noto Sans TC", sans-serif`;

    let parts = [];
    let totalW = 0;

    for (let char of formula) {
        let isNum = /\d/.test(char);
        let f = isNum ? `bold ${subSize}px "Noto Sans TC", sans-serif` : `bold ${symbolSize}px "Noto Sans TC", sans-serif`;
        ctx.font = f;
        let w = ctx.measureText(char).width;
        parts.push({ char, isNum, w, font: f });
        totalW += w;
    }

    ctx.font = `bold ${chargeSize}px "Noto Sans TC", sans-serif`;
    let chargeW = ctx.measureText(charge).width;
    totalW += chargeW;

    let curX = cx - totalW / 2;
    let baseY = cy;

    parts.forEach(p => {
        ctx.font = p.font;
        let y = p.isNum ? baseY + radius * 0.2 : baseY;
        ctx.strokeText(p.char, curX + p.w / 2, y);
        ctx.fillText(p.char, curX + p.w / 2, y);
        curX += p.w;
    });

    ctx.font = `bold ${chargeSize}px "Noto Sans TC", sans-serif`;
    let chargeY = baseY - radius * 0.2;
    ctx.strokeText(charge, curX + chargeW / 2, chargeY);
    ctx.fillText(charge, curX + chargeW / 2, chargeY);
}

// Logic Functions (Identical but use INTERNAL_WIDTH/HEIGHT)
function resetGame(lvl) {
    level = lvl || level;
    grid = {};
    fallingBubbles = [];
    projectile = null;
    score = 0;
    gameWon = false;
    gameOver = false;
    startTime = Date.now();
    nextIsCation = true;
    shooterAngle = Math.PI / 2;
    lastSpawnTime = Date.now();

    document.getElementById('level').innerText = level;
    document.getElementById('score').innerText = 0;

    if (level === 1) populateGrid(8, 8);
    else populateGrid(15, 15);

    currentIon = getRandomCation();
    nextIon = getRandomAnion();
    next2Ion = getRandomCation();
    nextIsCation = false;
}

function getRandomCation() {
    let list = (level === 1) ? LEVEL1_CATIONS : LEVEL2_CATIONS;
    return list[Math.floor(Math.random() * list.length)];
}

function getRandomAnion() {
    let list = (level === 1) ? LEVEL1_ANIONS : LEVEL2_ANIONS;
    return list[Math.floor(Math.random() * list.length)];
}

function populateGrid(nCat, nAni) {
    let list = [];
    for (let i = 0; i < nCat; i++) list.push(getRandomCation());
    for (let i = 0; i < nAni; i++) list.push(getRandomAnion());
    list.sort(() => Math.random() - 0.5);

    let count = 0;
    for (let ion of list) {
        while (true) {
            let r = Math.floor(count / GRID_COLS);
            let c = count % GRID_COLS;
            count++;
            if (r % 2 === 1 && c >= GRID_COLS - 1) continue;
            grid[`${r},${c}`] = new Bubble(ion, r, c);
            break;
        }
    }
}

function getNeighbors(r, c) {
    let offsets = (r % 2 === 1)
        ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]]
        : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];
    return offsets.map(([dr, dc]) => [r + dr, c + dc]);
}

function snapToGrid(proj) {
    let estR = Math.floor((proj.y - HEADER_HEIGHT) / (BUBBLE_DIAMETER * 0.85));
    let bestDist = Infinity;
    let bestPos = [0, 0];

    for (let r = Math.max(0, estR - 2); r <= estR + 3; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (grid[`${r},${c}`]) continue;
            if (r % 2 === 1 && c >= GRID_COLS - 1) continue;

            let offset = (r % 2 === 1) ? BUBBLE_RADIUS : 0;
            let bx = c * BUBBLE_DIAMETER + BUBBLE_RADIUS + offset;
            let by = r * (BUBBLE_DIAMETER * 0.85) + BUBBLE_RADIUS + HEADER_HEIGHT;

            let dist = Math.hypot(proj.x - bx, proj.y - by);
            if (dist < bestDist) {
                bestDist = dist;
                bestPos = [r, c];
            }
        }
    }
    return bestPos;
}

function landProjectile() {
    let [r, c] = snapToGrid(projectile);
    let bubble = new Bubble(projectile.ion, r, c);
    grid[`${r},${c}`] = bubble;
    projectile = null;

    processReaction(bubble);
    removeFloating();
    reloadShooter();

    if (r >= GRID_ROWS - 1) gameOver = true;
    else if (grid[`${r},${c}`]) {
        // Double check if bubble is too low
        if (grid[`${r},${c}`].y + BUBBLE_RADIUS > INTERNAL_HEIGHT - 100) {
            gameOver = true;
        }
    }
}

function processReaction(startBubble) {
    let startIon = startBubble.ion;
    let neighbors = getNeighbors(startBubble.r, startBubble.c);
    let toRemove = new Set();

    const isHalogen = (i) => ['Cl', 'Br', 'I'].includes(i);
    const isAgCu1 = (i) => ['Ag', 'Cu1'].includes(i);

    for (let [nr, nc] of neighbors) {
        if (!grid[`${nr},${nc}`]) continue;
        let nIon = grid[`${nr},${nc}`].ion;
        let pair = [startIon, nIon].sort().join(',');

        let match = false;
        if (level === 1) {
            if (isAgCu1(startIon) && isHalogen(nIon)) match = true;
            if (isAgCu1(nIon) && isHalogen(startIon)) match = true;
            if (pair === 'Pb,SO4') match = true;
        } else {
            const P2 = [
                'Ag,Cl', 'Pb,S', 'Cu,S', 'Mg,CO3', 'Ba,CO3',
                'Cu,CO3', 'Pb,CO3', 'Ba,SO4', 'Pb,SO4', 'Ag,OH'
            ].map(s => s.split(',').sort().join(','));
            if (P2.includes(pair)) match = true;
        }

        if (match) {
            toRemove.add(`${startBubble.r},${startBubble.c}`);
            toRemove.add(`${nr},${nc}`);
            break;
        }
    }

    let patterns = [];
    if (level === 1) {
        if (startIon === 'Cu1' || startIon === 'SO4') patterns.push({ Cu1: 2, SO4: 1 });
        if (startIon === 'Pb' || isHalogen(startIon)) {
            patterns.push({ Pb: 1, Cl: 2 });
            patterns.push({ Pb: 1, Br: 2 });
            patterns.push({ Pb: 1, I: 2 });
        }
    } else {
        if (['Cl', 'Pb'].includes(startIon)) patterns.push({ Cl: 2, Pb: 1 });
        if (['S', 'Ag'].includes(startIon)) patterns.push({ S: 1, Ag: 2 });
        if (['CO3', 'Ag'].includes(startIon)) patterns.push({ CO3: 1, Ag: 2 });
        if (['Mg', 'OH'].includes(startIon)) patterns.push({ Mg: 1, OH: 2 });
        if (['Cu', 'OH'].includes(startIon)) patterns.push({ Cu: 1, OH: 2 });
        if (['Pb', 'OH'].includes(startIon)) patterns.push({ Pb: 1, OH: 2 });
    }

    for (let pat of patterns) {
        let cluster = findCluster(startBubble, pat);
        if (cluster) {
            cluster.forEach(p => toRemove.add(p));
            break;
        }
    }

    toRemove.forEach(key => {
        if (grid[key]) {
            grid[key].state = 'popping';
            grid[key].popTimer = 30;
        }
    });
}

function findCluster(startBubble, reqs) {
    let totalNeeded = Object.values(reqs).reduce((a, b) => a + b, 0);
    if (totalNeeded !== 3) return null;

    let startKey = `${startBubble.r},${startBubble.c}`;
    let neighbors = getNeighbors(startBubble.r, startBubble.c).filter(([r, c]) => grid[`${r},${c}`]);

    for (let i = 0; i < neighbors.length; i++) {
        for (let j = i + 1; j < neighbors.length; j++) {
            let n1 = neighbors[i];
            let n2 = neighbors[j];
            let set = [startKey, `${n1[0]},${n1[1]}`, `${n2[0]},${n2[1]}`];
            if (checkSet(set, reqs)) return set;
        }
    }

    for (let n1 of neighbors) {
        let n1Key = `${n1[0]},${n1[1]}`;
        let nn = getNeighbors(n1[0], n1[1]).filter(([r, c]) => grid[`${r},${c}`] && `${r},${c}` !== startKey);
        for (let n2 of nn) {
            let n2Key = `${n2[0]},${n2[1]}`;
            let set = [startKey, n1Key, n2Key];
            if (checkSet(set, reqs)) return set;
        }
    }
    return null;
}

function checkSet(keys, reqs) {
    let counts = {};
    for (let k of keys) {
        if (!grid[k]) return false;
        let ion = grid[k].ion;
        counts[ion] = (counts[ion] || 0) + 1;
    }
    for (let ion in reqs) {
        if (counts[ion] !== reqs[ion]) return false;
    }
    return true;
}

function removeFloating() {
    let visited = new Set();
    let q = [];
    for (let c = 0; c < GRID_COLS; c++) {
        if (grid[`0,${c}`]) {
            q.push([0, c]);
            visited.add(`0,${c}`);
        }
    }
    let head = 0;
    while (head < q.length) {
        let [r, c] = q[head++];
        for (let [nr, nc] of getNeighbors(r, c)) {
            let k = `${nr},${nc}`;
            if (grid[k] && !visited.has(k)) {
                visited.add(k);
                q.push([nr, nc]);
            }
        }
    }
    Object.keys(grid).forEach(key => {
        if (!visited.has(key)) {
            let b = grid[key];
            if (b.state !== 'popping') {
                fallingBubbles.push(new FallingBubble(b.ion, b.x, b.y));
                score += 50;
            }
            delete grid[key];
        }
    });
}

function reloadShooter() {
    currentIon = nextIon;
    nextIon = next2Ion;
    next2Ion = nextIsCation ? getRandomCation() : getRandomAnion();
    nextIsCation = !nextIsCation;
}

function checkWin() {
    const allowed = (level === 1) ? ['Na', 'Cu', 'NO3'] : ['Na', 'NO3'];
    let remaining = Object.values(grid).filter(b => b.state !== 'popping');
    if (remaining.every(b => allowed.includes(b.ion))) {
        gameWon = true;
    }
}

function addRow() {
    let newGrid = {};
    for (let key in grid) {
        let b = grid[key];
        let nr = b.r + 1;
        if (nr % 2 === 1 && b.c >= GRID_COLS - 1) continue;
        if (nr >= GRID_ROWS - 1) gameOver = true;
        b.r = nr;
        b.updatePos();
        newGrid[`${nr},${b.c}`] = b;
    }
    grid = newGrid;
    let available = Array.from({ length: GRID_COLS }, (_, i) => i);
    available.sort(() => Math.random() - 0.5);
    for (let i = 0; i < 8; i++) {
        let c = available[i];
        let ion = (Math.random() < 0.5) ? getRandomCation() : getRandomAnion();
        grid[`0,${c}`] = new Bubble(ion, 0, c);
    }
}

// Loop
function update() {
    if (gameState !== 'PLAYING') return;

    if (gameWon) {
        gameState = 'WIN';
        document.getElementById('win-screen').classList.remove('hidden');
        document.getElementById('win-time').innerText = document.getElementById('timer').innerText;
        return;
    }
    if (gameOver) {
        gameState = 'GAME_OVER';
        document.getElementById('game-over-screen').classList.remove('hidden');
        return;
    }

    if (!gameWon && !gameOver) {
        let elapsed = Math.floor((Date.now() - startTime) / 1000);
        let m = Math.floor(elapsed / 60).toString().padStart(2, '0');
        let s = (elapsed % 60).toString().padStart(2, '0');
        document.getElementById('time').innerText = `${m}:${s}`;
    }

    if (level === 3 && Date.now() - lastSpawnTime > 30000) {
        addRow();
        lastSpawnTime = Date.now();
    }

    if (projectile) {
        projectile.move();
        if (projectile.y < BUBBLE_RADIUS + HEADER_HEIGHT) {
            landProjectile();
        } else {
            let pr = BUBBLE_RADIUS * projectile.scale;
            for (let key in grid) {
                let b = grid[key];
                let dist = Math.hypot(projectile.x - b.x, projectile.y - b.y);
                if (dist < pr + BUBBLE_RADIUS - 5) {
                    landProjectile();
                    break;
                }
            }
        }
    }

    let popped = false;
    let toDelete = [];
    for (let key in grid) {
        let b = grid[key];
        if (b.state === 'popping') {
            b.popTimer--;
            if (b.popTimer <= 0) {
                toDelete.push(key);
                popped = true;
            }
        }
    }
    toDelete.forEach(k => {
        delete grid[k];
        score += 100;
        document.getElementById('score').innerText = score;
    });
    if (popped) removeFloating();
    checkWin();

    for (let i = fallingBubbles.length - 1; i >= 0; i--) {
        fallingBubbles[i].update();
        if (fallingBubbles[i].y > INTERNAL_HEIGHT + 50) {
            fallingBubbles.splice(i, 1);
        }
    }
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(scale, scale);

    // Separator
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, HEADER_HEIGHT);
    ctx.lineTo(INTERNAL_WIDTH, HEADER_HEIGHT);
    ctx.stroke();

    if (gameState === 'START') {
        ctx.restore();
        return;
    }

    // Danger Line
    const dangerY = (GRID_ROWS - 1) * (BUBBLE_DIAMETER * 0.85) + BUBBLE_RADIUS + HEADER_HEIGHT + BUBBLE_RADIUS;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, dangerY);
    ctx.lineTo(INTERNAL_WIDTH, dangerY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    ctx.font = 'bold 20px "Noto Sans TC"';
    ctx.textAlign = 'center';
    ctx.fillText("DANGER LINE", INTERNAL_WIDTH / 2, dangerY - 10);

    // Bubbles
    for (let key in grid) grid[key].draw();
    fallingBubbles.forEach(b => b.draw());

    const sx = INTERNAL_WIDTH / 2;
    const sy = INTERNAL_HEIGHT - 50;

    if (!projectile && gameState === 'PLAYING') {
        drawAimingLine(sx, sy, shooterAngle);
    }

    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(sx, sy, 35, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, 25, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#00d2ff';
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-shooterAngle);
    const grad = ctx.createLinearGradient(0, -20, 0, 20);
    grad.addColorStop(0, '#555');
    grad.addColorStop(0.5, '#AAA');
    grad.addColorStop(1, '#555');
    ctx.fillStyle = grad;
    ctx.fillRect(0, -20, 80, 40);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#222';
    ctx.strokeRect(0, -20, 80, 40);
    ctx.fillStyle = '#333';
    ctx.fillRect(70, -22, 12, 44);
    ctx.fillStyle = '#00d2ff';
    ctx.fillRect(72, -22, 2, 44);
    ctx.restore();

    if (!projectile) {
        let bx = sx + Math.cos(shooterAngle) * 50;
        let by = sy - Math.sin(shooterAngle) * 50;
        drawBubble(bx, by, BUBBLE_RADIUS, currentIon);
    } else {
        projectile.draw();
    }

    drawNextBubbleInfo(sx, sy);
    ctx.restore();
}

function drawNextBubbleInfo(sx, sy) {
    const nextX = sx + 100;
    const nextY = sy - 20;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 16px "Noto Sans TC"';
    ctx.textAlign = 'center';
    ctx.fillText("NEXT", nextX, nextY - 35);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(nextX, nextY, 35, 0, Math.PI * 2);
    ctx.stroke();
    drawBubble(nextX, nextY, BUBBLE_RADIUS * 0.7, nextIon);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '12px "Noto Sans TC"';
    ctx.fillText("LATER", nextX + 60, nextY - 15);
    drawBubble(nextX + 60, nextY + 10, BUBBLE_RADIUS * 0.5, next2Ion);
}

function drawAimingLine(cx, cy, angle) {
    let x = cx;
    let y = cy;
    let dx = Math.cos(angle);
    let dy = -Math.sin(angle);
    let step = 10;
    let maxSteps = 150;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    for (let i = 0; i < maxSteps; i++) {
        x += dx * step;
        y += dy * step;
        if (x <= BUBBLE_RADIUS || x >= INTERNAL_WIDTH - BUBBLE_RADIUS) {
            dx = -dx;
            x = Math.max(BUBBLE_RADIUS, Math.min(x, INTERNAL_WIDTH - BUBBLE_RADIUS));
            ctx.lineTo(x, y);
        }
        if (y <= HEADER_HEIGHT + BUBBLE_RADIUS) {
            ctx.lineTo(x, y);
            break;
        }
        let collided = false;
        for (let key in grid) {
            let b = grid[key];
            let dist = Math.hypot(x - b.x, y - b.y);
            if (dist < BUBBLE_DIAMETER - 5) {
                collided = true;
                break;
            }
        }
        if (collided) {
            ctx.lineTo(x, y);
            break;
        }
        ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
}

// Input Handling
let lastTouchX = null;
let isDragging = false;
let startX = 0;
let startY = 0;

function fireProjectile() {
    if (!projectile && gameState === 'PLAYING') {
        const sx = INTERNAL_WIDTH / 2;
        const sy = INTERNAL_HEIGHT - 50;
        projectile = new Projectile(currentIon, sx, sy, shooterAngle);
    }
}

function handleInteractionStart(e) {
    if (gameState !== 'PLAYING') return;
    const touch = e.touches ? e.touches[0] : e;
    startX = touch.clientX;
    startY = touch.clientY;
    lastTouchX = startX;
    isDragging = false;
}

function handleInteractionMove(e) {
    if (gameState !== 'PLAYING') return;
    
    const touch = e.touches ? e.touches[0] : e;
    const currentX = touch.clientX;
    const currentY = touch.clientY;
    
    // Check if we are dragging
    const dist = Math.hypot(currentX - startX, currentY - startY);
    if (dist > 5) {
        isDragging = true;
    }

    if (isDragging && lastTouchX !== null) {
        const deltaX = currentX - lastTouchX;
        // Sensitivity adjustment
        const sensitivity = 0.005; 
        shooterAngle -= deltaX * sensitivity;
        
        // Clamp angle
        shooterAngle = Math.max(0.1, Math.min(Math.PI - 0.1, shooterAngle));
    }
    
    lastTouchX = currentX;
}

function handleInteractionEnd(e) {
    if (gameState !== 'PLAYING') return;
    
    if (!isDragging) {
        // It's a tap!
        fireProjectile();
    }
    
    lastTouchX = null;
    isDragging = false;
}

// Event Listeners
window.addEventListener('resize', resizeCanvas);

// Touch Events
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInteractionStart(e);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    handleInteractionMove(e);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleInteractionEnd();
}, { passive: false });

// Mouse Events (for testing in browser)
canvas.addEventListener('mousedown', handleInteractionStart);
window.addEventListener('mousemove', handleInteractionMove);
window.addEventListener('mouseup', handleInteractionEnd);

// Keys (keep for hybrid support)
window.addEventListener('keydown', e => {
    if (gameState === 'PLAYING') {
        if (e.code === 'ArrowLeft') shooterAngle = Math.min(Math.PI - 0.1, shooterAngle + 0.1);
        if (e.code === 'ArrowRight') shooterAngle = Math.max(0.1, shooterAngle - 0.1);
        if (e.code === 'Space' && !projectile) {
            const sx = INTERNAL_WIDTH / 2;
            const sy = INTERNAL_HEIGHT - 50;
            projectile = new Projectile(currentIon, sx, sy, shooterAngle);
        }
    }
});

// UI Buttons
document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-screen').classList.add('hidden');
    gameState = 'PLAYING';
    resetGame(1);
});

document.getElementById('restart-btn').addEventListener('click', () => {
    document.getElementById('game-over-screen').classList.add('hidden');
    gameState = 'PLAYING';
    resetGame();
});

document.getElementById('next-level-btn').addEventListener('click', () => {
    document.getElementById('win-screen').classList.add('hidden');
    gameState = 'PLAYING';
    level = Math.min(3, level + 1);
    resetGame();
});

document.getElementById('reset-btn').addEventListener('click', () => {
    resetGame();
});

// Start Loop
resizeCanvas();
function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}
gameLoop();
