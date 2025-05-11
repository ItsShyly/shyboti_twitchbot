import type { ChatUserstate } from "tmi.js";

export const commandName = {
    name: "rz", 
    handler: async (
      channel: string,
      userstate: ChatUserstate,
      args: string[],
      client: any 
    ) => {
      let reply = "";
  
      if (args.length >= 2) {
        const min = parseInt(args[0], 10);
        const max = parseInt(args[1], 10);

        if (!isNaN(min) && !isNaN(max) && min < max) {
          const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
          reply = `(${min}- ${max}): ${randomNumber}`;
        } else {
          reply = "Invalid input! Please use: +rz <min> <max>";
        }
      } else if (args.length === 1) {
        const max = parseInt(args[0], 10);
        if (!isNaN(max) && max > 1) {
          const randomNumber = Math.floor(Math.random() * max) + 1;
          reply = `(1- ${max}): ${randomNumber}`;
        } else {
          reply = "huh du hast irgendwas falsch gemacht: +rz | +rz <max> | +rz <min> <max> | Oh und erst ab 2 ";
        }
      } else {
        const randomNumber = Math.floor(Math.random() * 1000) + 1;
        reply = `${randomNumber}`;
      }
  
      await client.say(channel, reply);
      console.log(`* replied with "${reply}"`);
    }
}