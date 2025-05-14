import axios from 'axios';
import dotenv from "dotenv";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import type { ChatUserstate } from "tmi.js";

dotenv.config();


const OPEN_CAGE_API_KEY = process.env.OPENCAGE_API_KEY;


const getCoordinatesFromAPI = async (location: string) => {
  if (!location || typeof location !== 'string' || location.trim().length === 0) {
    console.error("Invalid location provided.");
    return null;
  }
  console.log("trying to add:", location)

  const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(location)}&key=${OPEN_CAGE_API_KEY}&language=en&no_annotations=1&roadinfo=1&address_only=1`;

  try {
    const response = await axios.get(url);
    if (response.data.results.length > 0) {
      const { lat, lng } = response.data.results[0].geometry;
      return { lat, lon: lng };
    }
  } catch (error) {
    console.error("Error fetching coordinates:", error);
  }

  return null;
};


const getRandomLocation = async () => {
  const db = await getDB('geo-locations.db');
  const randomLocation = await db.get("SELECT * FROM locations ORDER BY RANDOM() LIMIT 1");
  await db.close();

  if (!randomLocation) {
    console.error("No location found in the database.");
    return null;
  }

  // Fetch the coordinates again from the API based on the stored full location string
  const coordinates = await getCoordinatesFromAPI(randomLocation.location);  // Use the full location string
  if (!coordinates) {
    console.error(`Could not get coordinates for ${randomLocation.location}`);
    return null;
  }

  const { lat, lon } = coordinates;

  return {
    location: randomLocation.location,  // Return the full location string
    lat,
    lon,
    imgur: randomLocation.imgur
  };
};


// Sanitize matchId by removing or replacing any invalid characters
const sanitizeMatchId = (matchId: string) => {
  return matchId.replace(/[^a-zA-Z0-9_]/g, '_');  // Replace all non-alphanumeric characters with underscores
};

// Function to generate a new match ID
const generateMatchId = async () => {
  const today = new Date();
  const datePrefix = `${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;

  const db = await getDB('geo-matches.db');
  const tables = await db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'match_${datePrefix}_%'`);
  await db.close();

  if (tables.length === 0) {
    return `${datePrefix}_1`;  // If no tables exist, start with _1
  }

  const lastMatchId = tables.map(table => {
    const parts = table.name.split('_');
    const incrementalId = parseInt(parts[2], 10);  // Get the last part as incremental ID
    return incrementalId;
  }).sort((a, b) => b - a)[0];  // Sort and get the highest number

  // Generate the next match ID (increment by 1)
  const nextMatchId = lastMatchId + 1;

  return `${datePrefix}_${nextMatchId}`;
};

// Database setup for geo-locations and geo-matches
const getDB = async (dbName: string) => {
  const db = await open({
    filename: `./db/${dbName}`,
    driver: sqlite3.Database
  });

  if (dbName === 'geo-locations.db') {
    await db.run(`
      CREATE TABLE IF NOT EXISTS locations (
        imgur TEXT PRIMARY KEY,
        location TEXT,  -- Combined column for full location
        lat REAL,
        lon REAL
      );
    `);
  } else if (dbName === 'geo-matches.db') {
    // empty
  }

  return db;
};


// For each match, create a table to store user guesses
// For each match, create a table to store user guesses
const createMatchTable = async (matchId: string) => {
  const sanitizedMatchId = sanitizeMatchId(matchId);  // Ensure sanitized matchId

  const db = await getDB('geo-matches.db');
  await db.run(`
    CREATE TABLE IF NOT EXISTS match_${sanitizedMatchId} (
      user TEXT,
      location TEXT,
      distance REAL,
      match_location TEXT
    );
  `);
  await db.close();
};

const manageLocation = async (command: string, location: string, imgur: string = '') => {
  const db = await getDB('geo-locations.db');

  if (command === 'add') {
    // Ensure the location does not accidentally have the imgur link removed or altered
    const filteredLocation = location.trim();

    // If an imgur link is provided, add it as imgur column in the DB
    if (imgur && imgur.match(/https?:\/\/(www\.)?imgur\.com\/[a-zA-Z0-9]+/)) {
      // Fetch coordinates using the API for the filtered location
      const coordinates = await getCoordinatesFromAPI(filteredLocation);
      if (!coordinates) {
        console.error("Could not find coordinates for the provided location.");
        return;
      }

      const { lat, lon } = coordinates;

      // Store the full location string along with coordinates and imgur link
      await db.run(`
        INSERT INTO locations (imgur, location, lat, lon) 
        VALUES (?, ?, ?, ?)`,
        [imgur, filteredLocation, lat, lon]
      );
      console.log(`Location ${filteredLocation} with imgur ${imgur} added to the database.`);
    } else {
      console.error("Invalid imgur link provided:", imgur);
    }
  } else if (command === 'remove') {
    await db.run(`DELETE FROM locations WHERE imgur = ?`, [imgur]);
    console.log(`Location with imgur ${imgur} removed from the database.`);
  }
  await db.close();
};



export const commandGeo = {
  name: "geo",
  handler: async (channel: string, userstate: ChatUserstate, args: string[], client: any) => {
    const command = args[0];

    if (command === "play" && !gameActive) {
      const matchId = await generateMatchId();
      currentLocation = await getRandomLocation();
      if (!currentLocation) {
        return client.say(channel, "No locations available in the database.");
      }
      gameActive = true;
      guesses = [];
      client.say(channel, `New round started! Match ID: ${matchId} | Guess the location: ${currentLocation.imgur} | 2.5mins time | +geo guess oder +gg <guess>| Du kannst max. 5 guess Angaben machen, egal ob Stadt, Land, Region oder Straße. Bsp: +gg Uganda Kampala `);

      gameTimers[matchId] = 150;

      // Inside the game interval logic
      gameIntervals[matchId] = setInterval(() => {
        gameTimers[matchId] -= 1;

        if (gameTimers[matchId] === 60) {
          client.say(channel, "Nur noch 60 sekunden");
        }

        if (gameTimers[matchId] === 30) {
          client.say(channel, "Nur noch 30 sekunden");
        }

        if (gameTimers[matchId] <= 0) {
          clearInterval(gameIntervals[matchId]);
          endGame(channel, client, matchId);
        }
      }, 1000);
    } else if (command === "guess" && gameActive) {
      const matchId = Object.keys(gameIntervals)[0]; // Automatically associates guesses with the current active match
      if (!currentLocation || !matchId) return;

      const guess = args.slice(1).join(" ").toLowerCase();  // Combine all parts into one location guess
      if (guess) {
        // Fetch coordinates for the guess
        const coordinates = await getCoordinatesFromAPI(guess);
        if (!coordinates) {
          client.say(channel, "Hm Konnte dort keine cords finden, versuchs mal anders zu schreiben ");
          return;
        }

        const distance = await calculateDistance(
          coordinates.lat, coordinates.lon, currentLocation.lat, currentLocation.lon
        );

        const userGuesses = guesses.filter(g => g.user === userstate.username).length;
        if (userGuesses >= 5) {
          client.say(channel, `${userstate.username}, you've already made 5 guesses!`);
          return;
        }

        guesses.push({
          matchId,
          user: userstate.username ?? "UnknownUser",
          location: guess,  // The guess will be the full location
          distance
        });
        client.say(channel, `${userstate.username} guessed ${guess}!`);

        if (gameTimers[matchId] > 30) {
          gameTimers[matchId] = 30;
          client.say(channel, "Noch 30 Sekunden - Jemand hat geguessed");
        }
      } else {
        client.say(channel, "Bitte gib deinen Guess im richtigen Format ein, z.B. +gg Uganda, Kampala");
      }
    } else if (command === "logs") {
      const matchId = args[1] || "all";
      if (matchId === "all") {
        client.say(channel, "Showing all game logs...");
        await showAllGameLogs(channel, client);
      } else {
        client.say(channel, `Logs for Match ID ${matchId}:`);
        await showGameLogs(channel, client, matchId);
      }
    } else if (command === "add" || command === "remove") {
      const location = args.slice(2).join(" ");
      const imgur = args[1];  // The link parameter
      console.log("Imgur:", imgur)
      if (command === 'add') {
        await manageLocation(command, location, imgur);
        client.say(channel, `Location ${location} added.`);
      } else if (command === 'remove') {
        await manageLocation(command, location, imgur);
        client.say(channel, `Location with imgur ${imgur} removed.`);
      }
    }
  },
};

