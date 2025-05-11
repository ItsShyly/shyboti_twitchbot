import { commands } from "../index"; // Import commands to execute them
import os from "os"; // For system-related info
import { ChatUserstate } from "tmi.js";

// Keep track of bot's start time
const botStartTime = Date.now();

// Get channels from the environment variable
const channels = process.env.CHANNELS?.split(',') || [];

function createMemoryBar(percent: number): string {
  const totalBlocks = 10;
  const filledBlocks = Math.round((percent / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;

  const bar = `[${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)}]`;
  let state = "Idle";

  if (percent >= 100) state = "Maxed out";
  else if (percent >= 80) state = "High load";
  else if (percent >= 60) state = "Active";
  else if (percent >= 40) state = "Moderate";
  else if (percent >= 20) state = "Low";

  return `${bar} ${percent.toFixed(0)}% — ${state}`;
}

export const ping = {
  name: "ping",
  handler: async (
    channel: string,
    userstate: ChatUserstate,
    args: string[],
    client: any
  ) => {
    if (args.length === 0) {
      // Calculate bot's uptime based on when the bot started
      const botUptime = Date.now() - botStartTime; // Bot uptime in milliseconds
      const uptimeHours = Math.floor(botUptime / 3600000); // Convert to hours
      const uptimeMinutes = Math.floor((botUptime % 3600000) / 60000); // Convert to minutes
      const uptimeSeconds = Math.floor((botUptime % 60000) / 1000); // Convert to seconds
      const formattedUptime = `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`;

      // Memory usage for StatX (percentage of memory used by the bot)
      const totalMemory = os.totalmem(); // Total system memory in bytes
      const freeMemory = os.freemem(); // Free system memory in bytes
      const usedMemoryPercentage = ((totalMemory - freeMemory) / totalMemory) * 100;
      const memoryUsagePercentage = usedMemoryPercentage.toFixed(2); // Percentage of used memory

      // Number of channels in the `CHANNELS` environment variable
      const activeChannelsCount = channels.length;

      await client.say(
        channel,
        `Bot Uptime: ${formattedUptime}, Memory Usage: ${memoryUsagePercentage}% (pc), Active Channels: ${activeChannelsCount} | Check command ping: +ping <command>`
      );
      return;
    }

    let commandName;

    // Ensure args[0] is defined before calling toLowerCase()
    if (!args[0]) {
      console.log("1:", args[0])
    } else {
      commandName = args[0]?.toLowerCase();
      console.log("2:", commandName)

    }

    if (!commandName || !commands[commandName]) {
      await client.say(channel, `Command "${commandName}" not found.`);
      return;
    }

    console.log("0-did that work? ")

  

    
    
    console.log("1-did that work? ")

    const startTime = performance.now(); // Start timing

    // Track memory usage before executing the command (just for the current process)
    const startMemory = process.memoryUsage().heapUsed;

    console.log("2-did that work? ")


    try {
      console.log("2-did that work? ")

      await commands[commandName](channel, userstate, args.slice(1), client);
    } catch (error) {
      console.error(`Error executing command "${commandName}":`, error);
      await client.say(channel, `Error executing command "${commandName}".`);
      return;
    }

    console.log("3-did that work? ")


    const endTime = performance.now(); // End timing

    // Track memory usage after executing the command
    const endMemory = process.memoryUsage().heapUsed;

    // Calculate the time it took to execute the command
    const timeTakenMs = endTime - startTime;
    const timeSeconds = timeTakenMs / 1000; // Convert to seconds
    let formattedTime: string;

    // If the time is less than 1 second, show milliseconds
    if (timeSeconds < 1) {
      formattedTime = `${Math.round(timeTakenMs)}ms`; // Show time in ms
    } else {
      // If time is 1 second or more, show it in seconds with one decimal place
      formattedTime = `${timeSeconds.toFixed(1)}s`; // Show time in seconds with decimal precision
    }

   // Calculate the memory used by just this command execution
   const commandMemoryUsage = endMemory - startMemory;
   const commandMemoryUsageKB = (commandMemoryUsage / 1024); // in KB

   // Debug: Check the memory usage
   console.log("Memory used by command:", commandMemoryUsageKB, "KB");

   // Calculate the percentage of total system memory this command used
   const memoryDeltaPercent = Math.max((commandMemoryUsageKB / 1024) * 100, 1); // Minimum 1% for visibility

   const memoryBar = createMemoryBar(memoryDeltaPercent);

   // Display command stats including the size of the command object itself
   await client.say(
     channel,
     `command=${commandName} | memoryUsage=${memoryBar} (+${commandMemoryUsageKB.toFixed(1)}KB) | time=${formattedTime}`
   );
  },
};
