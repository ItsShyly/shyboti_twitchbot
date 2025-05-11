import type { ChatUserstate } from "tmi.js";

// Command definition with a name and a handler function
export const commandName = {
  name: "huansohn", // The Trigger
  handler: async (
    channel: string,
    userstate: ChatUserstate,
    args: string[],
    client: any
  ) => {
    const username = userstate.username || "unknown";


    let reply = ` 󠀀${username} 󠀀`;

    // Nachricht im Chat senden
    await client.say(channel, reply);
    console.log(`* replied with "${reply}"`);
  },
};
