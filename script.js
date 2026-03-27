// ------------------ FIREBASE SETUP ------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA6QaoKriHYTWJw1WNMcCxRi5OxR9tKS_o",
  authDomain: "triangle-pvp-game.firebaseapp.com",
  databaseURL: "https://triangle-pvp-game-default-rtdb.firebaseio.com/",
  projectId: "triangle-pvp-game",
  storageBucket: "triangle-pvp-game.appspot.com",
  messagingSenderId: "185433129150",
  appId: "1:185433129150:web:836e50ae6dd23c52265eef"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ------------------ GAME SETUP ------------------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const rows = 10;
const spacing = 50;

let dots = [];
let selectedDot = null;
let playerNumber = null; // 1 or 2
let roomId = new URLSearchParams(window.location.search).get("room") || "default-room";

// ------------------ STATE ------------------
let gameState = {
  lines: [],
  triangles: [],
  scores: { player1: 0, player2: 0 },
  currentPlayer: 1,
  outerTriangleDone: false
};

// ------------------ CREATE TRIANGULAR LATTICE ------------------
for (let r = 0; r < rows; r++) {
  for (let c = 0; c <= r; c++) {
    let x = canvas.width/2 - (r * spacing)/2 + c * spacing;
    let y = 60 + r * spacing;
    dots.push({x, y, r, c});
  }
}

// ------------------ HELPER FUNCTIONS ------------------
function isNeighbor(a, b){
  let dr = b.r - a.r;
  let dc = b.c - a.c;
  if(dr === 1 && (dc === 0 || dc === 1)) return true;
  if(dr === -1 && (dc === -1 || dc === 0)) return true;
  if(dr === 0 && Math.abs(dc) === 1) return true;
  return false;
}

function lineExists(a,b){
  return gameState.lines.some(line =>
    (line[0].r === a.r && line[0].c === a.c && line[1].r === b.r && line[1].c === b.c) ||
    (line[1].r === a.r && line[1].c === a.c && line[0].r === b.r && line[0].c === b.c)
  );
}

// ------------------ CHECK TRIANGLES ------------------
function checkTriangles(){
  let gained = false;
  for(let i = 0; i < dots.length; i++){
    for(let j = i+1; j < dots.length; j++){
      for(let k = j+1; k < dots.length; k++){
        let a = dots[i], b = dots[j], c = dots[k];
        if(isNeighbor(a,b) && isNeighbor(b,c) && isNeighbor(a,c)){
          if(lineExists(a,b) && lineExists(b,c) && lineExists(a,c)){
            let exists = gameState.triangles.some(t =>
              t.a.r===a.r && t.a.c===a.c &&
              t.b.r===b.r && t.b.c===b.c &&
              t.c.r===c.r && t.c.c===c.c
            );
            if(!exists){
              gameState.triangles.push({a,b,c,player: gameState.currentPlayer});
              if(gameState.currentPlayer===1) gameState.scores.player1++;
              else gameState.scores.player2++;
              gained = true;
            }
          }
        }
      }
    }
  }
  return gained;
}

// ------------------ OUTER TRIANGLE BONUS ------------------
function checkOuterTriangle(){
  const lastRow = rows-1;
  // left edge
  for(let r=0;r<rows-1;r++){
    let a=dots.find(d=>d.r===r && d.c===0);
    let b=dots.find(d=>d.r===r+1 && d.c===0);
    if(!lineExists(a,b)) return false;
  }
  // right edge
  for(let r=0;r<rows-1;r++){
    let a=dots.find(d=>d.r===r && d.c===r);
    let b=dots.find(d=>d.r===r+1 && d.c===r+1);
    if(!lineExists(a,b)) return false;
  }
  // bottom edge
  for(let c=0;c<rows-1;c++){
    let a=dots.find(d=>d.r===lastRow && d.c===c);
    let b=dots.find(d=>d.r===lastRow && d.c===c+1);
    if(!lineExists(a,b)) return false;
  }
  return true;
}

// ------------------ DRAW BOARD ------------------
function drawBoard(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // TRIANGLES
  gameState.triangles.forEach(tri=>{
    ctx.beginPath();
    ctx.moveTo(tri.a.x, tri.a.y);
    ctx.lineTo(tri.b.x, tri.b.y);
    ctx.lineTo(tri.c.x, tri.c.y);
    ctx.closePath();
    ctx.fillStyle=tri.player===1?"lightblue":"lightcoral";
    ctx.fill();
  });

  // LINES
  gameState.lines.forEach(line=>{
    ctx.beginPath();
    ctx.moveTo(line[0].x,line[0].y);
    ctx.lineTo(line[1].x,line[1].y);
    ctx.stroke();
  });

  // HIGHLIGHT AVAILABLE NEIGHBORS
  if(selectedDot){
    dots.forEach(dot=>{
      if(isNeighbor(selectedDot,dot) && !lineExists(selectedDot,dot)){
        ctx.beginPath();
        ctx.arc(dot.x,dot.y,7,0,Math.PI*2);
        ctx.fillStyle="gold";
        ctx.fill();
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
  ctx.fillText("You: Player " + playerNumber, 20, 20);
  ctx.fillText("Player 1: " + gameState.scores.player1, 20, 40);
  ctx.fillText("Player 2: " + gameState.scores.player2, 20, 60);
  ctx.fillText("Current Turn: Player " + gameState.currentPlayer, 20, 80);
}

// ------------------ PLAYER ASSIGNMENT ------------------
const roomRef = ref(db, "rooms/"+roomId);
get(roomRef).then(snapshot=>{
  if(snapshot.exists()){
    const data = snapshot.val();
    if(!data.player1) playerNumber=1;
    else if(!data.player2) playerNumber=2;
    else playerNumber=null; // room full
  } else {
    playerNumber=1;
    set(roomRef,{ lines: [], triangles: [], scores:{player1:0,player2:0}, currentPlayer:1 });
  }
  drawBoard();
});

// ------------------ SYNC WITH FIREBASE ------------------
onValue(roomRef, snapshot=>{
  const data = snapshot.val();
  if(!data) return;
  gameState = data;
  drawBoard();
});

// ------------------ CLICK HANDLER ------------------
canvas.addEventListener("click", function(e){
  if(!playerNumber) return alert("Room full or not assigned");

  if(gameState.currentPlayer !== playerNumber) return; // not your turn

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for(let dot of dots){
    const dist = Math.hypot(dot.x-mx,dot.y-my);
    if(dist<10){
      if(!selectedDot){
        selectedDot=dot;
        drawBoard();
      } else {
        if(isNeighbor(selectedDot,dot) && !lineExists(selectedDot,dot)){
          gameState.lines.push([selectedDot,dot]);
          let gained = checkTriangles();

          // outer triangle bonus
          if(!gameState.outerTriangleDone && checkOuterTriangle()){
            gameState.outerTriangleDone=true;
            if(playerNumber===1) gameState.scores.player1+=10;
            else gameState.scores.player2+=10;
          }

          // switch player if no triangle
          if(!gained) gameState.currentPlayer = gameState.currentPlayer===1?2:1;

          // push update to Firebase
          set(roomRef, gameState);
        }
        selectedDot=null;
        drawBoard();
      }
      break;
    }
  }
});

// ------------------ INITIAL DRAW ------------------
drawBoard();