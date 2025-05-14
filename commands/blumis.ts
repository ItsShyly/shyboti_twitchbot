import path from 'path';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { ChatUserstate } from 'tmi.js';

// Initialize the database
async function initDB() {
  const dbPath = path.resolve('./db/blumisProgress.db');
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  return db;
}

// Daily motivation messages based on flowers
const flowerMessages: { [key: string]: string } = {
  "🌸": "Wie eine Kirschblüte, zart und rein, bringst du Freude und Glück in unser Leben hinein.",
  "🌺": "Exotisch und strahlend, wie eine Hibiskusblüte, bist du ein Blickfang in jeder Minute.",
  "🌻": "Heute bist du meine Sonne, an die ich mich orientier, mit dir wird jeder Tag ein bisschen schöner hier.",
  "🌼": "Wie ein Gänseblümchen, so frisch und klar, bringst du Leichtigkeit, wohin du auch fährst.",
  "🌷": "Wie eine Tulpe, bunt und fein, lässt du die Welt in Farben erstrahlen, ganz allein.",
  "💐": "Ein Strauß Blumis, so voller Leben und Licht, er bringt dir Freude und ein Lächeln im Gesicht.",
  "🪷": "Wie eine Lotosblume, stark und rein, überwindest du alles und strahlst so fein.",
  "🏵️": "Diese Blume zieht besonderes an, das zeigt, dass du eine tolle Person bist und besonderes kannst.",
  "🌹": "Rosen sind rot, Veilchen sind blau, dein Tag wird toll, ich sag nur vertrau.",
  "🥀": "Selbst an grauen Tagen bleibst du toll, merk dir das."
};


// Command handler
export const commandName = {
  name: 'blumis',
  handler: async (channel: string, userstate: ChatUserstate, args: string[], client: any) => {
    // Ensure username is always a valid string
    const username = (userstate['display-name'] || userstate.username || "").toLowerCase();

    // Debugging logs
    console.log(`User command received: ${username}`);

    if (!username) {
      console.error("Error: Username is undefined!");
      return;
    }

    // Prevent SQL injection risk by ensuring a valid table name
    const sanitizedUsername = username.replace(/[^a-zA-Z0-9_]/g, '');


    // Handle daily case
    if (args.length > 0 && args[0].toLowerCase() === 'daily') {
      const db = await initDB();

      await db.exec(`
        CREATE TABLE IF NOT EXISTS ${sanitizedUsername} (
          flowers TEXT,
          timestamp INTEGER,
          message TEXT
        );
      `);

      const todayTimestamp = Math.floor(Date.now() / 86400000);
      const result = await db.get(
        `SELECT * FROM ${sanitizedUsername} WHERE timestamp = ? ORDER BY timestamp DESC LIMIT 1`,
        todayTimestamp
      );

      if (result) {
        const flowers = result.flowers;
        const flowerCounts = flowers.split(" ").reduce((acc: any, flower: string) => {
          acc[flower] = (acc[flower] || 0) + 1;
          return acc;
        }, {});

        const mostFrequentFlower = Object.keys(flowerCounts).reduce((a, b) =>
          flowerCounts[a] > flowerCounts[b] ? a : b
        );
        const motivationMessage = flowerMessages[mostFrequentFlower] || "Du bist wundervoll, genau wie deine blumis!";

        await client.say(channel, `${username}, du hast schon deine tägliche Dosis an blumis erhalten! Deine daily Blumi war: ${mostFrequentFlower} (${flowerCounts[mostFrequentFlower]}x) ${motivationMessage}`);
        return;
      }

      const flowerOptions = ["🌸", "🌺", "🌻", "🌼", "🌷", "💐", "🪷", "🪴", "🏵️", "🌹", "🥀"];
      const flowerCount = Math.floor(Math.random() * (25 - 1 + 1)) + 1;
      const flowers = ["🌹"].concat(
        Array.from({ length: flowerCount - 1 }, () =>
          flowerOptions[Math.floor(Math.random() * flowerOptions.length)]
        )
      ).join(" ");

      await db.run(
        `INSERT INTO ${sanitizedUsername} (flowers, timestamp, message) VALUES (?, ?, ?)`,
        flowers,
        Date.now(),
        `${username} aliner BlumiFürDich ${flowers} (${flowerCount})`
      );

      const flowerCounts = flowers.split(" ").reduce((acc: any, flower: string) => {
        acc[flower] = (acc[flower] || 0) + 1;
        return acc;
      }, {});

      const mostFrequentFlower = Object.keys(flowerCounts).reduce((a, b) =>
        flowerCounts[a] > flowerCounts[b] ? a : b
      );
      const motivationMessage = flowerMessages[mostFrequentFlower] || "Du bist wundervoll, genau wie deine blumis!";
      const randomEmote = ["ActinUp", "flushE", "wowie", "shy", "YesYes", "okak"][Math.floor(Math.random() * 4)];

      await client.say(channel, ` ${username} BlumiFürDich ${flowers} (${flowerCount}). Deine häufigste Blumi war: ${mostFrequentFlower} (${flowerCounts[mostFrequentFlower]}x). ${motivationMessage} ${randomEmote}`);
    } else {
      // Normal Blumis command
      const flowerOptions = ["🌸", "🌺", "🌻", "🌼", "🌷", "💐", "🪷", "🪴", "🏵️", "🌹", "🥀", "🌹", "🌹", "🌹"];
      const flowerCount = Math.floor(Math.random() * (25 - 1 + 1)) + 1;
      const flowers = ["🌹"].concat(
        Array.from({ length: flowerCount - 1 }, () =>
          flowerOptions[Math.floor(Math.random() * flowerOptions.length)]
        )
      ).join(" ");

      await client.say(channel, `${username} aliner BlumiFürDich ${flowers} (${flowerCount})`);
      console.log(`Send: ${channel} ${username} aliner BlumiFürDich ${flowers} (${flowerCount})`)
    }
  },
};
