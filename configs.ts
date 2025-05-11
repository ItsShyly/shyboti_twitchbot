import type { Options } from "tmi.js";
import * as dotenv from "dotenv";
import { resolve } from "path";

// load environment variables
dotenv.config({
  path: resolve(__dirname, "../.env"),
});

// Export the credentials with Twitch bot identity and channels config
export const CREDENTIALS: Options = {
  identity: {
    username: process.env.BOT_USERNAME,
    password: process.env.AUTH_TOKEN,
  },
  channels: process.env.CHANNELS?.split(",") ?? [],
};

export const IDENTIFIER = process.env.BOT_IDENTIFIER ?? "+";
