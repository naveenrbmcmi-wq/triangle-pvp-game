import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, get, set } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const rows = 10;
const spacing = 50;

let dots = [], lines = [], triangles = [];
let selectedDot = null;
let currentPlayer = 1; // track whose turn
let myPlayerNumber = 0; // 1 or 2 assigned
let score1 = 0, score2 = 0;
let timeLeft = 15, timerInterval = null;
let outerTriangleDone = false;

// ---------------- Firebase Setup ----------------
const firebaseConfig = {
    apiKey: "AIzaSyA6QaoKriHYTWJw1WNMcCxRi5OxR9tKS_o",
    authDomain: "triangle-pvp-game.firebaseapp.com",
    projectId: "triangle-pvp-game",
    storageBucket: "triangle-pvp-game.firebasestorage.app",
    messagingSenderId: "185433129150",
    appId: "1:185433129150:web:836e50ae6dd23c52265eef",
    measurementId: "G-DTFB5HGBQT"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ---------------- Room Setup ----------------
const roomId = prompt("Enter Room ID:");
const roomRef = ref(db, "rooms/" + roomId);

// Assign player number
async function assignPlayer() {
    const roomSnapshot = await get(roomRef);
    const roomData = roomSnapshot.val() || {};
    const players = roomData.players || {};

    if (!players[1]) {
        myPlayerNumber = 1;
        set(ref(db, `rooms/${roomId}/players/1`), { joined: true });
    } else if (!players[2]) {
        myPlayerNumber = 2;
        set(ref(db, `rooms/${roomId}/players/2`), { joined: true });
    } else {
        alert("Room full! Join another room.");
        location.reload();
    }
}

// ---------------- Create Dots ----------------
for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= r; c++) {
        let x = canvas.width/2 - (r*spacing)/2 + c*spacing;
        let y = 60 + r*spacing;
        dots.push({x, y, r, c});
    }
}

// ---------------- Helpers ----------------
function isNeighbor(a,b){
    const dr = b.r - a.r;
    const dc = b.c - a.c;
    if(dr===1 && (dc===0||dc===1)) return true;
    if(dr===-1 && (dc===-1||dc===0)) return true;
    if(dr===0 && Math.abs(dc)===1) return true;
    return false;
}

function lineExists(a,b){
    return lines.some(l=> 
        (l[0].r===a.r && l[0].c===a.c && l[1].r===b.r && l[1].c===b.c) ||
        (l[0].r===b.r && l[0].c===b.c && l[1].r===a.r && l[1].c===a.c)
    );
}

function checkTriangles(){
    let gained=false;
    for(let i=0;i<dots.length;i++){
        for(let j=i+1;j<dots.length;j++){
            for(let k=j+1;k<dots.length;k++){
                let a=dots[i], b=dots[j], c=dots[k];
                if(isNeighbor(a,b) && isNeighbor(b,c) && isNeighbor(a,c)){
                    if(lineExists(a,b)&&lineExists(b,c)&&lineExists(a,c)){
                        let exists=triangles.some(t=> t.a.r===a.r && t.b.r===b.r && t.c.r===c.r && t.a.c===a.c && t.b.c===b.c && t.c.c===c.c);
                        if(!exists){
                            triangles.push({a,b,c,player:currentPlayer});
                            if(currentPlayer===1) score1++;
                            else score2++;
                            gained=true;
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

// ---------------- Timer ----------------
function startTimer(){
    clearInterval(timerInterval);
    timeLeft=15;
    timerInterval=setInterval(()=>{
        timeLeft--;
        if(timeLeft<=0){
            currentPlayer = currentPlayer===1?2:1;
            selectedDot=null;
            startTimer();
        }
        drawBoard();
    },1000);
}

// ---------------- Draw Board ----------------
function drawBoard(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Triangles
    triangles.forEach(tri=>{
        ctx.beginPath();
        ctx.moveTo(tri.a.x,tri.a.y);
        ctx.lineTo(tri.b.x,tri.b.y);
        ctx.lineTo(tri.c.x,tri.c.y);
        ctx.closePath();
        ctx.fillStyle=tri.player===1?"lightblue":"lightcoral";
        ctx.fill();
    });

    // Lines
    lines.forEach(l=>{
        ctx.beginPath();
        ctx.moveTo(l[0].x,l[0].y);
        ctx.lineTo(l[1].x,l[1].y);
        ctx.strokeStyle="black";
        ctx.lineWidth=2;
        ctx.stroke();
    });

    // Highlight neighbors
    if(selectedDot){
        dots.forEach(dot=>{
            if(isNeighbor(selectedDot,dot) && !lineExists(selectedDot,dot)){
                ctx.beginPath();
                ctx.arc(dot.x,dot.y,12,0,Math.PI*2);
                ctx.fillStyle="rgba(255,215,0,0.3)";
                ctx.fill();
            }
        });
    }

    // Dots
    dots.forEach(dot=>{
        ctx.beginPath();
        ctx.arc(dot.x,dot.y,6,0,Math.PI*2);
        ctx.fillStyle="black";
        ctx.fill();
        ctx.strokeStyle="white";
        ctx.stroke();
    });

    // UI
    ctx.fillStyle="black";
    ctx.font="16px Arial";
    ctx.fillText("Player: "+(currentPlayer===1?"Blue":"Red"),20,20);
    ctx.fillText("Blue: "+score1,20,40);
    ctx.fillText("Red: "+score2,20,60);
    ctx.fillText("Time: "+timeLeft,20,80);
}

// ---------------- Firebase Moves ----------------
function sendMove(a,b){
    push(ref(db, "rooms/"+roomId+"/moves"),{
        a:{r:a.r,c:a.c},
        b:{r:b.r,c:b.c},
        player:myPlayerNumber
    });
}

onChildAdded(ref(db,"rooms/"+roomId+"/moves"),snap=>{
    const move = snap.val();
    const dotA = dots.find(d=>d.r===move.a.r && d.c===move.a.c);
    const dotB = dots.find(d=>d.r===move.b.r && d.c===move.b.c);
    if(!lineExists(dotA,dotB)){
        lines.push([dotA,dotB]);
        currentPlayer = move.player===1?2:1;
        checkTriangles();
        if(!outerTriangleDone && checkOuterTriangle()){
            outerTriangleDone=true;
            if(move.player===1) score1+=10; else score2+=10;
        }
        drawBoard();
    }
});

// ---------------- Click Handler ----------------
canvas.addEventListener("click", e=>{
    if(currentPlayer !== myPlayerNumber) return; // only your turn
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX-rect.left;
    const my = e.clientY-rect.top;

    for(let dot of dots){
        if(Math.hypot(dot.x-mx,dot.y-my)<10){
            if(!selectedDot){ selectedDot=dot; drawBoard(); }
            else{
                if(isNeighbor(selectedDot,dot) && !lineExists(selectedDot,dot)){
                    lines.push([selectedDot,dot]);
                    sendMove(selectedDot,dot);

                    let gained=checkTriangles();
                    if(!outerTriangleDone && checkOuterTriangle()){
                        outerTriangleDone=true;
                        if(currentPlayer===1) score1+=10; else score2+=10;
                    }
                    if(!gained) currentPlayer=currentPlayer===1?2:1;
                    startTimer();
                }
                selectedDot=null;
                drawBoard();
            }
            break;
        }
    }
});

// ---------------- Start ----------------
assignPlayer().then(()=>{
    drawBoard();
    startTimer();
});