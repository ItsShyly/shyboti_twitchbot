import { ChatUserstate } from 'tmi.js';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite'; // Import Database type
import { aiResponse } from "../lib/openAI/aiResponse";
import sixtySixContent from "../lib/openAI/prompts/66Content";

// Initialize the database
async function initializeDatabase(): Promise<Database> {
  const db = await open({
    filename: './db/66Cooldown.db',
    driver: sqlite3.Database,
  });

  // Create table for cooldowns if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS cooldowns (
      channel TEXT,
      username TEXT,
      timestamp INTEGER,
      PRIMARY KEY (channel, username)
    )
  `);

  return db;
}

// Temporary:
// Fetch the cooldown for a user in a channel
async function getCooldown(db: Database, channel: string, username: string): Promise<number | null> {
  const row = await db.get('SELECT timestamp FROM cooldowns WHERE channel = ? AND username = ?', [channel, username]);
  return row ? row.timestamp : null;
}

// Update the cooldown for a user in a channel
async function updateCooldown(db: Database, channel: string, username: string, timestamp: number): Promise<void> {
  await db.run('INSERT OR REPLACE INTO cooldowns (channel, username, timestamp) VALUES (?, ?, ?)', [channel, username, timestamp]);
}

// Reset the cooldown for a user in a channel
async function resetCooldown(db: Database, channel: string, username: string): Promise<void> {
  await db.run('DELETE FROM cooldowns WHERE channel = ? AND username = ?', [channel, username]);
}

// Command definition with a name and a handler function
export const commandName = {
  name: '66', // The Trigger
  handler: async (channel: string, userstate: ChatUserstate, args: string[], client: any) => {
    let reply = '';

    // Initialize the database
    const db = await initializeDatabase();

    // Get the username of the user who invoked the command
    const username = userstate.username;

    // If the username is missing, send an error message
    if (!username) {
      reply = 'Error: Username not found!';
      await client.say(channel, reply);
      return;
    }

    // Check if the user entered "+66 reset"
    if (args[0] === 'reset') {
      await resetCooldown(db, channel, username);
      reply = `Cooldown reset for ${username}.`;
      await client.say(channel, reply);
      return;
    }

    // Get the current timestamp
    const currentTime = Date.now();

    // Get the last used timestamp for the user in the specific channel
    const lastUsedTimestamp = await getCooldown(db, channel, username);

    // If the user is still on cooldown, send a wait message
    if (lastUsedTimestamp && currentTime - lastUsedTimestamp < 30 * 60 * 1000) {
      const remainingTime = Math.ceil((30 * 60 * 1000 - (currentTime - lastUsedTimestamp)) / 1000);
      reply = `bitti warte noch ${remainingTime} sekunden.`;
      await client.say(channel, reply);
      return;
    }

    try {
      // Update the cooldown timestamp for the user
      await updateCooldown(db, channel, username, currentTime);
      const content = sixtySixContent(username);

      reply = await aiResponse(
        username, // User Name
        "", // User Message
        "Shyboti", // AI Name
        content, // AI Content
        "" // DB memory Name
      );

    } catch (error) {
      console.error('Error during OpenAI API call:', error);
      reply = 'Hm irgendwas ist schief gelaufen.';
    }

    // Send the reply back to the chat and remove quotation marks
    reply = reply.replace(/"/g, '');
    await client.say(channel, reply);
    console.log(`* replied with "${reply}"`);
  },
};
