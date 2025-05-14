import * as dotenv from "dotenv";
import fetch from "node-fetch";
import type { ChatUserstate } from "tmi.js";
import { fetchEmotesFromSet, getEmoteSet } from "../lib/7tv/fetchEmotes.ts";
dotenv.config({ path: "./.env" }); // Explicit path

export const commandName = {
  name: "kiss",
  handler: async (
    channel: string,
    userstate: ChatUserstate,
    args: string[],
    client: any
  ) => {
    // Handle case where 'display-name' or 'username' might be empty
    const sender =
      userstate["display-name"] ||
      userstate["username"] ||
      "Someone";

    const authToken = process.env.AUTH_TOKEN;
    const clientId = process.env.CLIENT_ID;
    const username = process.env.BOT_USERNAME;

    if (!authToken || !clientId) {
      console.error("❌ Missing required environment variables.");
      await client.say(
        channel,
        "sorry ist kaputt weil missing environment variables."
      );
      return;
    }

    // Get broadcaster ID (channel's user ID)
    let broadcasterId: string | null = null;
    let moderatorId: string | null = null;
    const cleanChannel = channel.replace(/^#/, ""); // Define cleanChannel here before its use

    try {
      console.log(`🔍 Fetching broadcaster ID for ${cleanChannel}...`);
      const broadcasterResponse = await fetch(
        `https://api.twitch.tv/helix/users?login=${cleanChannel}`,
        {
          headers: {
            "Client-ID": clientId as string,
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (!broadcasterResponse.ok) {
        throw new Error(
          `Twitch API error: ${broadcasterResponse.status} - ${broadcasterResponse.statusText}`
        );
      }

      const broadcasterData = await broadcasterResponse.json();
      if (!broadcasterData?.data?.length) {
        throw new Error("No broadcaster data found.");
      }

      broadcasterId = broadcasterData.data[0].id;
      console.log(`✅ Broadcaster ID: ${broadcasterId}`);
    } catch (error) {
      console.error("❌ Error fetching broadcaster ID:", error);
      await client.say(
        channel,
        `sorry ist kaputt weil broadcaster ID fetch failed: ${error}`
      );
      return;
    }

    try {
      console.log(`🔍 Fetching moderator ID for ${username}...`);
      const moderatorResponse = await fetch(
        `https://api.twitch.tv/helix/users?login=${username}`,
        {
          headers: {
            "Client-ID": clientId as string,
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (!moderatorResponse.ok) {
        throw new Error(
          `Twitch API error: ${moderatorResponse.status} - ${moderatorResponse.statusText}`
        );
      }

      const moderatorData = await moderatorResponse.json();
      if (!moderatorData?.data?.length) {
        throw new Error("No moderator data found.");
      }

      moderatorId = moderatorData.data[0].id;
      console.log(`✅ Moderator ID: ${moderatorId}`);
    } catch (error) {
      console.error("❌ Error fetching moderator ID:", error);
      await client.say(
        channel,
        `sorry ist kaputt weil moderator ID fetch failed: ${error}`
      );
      return;
    }

    let recipient = "someone";

    if (args.length > 0) {
      recipient = args[0].replace(/^@/, ""); // Remove '@' if present
    } else {
      try {
        console.log(`🔍 Fetching chatters for ${cleanChannel}...`);
        const response = await fetch(
          `https://api.twitch.tv/helix/chat/chatters?broadcaster_id=${broadcasterId}&moderator_id=${moderatorId}`,
          {
            headers: {
              "Client-ID": clientId,
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            `Twitch API error: ${response.status} - ${response.statusText}`
          );
        }

        const data = await response.json();
        const chatters = data?.data?.map((user: any) => user.user_login) || [];
        if (chatters.length > 0) {
          // Filter out specific users (temporary)
          const filteredChatters = chatters.filter(
            (user: string) =>
              user !== "death_unikorn_tv" &&
              user !== "death_unikorn_tv_" &&
              user !== "susgeebot2" &&
              user !== "vgregor"
          );

          if (filteredChatters.length > 0) {
            const chance = Math.random();

            recipient =
              filteredChatters[
              Math.floor(Math.random() * filteredChatters.length)
              ] || "someone";

            // Attempt 10% chance to kiss an emote instead
            if (chance < 0.1) {
              console.log(chance);
              try {
                console.log("Fetching Emotes...");
                const emoteSetId = await getEmoteSet(channel);
                console.log("SetID:", emoteSetId);
                if (emoteSetId) {
                  const emotes = await fetchEmotesFromSet(emoteSetId);
                  console.log("Emotes:", emotes);
                  if (emotes.length > 0) {
                    recipient =
                      emotes[Math.floor(Math.random() * emotes.length)];
                    console.log(
                      `🎯 Chose random emote as recipient: ${recipient}`
                    );
                  }
                }
              } catch (error) {
                console.error("❌ Error fetching emotes:", error);
              }
            }
          } else {
            recipient = ""; // In case all chatters are filtered out
          }
        }
      } catch (error) {
        console.error("❌ Error fetching chatters:", error);
      }
    }

    // Fetch the recipient's display name
    let recipientDisplayName = recipient;
    try {
      const userResponse = await fetch(
        `https://api.twitch.tv/helix/users?login=${recipient}`,
        {
          headers: {
            "Client-ID": clientId,
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData?.data?.length) {
          recipientDisplayName = userData.data[0].display_name;
        }
      }
    } catch (error) {
      console.error("❌ Error fetching recipient display name:", error);
    }

    const kisses = Math.floor(Math.random() * 1000) + 1;
    let extra = "";

    if (kisses > 950) {
      extra = "spilledGlue";
    }

    const reply = `${sender} -> kiss ${extra} <- ${recipientDisplayName} `;
    console.log(`💬 Sent message: "${reply}"`);

    await client.say(channel, reply);

    // Bot Comment
    if (recipientDisplayName === "ShyBoti") {
      if (extra != "") {
        if (Math.random() < 0.8) {
          await client.say(channel, "AYOOO");
        } else {
          await client.say(channel, "ActinUp");
        }
      } else if (Math.random() < 0.5) {
        await client.say(channel, "flushE");
      } else {
        await client.say(channel, "ppPoof");
      }
    }
  },
};
