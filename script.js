// ============================
// T10 Triangle Game - PvP Stable
// ============================

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

let roomId = prompt("Enter room ID:"); // simple room system

// ------------- FIREBASE SETUP -------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID",
    measurementId: "MEASUREMENT_ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const movesRef = ref(db, "rooms/" + roomId + "/moves");

// ------------- CREATE DOTS -----------------
for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= r; c++) {
        let x = canvas.width/2 - (r * spacing)/2 + c * spacing;
        let y = 60 + r * spacing;
        dots.push({x, y, r, c});
    }
}

// ------------- HELPER FUNCTIONS ------------
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
        (line[0].r === a.r && line[0].c === a.c && line[1].r === b.r && line[1].c === b.c) ||
        (line[0].r === b.r && line[0].c === b.c && line[1].r === a.r && line[1].c === a.c)
    );
}

// ------------- TRIANGLE CHECK ---------------
function checkTriangles(){
    let gained = false;
    for(let i = 0; i < dots.length; i++){
        for(let j = i+1; j < dots.length; j++){
            for(let k = j+1; k < dots.length; k++){
                let a = dots[i], b = dots[j], c = dots[k];
                if(isNeighbor(a,b) && isNeighbor(b,c) && isNeighbor(a,c)){
                    if(lineExists(a,b) && lineExists(b,c) && lineExists(a,c)){
                        let exists = triangles.some(t =>
                            t.a.r === a.r && t.a.c === a.c &&
                            t.b.r === b.r && t.b.c === b.c &&
                            t.c.r === c.r && t.c.c === c.c
                        );
                        if(!exists){
                            triangles.push({a,b,c,player: currentPlayer});
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

// ------------- OUTER TRIANGLE CHECK ----------
function checkOuterTriangle(){
    for(let r = 0; r < rows-1; r++){
        let a = dots.find(d=>d.r===r && d.c===0);
        let b = dots.find(d=>d.r===r+1 && d.c===0);
        if(!lineExists(a,b)) return false;
    }
    for(let r = 0; r < rows-1; r++){
        let a = dots.find(d=>d.r===r && d.c===r);
        let b = dots.find(d=>d.r===r+1 && d.c===r+1);
        if(!lineExists(a,b)) return false;
    }
    for(let c = 0; c < rows-1; c++){
        let a = dots.find(d=>d.r===rows-1 && d.c===c);
        let b = dots.find(d=>d.r===rows-1 && d.c===c+1);
        if(!lineExists(a,b)) return false;
    }
    return true;
}

// ------------- TIMER -----------------------
function startTimer(){
    clearInterval(timerInterval);
    timeLeft = 15;

    timerInterval = setInterval(() => {
        timeLeft--;
        if(timeLeft <= 0){
            currentPlayer = currentPlayer===1?2:1;
            selectedDot = null;
            startTimer();
        }
        drawBoard();
    },1000);
}

// ------------- DRAW BOARD ------------------
function drawBoard(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // TRIANGLES
    triangles.forEach(tri => {
        ctx.beginPath();
        ctx.moveTo(tri.a.x, tri.a.y);
        ctx.lineTo(tri.b.x, tri.b.y);
        ctx.lineTo(tri.c.x, tri.c.y);
        ctx.closePath();
        ctx.fillStyle = tri.player===1?"lightblue":"lightcoral";
        ctx.fill();
    });

    // LINES
    lines.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(line[0].x,line[0].y);
        ctx.lineTo(line[1].x,line[1].y);
        ctx.stroke();
    });

    // HIGHLIGHT NEIGHBORS (semi-transparent gold)
    if(selectedDot){
        dots.forEach(dot=>{
            if(isNeighbor(selectedDot,dot) && !lineExists(selectedDot,dot)){
                ctx.beginPath();
                ctx.arc(dot.x,dot.y,10,0,Math.PI*2); // bigger than dot
                ctx.fillStyle = "rgba(255,215,0,0.5)";
                ctx.fill();
            }
        });
    }

    // DOTS (draw last, always visible)
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

// ------------- SEND MOVE TO FIREBASE ----------
function sendMove(dotA,dotB){
    push(movesRef,{
        a:{r:dotA.r,c:dotA.c},
        b:{r:dotB.r,c:dotB.c},
        player:currentPlayer
    });
}

// ------------- RECEIVE MOVE FROM FIREBASE -------
onChildAdded(movesRef, (data)=>{
    const move = data.val();
    const dotA = dots.find(d=>d.r===move.a.r && d.c===move.a.c);
    const dotB = dots.find(d=>d.r===move.b.r && d.c===move.b.c);

    if(!lineExists(dotA,dotB)){
        lines.push([dotA,dotB]);
        currentPlayer = move.player===1?2:1;
        checkTriangles();

        if(!outerTriangleDone && checkOuterTriangle()){
            outerTriangleDone=true;
            if(move.player===1) score1+=10;
            else score2+=10;
        }

        drawBoard();
    }
});

// ------------- CLICK HANDLER -----------------
canvas.addEventListener("click", e=>{
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for(let dot of dots){
        if(Math.hypot(dot.x-mx,dot.y-my)<10){
            if(!selectedDot){
                selectedDot=dot;
                drawBoard();
            }else{
                if(isNeighbor(selectedDot,dot) && !lineExists(selectedDot,dot)){
                    lines.push([selectedDot,dot]);
                    sendMove(selectedDot,dot);

                    let gained = checkTriangles();
                    if(!outerTriangleDone && checkOuterTriangle()){
                        outerTriangleDone=true;
                        if(currentPlayer===1) score1+=10;
                        else score2+=10;
                    }

                    if(!gained) currentPlayer = currentPlayer===1?2:1;

                    startTimer();
                }
                selectedDot=null;
                drawBoard();
            }
            break;
        }
    }
});

// ------------- START GAME ------------------
drawBoard();
startTimer();