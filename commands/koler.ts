import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { ChatUserstate } from 'tmi.js';

// Function to sanitize the channel name
function sanitizeChannelName(channel: string): string {
  return channel.replace(/[^a-zA-Z0-9_]/g, '_'); // Replace non-alphanumeric characters with underscores
}

// Initialize SQLite database inside an async function
async function initializeDatabase() {
  const db = await open({
    filename: './db/kolerProgress.db', // Corrected the path to ensure it’s created in a proper directory
    driver: sqlite3.Database,
  });
  return db; // Return the database instance for later use
}

// Game settings
const maxPressure = 100;
const explosionChanceMultiplier = 0.5;
const pressureScaleFactor = 0.1;
const explosionRisingPercentage = 50;

export const commandName = {
  name: 'koler', // The Trigger
  handler: async (
    channel: string,
    userstate: ChatUserstate,
    args: string[],
    client: any
  ) => {
    const username = userstate.username;
    const sanitizedChannel = sanitizeChannelName(channel); // Sanitize the channel name

    // Initialize database
    const db = await initializeDatabase();

    // Create a table dynamically for each channel (if not exists)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ${sanitizedChannel}_game_progress (
        round INTEGER,
        pressure INTEGER,
        last_username TEXT
      );
    `);

    // Retrieve the current game progress for the channel
    const gameProgress = await db.get(`
      SELECT * FROM ${sanitizedChannel}_game_progress LIMIT 1
    `);

    if (gameProgress && gameProgress.last_username === username) {
      // If the same username, send the message and stop further execution
      await client.say(channel, "Jemand anderes muss jetzt schötölölenen NoNo");
      console.log(`* Username ${username} attempted to play again. Sending new user message.`);
      return; // Stop further execution if the username is the same
    }

    // Initialize or set the round counter from the game state
    let roundCounter = gameProgress ? gameProgress.round : 1;
    let pressure = Math.floor(maxPressure * (1 - Math.exp(-pressureScaleFactor * roundCounter)));

    let explosionOdds = 1;
    if (pressure >= explosionRisingPercentage) {
      explosionOdds = Math.floor((pressure - explosionRisingPercentage) * explosionChanceMultiplier);
    }

    console.log(`* Odds of dying (kolerExplode) this round: ${explosionOdds}%`);

    // Check if it's an explosion
    const chanceOfExploding = Math.random() < (explosionOdds / 100);
    let reply = '';
    if (chanceOfExploding) {
      reply = `kolerExplode`;
      roundCounter = 1; // Reset round after explosion
    } else {
      reply = `koler Pressure: ${pressure}%`;
      roundCounter++; // Increment for next round
    }

    // Delete existing progress if the user is different
    if (gameProgress && gameProgress.last_username !== username) {
      await db.run(`
        DELETE FROM ${sanitizedChannel}_game_progress WHERE last_username = ?;
      `, [gameProgress.last_username]); // Delete the previous user's entry
    }

    // Update the game state for the channel
    await db.run(`
      INSERT OR REPLACE INTO ${sanitizedChannel}_game_progress (round, pressure, last_username)
      VALUES (?, ?, ?)
    `, [roundCounter, pressure, username]);

    // Send the result to the channel
    await client.say(channel, reply);
    console.log(`* replied with "${reply}" (Round ${roundCounter})`);
  },
};
