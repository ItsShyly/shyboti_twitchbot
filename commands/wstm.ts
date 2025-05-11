import type { ChatUserstate } from "tmi.js";
import { OpenAI } from "openai";

import sqlite3 from "sqlite3";
import { open } from "sqlite";

import fs from "fs";
import path from "path";


import { aiResponse } from "../lib/openAI/aiResponse";
import { storyContent, quizContent } from "../lib/openAI/prompts/wstmContent";

const initializeDB = async () => {
  const dbDirectory = path.resolve("./db");

  // Ensure the directory exists
  if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
  }

  const db = await open({
    filename: "./db/wstm-leaderboard.db",
    driver: sqlite3.Database,
  });

  // Create tables for story and normal modes if they don't exist
  await db.exec(`
        CREATE TABLE IF NOT EXISTS story_leaderboard (
            username TEXT PRIMARY KEY,
            score INTEGER DEFAULT 0
        );
    `);

  await db.exec(`
        CREATE TABLE IF NOT EXISTS normal_leaderboard (
            username TEXT PRIMARY KEY,
            score INTEGER DEFAULT 0
        );
    `);

  console.log("Database and tables initialized or already exist.");

  return db;
};

initializeDB().catch(console.error);

const updateLeaderboard = async (
  username: string,
  isStoryMode: boolean,
  points: number
) => {
  const db = await open({
    filename: "./db/wstm-leaderboard.db",
    driver: sqlite3.Database,
  });

  const table = isStoryMode ? "story_leaderboard" : "normal_leaderboard";

  // Check if the user already has a score
  const user = await db.get(
    `SELECT * FROM ${table} WHERE username = ?`,
    username
  );

  console.log("User got points:", points)
  
  if (user) {
    // Update the score (increment by 1 for a correct guess)
    await db.run(
      `UPDATE ${table} SET score = score + ${points} WHERE username = ?`,
      username
    );
  } else {
    await db.run(
      `INSERT INTO ${table} (username, score) VALUES (?, ${points})`,
      username
    );
  }
};

