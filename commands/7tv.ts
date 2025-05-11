import type { ChatUserstate } from "tmi.js";
import fetch from "node-fetch";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

// Open or create the database
const dbPromise = open({
  filename: "db/7tvConfig.db",
  driver: sqlite3.Database,
});

async function setupDatabase() {
  const db = await dbPromise;
  // Create the table if it doesn't exist
  await db.run(`
    CREATE TABLE IF NOT EXISTS EmoteConfig (
      channel TEXT PRIMARY KEY,
      emoteSetId TEXT
    )
  `);
}

setupDatabase(); // Initialize database

const maxRandomEmotes = 5;

export const commandName = {
  name: "7tv",
  handler: async (
    channel: string,
    userstate: ChatUserstate,
    args: string[],
    client: any
  ) => {
    let reply = "t ";
    const db = await dbPromise;

    try {
      const subCommand = args[0]?.toLowerCase();

      if (subCommand === "add") {
        const input = args[1];
        if (!input) {
          const reply = "Du musst eine Emote-Set-ID oder URL angeben, um sie hinzuzufügen! shyy";
          await client.say(channel, reply);
          console.log(`* replied with "${reply}"`);
          return;
        }

        // Handle input as URL or plain ID
        const emoteSetId = input.startsWith("https://7tv.app/emote-sets/") ?
          input.split("/").pop() :
          input;

        if (!emoteSetId) {
          const reply = "Ungültige URL oder Emote-Set-ID!";
          await client.say(channel, reply);
          console.log(`* replied with "${reply}"`);
          return;
        }

        // Add or update the emote set ID for the channel
        await db.run(
          `INSERT INTO EmoteConfig (channel, emoteSetId) VALUES (?, ?)
           ON CONFLICT(channel) DO UPDATE SET emoteSetId = ?`,
          [channel, emoteSetId, emoteSetId]
        );

        const reply = `Emote-Set-ID "${emoteSetId}" erfolgreich hinzugefügt! JAAA`;
        await client.say(channel, reply);
        console.log(`* replied with "${reply}"`);
      } else if (subCommand === "remove") {
        const result = await db.run(`DELETE FROM EmoteConfig WHERE channel = ?`, [channel]);

        const reply = result.changes ?
          `Emote-Set-Config wurde erfolgreich aus diesem Channel entfernt shyy` :
          `Hier wurde nichts eingerichtet - Du kannst das mit "+7tv add *emote-set-url*" machen shyy`;
        await client.say(channel, reply);
        console.log(`* replied with "${reply}"`);

      } else if (subCommand === "random") {
        const numEmotes = Math.min(parseInt(args[1]) || 1, maxRandomEmotes);   // Default to 1 if no number is specified, but cap at maxRandomEmotes
        const row = await db.get(
          `SELECT emoteSetId FROM EmoteConfig WHERE channel = ?`,
          [channel]
        );
      
        if (!row) {
          const reply = `Kein Emote-Set für diesen Channel eingerichtet! Benutze "!7tv add [ID/URL]" um eines zu setzen.`;
          await client.say(channel, reply);
          console.log(`* replied with 1 "${reply}"`);
          return;
        }
      
        const emoteSetId = row.emoteSetId;
        const response = await fetch(`https://7tv.io/v3/emote-sets/${emoteSetId}`);
        const data = await response.json();
      
        if (data.emotes && data.emotes.length > 0) {
          // Get 'numEmotes' random emotes
          const randomEmotes = [];
          const emotesList = data.emotes;
      
          // Shuffle emotesList for true randomness
          for (let i = emotesList.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [emotesList[i], emotesList[j]] = [emotesList[j], emotesList[i]];  // Swap
          }
      
          // Pick the requested number of random emotes (capped at 10)
          for (let i = 0; i < numEmotes && i < emotesList.length; i++) {
            randomEmotes.push(emotesList[i].name);
          }
      
          const reply = randomEmotes.join(" ");
          await client.say(channel, reply);
          console.log(`* replied with 2 "${reply}"`);
        } else {
          const reply = `Keine Emotes im Set mit der ID "${emoteSetId}" gefunden!`;
          await client.say(channel, reply);
          console.log(`* replied with 3 "${reply}"`);
        }
      
      } else {
        const reply =
          "Verwendung: !7tv add [ID oder URL] | +7tv random [Anzahl]";
        await client.say(channel, reply);
        console.log(`* replied with 4 "${reply}"`);
      }

    } catch (error) {
      console.error("Error handling command:", error);
      const reply = "An error occurred. Please try again later!";
      await client.say(channel, reply);
      console.log(`* replied with 5 "${reply}"`);
    }
  },
};

console.log("7tv.ts is loading...");
