import type { ChatUserstate } from "tmi.js";
import { aiResponse } from "../lib/openAI/aiResponse";
import tindaContent from "../lib/openAI/prompts/tindaContent";


export const commandName = {
    name: "tinda",
    handler: async (
      channel: string,
      userstate: ChatUserstate,
      args: string[],
      client: any
  ) => {
    let reply = "";

    if (args.length > 0) {
      const username = userstate["display-name"] || "Unbekannt";
      let message = args.join(" ");

   
      reply = await aiResponse(
        username, // User Name
        message, // User Message
        "Tinda", // AI Name
        tindaContent, // AI Content
        "tindaMemory" // DB memory Name
      );

      reply = reply
      .replace(/[^\p{Emoji}\p{L}\p{N}\s]/gu, "")
      .replace(/"/g, " ")
      .replace(/,/g, " ,")
      .replace(/Tinda:/gi, "");
    
    } else {
      reply = "sag was oder bleib leise NaUnd";
    }

    await client.say(channel, `${reply}`);
    console.log(`* replied with "${reply}"`);
  },
};
