// ─────────────────────────────────────────────────────────────
//  Ghana Dame – Full Game with Online Multiplayer
//  Stack: React + Supabase Realtime
//
//  SETUP:
//  1. npm install @supabase/supabase-js
//  2. Create a Supabase project at https://supabase.com
//  3. Run the SQL below in your Supabase SQL editor
//  4. Replace SUPABASE_URL and SUPABASE_ANON_KEY below
//  5. npm run dev / vercel deploy
//
//  SQL (run once in Supabase SQL editor):
//  ─────────────────────────────────────
//  create table games (
//    id text primary key,
//    board jsonb not null,
//    turn text not null,
//    red_cap int default 0,
//    gold_cap int default 0,
//    winner text,
//    win_msg text,
//    updated_at timestamptz default now()
//  );
//  alter table games enable row level security;
//  create policy “public access” on games for all using (true) with check (true);
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from “react”;
import { createClient } from “@supabase/supabase-js”;

// ── YOUR SUPABASE CREDENTIALS ────────────────────────────────
const SUPABASE_URL  = “https://hfwasrklopglxlagchyo.supabase.co”;
const SUPABASE_ANON = “eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmd2Fzcmtsb3BnbHhsYWdjaHlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNzM0MjIsImV4cCI6MjA5MDc0OTQyMn0.4JkGh1FdqHBvgV1Nk1FCoxHEGdK7wqTfAzOE4l4ghXE”;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
// ─────────────────────────────────────────────────────────────

const ROWS = 10, COLS = 10;
const RED = “red”, GOLD = “gold”;
const isPlay = (r, c) => (r + c) % 2 === 0;
function cloneBoard(b) { return b.map(r => r.map(c => c ? { …c } : null)); }
function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
function countPieces(col, b) {
let n = 0;
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
if (b[r][c]?.col === col) n++;
return n;
}

function singleCaptures(r, c, b) {
const p = b[r][c]; if (!p) return [];
const caps = [];
const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
if (!p.king) {
dirs.forEach(([dr,dc]) => {
const mr=r+dr, mc=c+dc, lr=r+dr*2, lc=c+dc*2;
if (!inBounds(mr,mc)||!inBounds(lr,lc)) return;
if (!b[mr][mc]||b[mr][mc].col===p.col) return;
if (b[lr][lc]||!isPlay(lr,lc)) return;
caps.push({capR:mr,capC:mc,landR:lr,landC:lc});
});
} else {
dirs.forEach(([dr,dc]) => {
let sr=r+dr, sc=c+dc, ep=null;
while (inBounds(sr,sc)) {
const cell=b[sr][sc];
if (cell) { if (cell.col===p.col||ep) break; ep={r:sr,c:sc}; }
else if (ep && isPlay(sr,sc)) caps.push({capR:ep.r,capC:ep.c,landR:sr,landC:sc});
sr+=dr; sc+=dc;
}
});
}
return caps;
}

function simpleMoves(r, c, b) {
const p = b[r][c]; if (!p) return [];
const dirs = p.king ? [[-1,-1],[-1,1],[1,-1],[1,1]]
: p.col===RED ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
const moves = [];
if (p.king) {
dirs.forEach(([dr,dc]) => {
let nr=r+dr, nc=c+dc;
while (inBounds(nr,nc)&&!b[nr][nc]&&isPlay(nr,nc)) { moves.push({r:nr,c:nc}); nr+=dr; nc+=dc; }
});
} else {
dirs.forEach(([dr,dc]) => {
const nr=r+dr, nc=c+dc;
if (inBounds(nr,nc)&&!b[nr][nc]&&isPlay(nr,nc)) moves.push({r:nr,c:nc});
});
}
return moves;
}

function hasAnyCaptureForCol(col, b) {
for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++)
if (b[r][c]?.col===col && singleCaptures(r,c,b).length) return true;
return false;
}

function findSeqCaptures(r,c,p,b,seq,all,vis) {
const dirs=[[-1,-1],[-1,1],[1,-1],[1,1]];
if (!p.king) {
dirs.forEach(([dr,dc])=>{
const mr=r+dr,mc=c+dc,lr=r+dr*2,lc=c+dc*2;
if(!inBounds(mr,mc)||!inBounds(lr,lc))return;
const en=b[mr][mc];
if(!en||en.col===p.col)return;
if(seq.some(s=>s.cap.r===mr&&s.cap.c===mc))return;
if(b[lr][lc]||!isPlay(lr,lc)||vis.has(`${lr},${lc}`))return;
const nb=cloneBoard(b); nb[r][c]=null; nb[mr][mc]=null; nb[lr][lc]=p;
const ns=[…seq,{cap:{r:mr,c:mc},land:{r:lr,c:lc}}];
const nv=new Set(vis); nv.add(`${lr},${lc}`);
const sub=[]; findSeqCaptures(lr,lc,p,nb,ns,sub,nv);
if(!sub.length) all.push(ns); else sub.forEach(s=>all.push(s));
});
} else {
dirs.forEach(([dr,dc])=>{
let sr=r+dr,sc=c+dc,ep=null;
while(inBounds(sr,sc)){
const cell=b[sr][sc];
if(cell){if(cell.col===p.col||ep)break;if(seq.some(s=>s.cap.r===sr&&s.cap.c===sc))break;ep={r:sr,c:sc};}
else if(ep&&!vis.has(`${sr},${sc}`)&&isPlay(sr,sc)){
const nb=cloneBoard(b); nb[r][c]=null; nb[ep.r][ep.c]=null; nb[sr][sc]=p;
const ns=[…seq,{cap:{r:ep.r,c:ep.c},land:{r:sr,c:sc}}];
const nv=new Set(vis); nv.add(`${sr},${sc}`);
const sub=[]; findSeqCaptures(sr,sc,p,nb,ns,sub,nv);
if(!sub.length) all.push(ns); else sub.forEach(s=>all.push(s));
}
sr+=dr; sc+=dc;
}
});
}
}

