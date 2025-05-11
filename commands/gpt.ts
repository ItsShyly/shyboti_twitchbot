import { getEmoteSet, fetchEmotesFromSet } from "../lib/7tv/fetchEmotes";
import { aiResponse } from "../lib/openAI/aiResponse";
import { gptContent} from "../lib/openAI/prompts/gptContent";
import { ChatUserstate } from "tmi.js";

export const commandName = {
  name: "gpt",
  handler: async (
    channel: string,
    userstate: ChatUserstate,
    args: string[],
    client: any
  ) => {
    let reply = "";

    try {
      const emoteSetId = await getEmoteSet(channel);

      if (!emoteSetId) {
        reply = "No emote set found for this channel.";
        await client.say(channel, reply);
        return;
      }

      const emotes = await fetchEmotesFromSet(emoteSetId);

      if (emotes.length === 0) {
        reply = "No emotes found for the emote set.";
        await client.say(channel, reply);
        return;
      }

      const username = userstate.username ?? "";
      const message = args.join(" ");
      const content =  gptContent(emotes.toString());

      reply = await aiResponse(
        username,
        message,
        "ShyBoti",
        content,
        "gptMemory"
      );
    } catch (error) {
      console.error("Error during OpenAI API call:", error);
      reply = "Sorry, something went wrong with the AI!";
    }

    await client.say(channel, reply);
  },
};
