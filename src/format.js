// format.js — build Discord embeds from a computed state.
import { EmbedBuilder } from "discord.js";
import { fmt } from "./data.js";

const GOLD = 0xCA883C;
const GREEN = 0x4E9A6B;
const AMBER = 0xCA883C;
const RED = 0xB4543C;

const medal = r => r===1 ? "🥇" : r===2 ? "🥈" : r===3 ? "🥉" : "`#"+r+"`";
const dot = s => s==="hunt" ? "🟢" : s==="lag" ? "🟡" : "⚪";
const pct = n => n.toFixed(1)+"%";

function footer(S){
	const u = S.summary.updated ? S.summary.updated.toISOString().replace("T"," ").slice(0,16)+" UTC" : "live";
	return { text: "AWO Hunt Tracker · sheet updated " + u };
}

export function leaderboardEmbed(S, count=10){
	const rows = S.players.slice(0, count).map(p =>
		`${medal(p.rank)} ${dot(p.status)} **${esc(p.name)}** — ${fmt(p.value)} pts · ${fmt(p.count)} chests`
	).join("\n");
	return new EmbedBuilder()
		.setColor(GOLD)
		.setTitle("🐺 The Pack — Top " + count)
		.setDescription(rows || "No data yet.")
		.addFields({
			name: "Clan",
			value: `${fmt(S.clanValue)} pts · ${pct(S.goalPct)} of ${fmt(S.summary.goal)} · ${S.onQuota} on pace · ${S.idle} idle`
		})
		.setFooter(footer(S));
}

export function playerEmbed(S, query){
	const q = query.trim().toLowerCase();
	let p = S.players.find(x => x.name.toLowerCase() === q)
		|| S.players.find(x => x.name.toLowerCase().includes(q));
	if(!p){
		return new EmbedBuilder().setColor(RED).setTitle("Hunter not found")
			.setDescription(`No hunter matching **${esc(query)}**. Try \`/leaderboard\` to see names.`);
	}
	const top = p.bySource.slice(0,5).map(s => `• ${esc(s.src)} — ${fmt(s.pts)} pts (${s.cnt}×${fmt(s.w)})`).join("\n") || "No scoring chests yet.";
	const statusLabel = p.status==="hunt" ? "On pace" : p.status==="lag" ? "Behind pace" : "Idle";
	return new EmbedBuilder()
		.setColor(p.status==="hunt"?GREEN:p.status==="lag"?AMBER:0x6B5B47)
		.setTitle(`${dot(p.status)} ${esc(p.name)}`)
		.setDescription(`Rank **#${p.rank}** of ${S.players.length} · ${statusLabel}`)
		.addFields(
			{ name: "Points",     value: fmt(p.value), inline: true },
			{ name: "Chests",     value: fmt(p.count), inline: true },
			{ name: "Pts / chest",value: p.eff?p.eff.toFixed(1):"—", inline: true },
			{ name: "Pace / day", value: fmt(p.pace) + ` (quota ${fmt(S.summary.perDay)})`, inline: false },
			{ name: "Top sources", value: top, inline: false }
		)
		.setFooter(footer(S));
}

export function goalEmbed(S){
	const ahead = S.projected >= S.summary.goal;
	const bar = progressBar(S.goalPct);
	const verdict = ahead
		? `**Ahead of pace** — projected to finish near **${fmt(S.projected)}** (${pct(Math.min(S.projected/S.summary.goal*100,999))} of goal).`
		: `**Behind pace** — projected **${fmt(S.projected)}** of ${fmt(S.summary.goal)} at the current rate.`;
	return new EmbedBuilder()
		.setColor(ahead?GREEN:AMBER)
		.setTitle("🎯 March to the Goal")
		.setDescription(`${bar}  **${pct(S.goalPct)}**\n\n${fmt(S.clanValue)} / ${fmt(S.summary.goal)} pts · ${S.daysLeft.toFixed(1)} days left\n\n${verdict}`)
		.addFields(
			{ name: "Hunters scoring", value: `${S.active} / ${S.players.length}`, inline: true },
			{ name: "On pace", value: String(S.onQuota), inline: true },
			{ name: "Idle", value: String(S.idle), inline: true }
		)
		.setFooter(footer(S));
}

export function chestsEmbed(S, count=8){
	const rows = S.sources.slice(0, count).map((d,i) =>
		`\`${String(i+1).padStart(2)}\` **${esc(d.src)}** — ${fmt(d.pts)} pts · ${fmt(d.opens)} opens`
	).join("\n");
	return new EmbedBuilder()
		.setColor(GOLD)
		.setTitle("📦 Top Scoring Sources")
		.setDescription(rows || "No data yet.")
		.setFooter(footer(S));
}

// ---- announcement embeds ----

export function moversEmbed(S, movers){
	const rows = movers.map(m =>
		`${dot(m.status)} **${esc(m.name)}** +${fmt(m.delta)} pts${m.chests?` · +${fmt(m.chests)} chests`:""}`
	).join("\n");
	return new EmbedBuilder()
		.setColor(GOLD)
		.setTitle("📈 New chests scored")
		.setDescription(rows)
		.addFields({ name: "Clan total", value: `${fmt(S.clanValue)} pts · ${pct(S.goalPct)} of goal` })
		.setFooter(footer(S));
}

export function milestoneEmbed(S, threshold){
	const flavor = {25:"A quarter of the way.",50:"Halfway to the goal.",75:"Three quarters there.",100:"Goal reached. 🏆"}[threshold] || "";
	return new EmbedBuilder()
		.setColor(threshold>=100?GREEN:GOLD)
		.setTitle(`🚩 ${threshold}% of the goal!`)
		.setDescription(`${flavor}\n\n**${fmt(S.clanValue)}** / ${fmt(S.summary.goal)} pts · ${S.daysLeft.toFixed(1)} days left`)
		.setFooter(footer(S));
}

export function recapEmbed(S, title, count=10){
	const rows = S.players.slice(0, count).map(p =>
		`${medal(p.rank)} **${esc(p.name)}** — ${fmt(p.value)} pts`
	).join("\n");
	return new EmbedBuilder()
		.setColor(GOLD)
		.setTitle(title)
		.setDescription(rows || "No data.")
		.addFields({
			name: "Clan",
			value: `${fmt(S.clanValue)} pts · ${pct(S.goalPct)} of goal · ${fmt(S.clanChests)} chests · ${S.onQuota} on pace`
		})
		.setFooter(footer(S));
}

function progressBar(p){
	const slots = 14, filled = Math.round(p/100*slots);
	return "▰".repeat(filled) + "▱".repeat(slots-filled);
}
function esc(s){ return String(s).replace(/([*_`~|>])/g, "\\$1"); }
