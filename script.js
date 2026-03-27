const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const rows = 10;
const spacing = 50;

let dots = [];
let lines = [];
let triangles = [];

let selectedDot = null;
let currentPlayer = 1;

let score1 = 0;
let score2 = 0;

let timeLeft = 15;
let timerInterval = null;

let outerTriangleDone = false;
let moveTimer = 15; // synced with Firebase

// CREATE TRIANGULAR LATTICE
for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= r; c++) {
        let x = canvas.width / 2 - (r * spacing) / 2 + c * spacing;
        let y = 60 + r * spacing;
        dots.push({ x, y, r, c });
    }
}

// NEIGHBOR CHECK (bi-directional)
function isNeighbor(a, b) {
    let dr = b.r - a.r;
    let dc = b.c - a.c;

    if (dr === 1 && (dc === 0 || dc === 1)) return true;   // down-left / down-right
    if (dr === -1 && (dc === -1 || dc === 0)) return true; // up-left / up-right
    if (dr === 0 && Math.abs(dc) === 1) return true;       // horizontal
    return false;
}

// CHECK IF LINE EXISTS
function lineExists(a, b) {
    return lines.some(line =>
        (line[0].r === a.r && line[0].c === a.c && line[1].r === b.r && line[1].c === b.c) ||
        (line[0].r === b.r && line[0].c === b.c && line[1].r === a.r && line[1].c === a.c)
    );
}

// TRIANGLE CHECK
function checkTriangles() {
    let gained = false;
    for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
            for (let k = j + 1; k < dots.length; k++) {
                let a = dots[i];
                let b = dots[j];
                let c = dots[k];

                if (isNeighbor(a, b) && isNeighbor(b, c) && isNeighbor(a, c)) {
                    if (lineExists(a, b) && lineExists(b, c) && lineExists(a, c)) {
                        let exists = triangles.some(t =>
                            t.a.r === a.r && t.a.c === a.c &&
                            t.b.r === b.r && t.b.c === b.c &&
                            t.c.r === c.r && t.c.c === c.c
                        );
                        if (!exists) {
                            triangles.push({ a, b, c, player: currentPlayer });
                            if (currentPlayer === 1) score1++;
                            else score2++;
                            gained = true;
                        }
                    }
                }
            }
        }
    }
    return gained;
}

// OUTER TRIANGLE CHECK
function checkOuterTriangle() {
    for (let r = 0; r < rows - 1; r++) {
        let a = dots.find(d => d.r === r && d.c === 0);
        let b = dots.find(d => d.r === r + 1 && d.c === 0);
        if (!lineExists(a, b)) return false;
    }
    for (let r = 0; r < rows - 1; r++) {
        let a = dots.find(d => d.r === r && d.c === r);
        let b = dots.find(d => d.r === r + 1 && d.c === r + 1);
        if (!lineExists(a, b)) return false;
    }
    for (let c = 0; c < rows - 1; c++) {
        let a = dots.find(d => d.r === rows - 1 && d.c === c);
        let b = dots.find(d => d.r === rows - 1 && d.c === c + 1);
        if (!lineExists(a, b)) return false;
    }
    return true;
}

// DRAW EVERYTHING
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // TRIANGLES
    triangles.forEach(tri => {
        ctx.beginPath();
        ctx.moveTo(tri.a.x, tri.a.y);
        ctx.lineTo(tri.b.x, tri.b.y);
        ctx.lineTo(tri.c.x, tri.c.y);
        ctx.closePath();
        ctx.fillStyle = tri.player === 1 ? "lightblue" : "lightcoral";
        ctx.fill();
    });

    // LINES
    lines.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(line[0].x, line[0].y);
        ctx.lineTo(line[1].x, line[1].y);
        ctx.stroke();
    });

    // HIGHLIGHT AVAILABLE NEIGHBORS
    if (selectedDot) {
        dots.forEach(dot => {
            if (isNeighbor(selectedDot, dot) && !lineExists(selectedDot, dot)) {
                ctx.beginPath();
                ctx.arc(dot.x, dot.y, 7, 0, Math.PI * 2);
                ctx.fillStyle = "gold";
                ctx.fill();
            }
        });
    }

    // DOTS
    dots.forEach(dot => {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "black";
        ctx.fill();
    });

    // UI TEXT
    ctx.fillStyle = "black";
    ctx.font = "16px Arial";
    ctx.fillText("Player: " + (currentPlayer === 1 ? "Blue" : "Red"), 20, 20);
    ctx.fillText("Blue: " + score1, 20, 40);
    ctx.fillText("Red: " + score2, 20, 60);
    ctx.fillText("Time: " + moveTimer, 20, 80);
}

