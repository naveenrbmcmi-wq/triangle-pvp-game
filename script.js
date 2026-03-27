const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const rows = 10;
const spacing = 50;

let dots = [];
for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= r; c++) {
        let x = canvas.width/2 - (r * spacing)/2 + c * spacing;
        let y = 60 + r * spacing;
        dots.push({x, y, r, c});
    }
}

let uiSelectedDot = null;
let timeLeft = 15;
let timerInterval = null;

let lines = [];
let triangles = [];
let currentPlayer = 1;
let score1 = 0;
let score2 = 0;
let outerTriangleDone = false;

// Ask for room ID and player number
let roomId = prompt("Enter Room ID:") || "room123";
let myPlayerNumber = parseInt(prompt("Are you Player 1 or 2? Enter 1 or 2:") || "1");

const roomRef = firebaseRef(window.firebaseDb, "rooms/" + roomId + "/gameState");

// =========================
// HELPERS
// =========================
function isNeighbor(a, b){
    let dr = b.r - a.r;
    let dc = b.c - a.c;
    if(dr === 1 && (dc === 0 || dc === 1)) return true;
    if(dr === -1 && (dc === -1 || dc === 0)) return true;
    if(dr === 0 && Math.abs(dc) === 1) return true;
    return false;
}

function lineExists(a, b){
    return lines.some(line => 
        (line[0] === a && line[1] === b) || (line[0] === b && line[1] === a)
    );
}

function checkTriangles(){
    let gained = false;
    for(let i=0;i<dots.length;i++){
        for(let j=i+1;j<dots.length;j++){
            for(let k=j+1;k<dots.length;k++){
                let a=dots[i], b=dots[j], c=dots[k];
                if(isNeighbor(a,b) && isNeighbor(b,c) && isNeighbor(a,c)){
                    if(lineExists(a,b) && lineExists(b,c) && lineExists(a,c)){
                        let exists = triangles.some(t=>t.a===a && t.b===b && t.c===c);
                        if(!exists){
                            triangles.push({a,b,c,player:currentPlayer});
                            if(currentPlayer===1) score1++;
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

function checkOuterTriangle(){
    for(let r=0;r<rows-1;r++){
        let a=dots.find(d=>d.r===r && d.c===0);
        let b=dots.find(d=>d.r===r+1 && d.c===0);
        if(!lineExists(a,b)) return false;
    }
    for(let r=0;r<rows-1;r++){
        let a=dots.find(d=>d.r===r && d.c===r);
        let b=dots.find(d=>d.r===r+1 && d.c===r+1);
        if(!lineExists(a,b)) return false;
    }
    for(let c=0;c<rows-1;c++){
        let a=dots.find(d=>d.r===rows-1 && d.c===c);
        let b=dots.find(d=>d.r===rows-1 && d.c===c+1);
        if(!lineExists(a,b)) return false;
    }
    return true;
}

// =========================
// TIMER
// =========================
function startTimer(){
    clearInterval(timerInterval);
    timeLeft = 15;
    timerInterval = setInterval(()=>{
        timeLeft--;
        if(timeLeft <=0){
            if(myPlayerNumber===currentPlayer){
                currentPlayer = currentPlayer===1?2:1;
                uiSelectedDot=null;
            }
            startTimer();
        }
        drawBoard();
    },1000);
}

// =========================
// DRAW BOARD
// =========================
function drawBoard(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // TRIANGLES
    triangles.forEach(tri=>{
        ctx.beginPath();
        ctx.moveTo(tri.a.x, tri.a.y);
        ctx.lineTo(tri.b.x, tri.b.y);
        ctx.lineTo(tri.c.x, tri.c.y);
        ctx.closePath();
        ctx.fillStyle = tri.player===1 ? "lightblue":"lightcoral";
        ctx.fill();
    });

    // LINES
    lines.forEach(line=>{
        ctx.beginPath();
        ctx.moveTo(line[0].x,line[0].y);
        ctx.lineTo(line[1].x,line[1].y);
        ctx.stroke();
    });

    // HIGHLIGHT NEIGHBORS
    if(uiSelectedDot){
        dots.forEach(dot=>{
            if(isNeighbor(uiSelectedDot,dot) && !lineExists(uiSelectedDot,dot)){
                ctx.beginPath();
                ctx.arc(dot.x,dot.y,9,0,Math.PI*2);
                ctx.strokeStyle="gold";
                ctx.lineWidth=3;
                ctx.stroke();
            }
        });
    }

    // DOTS
    dots.forEach(dot=>{
        ctx.beginPath();
        ctx.arc(dot.x,dot.y,5,0,Math.PI*2);
        ctx.fillStyle="black";
        ctx.fill();
    });

    // UI TEXT
    ctx.fillStyle="black";
    ctx.font="16px Arial";
    ctx.fillText("Player: "+(currentPlayer===1?"Blue":"Red"),20,20);
    ctx.fillText("Blue: "+score1,20,40);
    ctx.fillText("Red: "+score2,20,60);
    ctx.fillText("Time: "+timeLeft,20,80);
}

// =========================
// CLICK HANDLER
// =========================
canvas.addEventListener("click",e=>{
    if(currentPlayer!==myPlayerNumber) return; // wait for turn

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for(let dot of dots){
        const dist = Math.hypot(dot.x - mx, dot.y - my);
        if(dist<10){
            if(!uiSelectedDot){
                uiSelectedDot = dot;
            } else {
                if(isNeighbor(uiSelectedDot,dot) && !lineExists(uiSelectedDot,dot)){
                    lines.push([uiSelectedDot,dot]);
                    let gained = checkTriangles();

                    if(!outerTriangleDone && checkOuterTriangle()){
                        outerTriangleDone=true;
                        if(currentPlayer===1) score1+=10;
                        else score2+=10;
                    }

                    if(!gained) currentPlayer = currentPlayer===1?2:1;
                    uiSelectedDot=null;
                    startTimer();

                    // Update Firebase
                    firebaseSet(roomRef,{
                        lines: lines.map(l=>({a:{r:l[0].r,c:l[0].c},b:{r:l[1].r,c:l[1].c}})),
                        triangles: triangles.map(t=>({a:{r:t.a.r,c:t.a.c},b:{r:t.b.r,c:t.b.c},c:{r:t.c.r,c:t.c.c},player:t.player})),
                        score1, score2, currentPlayer
                    });
                } else {
                    uiSelectedDot=null;
                }
            }
            drawBoard();
            break;
        }
    }
});

// =========================
// FIREBASE LISTENER
// =========================
firebaseOnValue(roomRef,snapshot=>{
    const state = snapshot.val();
    if(!state) return;

    lines = state.lines.map(l=>[dots.find(d=>d.r===l.a.r&&d.c===l.a.c),dots.find(d=>d.r===l.b.r&&d.c===l.b.c)]);
    triangles = state.triangles.map(t=>({
        a:dots.find(d=>d.r===t.a.r&&d.c===t.a.c),
        b:dots.find(d=>d.r===t.b.r&&d.c===t.b.c),
        c:dots.find(d=>d.r===t.c.r&&d.c===t.c.c),
        player:t.player
    }));
    score1 = state.score1;
    score2 = state.score2;
    currentPlayer = state.currentPlayer;

    drawBoard();
});

// =========================
// START GAME
// =========================
drawBoard();
startTimer();