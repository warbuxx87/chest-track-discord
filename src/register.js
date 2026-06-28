// register.js — register slash commands with Discord. Run once after deploy,
// and again whenever you change command definitions:  node src/register.js
import { REST, Routes } from "discord.js";
import { commands } from "./commands.js";
import "dotenv/config";

const { DISCORD_TOKEN, APP_ID, GUILD_ID } = process.env;
if(!DISCORD_TOKEN || !APP_ID){
	console.error("Missing DISCORD_TOKEN or APP_ID in env.");
	process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

try {
	if(GUILD_ID){
		// guild commands update instantly — best for a single-clan bot
		await rest.put(Routes.applicationGuildCommands(APP_ID, GUILD_ID), { body: commands });
		console.log(`Registered ${commands.length} guild commands to ${GUILD_ID}.`);
	} else {
		// global commands can take up to ~1h to propagate
		await rest.put(Routes.applicationCommands(APP_ID), { body: commands });
		console.log(`Registered ${commands.length} global commands.`);
	}
} catch(e){
	console.error("Registration failed:", e);
	process.exit(1);
}
