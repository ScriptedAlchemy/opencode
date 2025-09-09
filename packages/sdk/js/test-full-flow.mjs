#!/usr/bin/env node

/**
 * Test full SDK flow:
 * 1. Start server
 * 2. Create session
 * 3. Launch TUI with that session
 * 4. Append prompt via SDK
 */

import { createOpencodeClient } from './src/client.ts';
import { createOpencodeTui } from './src/server.ts';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(url, maxAttempts = 30, interval = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url + '/doc');
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    await sleep(interval);
  }
  return false;
}

async function main() {
  let tui;
  let client;
  const port = 4096;
  const hostname = '127.0.0.1';
  const serverUrl = `http://${hostname}:${port}`;

  // Step 1: Launch TUI with specific port (TUI starts its own server)
  tui = createOpencodeTui({
    port: port,
    hostname: hostname,
    project: process.cwd(),
    model: 'github/gpt-4o',
    config: {}
  });

  // Wait for TUI server to be ready
  const serverReady = await waitForServer(serverUrl);
  if (!serverReady) {
    tui.close();
    process.exit(1);
  }

  // Step 2: Create client to connect to TUI's server
  client = createOpencodeClient({
    baseUrl: serverUrl,
    responseStyle: 'data'
  });

  // Step 3: Create session via the TUI's server
  const session = await client.session.create({
    body: {
      title: 'Test Session with Pre-populated Error Context'
    }
  });

  // Step 3.5: Set the session in the TUI
  console.log('Setting session in TUI...');
  await client.tui.setSession({
    body: { sessionId: session.id }
  });
  console.log('Session set in TUI');

  // Step 4: Append prompt via SDK to the TUI
  const promptText = `I encountered an error while running the wiggum CLI:

Error: Command failed with exit code 1
  at /Users/bytedance/wiggum/packages/cli/src/agent.ts:95

Please help me debug this issue.`;

  console.log('Session ID:', session.id);
  console.log('Appending prompt...');
  await client.tui.appendPrompt({
    body: { text: promptText }
  });
  console.log('Prompt appended');

  // Wait a bit before submitting
  await sleep(2000);

  // Step 5: Submit the prompt
  try {
    console.log('Calling submitPrompt...');
    const submitResult = await client.tui.submitPrompt();
    console.log('Submit result:', submitResult);
  } catch (error) {
    console.log('Submit error:', error.message);
  }

  // Wait a bit before showing toast
  await sleep(1000);

  // Step 6: Show success toast
  try {
    await client.tui.showToast({
      body: {
        message: 'Test completed successfully! Prompt has been submitted.',
        variant: 'success',
        title: 'SDK Test'
      }
    });
  } catch (error) {
    // Silent error handling
  }

  // Try other TUI operations
  try {
    await client.tui.executeCommand({
      body: { command: 'agent_cycle' }
    });
  } catch (error) {
    // Silent error handling
  }

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    if (tui) {
      tui.close();
    }
    process.exit(0);
  });

  // Keep alive
  await new Promise(() => {});
}

// Run the test
main().catch(error => {
  process.exit(1);
});