const showAllGameLogs = async (channel: string, client: any) => {
  const db = await getDB('geo-matches.db');
  const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");

  const tableNames = tables.map(table => table.name).join(", ");
  client.say(channel, `Tables in the database: ${tableNames}`);
};

const showGameLogs = async (channel: string, client: any, matchId: string) => {
  const db = await getDB('geo-matches.db');
  const logs = await db.all(`SELECT * FROM match_${matchId}`);
  await db.close();

  const formattedLogs = logs.map(log => {
    return `${log.user} guessed ${log.location} (${log.distance} km) - Correct Location: ${log.match_location}`;
  }).join(' | ');

  client.say(channel, formattedLogs);
};


const endGame = async (channel: string, client: any, matchId: string) => {
  if (!gameActive) return;
  gameActive = false;
  const sanitizedMatchId = sanitizeMatchId(matchId);  // Ensure sanitized matchId

  if (gameIntervals[matchId]) {
    clearInterval(gameIntervals[matchId]);
  }

  if (guesses.length === 0) {
    return client.say(channel, "No one guessed. The game has ended.");
  }

  const winner = guesses.reduce((prev, curr) => (prev.distance < curr.distance ? prev : curr), guesses[0]);
  const sortedGuesses = guesses.sort((a, b) => a.distance - b.distance);
  let results = sortedGuesses.map((guess, index) => `${index + 1}: ${guess.user} (${guess.distance.toFixed(2)} km)`).join(' | ');

  client.say(channel, `yippie Win: ${winner.user} mit ${winner.distance.toFixed(2)}km Abstand | Location: ${currentLocation.location} | Results: ${results}`);

  await createMatchTable(sanitizedMatchId);

  const db = await getDB('geo-matches.db');
  for (const guess of guesses) {
    await db.run(`
      INSERT INTO match_${sanitizedMatchId} (user, location, distance, match_location) 
      VALUES (?, ?, ?, ?)`,
      [guess.user, guess.location, guess.distance, currentLocation.location]
    );
  }
  await db.close();
};


const calculateDistance = async (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const R = 6371; // Radius of the Earth in km

  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};



const toRadians = (deg: number) => deg * (Math.PI / 180);

let gameActive = false;
let currentLocation: any = null;
let guesses: any[] = [];
let gameTimers: { [key: string]: number } = {}; // Track timer for each match
let gameIntervals: { [key: string]: NodeJS.Timeout } = {}; // Track intervals for each match
