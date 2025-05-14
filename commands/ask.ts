import { ChatClient } from "@twurple/chat";

export const ask = {
  name: "ask",
  handler: async (
    channel: string,
    userstate: any,
    args: string[],
    client: ChatClient
  ) => {
    // Default responses for general questions
    const responses = [
      "Nö.", "Schnauze.", "Fiddy", "Frag später nochmal.",
      "JAAA auf jeden Fall.", "Keine Ahnung", "Vielleicht, aber eher nicht",
      "YesYes", "NoNo", "Frag nochmal Hihi", "Frag mich nicht, frag Google",
      "Ja, aber nur wenn du es wirklich fühlst.", "Warum fragst du MICH das?",
      "UHM besser nicht.", "Tendenziell ja.", "Wahrscheinlich eher nein.",
      "50/50 würde ich sagen, oder? haha", "Ja, aber erst morgen.",
      "Lass das lieber.", "Jein", "Muss das sein?",
      "Vielleicht, aber du wirst es bereuen.", "joa ", "Vielleicht",
      "Neee.", "Klar!", "Heute nicht.", "Du weißt die Antwort doch selbst.",
      "Hmm… das ist ein klares Vielleicht.", "Nicht mal ansatzweise.",
      "Das Universum sagt nein.", "Du hast zu viele Fragen.",
      "Nur wenn du mir eine Pizza bringst.", "Wirklich? Das willst du wissen?",
      "Vielleicht, wenn du Glück hast.", "Warum nicht?", "Absolut nicht.",
      "Ja, aber nur unter bestimmten Bedingungen.", "Ich würde es lassen.",
      "Dazu kann ich nichts sagen.", "Glaub an dich selbst, dann ja.",
      "Ich sag mal: nö", "100% ja!", "???", "arnoldHalt", "ApuApproved",
      "OK", "catAsk was sagst du selbst dazu?", "Ja"
    ];

    // Ensure the user has asked a question
    if (args.length === 0) {
      await client.say(channel, "Du musst schon eine Frage stellen mad");
      return;
    }

    // Clean and debug the input
    const input = args.join(" ").trim();
    console.log("[Debug] Input:", input);

    // Reject input that consists only of numbers
    if (/^\d+(\s\d+)*$/.test(input)) {
      await client.say(channel, "Ich kann nur mit Ja oder Nein antworten Saj");
      return;
    }

    // Handle "oder" (or) input
    if (input.toLowerCase().includes("oder")) {
      const options = input.split(/\s*oder\s*/).map(opt => opt.trim());
      console.log("[Debug] Raw options:", options);

      // If the question ends with "oder"
      if (input.toLowerCase().endsWith("oder")) {
        const response = responses[Math.floor(Math.random() * responses.length)];
        await client.say(channel, response);
        return;
      }

      const processedOptions = options.map((option, index) => {
        option = option.replace("?", "").trim();

        // Extract first number-word combination (if present)
        let matches = option.match(/(\d+\s+[a-zA-ZäöüßÄÖÜ]+)/);
        if (matches) {
          return matches[1].trim();
        }

        // Otherwise, get the last standalone word (based on position)
        const words = option.split(/\s+/);
        if (words.length > 1) {
          if (index === 0) {
            return words[words.length - 1]; // Before "oder"
          } else {
            return words[words.length - 2]; // After "oder"
          }
        }

        return option;
      }).filter(Boolean); // Remove any empty values

      console.log("[Debug] Processed options:", processedOptions);

      if (processedOptions.length >= 2) {
        const choice = processedOptions[Math.floor(Math.random() * processedOptions.length)];
        console.log("[Debug] Chosen option:", choice);
        await client.say(channel, choice);
        return;
      }
    }

    // If no "oder" handling was needed, just return a random response
    const reply = responses[Math.floor(Math.random() * responses.length)];
    console.log("[Debug] Random response:", reply);
    await client.say(channel, reply);
  }
};
