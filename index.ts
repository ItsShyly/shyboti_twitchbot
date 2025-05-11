import tmi from "tmi.js";
import { ChatUserstate } from "tmi.js";
import { CREDENTIALS, IDENTIFIER } from "./configs.js";
import { readdirSync } from "fs";
import { resolve } from "path";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";

// Create a new client with selected options from ACCOUNT configuration
const client = new tmi.Client(CREDENTIALS);

// Commands object to hold dynamically loaded commands
const commands: Record<
  string,
  (
    channel: string,
    userstate: ChatUserstate,
    args: string[],
    client: tmi.Client
  ) => Promise<void>
> = {};

// Dynamically load commands from the `commands` folder
const commandsPath = resolve(__dirname, "./commands");
const commandNames: string[] = [];
readdirSync(commandsPath).forEach((file) => {
  if (file.endsWith(".ts") || file.endsWith(".js")) {
    const commandModule = require(resolve(commandsPath, file));
    const command = commandModule[Object.keys(commandModule)[0]];
    if (command && command.name && command.handler) {
      commands[command.name] = command.handler;
      commandNames.push(command.name);
    }
  }
});

// Database initialization
const initDb = async (): Promise<
  Database<sqlite3.Database, sqlite3.Statement>
> => {
  const db = await open({
    filename: "./db/commandsConfig.db",
    driver: sqlite3.Database,
  });
  await db.exec(
    `CREATE TABLE IF NOT EXISTS channels (channel TEXT PRIMARY KEY)`
  );
  await db.exec(
    `CREATE TABLE IF NOT EXISTS command_aliases (
        alias TEXT PRIMARY KEY,
        command TEXT NOT NULL
      )`
  );
  return db;
};

// Initialize table for a specific channel
const initChannelTable = async (
  db: Database<sqlite3.Database, sqlite3.Statement>,
  channel: string
) => {
  await db.run(`INSERT OR IGNORE INTO channels (channel) VALUES (?)`, channel);
  const tableName = `channel_${channel.replace("#", "")}`;
  await db.run(
    `CREATE TABLE IF NOT EXISTS ${tableName} (
        command TEXT PRIMARY KEY,
        isActive BOOLEAN DEFAULT true,
        cooldown INTEGER DEFAULT 0,
        modOnly BOOLEAN DEFAULT true,
        lastUsed INTEGER DEFAULT 0
      )`
  );

  // Populate table with commands if empty
  const rows = await db.all(`SELECT command FROM ${tableName}`);
  if (rows.length === 0) {
    const insertStmt = await db.prepare(
      `INSERT INTO ${tableName} (command) VALUES (?)`
    );
    for (const command of commandNames) {
      await insertStmt.run(command);
    }
    await insertStmt.finalize();
  }
};

const getMainCommand = async (
  db: Database<sqlite3.Database, sqlite3.Statement>,
  command: string
): Promise<string> => {
  const aliasEntry = await db.get(
    `SELECT command FROM command_aliases WHERE alias = ?`, // Removed the extra comma
    command
  );
  return aliasEntry ? aliasEntry.command : command; // Return the resolved main command or original command
};

// This function handles messages from the Twitch chat
async function onMessage(
  channel: string,
  userstate: ChatUserstate,
  message: string,
  self: boolean
) {
  if (self || !message.startsWith(IDENTIFIER)) return;

  const db = await initDb();
  await initChannelTable(db, channel);
  message = message.slice(1); // Remove the identifier (+)
  const [commandInput, ...args] = message.split(" "); // Split the message into the command and arguments

  let command = await getMainCommand(db, commandInput?.toLowerCase() ?? "");
  let commandArgs = args; // Use `commandArgs` to avoid confusion with the name `arguments`
  let fullCommand = command + " " + args.join(" ");
  // Check if the commandInput contains more than one word
  let commandParts = command.trim().split(/\s+/); // Split the command into words
  if (commandParts.length > 1) {
    command = commandParts[0]; // Use only the first word as the command
    commandArgs = [...commandParts.slice(1), ...args]; // Merge commandParts (excluding the command) with args
  }

  if (command) {
    try {
      const tableName = `channel_${channel.replace("#", "")}`;

      // Use the main command (even if it's an alias) for checking and retrieving command data
      const cmdData = await db.get(
        `SELECT isActive, cooldown, lastUsed, modOnly FROM ${tableName} WHERE command = ?`,
        [command]
      );

      if (cmdData) {
        const { isActive, cooldown, lastUsed, modOnly } = cmdData;

        if (!isActive) {
          return;
        }

        // Check if cooldown is required
        const now = Date.now();
        if (cooldown > 0 && now - lastUsed < cooldown * 1000) {
          const remainingTime = Math.ceil(
            (cooldown * 1000 - (now - lastUsed)) / 1000
          );

          return;
        }

        // Check if modOnly is enabled and the user is not a moderator
        if (modOnly && !userstate.mod) {
          return;
        }

        // Update the lastUsed time and execute the command
        await db.run(`UPDATE ${tableName} SET lastUsed = ? WHERE command = ?`, [
          now,
          command,
        ]);

        // Call the command handler, passing the resolved command and the original arguments
        await commands[command](channel, userstate, commandArgs, client);
      } else {
      }
    } catch (error) {
      console.error("Error handling command:", error);
    }
  }
}

// Set up the message listener
client.on("message", onMessage);

// Connect the client
client.connect();

export { commands };