function allMovesAI(col, b) {
const res=[];
for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
if(!b[r][c]||b[r][c].col!==col) continue;
const seqs=[]; findSeqCaptures(r,c,b[r][c],b,[],seqs,new Set([`${r},${c}`]));
if(seqs.length) seqs.forEach(seq=>res.push({fr:r,fc:c,r:seq[seq.length-1].land.r,c:seq[seq.length-1].land.c,caps:seq.map(s=>s.cap)}));
else simpleMoves(r,c,b).forEach(m=>res.push({fr:r,fc:c,r:m.r,c:m.c,caps:[]}));
}
const caps=res.filter(m=>m.caps.length>0);
if(!caps.length) return res;
const mx=Math.max(…caps.map(m=>m.caps.length));
return caps.filter(m=>m.caps.length===mx);
}

function applyMoveObj(fr,fc,tr,tc,caps,b){
const p={…b[fr][fc]};
b[fr][fc]=null;
caps.forEach(cap=>b[cap.r][cap.c]=null);
b[tr][tc]=p;
if((p.col===RED&&tr===0)||(p.col===GOLD&&tr===9)) p.king=true;
return b;
}

function evaluate(b){
let s=0;
for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
const p=b[r][c]; if(!p) continue;
let v=p.king?5:1;
if(!p.king) v+=(p.col===GOLD?r:9-r)*0.08;
v+=(5-Math.abs(c-4.5))*0.04;
if(c===0||c===9) v-=0.15;
if(p.col===GOLD) s+=v; else s-=v;
}
return s;
}

function minimax(b,depth,alpha,beta,isMax){
if(depth===0) return evaluate(b);
const col=isMax?GOLD:RED;
const moves=allMovesAI(col,b);
if(!moves.length) return isMax?-9999:9999;
let best=isMax?-Infinity:Infinity;
for(const m of moves){
const nb=applyMoveObj(m.fr,m.fc,m.r,m.c,m.caps,cloneBoard(b));
const s=minimax(nb,depth-1,alpha,beta,!isMax);
if(isMax){best=Math.max(best,s);alpha=Math.max(alpha,s);}
else{best=Math.min(best,s);beta=Math.min(beta,s);}
if(beta<=alpha) break;
}
return best;
}

function makeBoard(){
const b=Array.from({length:ROWS},()=>Array(COLS).fill(null));
for(let r=0;r<4;r++) for(let c=0;c<COLS;c++) if(isPlay(r,c)) b[r][c]={col:GOLD,king:false};
for(let r=6;r<10;r++) for(let c=0;c<COLS;c++) if(isPlay(r,c)) b[r][c]={col:RED,king:false};
return b;
}

function genRoomId() {
return Math.random().toString(36).slice(2,8).toUpperCase();
}

