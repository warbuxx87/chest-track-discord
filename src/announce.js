// announce.js — decide what (if anything) to announce, given fresh state + store.
// Pure: returns { posts:[embed...], store:newStore }. Caller sends + persists.
import { moversEmbed, milestoneEmbed, recapEmbed } from "./format.js";

const MILESTONES = [25, 50, 75, 100];
const MOVERS_TOP = parseInt(process.env.MOVERS_TOP || "5", 10);
const MIN_MOVE = parseInt(process.env.MOVERS_MIN_POINTS || "1", 10); // ignore noise below this delta
const DAILY_UTC_HOUR = parseInt(process.env.DAILY_UTC_HOUR || "17", 10); // 17 UTC ≈ 12:00 Colombia

export function decide(S, prev){
	const posts = [];
	const store = { ...prev, lastValues: { ...prev.lastValues }, milestones: [...prev.milestones] };
	const cycleId = S.summary.start ? S.summary.start.toISOString() : "no-cycle";
	const updated = S.summary.updated ? S.summary.updated.toISOString() : null;

	// --- new cycle? reset everything, announce nothing this tick ---
	if(store.cycleId !== cycleId){
		store.cycleId = cycleId;
		store.milestones = [];
		store.cycleRecapPosted = false;
		store.lastValues = snapshot(S);
		store.lastUpdated = updated;
		// keep lastDaily so we don't double-post a daily right after reset
		return { posts, store };
	}

	// --- top movers: only when the sheet's Updated timestamp advanced ---
	if(updated && updated !== store.lastUpdated){
		const movers = S.players.map(p => {
			const before = store.lastValues[p.name] || { v: 0, c: 0 };
			return { name: p.name, status: p.status, delta: p.value - before.v,
				chests: p.count - before.c };
		}).filter(m => m.delta >= MIN_MOVE).sort((a,b) => b.delta - a.delta).slice(0, MOVERS_TOP);
		if(movers.length) posts.push(moversEmbed(S, movers));
		store.lastValues = snapshot(S);
		store.lastUpdated = updated;
	}

	// --- goal milestones ---
	for(const t of MILESTONES){
		if(S.goalPct >= t && !store.milestones.includes(t)){
			posts.push(milestoneEmbed(S, t));
			store.milestones.push(t);
		}
	}

	// --- cycle final recap (once, when the cycle window has closed) ---
	if(S.summary.end && S.now >= S.summary.end && !store.cycleRecapPosted){
		posts.push(recapEmbed(S, "🏁 Cycle Final Standings", 10));
		store.cycleRecapPosted = true;
	}

	// --- daily recap (once per UTC day, at/after DAILY_UTC_HOUR) ---
	const today = new Date().toISOString().slice(0, 10);
	if(new Date().getUTCHours() >= DAILY_UTC_HOUR && store.lastDaily !== today){
		posts.push(recapEmbed(S, "📊 Daily Standings — Top 10", 10));
		store.lastDaily = today;
	}

	return { posts, store };
}

function snapshot(S){
	const o = {};
	for(const p of S.players) o[p.name] = { v: p.value, c: p.count };
	return o;
}
