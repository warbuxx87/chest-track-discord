// commands.js — slash command definitions + dispatch.
import { SlashCommandBuilder } from "discord.js";
import { fetchState } from "./data.js";
import { leaderboardEmbed, playerEmbed, goalEmbed, chestsEmbed } from "./format.js";

export const commands = [
	new SlashCommandBuilder()
		.setName("leaderboard")
		.setDescription("Top hunters by points")
		.addIntegerOption(o => o.setName("count").setDescription("How many (1–25, default 10)").setMinValue(1).setMaxValue(25)),
	new SlashCommandBuilder()
		.setName("player")
		.setDescription("A hunter's stats")
		.addStringOption(o => o.setName("name").setDescription("Hunter name (partial ok)").setRequired(true)),
	new SlashCommandBuilder()
		.setName("goal")
		.setDescription("Clan progress toward the point goal"),
	new SlashCommandBuilder()
		.setName("chests")
		.setDescription("Top scoring chest/event sources")
		.addIntegerOption(o => o.setName("count").setDescription("How many (1–15, default 8)").setMinValue(1).setMaxValue(15))
].map(c => c.toJSON());

export async function handleInteraction(interaction){
	if(!interaction.isChatInputCommand()) return;
	await interaction.deferReply();
	let S;
	try {
		S = await fetchState();
	} catch(e){
		console.error("fetchState failed:", e.message);
		return interaction.editReply("⚠️ Couldn't reach the sheet right now. Try again in a moment.");
	}
	try {
		switch(interaction.commandName){
			case "leaderboard":
				return interaction.editReply({ embeds: [leaderboardEmbed(S, interaction.options.getInteger("count") || 10)] });
			case "player":
				return interaction.editReply({ embeds: [playerEmbed(S, interaction.options.getString("name"))] });
			case "goal":
				return interaction.editReply({ embeds: [goalEmbed(S)] });
			case "chests":
				return interaction.editReply({ embeds: [chestsEmbed(S, interaction.options.getInteger("count") || 8)] });
			default:
				return interaction.editReply("Unknown command.");
		}
	} catch(e){
		console.error("handler error:", e);
		return interaction.editReply("⚠️ Something went wrong building that.");
	}
}
