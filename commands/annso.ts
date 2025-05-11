import type { ChatUserstate } from "tmi.js";

// Command definition with a name and a handler function
export const commandName = {
  name: "annso", // The Trigger
  handler: async (
    channel: string,
    userstate: ChatUserstate,
    args: string[],
    client: any 
  ) => {
    let reply = "annso bitti schnell deine botties warten 󠀀";


    // Send the reply back to the chat
    await client.say(channel, reply);
    console.log(`* replied with "${reply}"`);
  },
};
