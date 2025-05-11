import { ChatUserstate } from 'tmi.js';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite'; // Import Database type
import { aiResponse } from "../lib/openAI/aiResponse";
import swContent from "../lib/openAI/prompts/swContent";




// Command definition with a name and a handler function
export const commandName = {
  name: 'sw', // The Trigger
  handler: async (channel: string, userstate: ChatUserstate, args: string[], client: any) => {
    let reply = '';

    // Initialize the database

    // Get the username of the user who invoked the command
    const username = userstate.username;

    // If the username is missing, send an error message
    if (!username) {
      reply = 'Error: Username not found!';
      await client.say(channel, reply);
      return;
    }

    try {
      // Update the cooldown timestamp for the user

      reply = await aiResponse(
        username, // User Name
        "", // User Message
        "Shyboti", // AI Name
        swContent, // AI Content
        "" // DB memory Name
      );

    } catch (error) {
      console.error('Error during OpenAI API call:', error);
      reply = 'Hm irgendwas ist schief gelaufen.';
    }

    // Send the reply back to the chat and remove quotation marks
    reply = reply.replace(/"/g, '');
    reply = reply + " Nerdge" 
    await client.say(channel, reply);
    console.log(`* replied with "${reply}"`);
  },
};