const fetchLeaderboard = async (channel: string, client: any) => {
    const db = await open({
      filename: "./db/wstm-leaderboard.db",
      driver: sqlite3.Database,
    });
  
    // Fetch the top 5 players from the story leaderboard
    const storyLeaderboard = await db.all(
      "SELECT username, score FROM story_leaderboard ORDER BY score DESC LIMIT 5"
    );
  
    // Fetch the lowest-scoring player from the story leaderboard
    const lowestStoryPlayer = await db.all(
      "SELECT username, score FROM story_leaderboard ORDER BY score ASC LIMIT 1"
    );
  
    // Merge top 5 and lowest player (if needed) for story leaderboard
    if (!storyLeaderboard.some(player => player.username === lowestStoryPlayer[0].username)) {
      storyLeaderboard.push(lowestStoryPlayer[0]);
    }
  
    // Sort the final story leaderboard by score (descending)
    storyLeaderboard.sort((a, b) => b.score - a.score);
  
    // Fetch the top 5 players from the normal leaderboard
    const normalLeaderboard = await db.all(
      "SELECT username, score FROM normal_leaderboard ORDER BY score DESC LIMIT 5"
    );
  
    // Fetch the lowest-scoring player from the normal leaderboard
    const lowestNormalPlayer = await db.all(
      "SELECT username, score FROM normal_leaderboard ORDER BY score ASC LIMIT 1"
    );
  
    // Merge top 5 and lowest player (if needed) for normal leaderboard
    if (!normalLeaderboard.some(player => player.username === lowestNormalPlayer[0].username)) {
      normalLeaderboard.push(lowestNormalPlayer[0]);
    }
  
    // Sort the final normal leaderboard by score (descending)
    normalLeaderboard.sort((a, b) => b.score - a.score);
  
    // Combine and sum scores for the same users
    const scoreMap = new Map();
  
    [...storyLeaderboard, ...normalLeaderboard].forEach(({ username, score }) => {
      scoreMap.set(username, (scoreMap.get(username) || 0) + score);
    });
  
    // Convert map to sorted array
    const combinedLeaderboard = Array.from(scoreMap.entries())
      .map(([username, score]) => ({ username, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Limit to top 5 players
  
    // Final results
    console.log('Final Combined Leaderboard:', combinedLeaderboard);
  

  // Format the leaderboard for display
  const leaderboardMessage = combinedLeaderboard
    .map(
      (entry, index) =>
        `${index + 1}. ${entry.username}: ${Math.floor(entry.score * 25)}`
    )
    .join(" | ");

  client.say(channel, `o WSTM Leaderboard | ${leaderboardMessage}`);
};


const aiStory = async (username: string, message: string): Promise<string> => {
  try {
    const completion = await aiResponse(
      username, // User Name
      message, // User Message
      "ShyBoti", // AI Name
      storyContent, // AI Content
      "" // DB memory Name
    );

    return (
      completion ??
      "Sorry, ich konnte keine Geschichte generieren."
    );
  } catch (error) {
    console.error("Fehler beim Generieren der Geschichte:", error);
    return "Sorry, etwas ist schiefgelaufen!";
  }
};

const aiQuiz = async (username: string, message: string): Promise<string> => {
    try {
      const completion = await aiResponse(
        username, // User Name
        message, // User Message
        "ShyBoti", // AI Name
        quizContent, // AI Content
        "" // DB memory Name
      );
  
      return (
        completion ??
        "Sorry, ich konnte keine Geschichte generieren."
      );
    } catch (error) {
      console.error("Fehler beim Generieren der Geschichte:", error);
      return "Sorry, etwas ist schiefgelaufen!";
    }
  };

const activeGames = new Map();

export const commandName = {
    name: "wstm",
    handler: async (
      channel: string,
      userstate: ChatUserstate,
      args: string[],
      client: any
    ) => {
      const channelName = channel.replace("#", "");
      const isStoryMode = args.includes("story");
      const isQuizMode = args.includes("quiz"); // Ensure quiz mode is correctly identified
      let storyMode;
      let quizMode;
      let originalMessage;
      originalMessage = ""
  
      if (args.includes("lb")) {
        return fetchLeaderboard(channel, client);
      }
  
      // Remove story and quiz modes from arguments
      if (isStoryMode || isQuizMode) {
        args = args.filter((arg) => arg !== "story" && arg !== "quiz");
      }
  
      if (args.length === 0) {
        // No user guess, start the game
        if (activeGames.has(channel)) {
          return client.say(
            channel,
            "Hm Es läuft doch schon eine Runde? Rate mit +ws <user>"
          );
        }

        // Temporary game state tracking
        activeGames.set(channel, {});

        // Send first message instantly
        await client.say(
          channel,

            `${isStoryMode ? "Who sent this Message : Story" : isQuizMode ? "Who sent this Message : Quiz" : "Who sent this Message"} | 3 Versuche und ${
                isStoryMode ? "5" : isQuizMode ? "4" : "3"} Minuten | ${
                isStoryMode ? "+ws <user>" : isQuizMode ? "+ws <user>" : "+ws <user>"} |  COGGERS loading...`
        );

        const fetchRandomMessage = async (
          retries = 3
        ): Promise<string | null> => {
          if (retries <= 0) return null;
          try {
            const apiUrl = `https://logs.susgee.dev/channel/${channelName}/random`;
            const response = await fetch(apiUrl);
            if (!response.ok)
              throw new Error(`API Error: ${response.statusText}`);
            const textData = await response.text();
            if (
              textData.includes("susgeebot:") ||
              textData.includes("shyboti:") ||
              textData.includes("king_blau:") ||
              textData.includes("leaa021:") ||
              textData.includes(" has been") ||
              textData.includes(": +")
            ) {
              return fetchRandomMessage();
            }
            const match = textData.match(/\[(.*?)\] #[^ ]+ ([^:]+): (.+)/);
            if (!match) throw new Error("Unerwartetes Log-Format.");
            return textData;
          } catch (error) {
            console.error("Fehler beim Abrufen der Nachricht:", error);
            return fetchRandomMessage(retries - 1);
          }
        };

        const textData = await fetchRandomMessage();
        if (!textData)
          return client.say(channel, "Konnte keine gültige Nachricht abrufen.");

        const match = textData.match(/\[(.*?)\] #[^ ]+ ([^:]+): (.+)/);
        if (!match)
          return client.say(
            channel,
            "Fehler bei der Verarbeitung der Nachricht."
          );

        const rawTimestamp = match[1];
        const username = match[2]?.toLowerCase() ?? "";
        let message = match[3];
        const similarMessages = isQuizMode
          ? await aiQuiz(username, message)
          : [];

        // Handle story or quiz mode
        if (isStoryMode) {
          message = await aiStory(username, message);
        } else if (isQuizMode) {
          message = (similarMessages as string[]).join("\n");
        }

        const date = new Date(rawTimestamp);
        const formattedTimestamp = `${date
          .getDate()
          .toString()
          .padStart(2, "0")}.${(date.getMonth() + 1)
          .toString()
          .padStart(2, "0")}.${date.getFullYear()}, ${date.getHours()}:${date
          .getMinutes()
          .toString()
          .padStart(2, "0")}`;
        let hiddenMessage = `${formattedTimestamp} | x: ${message}`;

        activeGames.delete(channel); // Reset active games to prevent overlap

        // Check if the game is in story or quiz mode
        if (isStoryMode) {
            hiddenMessage = `${formattedTimestamp} | ${message}`;
            storyMode = true;
            originalMessage = match[3];
          } else if (isQuizMode) {
            hiddenMessage = `${formattedTimestamp} | ${username}: ${message}`;
            quizMode = true;
          }
    
          // Handle the user guesses
          if (quizMode) {
            client.on("message", (channel: string, userstate: ChatUserstate, message: string) => {
              const userGuess = message.toLowerCase().trim() ?? ""; 
              const userName = userstate.username; // Get the username
              if (
                userGuess === "1" ||
                userGuess === "2" ||
                userGuess === "3" ||
                userGuess === "4"
              ) {
                const correctAnswer = message.includes(game.originalMessage)
                  ? "4"
                  : "error"; // Check if the answer matches one of the four options
                const answer = correctAnswer === userGuess ? "✅" : "❌";
                client.say(
                  channel,
                  `${userName}, Deine Antwort: ${answer} ${
                    answer === "✅" ? "Es war richtig!" : "Es war falsch!"
                  }`
                );
                activeGames.delete(channel); // End game after the guess
            }
          });
        }

        await client.say(channel, `${hiddenMessage}`);

        // Set the time limit based on the mode
        let timeLimit = 60 * 1000;
        if (storyMode) {
          timeLimit = timeLimit * 5; // Longer time for story mode
        } else if (quizMode) {
          timeLimit = timeLimit * 4; // Shorter time for quiz mode
        } else {
          timeLimit = timeLimit * 3; // Normal time for other modes
        }

        if (activeGames.has(channel)) return;


        activeGames.set(channel, {
          username,
          originalMessage,
          message: hiddenMessage,
          tries: 0,
          storyMode,
          quizMode,
          startTime: Date.now(),
          timeLimit,
          guessedUsers: [],
          similarMessages, // Store similar messages for quiz mode
        });

        const game = activeGames.get(channel);
        if (game) {
          // Ensure the game object has a `timeLeft` property
          if (game.timeLeft !== undefined && game.timeLeft > 0) {
            game.timeLeft -= 1; // Decrease the time left by 1 second
          }
        
          if (game.timeoutId) {
            clearTimeout(game.timeoutId); // Clear the previous timeout if exists
          }
        
          // Set the new timeout to update the time every second
          game.timeoutId = setTimeout(() => {
            if (!activeGames.has(channel)) return;
        
            // Check if time has expired
            if (game.timeLeft <= 0) {
              activeGames.delete(channel);
        
              if (!game.storyMode) {
                client.say(
                  channel,
                  `Hm Zeit um! Es war: ${game.username.split(" ").join("\u200B")}`
                );
              } else {
                client.say(
                  channel,
                  `Hm Zeit um! Es war: ${game.username.split(" ").join("\u200B")} mit der Nachricht: ${game.originalMessage}`
                );
              }
            } else {
              // Continue updating time left every second
              game.timeLeft -= 1;
            }
          }, 1000); // This sets the timeout to update every second
        }
    }
  
      if (!activeGames.has(channel)) {
        return client.say(
          channel,
          "Kein aktives Spiel! Starte ein neues mit +ws oder +wss"
        );
      }
  
      const activeGame = activeGames.get(channel);
  
      // Guessing phase
      const guess = args[0].toLowerCase() ?? "";   

      const game = activeGames.get(channel);
      const elapsedTime = Date.now() - game.startTime;
      const timeLeft = Math.max(
        0,
        Math.floor((game.timeLimit - elapsedTime) / 1000)
      );
  
      if (game.guessedUsers.includes(guess)) {
        return client.say(
          channel,
          `arnoldHalt ${guess} wurde schon geschrieben. Bist du wirklich so unkreativ? DankStick`
        );
      }
  
      game.guessedUsers.push(guess);
  
      let points;
      switch (Number(game.tries)) {
        case 2:
            points = 0.25; // 3th Try
            break;
        case 1:
            points = 0.5; // 2nd Try
            break;
        case 0:
            points = 1; // First Try
            break;
        default:
            points = 0;
        
      }
  
      if (game.storyMode) {
        points = points * 1.25; // Bonus points for story mode
      }

    if (guess === game.username) {
      activeGames.delete(channel);
      if (userstate.username) {
        updateLeaderboard(userstate.username, game.storyMode, points);
      }
      if (!game.storyMode) {
        console.log(storyMode);
        return client.say(
          channel,
          `yippie ✅ Es war: ${game.username}`
     
        );
      } else {

        return client.say(
          channel,
          `yippie ✅ Es war: ${game.username
            .split(" ")
            .join("\u200B")} mit der Nachricht: ${game.originalMessage}`
        );
      }
    }

    game.tries++;

    if (game.tries >= 3) {
      activeGames.delete(channel);
      if (!game.storyMode) {
        return client.say(
          channel,
          `mistscheisse ❌ Verloren - Es war: ${game.username
            .split(" ")
            .join("\u200B")} | Nochmal:ㅤ+wsㅤoderㅤ+wssㅤ`
        );
      } else {
        return client.say(
          channel,
          `mistscheisse ❌ Verloren - Es war: ${game.username
            .split(" ")
            .join("\u200B")} mit der Nachricht: ${game.originalMessage}`
        );
      }
    }

    return client.say(channel, `NoNo ❌ [${game.tries}/3] [${timeLeft}s]`);
  },
};
