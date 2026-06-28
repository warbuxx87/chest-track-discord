// data.js — fetch the AWO Google Sheet and compute clan/hunter metrics.
// Parse + compute logic is ported verbatim from the dashboard so the numbers
// the bot announces always match awo-main-203.netlify.app.

const SHEET_ID = process.env.SHEET_ID || "15p_q4io0lD6Cffv4kLzNw0YbwqB3P3ZfRdQfAUD5Tvw";
const TABS = {
	summary: "[AWO] Alpha Wolves",
	matrix:  "ChestMatrix",
	points:  "Points"
};
const FALLBACK_PER_DAY = 4000;   // per-hunter daily quota
const FALLBACK_GOAL     = 100000; // clan point goal
const DAY = 86400000;

function gvizUrl(sheetName){
	return "https://docs.google.com/spreadsheets/d/" + SHEET_ID +
		"/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(sheetName);
}

async function fetchTab(sheetName){
	const r = await fetch(gvizUrl(sheetName));
	if(!r.ok) throw new Error("gviz " + sheetName + " HTTP " + r.status);
	return parseCsv(await r.text());
}

// RFC-4180-ish parser: handles quoted fields, commas, embedded quotes, CRLF
export function parseCsv(text){
	const rows=[]; let row=[], cell="", q=false;
	for(let i=0;i<text.length;i++){
		const c=text[i];
		if(q){
			if(c==='"'){ if(text[i+1]==='"'){cell+='"';i++;} else q=false; }
			else cell+=c;
		}else{
			if(c==='"') q=true;
			else if(c===','){ row.push(cell); cell=""; }
			else if(c==='\n'){ row.push(cell); rows.push(row); row=[]; cell=""; }
			else if(c==='\r'){ /* skip */ }
			else cell+=c;
		}
	}
	if(cell.length||row.length){ row.push(cell); rows.push(row); }
	return rows;
}

function num(v){
	if(v==null) return 0;
	const n=parseFloat(String(v).replace(/[\s\u00a0,]/g,""));
	return isNaN(n)?0:n;
}
function lastNonEmpty(row){
	for(let i=row.length-1;i>=0;i--){ const v=(row[i]||"").trim(); if(v!=="") return v; }
	return "";
}
function parseDate(s){
	if(!s) return null;
	const m=String(s).trim().match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
	if(!m) return null;
	return new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0),+(m[6]||0));
}

export function parseSummary(rows){
	let stop=rows.length;
	for(let i=0;i<rows.length;i++){
		if(rows[i].some(c=>(c||"").trim().toUpperCase()==="PLAYER")){ stop=i; break; }
	}
	const reStamp=/\d{4}-\d{1,2}-\d{1,2}[ T]\d{1,2}:\d{2}/;
	const stamps=[];
	for(let r=0;r<stop;r++){
		for(const c of rows[r]){
			if(c && reStamp.test(String(c).trim())){ stamps.push({r,v:String(c).trim()}); break; }
		}
	}
	const at=i=>stamps.length+i>=0?stamps[stamps.length+i]:null;
	const start=at(-3), end=at(-2), updated=at(-1);
	const afterRow=updated?updated.r:-1;
	const nums=[];
	for(let r=afterRow+1;r<stop;r++){
		const n=num(lastNonEmpty(rows[r]));
		if(n>0) nums.push(n);
	}
	return {
		start:   start?parseDate(start.v):null,
		end:     end?parseDate(end.v):null,
		updated: updated?parseDate(updated.v):null,
		perDay:  nums[0] || FALLBACK_PER_DAY,
		goal:    nums[1] || FALLBACK_GOAL
	};
}

export function parseMatrix(rows){
	if(!rows.length) return {sources:[],players:[]};
	const header=rows[0];
	const cols=[];
	for(let i=1;i<header.length;i++){
		const name=(header[i]||"").trim();
		if(name) cols.push({idx:i,name});
	}
	const players=[];
	for(let r=1;r<rows.length;r++){
		const row=rows[r];
		const name=(row[0]||"").trim();
		if(!name) continue;
		const counts={}; let total=0;
		for(const c of cols){ const v=num(row[c.idx]); counts[c.name]=v; total+=v; }
		players.push({name,counts,total});
	}
	return {sources:cols.map(c=>c.name),players};
}

export function parsePoints(rows){
	const m=new Map();
	for(const row of rows){
		const name=(row[0]||"").trim();
		if(!name||name.toUpperCase()==="TURNED ON SOURCE") continue;
		m.set(name,num(row[1]));
	}
	return m;
}

// compute() — pass now=Date for live; tests can inject a fixed clock.
export function compute(summary,matrix,points,now){
	now = now || new Date();
	const total = summary.start&&summary.end ? Math.max((summary.end-summary.start)/DAY,1) : 7;
	const elapsed = summary.start
		? Math.min(Math.max((now-summary.start)/DAY,0.01), total)
		: 1;
	const daysLeft = Math.max(total-elapsed,0);

	const players=matrix.players.map(p=>{
		let value=0, wastedOpens=0;
		const bySource=[];
		for(const src of matrix.sources){
			const cnt=p.counts[src]||0; if(!cnt) continue;
			const w=points.get(src)||0;
			const pts=cnt*w;
			if(pts>0) bySource.push({src,cnt,w,pts}); else wastedOpens+=cnt;
			value+=pts;
		}
		bySource.sort((a,b)=>b.pts-a.pts);
		const pace = value/elapsed;
		let status="idle";
		if(value>0) status = pace>=summary.perDay ? "hunt" : "lag";
		return {
			name:p.name, value, count:p.total, counts:p.counts,
			eff: p.total? value/p.total : 0,
			pace, status, bySource, wastedOpens
		};
	}).sort((a,b)=>b.value-a.value || b.count-a.count);
	players.forEach((p,i)=>p.rank=i+1);

	const dist={};
	for(const src of matrix.sources) dist[src]={src,opens:0,w:points.get(src)||0,pts:0};
	for(const p of matrix.players)
		for(const src of matrix.sources){
			const c=p.counts[src]||0; dist[src].opens+=c; dist[src].pts+=c*(points.get(src)||0);
		}
	const sources=Object.values(dist).filter(d=>d.opens>0).sort((a,b)=>b.pts-a.pts);

	const clanValue=players.reduce((s,p)=>s+p.value,0);
	const clanChests=players.reduce((s,p)=>s+p.count,0);
	const active=players.filter(p=>p.value>0).length;
	const onQuota=players.filter(p=>p.status==="hunt").length;
	const idle=players.filter(p=>p.value===0).length;

	return {
		summary, now, total, elapsed, daysLeft,
		players, sources,
		clanValue, clanChests, active, onQuota, idle,
		goalPct: Math.min(clanValue/summary.goal*100,100),
		projected: clanValue/elapsed*total
	};
}

// fetchState() — pull all tabs live and compute. Used by commands + scheduler.
export async function fetchState(){
	const [sRows,mRows,pRows] = await Promise.all([
		fetchTab(TABS.summary), fetchTab(TABS.matrix), fetchTab(TABS.points)
	]);
	return compute(parseSummary(sRows), parseMatrix(mRows), parsePoints(pRows));
}

export const fmt = n => Math.round(n).toLocaleString("en-US");
