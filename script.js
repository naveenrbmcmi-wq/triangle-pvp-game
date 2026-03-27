// =========================
// CANVAS SETUP
// =========================
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

// =========================
// CREATE TRIANGULAR LATTICE (local always)
if(dots.length === 0){
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= r; c++) {
      let x = canvas.width/2 - (r * spacing)/2 + c * spacing;
      let y = 60 + r * spacing;
      dots.push({x, y, r, c});
    }
  }
}

// =========================
// NEIGHBOR CHECK (bi-directional)
function isNeighbor(a, b){
    let dr = b.r - a.r;
    let dc = b.c - a.c;

    if(dr === 1 && (dc === 0 || dc === 1)) return true;   // down-left / down-right
    if(dr === -1 && (dc === -1 || dc === 0)) return true; // up-left / up-right
    if(dr === 0 && Math.abs(dc) === 1) return true;       // horizontal
    return false;
}

// =========================
// CHECK IF LINE EXISTS
function lineExists(a, b){
    return lines.some(line => 
        (line[0] === a && line[1] === b) ||
        (line[0] === b && line[1] === a)
    );
}

// =========================
// TRIANGLE CHECK
function checkTriangles(){
    let gained = false;
    for(let i = 0; i < dots.length; i++){
        for(let j = i+1; j < dots.length; j++){
            for(let k = j+1; k < dots.length; k++){
                let a = dots[i];
                let b = dots[j];
                let c = dots[k];

                if(isNeighbor(a,b) && isNeighbor(b,c) && isNeighbor(a,c)){
                    if(lineExists(a,b) && lineExists(b,c) && lineExists(a,c)){
                        let exists = triangles.some(t =>
                            t.a === a && t.b === b && t.c === c
                        );
                        if(!exists){
                            triangles.push({a, b, c, player: currentPlayer});
                            if(currentPlayer === 1) score1++;
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

// =========================
// OUTER TRIANGLE CHECK
function checkOuterTriangle(){
    for(let r = 0; r < rows - 1; r++){
        let a = dots.find(d => d.r === r && d.c === 0);
        let b = dots.find(d => d.r === r+1 && d.c === 0);
        if(!lineExists(a,b)) return false;
    }
    for(let r = 0; r < rows - 1; r++){
        let a = dots.find(d => d.r === r && d.c === r);
        let b = dots.find(d => d.r === r+1 && d.c === r+1);
        if(!lineExists(a,b)) return false;
    }
    for(let c = 0; c < rows - 1; c++){
        let a = dots.find(d => d.r === rows-1 && d.c === c);
        let b = dots.find(d => d.r === rows-1 && d.c === c+1);
        if(!lineExists(a,b)) return false;
    }
    return true;
}

// =========================
// TIMER
function startTimer(){
    clearInterval(timerInterval);
    timeLeft = 15;

    timerInterval = setInterval(() => {
        timeLeft--;
        if(timeLeft <= 0){
            currentPlayer = currentPlayer === 1 ? 2 : 1;
            selectedDot = null;
            startTimer();
        }
        drawBoard();
    }, 1000);
}

// =========================
// DRAW EVERYTHING
function drawBoard(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

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
        ctx.moveTo(line[0].x,line[0].y);
        ctx.lineTo(line[1].x,line[1].y);
        ctx.stroke();
    });

    // HIGHLIGHT AVAILABLE NEIGHBORS
    if(selectedDot){
        dots.forEach(dot => {
            if(isNeighbor(selectedDot, dot) && !lineExists(selectedDot, dot)){
                ctx.beginPath();
                ctx.arc(dot.x, dot.y, 7, 0, Math.PI*2);
                ctx.fillStyle = "gold";
                ctx.fill();
            }
        });
    }

    // DOTS
    dots.forEach(dot => {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 5, 0, Math.PI*2);
        ctx.fillStyle = "black";
        ctx.fill();
    });

    // UI TEXT
    ctx.fillStyle = "black";
    ctx.font = "16px Arial";
    ctx.fillText("Player: " + (currentPlayer === 1 ? "Blue" : "Red"), 20, 20);
    ctx.fillText("Blue: " + score1, 20, 40);
    ctx.fillText("Red: " + score2, 20, 60);
    ctx.fillText("Time: " + timeLeft, 20, 80);
}

// =========================
// CLICK HANDLER
canvas.addEventListener("click", function(e){
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for(let dot of dots){
        const dist = Math.hypot(dot.x - mx, dot.y - my);
        if(dist < 10){
            if(!selectedDot){
                selectedDot = dot;
                drawBoard(); // update neighbor highlight immediately
            }
            else{
                if(isNeighbor(selectedDot, dot) && !lineExists(selectedDot, dot)){
                    lines.push([selectedDot, dot]);

                    let gained = checkTriangles();

                    // OUTER TRIANGLE BONUS
                    if(!outerTriangleDone && checkOuterTriangle()){
                        outerTriangleDone = true;
                        if(currentPlayer === 1) score1 += 10;
                        else score2 += 10;
                    }

                    // SWITCH PLAYER IF NO TRIANGLE
                    if(!gained) currentPlayer = currentPlayer === 1 ? 2 : 1;

                    startTimer();
                }
                selectedDot = null;
                drawBoard();
            }
            break;
        }
    }
});

// =========================
// START GAME
drawBoard();
startTimer();