const DIFF_DEPTH={easy:1,med:3,hard:6};
const colors={gold:’#F5A623’,red:’#B83227’,green:’#1B6B3A’,black:’#0C0A08’,dark:’#161210’,cream:’#FDF3DC’,brown:’#5C3317’,yellow:’#F9D423’,blue:’#1A3A5C’};

// ─────────────────────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────────────────────
export default function App() {
// “menu” | “ai” | “local” | “online”
const [screen, setScreen] = useState(“menu”);
const [gameProps, setGameProps] = useState({});

if (screen === “menu”) return (
<Menu onStart={(mode, props) => { setGameProps(props||{}); setScreen(mode); }} />
);
return (
<Game
mode={screen}
{…gameProps}
onMenu={() => setScreen(“menu”)}
/>
);
}

// ─────────────────────────────────────────────────────────────
//  MENU
// ─────────────────────────────────────────────────────────────
function Menu({ onStart }) {
const [diff, setDiff] = useState(“med”);
const [p1, setP1] = useState(””);
const [p2, setP2] = useState(””);
const [roomInput, setRoomInput] = useState(””);
const [joining, setJoining] = useState(false);
const [creating, setCreating] = useState(false);
const [error, setError] = useState(””);
const [createdRoom, setCreatedRoom] = useState(null);
const [waitingForOpponent, setWaitingForOpponent] = useState(false);
const pollRef = useRef(null);

// Poll until opponent joins
useEffect(() => {
if (!waitingForOpponent || !createdRoom) return;
pollRef.current = setInterval(async () => {
const { data } = await supabase.from(“games”).select(“gold_cap”).eq(“id”, createdRoom).single();
// We store player2_joined flag in gold_cap as -1 (hack-free: use a separate column ideally)
// Better: check if gold_name is set — but we keep it simple here
// Actually we check via a “players” approach: once gold presses join, turn changes from “waiting” to “red”
if (data && data.gold_cap === -99) {
clearInterval(pollRef.current);
setWaitingForOpponent(false);
onStart(“online”, { roomId: createdRoom, myColor: RED, diff });
}
}, 2000);
return () => clearInterval(pollRef.current);
}, [waitingForOpponent, createdRoom, diff, onStart]);

async function handleCreateRoom() {
setError(””); setCreating(true);
const roomId = genRoomId();
const { error: err } = await supabase.from(“games”).insert({
id: roomId,
board: makeBoard(),
turn: “waiting”, // waiting for p2
red_cap: 0,
gold_cap: 0,
winner: null,
win_msg: null,
});
setCreating(false);
if (err) { setError(“Failed to create room. Check your Supabase config.”); return; }
setCreatedRoom(roomId);
setWaitingForOpponent(true);
}

async function handleJoinRoom() {
setError(””); setJoining(true);
const id = roomInput.trim().toUpperCase();
if (!id) { setError(“Enter a room code.”); setJoining(false); return; }
const { data, error: err } = await supabase.from(“games”).select(”*”).eq(“id”, id).single();
if (err || !data) { setError(“Room not found. Check the code.”); setJoining(false); return; }
if (data.turn !== “waiting”) { setError(“Room is already full or game started.”); setJoining(false); return; }
// Signal player 2 joined
await supabase.from(“games”).update({ turn: RED, gold_cap: -99 }).eq(“id”, id);
// Small delay then fix gold_cap
await supabase.from(“games”).update({ gold_cap: 0 }).eq(“id”, id);
setJoining(false);
onStart(“online”, { roomId: id, myColor: GOLD, diff });
}

return (
<div style={{background:colors.black,minHeight:‘100vh’,display:‘flex’,flexDirection:‘column’,alignItems:‘center’,fontFamily:”‘DM Sans’,sans-serif”,color:colors.cream}}>
<div style={{width:‘100%’,height:12,background:`repeating-linear-gradient(90deg,${colors.red} 0 16px,${colors.gold} 16px 32px,${colors.green} 32px 48px,${colors.yellow} 48px 64px,${colors.blue} 64px 80px,${colors.brown} 80px 96px)`,boxShadow:`0 3px 18px rgba(245,166,35,0.45)`}}/>
<div style={{flex:1,display:‘flex’,flexDirection:‘column’,alignItems:‘center’,justifyContent:‘center’,padding:‘32px 20px’,width:‘100%’,maxWidth:420}}>
<div style={{fontFamily:”‘Playfair Display’,serif”,fontSize:‘clamp(2rem,8vw,3rem)’,fontWeight:900,textAlign:‘center’,marginBottom:4}}>
<span style={{color:colors.gold}}>Ghana</span> Dame
</div>
<div style={{fontSize:‘0.6rem’,letterSpacing:4,textTransform:‘uppercase’,color:‘rgba(253,243,220,0.3)’,marginBottom:32}}>100-Square · Official Ghanaian Rules · 🇬🇭</div>

```
    {/* VS AI */}
    <div style={{width:'100%',background:'rgba(245,166,35,0.06)',border:'1px solid rgba(245,166,35,0.2)',borderRadius:12,padding:'18px 18px 14px',marginBottom:12}}>
      <div style={{fontWeight:800,fontSize:'0.85rem',letterSpacing:2,textTransform:'uppercase',color:colors.gold,marginBottom:12}}>🤖 vs AI</div>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        {[['easy','Easy','#1B6B3A'],['med','Medium','#F5A623'],['hard','Hard','#B83227']].map(([d,lbl,ac])=>(
          <button key={d} onClick={()=>setDiff(d)} style={{flex:1,padding:'7px 4px',borderRadius:5,fontFamily:"'DM Sans',sans-serif",fontSize:'0.68rem',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',cursor:'pointer',border:`1.5px solid ${diff===d?ac:'rgba(253,243,220,0.12)'}`,background:diff===d?ac:'transparent',color:diff===d?(d==='med'?colors.black:colors.cream):'rgba(253,243,220,0.35)',transition:'all 0.2s'}}>{lbl}</button>
        ))}
      </div>
      <button onClick={()=>onStart("ai",{diff})} style={btnStyle(colors.gold, colors.black)}>Play vs AI</button>
    </div>

    {/* Local */}
    <div style={{width:'100%',background:'rgba(27,107,58,0.08)',border:'1px solid rgba(27,107,58,0.3)',borderRadius:12,padding:'18px 18px 14px',marginBottom:12}}>
      <div style={{fontWeight:800,fontSize:'0.85rem',letterSpacing:2,textTransform:'uppercase',color:'#4CAF7D',marginBottom:12}}>👥 Local Multiplayer</div>
      <div style={{display:'flex',gap:10,marginBottom:12}}>
        <input value={p1} onChange={e=>setP1(e.target.value)} placeholder="Player 1 (Red)" style={inputStyle()}/>
        <input value={p2} onChange={e=>setP2(e.target.value)} placeholder="Player 2 (Gold)" style={inputStyle()}/>
      </div>
      <button onClick={()=>onStart("local",{p1Name:p1||"Player 1",p2Name:p2||"Player 2"})} style={btnStyle('#1B6B3A', colors.cream)}>Play Local</button>
    </div>

    {/* Online */}
    <div style={{width:'100%',background:'rgba(26,58,92,0.18)',border:'1px solid rgba(26,58,92,0.5)',borderRadius:12,padding:'18px 18px 14px'}}>
      <div style={{fontWeight:800,fontSize:'0.85rem',letterSpacing:2,textTransform:'uppercase',color:'#5B9BD5',marginBottom:12}}>🌐 Online Multiplayer</div>

      {waitingForOpponent ? (
        <div style={{textAlign:'center',padding:'10px 0'}}>
          <div style={{fontSize:'1.8rem',marginBottom:8}}>⏳</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.1rem',color:colors.gold,marginBottom:6}}>Room Code</div>
          <div style={{fontFamily:'monospace',fontSize:'2rem',letterSpacing:8,color:colors.cream,background:'rgba(255,255,255,0.06)',borderRadius:8,padding:'10px 0',marginBottom:10}}>{createdRoom}</div>
          <div style={{fontSize:'0.72rem',color:'rgba(253,243,220,0.45)',marginBottom:14}}>Share this code with your opponent. Waiting for them to join…</div>
          <button onClick={()=>{clearInterval(pollRef.current);setWaitingForOpponent(false);setCreatedRoom(null);}} style={{background:'transparent',border:'1px solid rgba(253,243,220,0.2)',borderRadius:5,color:'rgba(253,243,220,0.4)',fontFamily:"'DM Sans',sans-serif",fontSize:'0.7rem',padding:'7px 16px',cursor:'pointer',letterSpacing:'1px',textTransform:'uppercase'}}>Cancel</button>
        </div>
      ) : (
        <>
          <button onClick={handleCreateRoom} disabled={creating} style={{...btnStyle('#1A3A5C', colors.cream, true), marginBottom:10, border:'1px solid rgba(91,155,213,0.4)'}}>
            {creating ? "Creating…" : "Create Room"}
          </button>
          <div style={{display:'flex',gap:8}}>
            <input value={roomInput} onChange={e=>setRoomInput(e.target.value.toUpperCase())} placeholder="Enter room code" maxLength={6} style={{...inputStyle(), flex:1, fontFamily:'monospace', letterSpacing:3, textTransform:'uppercase'}}/>
            <button onClick={handleJoinRoom} disabled={joining} style={{...btnStyle('#1A3A5C', colors.cream, true), border:'1px solid rgba(91,155,213,0.4)', minWidth:80, flex:'none'}}>
              {joining ? "…" : "Join"}
            </button>
          </div>
        </>
      )}
      {error && <div style={{marginTop:10,fontSize:'0.72rem',color:'#FF6B6B',textAlign:'center'}}>{error}</div>}
    </div>
  </div>
  <div style={{width:'100%',height:10,opacity:0.65,background:`repeating-linear-gradient(90deg,${colors.green} 0 16px,${colors.gold} 16px 32px,${colors.red} 32px 48px,${colors.yellow} 48px 64px,${colors.blue} 64px 80px)`}}/>
</div>
```

);
}

function btnStyle(bg, col, outline=false) {
return {width:‘100%’,padding:‘12px’,border:‘none’,borderRadius:7,fontFamily:”‘DM Sans’,sans-serif”,fontSize:‘0.8rem’,fontWeight:800,letterSpacing:‘2px’,textTransform:‘uppercase’,cursor:‘pointer’,background:bg,color:col};
}
function inputStyle() {
return {flex:1,padding:‘9px 10px’,borderRadius:5,border:‘1px solid rgba(253,243,220,0.15)’,background:‘rgba(255,255,255,0.05)’,color:colors.cream,fontFamily:”‘DM Sans’,sans-serif”,fontSize:‘0.8rem’,boxSizing:‘border-box’,outline:‘none’,width:‘100%’};
}

// ─────────────────────────────────────────────────────────────
//  GAME  (AI + Local + Online)
// ─────────────────────────────────────────────────────────────
function Game({ mode, diff=“med”, p1Name=“Player 1”, p2Name=“Player 2”, roomId=null, myColor=null, onMenu }) {
const [board,setBoard]=useState(makeBoard);
const [turn,setTurn]=useState(RED);
const [sel,setSel]=useState(null);
const [landingSquares,setLandingSquares]=useState([]);
const [redCap,setRedCap]=useState(0);
const [goldCap,setGoldCap]=useState(0);
const [winner,setWinner]=useState(null);
const [winMsg,setWinMsg]=useState(””);
const [status,setStatus]=useState(””);
const [aiThink,setAiThink]=useState(false);
const [onlineStatus,setOnlineStatus]=useState(mode===“online”?“Connecting…”:””);
const channelRef=useRef(null);

const boardSize=Math.min(520,typeof window!==‘undefined’?window.innerWidth*0.94:520);
const cellSize=boardSize/10;

const redLabel  = mode===“ai” ? “You”  : mode===“online” ? (myColor===RED  ? “You” : “Opponent”) : p1Name;
const goldLabel = mode===“ai” ? “AI”   : mode===“online” ? (myColor===GOLD ? “You” : “Opponent”) : p2Name;

// ── Win check ─────────────────────────────────────────────
const checkWin = useCallback((b, rc, gc) => {
const rp=countPieces(RED,b), gp=countPieces(GOLD,b);
const rm=allMovesAI(RED,b).length, gm=allMovesAI(GOLD,b).length;
if(gp<=1||gm===0){
const msg=gp<=1?“AI/Opponent had 1 piece — Ghana rule! 🇬🇭”:“Opponent has no moves!”;
return {winner:RED, msg};
}
if(rp<=1||rm===0){
const msg=rp<=1?“You had 1 piece — Ghana rule! 🇬🇭”:“You have no moves!”;
return {winner:GOLD, msg};
}
return null;
},[]);

// ── Online: subscribe to room ─────────────────────────────
useEffect(()=>{
if(mode!==“online”||!roomId) return;
// Load initial state
supabase.from(“games”).select(”*”).eq(“id”,roomId).single().then(({data})=>{
if(!data) return;
setBoard(data.board);
setTurn(data.turn);
setRedCap(data.red_cap);
setGoldCap(data.gold_cap);
if(data.winner){ setWinner(data.winner); setWinMsg(data.win_msg||””); }
setOnlineStatus(data.turn===“waiting”?“Waiting for opponent…”:“Game on!”);
});

```
// Realtime subscription
const ch = supabase.channel("room:"+roomId)
  .on("postgres_changes",{event:"UPDATE",schema:"public",table:"games",filter:`id=eq.${roomId}`},(payload)=>{
    const d = payload.new;
    setBoard(d.board);
    setTurn(d.turn);
    setRedCap(d.red_cap);
    setGoldCap(d.gold_cap);
    if(d.winner){ setWinner(d.winner); setWinMsg(d.win_msg||""); }
    if(d.turn==="waiting") setOnlineStatus("Waiting for opponent…");
    else setOnlineStatus(d.turn===myColor?"Your turn":"Opponent's turn");
  })
  .subscribe();
channelRef.current = ch;
return () => { supabase.removeChannel(ch); };
```

},[mode, roomId, myColor]);

// ── Status string ─────────────────────────────────────────
useEffect(()=>{
if(mode===“online”) return; // handled above
if(winner) return;
if(mode===“ai”){
if(turn===GOLD){ setStatus(“AI is thinking…”); }
else { setStatus(hasAnyCaptureForCol(RED,board)?“Your turn — must capture! 🔥”:“Your turn — select a piece”); }
} else {
const name = turn===RED ? p1Name : p2Name;
setStatus(hasAnyCaptureForCol(turn,board)?`${name}'s turn — must capture! 🔥`:`${name}'s turn`);
}
},[turn, board, mode, winner, p1Name, p2Name]);

// ── AI logic ──────────────────────────────────────────────
useEffect(()=>{
if(mode!==“ai”||turn!==GOLD||winner||!aiThink) return;
const delay=diff===‘hard’?700:diff===‘med’?450:250;
const t=setTimeout(()=>{
const moves=allMovesAI(GOLD,board);
if(!moves.length){setAiThink(false);return;}
let best=null, bs=-Infinity;
if(diff===‘easy’){
const caps=moves.filter(m=>m.caps.length>0);
best=caps.length?caps[Math.floor(Math.random()*caps.length)]:moves[Math.floor(Math.random()*moves.length)];
} else {
for(const m of moves){
const s=minimax(applyMoveObj(m.fr,m.fc,m.r,m.c,m.caps,cloneBoard(board)),DIFF_DEPTH[diff]-1,-Infinity,Infinity,false);
if(s>bs){bs=s;best=m;}
}
}
setAiThink(false);
if(!best) return;
const nb=applyMoveObj(best.fr,best.fc,best.r,best.c,best.caps,cloneBoard(board));
const newRedCap=redCap+best.caps.length;
const w=checkWin(nb,newRedCap,goldCap);
setBoard(nb); setRedCap(newRedCap); setTurn(RED);
if(w){setWinner(w.winner);setWinMsg(w.msg);}
},delay);
return ()=>clearTimeout(t);
},[mode,turn,aiThink,board,diff,winner,redCap,goldCap,checkWin]);

// ── Push move to Supabase ─────────────────────────────────
async function pushOnlineMove(nb, nextTurn, newRedCap, newGoldCap, winResult) {
await supabase.from(“games”).update({
board: nb,
turn: winResult ? “done” : nextTurn,
red_cap: newRedCap,
gold_cap: newGoldCap,
winner: winResult?.winner || null,
win_msg: winResult?.msg || null,
}).eq(“id”, roomId);
}

// ── Build landings ────────────────────────────────────────
function buildLandings(r, c, b) {
const mustCap = hasAnyCaptureForCol(b[r][c].col, b);
if (mustCap) return singleCaptures(r,c,b).map(cap=>({r:cap.landR,c:cap.landC,caps:[{r:cap.capR,c:cap.capC}]}));
return simpleMoves(r,c,b).map(m=>({r:m.r,c:m.c,caps:[]}));
}

// ── Click handler ─────────────────────────────────────────
function handleCellClick(r, c) {
if(winner||aiThink) return;
if(mode===“ai”&&turn===GOLD) return;
if(mode===“online”){
if(turn!==myColor) return; // not your turn
if(turn===“waiting”||turn===“done”) return;
}

```
const piece=board[r][c];

if(piece?.col===turn){
  if(sel?.r===r&&sel?.c===c){setSel(null);setLandingSquares([]);return;}
  const mustCap=hasAnyCaptureForCol(turn,board);
  const lands=buildLandings(r,c,board);
  if(mustCap&&!lands.length) return;
  setSel({r,c}); setLandingSquares(lands);
  return;
}

if(!sel) return;
const landing=landingSquares.find(l=>l.r===r&&l.c===c);
if(!landing){setSel(null);setLandingSquares([]);return;}

const nb=cloneBoard(board);
const p={...nb[sel.r][sel.c]};
nb[sel.r][sel.c]=null;
landing.caps.forEach(cap=>nb[cap.r][cap.c]=null);
nb[r][c]=p;
if(p.col===RED&&r===0) p.king=true;
if(p.col===GOLD&&r===9) p.king=true;

const newGoldCap = p.col===RED ? goldCap+landing.caps.length : goldCap;
const newRedCap  = p.col===GOLD ? redCap+landing.caps.length : redCap;

// Chain capture?
if(landing.caps.length>0){
  const moreCaps=singleCaptures(r,c,nb);
  if(moreCaps.length){
    setBoard(nb); setRedCap(newRedCap); setGoldCap(newGoldCap);
    setSel({r,c});
    setLandingSquares(moreCaps.map(cap=>({r:cap.landR,c:cap.landC,caps:[{r:cap.capR,c:cap.capC}]})));
    setStatus("Keep capturing! 🔥");
    return;
  }
}

const nextTurn = turn===RED ? GOLD : RED;
const winResult = checkWin(nb, newRedCap, newGoldCap);

setSel(null); setLandingSquares([]);
setBoard(nb); setRedCap(newRedCap); setGoldCap(newGoldCap);

if(winResult){ setWinner(winResult.winner); setWinMsg(winResult.msg); }
else {
  setTurn(nextTurn);
  if(mode==="ai"&&nextTurn===GOLD) setAiThink(true);
}

if(mode==="online") pushOnlineMove(nb, nextTurn, newRedCap, newGoldCap, winResult);
```

}

function resetGame(){
const nb=makeBoard();
setBoard(nb); setTurn(RED); setSel(null); setLandingSquares([]);
setRedCap(0); setGoldCap(0); setWinner(null); setWinMsg(””); setAiThink(false);
if(mode===“online”){
supabase.from(“games”).update({board:nb,turn:RED,red_cap:0,gold_cap:0,winner:null,win_msg:null}).eq(“id”,roomId);
}
}

const capturedSet=new Set(landingSquares.flatMap(l=>l.caps.map(c=>`${c.r},${c.c}`)));
const myTurn = mode===“online” ? turn===myColor : true;

return (
<div style={{background:colors.black,minHeight:‘100vh’,display:‘flex’,flexDirection:‘column’,alignItems:‘center’,fontFamily:”‘DM Sans’,sans-serif”,color:colors.cream,userSelect:‘none’}}>
<div style={{width:‘100%’,height:12,flexShrink:0,background:`repeating-linear-gradient(90deg,${colors.red} 0 16px,${colors.gold} 16px 32px,${colors.green} 32px 48px,${colors.yellow} 48px 64px,${colors.blue} 64px 80px,${colors.brown} 80px 96px)`,boxShadow:`0 3px 18px rgba(245,166,35,0.45)`}}/>

```
  <div style={{textAlign:'center',padding:'10px 24px 2px'}}>
    <div style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(1.4rem,5vw,2.2rem)',fontWeight:900}}>
      <span style={{color:colors.gold}}>Ghana</span> Dame
      <span style={{fontSize:'0.58rem',letterSpacing:3,textTransform:'uppercase',color:'rgba(253,243,220,0.25)',marginLeft:10}}>
        {mode==="ai"?"vs AI":mode==="local"?"Local":"🌐 Online"}
      </span>
    </div>
    {mode==="online"&&roomId&&(
      <div style={{fontSize:'0.65rem',letterSpacing:3,color:'rgba(253,243,220,0.3)',marginTop:2}}>
        Room: <span style={{fontFamily:'monospace',color:colors.gold,letterSpacing:4}}>{roomId}</span>
        &nbsp;·&nbsp;You are <span style={{color:myColor===RED?'#F06050':'#FFD060',fontWeight:700}}>{myColor}</span>
      </div>
    )}
  </div>

  {mode==="ai"&&(
    <div style={{display:'flex',gap:8,margin:'6px auto 2px'}}>
      {[['easy','Easy','#1B6B3A'],['med','Medium','#F5A623'],['hard','Hard','#B83227']].map(([d,lbl,ac])=>(
        <button key={d} onClick={()=>{}} style={{padding:'5px 14px',borderRadius:4,fontFamily:"'DM Sans',sans-serif",fontSize:'0.65rem',fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',cursor:'default',border:`1.5px solid ${diff===d?ac:'rgba(253,243,220,0.1)'}`,background:diff===d?ac:'transparent',color:diff===d?(d==='med'?colors.black:colors.cream):'rgba(253,243,220,0.3)'}}>{lbl}</button>
      ))}
    </div>
  )}

  {/* Score bar */}
  <div style={{display:'flex',width:Math.min(boardSize,580),margin:'4px auto',borderRadius:8,overflow:'hidden',border:'1px solid rgba(245,166,35,0.2)'}}>
    {[{col:RED,label:redLabel,cap:goldCap,side:'left'},{col:GOLD,label:goldLabel,cap:redCap,side:'right'}].map(({col,label,cap,side})=>(
      <div key={col} style={{flex:1,padding:'8px 14px',display:'flex',alignItems:'center',gap:10,flexDirection:side==='right'?'row-reverse':'row',background:col===RED?'rgba(184,50,39,0.22)':'rgba(245,166,35,0.12)',filter:turn===col&&!winner?'brightness(1.5)':'none',transition:'filter 0.3s'}}>
        <div style={{width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',background:col===RED?'radial-gradient(circle at 35% 35%,#E05040,#8A2318)':'radial-gradient(circle at 35% 30%,#FFD060,#C8841A)',border:col===RED?'2px solid rgba(255,120,100,0.35)':'2px solid rgba(255,220,100,0.35)',fontSize:'0.8rem'}}>{col===RED?'☀':'★'}</div>
        <div style={{flex:1,textAlign:side==='right'?'right':'left'}}>
          <div style={{fontWeight:700,fontSize:'0.82rem'}}>{label}</div>
          <div style={{fontSize:'0.56rem',letterSpacing:'1.5px',textTransform:'uppercase',color:'rgba(253,243,220,0.38)'}}>{col}{turn===col&&!winner?" · turn":""}</div>
        </div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.6rem',fontWeight:900,color:colors.gold}}>{cap}</div>
      </div>
    ))}
  </div>

  {/* Status */}
  <div style={{width:Math.min(boardSize,580),margin:'2px auto 5px',textAlign:'center',fontSize:'0.7rem',fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:colors.gold,minHeight:16}}>
    {winner
      ? `🏆 ${winner===RED?redLabel:goldLabel} Wins! Ayekoo!`
      : mode==="online" ? onlineStatus : status}
  </div>

  {/* Board */}
  <div style={{position:'relative',width:boardSize,height:boardSize,borderRadius:4,overflow:'hidden',boxShadow:`0 0 0 3px ${colors.gold},0 0 0 7px ${colors.brown},0 24px 60px rgba(0,0,0,0.8)`}}>
    {Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=>{
      const play=isPlay(r,c);
      const isSel=sel?.r===r&&sel?.c===c;
      const isLand=landingSquares.some(l=>l.r===r&&l.c===c);
      const isCap=capturedSet.has(`${r},${c}`);
      const piece=board[r][c];
      let bg=play?'#2A1608':'#C8870A';
      if(play&&isSel) bg='rgba(245,166,35,0.28)';
      return (
        <div key={`${r}-${c}`} onClick={()=>play&&handleCellClick(r,c)}
          style={{position:'absolute',left:c*cellSize,top:r*cellSize,width:cellSize,height:cellSize,background:bg,
            cursor:play?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
            boxShadow:isSel?'inset 0 0 0 2px rgba(245,166,35,0.7)':isLand?'inset 0 0 0 2.5px rgba(245,166,35,0.55)':'none',
            backgroundImage:!play?`repeating-linear-gradient(45deg,rgba(255,255,255,0.03) 0 2px,transparent 2px 10px)`:'none'}}>
          {play&&isLand&&!piece&&(<div style={{width:'34%',height:'34%',borderRadius:'50%',background:'rgba(245,166,35,0.35)',border:'1.5px solid rgba(245,166,35,0.8)',animation:'pulse 0.9s ease-in-out infinite alternate'}}/>)}
          {piece&&(
            <div style={{width:'80%',height:'80%',borderRadius:'50%',zIndex:2,position:'relative',display:'flex',alignItems:'center',justifyContent:'center',
              background:piece.col===RED?'radial-gradient(circle at 35% 30%,#F06050,#8A1A10)':'radial-gradient(circle at 35% 30%,#FFE070,#B87010)',
              border:isCap?'2.5px solid rgba(255,60,40,0.9)':piece.col===RED?'2px solid rgba(255,130,110,0.45)':'2px solid rgba(255,230,130,0.45)',
              boxShadow:isSel?`0 8px 22px rgba(0,0,0,0.7),0 0 0 2.5px ${colors.gold},0 0 14px rgba(245,166,35,0.5)`:isCap?'0 0 14px rgba(255,60,40,0.7)':'0 3px 8px rgba(0,0,0,0.6)',
              transform:isSel?'scale(1.14) translateY(-3px)':isCap?'scale(1.06)':'scale(1)',
              animation:isCap?'threatPulse 0.75s ease-in-out infinite alternate':'none',
              transition:'all 0.15s',cursor:'pointer',fontSize:cellSize*0.28}}>
              {piece.king&&<span style={{position:'absolute',color:'rgba(255,255,255,0.9)',textShadow:'0 1px 3px rgba(0,0,0,0.8)',fontSize:'0.5em'}}>★</span>}
            </div>
          )}
        </div>
      );
    }))}
    {(aiThink||(mode==="online"&&turn!==myColor&&!winner))&&(
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.18)',zIndex:10,pointerEvents:'none'}}>
        <div style={{background:'rgba(0,0,0,0.8)',color:colors.gold,fontSize:'0.72rem',fontWeight:700,letterSpacing:2,textTransform:'uppercase',padding:'9px 20px',borderRadius:30,border:'1px solid rgba(245,166,35,0.3)'}}>
          {aiThink?"AI thinking…":"Opponent's turn…"}
        </div>
      </div>
    )}
  </div>

  <div style={{display:'flex',gap:8,margin:'10px auto 4px',width:Math.min(boardSize,560),justifyContent:'center'}}>
    <button onClick={resetGame} style={{flex:1,padding:'10px',border:'none',borderRadius:5,fontFamily:"'DM Sans',sans-serif",fontSize:'0.72rem',fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',cursor:'pointer',background:colors.gold,color:colors.black}}>New Game</button>
    <button onClick={onMenu} style={{padding:'10px 18px',border:'1px solid rgba(253,243,220,0.15)',borderRadius:5,fontFamily:"'DM Sans',sans-serif",fontSize:'0.72rem',fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',cursor:'pointer',background:'transparent',color:'rgba(253,243,220,0.4)'}}>Menu</button>
  </div>

  {winner&&(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.87)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(7px)'}}>
      <div style={{background:colors.dark,border:'1px solid rgba(245,166,35,0.3)',borderRadius:12,padding:'36px 32px',textAlign:'center',maxWidth:310,width:'90%'}}>
        <div style={{fontSize:'3rem',marginBottom:12}}>🏆</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.8rem',color:colors.gold,marginBottom:8}}>{winner===RED?redLabel:goldLabel} Wins!</div>
        <div style={{fontSize:'0.8rem',color:'rgba(253,243,220,0.5)',marginBottom:20,lineHeight:1.6}}>{winMsg}</div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={resetGame} style={{flex:1,padding:'11px',border:'none',borderRadius:5,fontFamily:"'DM Sans',sans-serif",fontSize:'0.75rem',fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',cursor:'pointer',background:colors.gold,color:colors.black}}>Play Again</button>
          <button onClick={onMenu} style={{flex:1,padding:'11px',border:'1px solid rgba(253,243,220,0.2)',borderRadius:5,fontFamily:"'DM Sans',sans-serif",fontSize:'0.75rem',fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',cursor:'pointer',background:'transparent',color:colors.cream}}>Menu</button>
        </div>
      </div>
    </div>
  )}

  <div style={{width:'100%',height:10,opacity:0.65,marginTop:'auto',flexShrink:0,background:`repeating-linear-gradient(90deg,${colors.green} 0 16px,${colors.gold} 16px 32px,${colors.red} 32px 48px,${colors.yellow} 48px 64px,${colors.blue} 64px 80px)`}}/>
  <style>{`@keyframes pulse{from{transform:scale(0.8);opacity:0.5}to{transform:scale(1.1);opacity:1}}@keyframes threatPulse{from{box-shadow:0 0 6px rgba(255,60,40,0.4)}to{box-shadow:0 0 18px rgba(255,60,40,0.85)}}`}</style>
</div>
```

);
}
