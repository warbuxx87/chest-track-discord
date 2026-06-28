// state.js — tiny JSON persistence for announcement state.
import { readFileSync, writeFileSync, existsSync } from "fs";

const FILE = process.env.STATE_FILE || new URL("../state.json", import.meta.url).pathname;

const DEFAULT = {
	cycleId: null,        // summary.start ISO — identifies the current cycle
	lastUpdated: null,    // summary.updated ISO last processed (movers gate)
	lastValues: {},       // { playerName: pointValue } at last sync
	milestones: [],       // thresholds already announced this cycle
	cycleRecapPosted: false,
	lastDaily: null       // YYYY-MM-DD of last daily recap (UTC)
};

export function loadStore(){
	try {
		if(existsSync(FILE)) return { ...DEFAULT, ...JSON.parse(readFileSync(FILE, "utf8")) };
	} catch(e){ console.error("state load failed, using default:", e.message); }
	return { ...DEFAULT };
}

export function saveStore(store){
	try { writeFileSync(FILE, JSON.stringify(store, null, 2)); }
	catch(e){ console.error("state save failed:", e.message); }
}
