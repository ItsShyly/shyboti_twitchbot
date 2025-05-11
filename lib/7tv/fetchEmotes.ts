// lib/7tv/emoteUtils.ts
import sqlite3 from "sqlite3";
import { open } from "sqlite";

let emoteCollection: string[] = [];

export async function getEmoteSet(channel: string): Promise<string | null> {
  const db = await open({
    filename: './db/7tvConfig.db',
    driver: sqlite3.Database,
  });

  const result = await db.get('SELECT emoteSetId FROM EmoteConfig WHERE channel = ?', [channel]);
  return result ? result.emoteSetId : null;
}

export async function fetchEmotesFromSet(emoteSetId: string): Promise<string[]> {
  try {
    const response = await fetch(`https://7tv.io/v3/emote-sets/${emoteSetId}`);
    const data = await response.json();

    emoteCollection = data.emotes.map((emote: any) => emote.name);
    return emoteCollection;
  } catch (error) {
    console.error("Error fetching emotes:", error);
    return [];
  }
}

export function getCachedEmotes(): string[] {
  return emoteCollection;
}
