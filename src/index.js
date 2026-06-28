// index.js — AWO Hunt Tracker bot. Slash commands + scheduled announcements.
import { Client, GatewayIntentBits, Events } from "discord.js";
import { fetchState } from "./data.js";
import { handleInteraction } from "./commands.js";
import { decide } from "./announce.js";
import { loadStore, saveStore } from "./state.js";
import "dotenv/config";

const { DISCORD_TOKEN, CHANNEL_ID } = process.env;
const POLL_MINUTES = parseInt(process.env.POLL_MINUTES || "15", 10);

if(!DISCORD_TOKEN){ console.error("Missing DISCORD_TOKEN."); process.exit(1); }

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, c => {
	console.log(`Online as ${c.user.tag}. Announcement channel: ${CHANNEL_ID || "(none — set CHANNEL_ID)"}`);
	if(CHANNEL_ID){
		runAnnouncements();                                  // once on boot
		setInterval(runAnnouncements, POLL_MINUTES * 60000); // then on a schedule
	}
});

client.on(Events.InteractionCreate, handleInteraction);

async function runAnnouncements(){
	try {
		const S = await fetchState();
		const store = loadStore();
		const { posts, store: next } = decide(S, store);
		if(posts.length){
			const channel = await client.channels.fetch(CHANNEL_ID);
			for(const embed of posts){
				await channel.send({ embeds: [embed] });
			}
			console.log(`Posted ${posts.length} announcement(s).`);
		}
		saveStore(next);
	} catch(e){
		console.error("announcement tick failed:", e.message);
	}
}

process.on("unhandledRejection", e => console.error("unhandledRejection:", e));
client.login(DISCORD_TOKEN);