// TIMER
function startTimer() {
    clearInterval(timerInterval);
    moveTimer = 15;

    timerInterval = setInterval(() => {
        moveTimer--;
        if (moveTimer <= 0) {
            currentPlayer = currentPlayer === 1 ? 2 : 1;
            selectedDot = null;
            saveToFirebase(); // update turn to Firebase
            startTimer();
        }
        drawBoard();
    }, 1000);
}

// SAVE GAME TO FIREBASE
function saveToFirebase() {
    roomRef.update({
        lines: lines.map(l => ({ r1: l[0].r, c1: l[0].c, r2: l[1].r, c2: l[1].c })),
        triangles: triangles.map(t => ({
            a: { r: t.a.r, c: t.a.c },
            b: { r: t.b.r, c: t.b.c },
            c: { r: t.c.r, c: t.c.c },
            player: t.player
        })),
        currentPlayer,
        score1,
        score2,
        timer: moveTimer
    });
}

// LOAD GAME FROM FIREBASE
roomRef.on("value", snapshot => {
    const data = snapshot.val();
    if (!data) return;

    // load lines
    lines = data.lines.map(l => {
        const a = dots.find(d => d.r === l.r1 && d.c === l.c1);
        const b = dots.find(d => d.r === l.r2 && d.c === l.c2);
        return [a, b];
    }) || [];

    // load triangles
    triangles = data.triangles.map(t => {
        const a = dots.find(d => d.r === t.a.r && d.c === t.a.c);
        const b = dots.find(d => d.r === t.b.r && d.c === t.b.c);
        const c = dots.find(d => d.r === t.c.r && d.c === t.c.c);
        return { a, b, c, player: t.player };
    }) || [];

    currentPlayer = data.currentPlayer || 1;
    score1 = data.score1 || 0;
    score2 = data.score2 || 0;
    moveTimer = data.timer || 15;

    drawBoard();
});

// CLICK HANDLER
canvas.addEventListener("click", function (e) {
    if (currentPlayer !== getLocalPlayer()) return; // only allow correct player

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (let dot of dots) {
        const dist = Math.hypot(dot.x - mx, dot.y - my);
        if (dist < 10) {
            if (!selectedDot) {
                selectedDot = dot;
                drawBoard();
            }
            else {
                if (isNeighbor(selectedDot, dot) && !lineExists(selectedDot, dot)) {
                    lines.push([selectedDot, dot]);

                    let gained = checkTriangles();

                    // OUTER TRIANGLE BONUS
                    if (!outerTriangleDone && checkOuterTriangle()) {
                        outerTriangleDone = true;
                        if (currentPlayer === 1) score1 += 10;
                        else score2 += 10;
                    }

                    // SWITCH PLAYER IF NO TRIANGLE
                    if (!gained) currentPlayer = currentPlayer === 1 ? 2 : 1;

                    saveToFirebase();
                    startTimer();
                }
                selectedDot = null;
                drawBoard();
            }
            break;
        }
    }
});

// Helper: which player is local
function getLocalPlayer() {
    // simple hack: first join = player 1, second = player 2
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("player") === "2" ? 2 : 1;
}

// START GAME
drawBoard();
startTimer();