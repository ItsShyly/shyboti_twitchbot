import type { ChatUserstate } from "tmi.js";

// Function to sanitize the input and escape special characters
const sanitizeInput = (input: string) => {
  return input.replace(/[\$\`\&\(\)\{\}\[\]\+\|\\\/\^<>"']/g, "");
};

export const commandName = {
  name: "spam",
  handler: async (
    channel: string,
    userstate: ChatUserstate,
    args: string[],
    client: any
  ) => {
    let reply = "";
    const min = 1;
    const max = 50;
    const cap = 75;
    let spamCount = Math.floor(Math.random() * (max - min + 1)) + min;
    let message = "";

    if (args.length > 0) {
      // Find all Numbers in the args
      const numbers = args.filter(arg => /^\d+$/.test(arg)).map(Number);
      
      if (numbers.length > 0) {
        if (numbers.length === 2) {
          spamCount = numbers[1]; // If 2 numbers -> the 2nd is the countt
          message = numbers[0].toString(); // and the first is the message
        } else {
          spamCount = numbers[numbers.length - 1];
        }
        
        if (spamCount > cap) {
          reply = `NoNo Ich darf nicht so viel, sonst gibt mir Twitch ein rate limit. Bitte mach maximal nur ${cap} shy`;
          await client.say(channel, reply);
          console.log(`* replied with "${reply}"`);
          return;
        }
        
        spamCount = Math.min(cap, Math.max(min, spamCount));
        args = args.filter(arg => !/^\d+$/.test(arg)); // remove numbers from args
      }
      
      if (!message) {
        message = sanitizeInput(args.join(" ")) || "Spam";
      }
      
      for (let i = 0; i < spamCount; i++) {
        await client.say(channel, message === "Spam" ? (i + 1).toString() : message);

        console.log(`* sent spam message (${i + 1}/${spamCount}): "${message === "Spam" ? (i + 1).toString() : message}"`);
      }

      // Bot Comment after all spam messages
      const randomNum = Math.random();
      if (randomNum < 0.1) {
        await client.say(channel, "LETSGO wir lieben spam");
      } else if (randomNum < 0.2) {
        await client.say(channel, "shy ich hoffe ich hab das gut gemacht");
      }
      console.log(randomNum);

    } else {
      reply = "Was soll ich denn spammen? shy";
      await client.say(channel, reply);
      console.log(`* replied with "${reply}"`);
    }
  },
};
