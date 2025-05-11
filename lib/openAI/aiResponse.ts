import OpenAI from "openai";
import dotenv from "dotenv";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";
import path from "path";



dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface MemoryEntry {
  user_message: string;
  bot_response: string;
  timestamp: string;
}


// Create and open the SQLite database
const openDatabase = async (memoryDb: string) => {
  const dbPath = path.resolve(`./db/openAi/${memoryDb}.db`);
  const dirPath = path.dirname(dbPath);

  // Ensure the directory exists
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Create table if not exists
  await db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      user_message TEXT,
      bot_response TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create table for older memories
  await db.run(`
    CREATE TABLE IF NOT EXISTS older_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      user_message TEXT,
      bot_response TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
};
/**
 * Fetch the last 20 messages from the memory
 */
const fetchLastMessages = async (
  db: any,
  limit: number = 5
): Promise<MemoryEntry[]> => {
  const result = await db.all(
    `
    SELECT user_message, bot_response, timestamp FROM memories
    ORDER BY timestamp DESC
    LIMIT ?
  `,
    [limit]
  );

  return result.reverse(); // Reverse to maintain chronological order
};

/**
 * Store the message and bot response in the memory
 */
const storeMemory = async (
  db: any,
  username: string,
  userMessage: string,
  botResponse: string
) => {
  // Store in memories table (last 20)
  await db.run(
    `INSERT INTO memories (username, user_message, bot_response)
    VALUES (?, ?, ?)`,
    [username, userMessage, botResponse]
  );

  // Check if there are more than 20 memories for the user
  const count = await db.get(
    `SELECT COUNT(*) as count FROM memories WHERE username = ?`,
    [username]
  );

  // If there are more than 20 memories, move the oldest to older_memories
  if (count.count > 20) {
    // Move the oldest message to the older_memories table
    await db.run(
      `INSERT INTO older_memories (username, user_message, bot_response, timestamp)
      SELECT username, user_message, bot_response, timestamp
      FROM memories
      WHERE username = ?
      ORDER BY timestamp ASC
      LIMIT 1`,
      [username]
    );

    // Delete the oldest message from the memories table
    await db.run(
      `DELETE FROM memories
      WHERE id IN (
        SELECT id
        FROM memories
        WHERE username = ?
        ORDER BY timestamp ASC
        LIMIT 1
      )`,
      [username]
    );
  }
};

/**
 * Generic function to generate AI content with memory support
 * @param username - the user's display name
 * @param message - user input
 * @param systemName - optional system message name (default: "system")
 * @param systemContent - optional system message content
 * @param memoryDb - the database file name where memories are stored
 */

export const aiResponse = async (
  username: string,
  message: string,
  systemName: string = "system",
  systemContent: string = "",
  memoryDb: string = ""
): Promise<string> => {
  try {
    let context = ""
    let db

    if (memoryDb) {
    // Open the database
    db = await openDatabase(memoryDb);

     // Fetch the last 10 messages (adjustable)
     const lastMessages: MemoryEntry[] = await fetchLastMessages(db, 10);

     // Filter out redundant entries
     const filteredMessages = lastMessages.filter(
       (entry, index, self) =>
         index === 0 || entry.user_message !== self[index - 1].user_message
     );
 
     // Build the context for the AI prompt (last 5 messages)
     context = filteredMessages
       .map(
         (entry: MemoryEntry) =>
           `"User Nachricht am ${entry.timestamp}: ${entry.user_message} \nDeine Response: ${entry.bot_response}"`
       )
       .join("\n");

       const totalTokens =  message.length + systemContent.length;
       console.log(`Prompt length: ${totalTokens} characters`);


    } else {
      context = "None"
    }

    // Generate AI response using OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", name: systemName, content: systemContent },
        { role: "system", name: 'context', content: 'Logs:' + context }, // Context message
        { role: "user", name: username, content: message}, // Current user message
      ],
     // max_completion_tokens: 115, // Limit response length
      temperature: 1.0,
    });

    const response =
      completion.choices[0]?.message?.content ??
      "Sorry, ich konnte keine Antwort generieren.";

    // Store in memory only if DB was used
    if (db) {
    await storeMemory(db, username, message, response);
    }

    // Return the AI response
    return response;
  } catch (error) {
    console.error("Fehler beim Generieren der Antwort:", error);
    return "Sorry, etwas ist schiefgelaufen!";
  }
};
