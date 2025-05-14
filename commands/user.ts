import axios, { AxiosError, AxiosResponse } from "axios"; // Import AxiosError type
import type { ChatUserstate } from "tmi.js";

const TWITCH_API_BASE_URL = "https://api.twitch.tv/helix";

// Fetch credentials from environment variables
const TWITCH_CLIENT_ID = process.env.CLIENT_ID!;
const TWITCH_OAUTH_TOKEN = process.env.AUTH_TOKEN!;

const LOGS_API_URL = "https://logs.susgee.dev/channel"; // Base URL for logs

async function shortenImageUrl(imageUrl: string | Blob) {
  try {
    const formData = new FormData();
    formData.append('image', imageUrl); // The profile image URL from Twitch

    const response = await axios.post('https://api.imgur.com/3/image', formData, {
      headers: {
        Authorization: `Client-ID 665a92d0507cd27`,
      },
    });

    if (response.data.success) {
      return response.data.data.link; // The shortened Imgur link
    } else {
      console.error('Imgur upload failed:', response.data);
      return imageUrl; // Fallback to the original URL if upload fails
    }
  } catch (error) {
    console.error('Error uploading image to Imgur:', error);
    return imageUrl; // Fallback to the original URL if an error occurs
  }
}


export const user = {
  name: "user",
  handler: async (
    channel: string,
    userstate: ChatUserstate,
    args: string[],
    client: any
  ) => {
    const target =
      args.length > 0
        ? args[0].toLowerCase().replace("@", "")
        : userstate.username?.toLowerCase() || "unknown";

    let reply = `Modding Info for ${target}:\n`;

    try {
      // Fetch user data from Twitch API
      const userResponse: AxiosResponse = await axios.get(
        `${TWITCH_API_BASE_URL}/users`,
        {
          params: {
            login: target,
          },
          headers: {
            "Client-ID": TWITCH_CLIENT_ID,
            Authorization: `Bearer ${TWITCH_OAUTH_TOKEN}`,
          },
        }
      );

      const userData = userResponse.data.data[0];

      if (!userData) {
        reply += `Could not find any information about ${target}.`;
      } else {
        const {
          id,
          display_name,
          description,
          profile_image_url,
          created_at,
          view_count,
          broadcaster_type,
        } = userData;

        const profileImageUrl = await shortenImageUrl(profile_image_url); // Use the shortened URL


        reply += `| Display Name: ${display_name}\n`;
        reply += `| Bio: ${description || "No bio available"}\n`;
        reply += `| Profile Image: ${profileImageUrl}\n`;
        reply += `| User ID: ${id}\n`;
        reply += `| Account Created: ${new Date(
          created_at
        ).toLocaleDateString()}\n`;
        reply += `| Broadcaster Type: ${broadcaster_type || "Not specified"}\n`;

        const streamResponse: AxiosResponse = await axios.get(
          `${TWITCH_API_BASE_URL}/streams`,
          {
            params: { user_login: target },
            headers: {
              "Client-ID": TWITCH_CLIENT_ID,
              Authorization: `Bearer ${TWITCH_OAUTH_TOKEN}`,
            },
          }
        );

        const streamData = streamResponse.data.data[0];
        if (!streamData) {
          reply += `| Status: Offline\n`;
        } else {
          reply += `| Status: Currently Streaming "${streamData.title}"\n`;
          reply += `– Game: ${streamData.game_name}\n`;
          reply += `– Viewers: ${streamData.viewer_count}\n`;
        }


        // Fetch log data to summarize the top 5 active users for the given channel and date
        try {
          // Update the URL format to use the correct username and date format
          const logUrl = `${LOGS_API_URL}/${target}/${new Date()
            .toISOString()
            .slice(0, 4)}/${new Date().toISOString().slice(5, 7)}/${new Date()
              .toISOString()
              .slice(8, 10)}`;
          console.log("logUrl:", logUrl); // Log the URL being called

          const logResponse: AxiosResponse = await axios.get(logUrl);

          // Check if the status is 404, which indicates no logs available
          if (logResponse.status === 404) {
            reply += "| No Logs available for today\n";
            return;
          }

          // Log the full response structure to inspect it
          console.log("logResponse data:", logResponse.data);
          const logData = logResponse.data;

          // Split the log data by new lines to get individual log entries
          const logEntries = logData.split("\n");

          // Check if the logEntries is an array and not empty
          if (!logEntries || logEntries.length === 0) {
            console.error("No log entries found.");
            reply += "No logs available for this day.\n";
            return;
          }

          // Define activityCounts with an index signature for dynamic keys
          const activityCounts: { [username: string]: number } = {};

          logEntries.forEach((logEntry: string) => {
            console.log("Processing log entry:", logEntry); // Log each log entry

            const usernameMatch = logEntry.match(/#\S+\s+(\S+)/); // Match the second word after the hashtag

            if (usernameMatch) {
              const username = usernameMatch[1].toLowerCase(); // Extract the second word as the username
              console.log("Matched username:", username); // Log the matched username

              // Increment activity count for the user
              activityCounts[username] = (activityCounts[username] || 0) + 1;
            } else {
              console.log("No match found for this log entry:", logEntry); // Log when no match is found
            }
          });

          console.log("Activity counts:", activityCounts);

          // Get the top 5 active users
          const topUsers = Object.entries(activityCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

          reply += "| Top 5 Users (today):";
          topUsers.forEach(([user, count], index) => {
            reply += `ㅤ${user} (${count} msgs),`;
          });
        } catch (logError) {
          // Type guard to check if it's an AxiosError
          if (logError instanceof AxiosError) {
            if (logError.response?.status === 404) {
              reply += "No Logs available for the specified date.\n";
            } else {
              reply += `– Error fetching log data: ${logError.message}\n`;
            }
          } else {
            reply += `– Error fetching log data: Unknown error.\n`;
          }
        }
      }
    } catch (error) {
      if (error instanceof AxiosError) {
        reply += `Error fetching data: ${error.message}\n`;
      } else {
        reply += `Error fetching data: Unknown error\n`;
      }
    }

    // Send the reply
    await client.say(channel, reply);
  },
};
