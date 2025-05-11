import type { ChatUserstate } from "tmi.js";


// Command definition with a name and a handler function
export const commandName = {
  name: "test", // The Trigger
  handler: async (
    channel: string,
    userstate: ChatUserstate,
    args: string[],
    client: any 
  ) => {
    let reply = "";

    // Example: Check if arguments are provided
    if (args.length > 0) {
      // Do something with the args
      reply = `You said: ${args.join(" ")}`;
    } else {
      reply = "No arguments provided!";
    }

    // Send the reply back to the chat
    await client.say(channel, reply);
    console.log(`* replied with "${reply}"`);
  },
  
};
