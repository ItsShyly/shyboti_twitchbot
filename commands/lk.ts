import type { ChatUserstate } from "tmi.js";


export const commandName = {
  name: "lk",
  handler: async (
    channel: string,
    userstate: ChatUserstate,
    args: string[],
    client: any 
  ) => {
    const channels = client.getChannels();
    let reply = `Currently connected to: ${channels.join(", ")}`;
    
    await client.say(channel, reply);
    console.log(`* replied with "${reply}"`);
  },
};
