import type { ChatUserstate } from "tmi.js";
import fetch from "node-fetch"; 
import sqlite3 from "sqlite3";
import { open } from "sqlite";

// editor perms should be different for each Channel stored in sql db .
// we also should've an Admin table or own db.

// for the channels, only the ChannelOwner and the Admins should have perms to give or remove editor in a channel.
// editors should then be able to use commands that are mod only, and can always deactivate or activate commands (the setup for this, is not in this file tho, it's in the index.ts)

// Todo: if the functions get added here, figure out a good db setup because of the steps that are neccasary in the index.ts afterwards.

// Command definition with a name and a handler function
export const commandName = {
  name: "perms", // The trigger
  handler: async (
    channel: string,
    userstate: ChatUserstate,
    args: string[],
    client: any
  ) => {
    let reply = "";

    const subCommand = args[0]?.toLowerCase();
    const user = args[1];

    try {
      console.log(`Received command: whitelist ${subCommand} ${user ?? ""}`);

      if (!subCommand || !["add", "remove"].includes(subCommand)) {
        reply = "Invalid command. Use '+whitelist add <user>' or '+whitelist remove <user>'";
      } else if (!user) {
        reply = "No user specified. Please provide a username.";
      } else {
        if (subCommand === "add") {
          console.log(`Adding user: ${user}`);
          reply = `User ${user} has been added to the whitelist.`;
        } else if (subCommand === "remove") {
          console.log(`Removing user: ${user}`);
          reply = `User ${user} has been removed from the whitelist.`;
        }
      }
    } catch (error) {
      console.error("Error handling command:", error);
      reply = "An error occurred. Please try again later!";
    }

    if (reply) {
      await client.say(channel, reply);
      console.log(`* Replied with "${reply}"`);
    }
  },
};
