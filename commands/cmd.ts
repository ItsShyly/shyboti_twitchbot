import fs from "fs";
import path from "path";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import type { ChatUserstate } from "tmi.js";

// Open or create the database
const dbPromise = open({
  filename: "db/commandsConfig.db",
  driver: sqlite3.Database,
});


const commandsDir = path.join("./commands");

// Function to read all command files
function getAllCommandFiles(): string[] {
  return fs
    .readdirSync(commandsDir)
    .filter((file) => file.endsWith(".js") || file.endsWith(".ts"))
    .map((file) => file.replace(/\.[^/.]+$/, "")); // Remove file extension
}

// Function to set up the database for a channel and add all commands
async function setupChannelTable(channel: string) {
  const db = await dbPromise;
  const tableName = channel.replace(/^#/, ""); // Remove the "#" from the channel name

  // Create the table if it doesn't exist
  await db.run(`
    CREATE TABLE IF NOT EXISTS channel_${tableName} (
      command TEXT PRIMARY KEY,
      isActive BOOLEAN DEFAULT true,
      cooldown INTEGER DEFAULT 0,
      lastUsed INTEGER DEFAULT 0,
      modOnly BOOLEAN DEFAULT false
    )
  `);

  // Get all commands from the /commands directory
  const allCommands = getAllCommandFiles();

  // Insert commands into the table if they are not already present
  const insertPromises = allCommands.map((command) =>
    db.run(`INSERT OR IGNORE INTO channel_${tableName} (command) VALUES (?)`, [
      command,
    ])
  );

  await Promise.all(insertPromises); // Wait for all inserts to complete
}


export const commandName = {
  name: "cmd", // The trigger for this command
  handler: async (
    channel: string,
    userstate: ChatUserstate,
    args: string[],
    client: any
  ) => {
    const db = await dbPromise;
    const tableName = channel.replace(/^#/, "");
    const subCommand = args[0]?.toLowerCase();

    try {
      // Command management logic


      if (subCommand === "init") {
        // Initialize the table for the channel and populate it with commands
        await setupChannelTable(channel);
        const reply = `Command management initialized for this channel! All commands added.`;
        await client.say(channel, reply);
        console.log(`* replied with "${reply}"`);
      } else if (subCommand === "list") {
        // List all commands for this channel
        const rows = await db.all(`SELECT * FROM channel_${tableName}`);
        const commandList = rows
          .map(
            (row) =>
              `${row.command} (Active: ${row.isActive ? "Yes" : "No"
              }, Cooldown: ${row.cooldown}s, ModOnly: ${row.modOnly ? "Yes" : "No"
              })`
          )
          .join(", ");
        const reply = `Available commands: ${commandList}`;
        await client.say(channel, reply);
        console.log(`* replied with "${reply}"`);
      } else if (subCommand === "deactivate" && args[1]) {
        const commandToDeactivate = args[1];
        await db.run(
          `UPDATE channel_${tableName} SET isActive = 0 WHERE command = ?`,
          [commandToDeactivate]
        );
        const reply = `Command "${commandToDeactivate}" has been deactivated.`;
        await client.say(channel, reply);
        console.log(`* replied with "${reply}"`);
      } else if (subCommand === "activate" && args[1]) {
        const commandToActivate = args[1];
        await db.run(
          `UPDATE channel_${tableName} SET isActive = 1 WHERE command = ?`,
          [commandToActivate]
        );
        const reply = `Command "${commandToActivate}" has been activated.`;
        await client.say(channel, reply);
        console.log(`* replied with "${reply}"`);
      } else if (subCommand === "cooldown" && args[1] && args[2]) {
        const commandToCooldown = args[1];
        const cooldownTime = parseInt(args[2], 10);
        if (isNaN(cooldownTime) || cooldownTime < 0) {
          const reply =
            "Please provide a valid cooldown time (positive number).";
          await client.say(channel, reply);
          console.log(`* replied with "${reply}"`);
          return;
        }
        await db.run(
          `UPDATE channel_${tableName} SET cooldown = ? WHERE command = ?`,
          [cooldownTime, commandToCooldown]
        );
        const reply = `Cooldown for command "${commandToCooldown}" has been set to ${cooldownTime} seconds.`;
        await client.say(channel, reply);
        console.log(`* replied with "${reply}"`);
      } else if (subCommand === "modonly" && args[1] && args[2]) {
        const commandToModOnly = args[1];
        const modOnlyStatus = args[2].toLowerCase() === "on" ? 1 : 0;
        await db.run(
          `UPDATE channel_${tableName} SET modOnly = ? WHERE command = ?`,
          [modOnlyStatus, commandToModOnly]
        );
        const reply = `Command "${commandToModOnly}" is now ${modOnlyStatus ? "mod-only" : "available to all users"
          }.`;
        await client.say(channel, reply);
        console.log(`* replied with "${reply}"`);
      } else if (subCommand === "alias" && args[2]) { // Check if args[2] is valid (alias subcommand)
        const aliasSubCommand = args[1].toLowerCase(); // Correctly get aliasSubCommand from args[1]
        console.log("Alias subcommand:", aliasSubCommand); // Debugging line to see aliasSubCommand
        console.log("CMD: Alias, Args: 2:", args[2], "3:", args[3], "4:", args[4]);

        if (aliasSubCommand === "add" && (args[3] || args[4])) {
          console.log("Condition triggered!");

          const alias = args[2].toLowerCase();
          const mainCommand = args[3].toLowerCase();
          let argCommand = "";

          console.log(alias, mainCommand, argCommand)
          console.log("Adding alias:", alias, "for command:", mainCommand); // Debugging line to see alias and mainCommand

          // Check if the main command exists
          const commandExists = await db.get(
            `SELECT 1 FROM channel_${tableName} WHERE command = ?`,
            [mainCommand]
          );
          if (!commandExists) {
            const reply = `The command "${mainCommand}" does not exist.`;
            await client.say(channel, reply);
            console.log(`* replied with "${reply}"`);
            return;
          }

          let command = mainCommand

          if (args[4]) {
            argCommand = args[4].toLowerCase();
            command = command + ' ' + argCommand
            console.log("triggered:", command)
            console.log("triggered arg:", command)
          }

          // Add the alias to the database
          await db.run(
            `INSERT OR IGNORE INTO command_aliases (alias, command) VALUES (?, ?)`,
            [alias, command]
          );
          const reply = `Alias "${alias}" has been added for command "${command}".`;
          await client.say(channel, reply);
          console.log(`* replied with "${reply}"`);
        } else if (aliasSubCommand === "remove" && args[2]) {
          const alias = args[2].toLowerCase(); // Capture the alias from args[2]
          // Remove the alias from the database
          await db.run(`DELETE FROM command_aliases WHERE alias = ?`, [alias]);
          const reply = `Alias "${alias}" has been removed.`;
          await client.say(channel, reply);
          console.log(`* replied with "${reply}"`);
        } else {
          const reply = "Invalid alias subcommand!";
          await client.say(channel, reply);
          console.log(`* replied with "${reply}"`);
        }
      } else if (!subCommand && commandName.name == "cmd") {
        const usageText = `Usage: 
        +cmd init; 
        +cmd list; 
        +cmd <deactivate | activate> <command>; 
        +cmd cooldown <command> <time>; 
        +cmd modonly <command> <on | off>, 
        +cmd alias <add | remove> alias <mainCommand> <argCommand>`
        await client.say(channel, usageText);
        console.error("replied with:", usageText)

      }
    } catch (error) {
      console.error("Error handling the command:", error);
      const reply = "An error occurred while processing your request.";
      await client.say(channel, reply);
    }
  },
};