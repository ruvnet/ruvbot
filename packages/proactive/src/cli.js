#!/usr/bin/env node
import { ProactiveBot, replay } from './index.js';
import { createMetaHarness } from './metaharness.js';
const command = process.argv[2];
if (command === 'doctor') console.log(JSON.stringify(await createMetaHarness(), null, 2));
else if (command === 'demo') {
  const bot = new ProactiveBot();
  const events = [
    { id: 'checkout-500', source: 'monitor', floor: 'P0', observedAt: Date.now(), body: 'Checkout unavailable' },
    { id: 'bot-pr', source: 'github', floor: 'P2', observedAt: Date.now(), body: 'Routine dependency update' }
  ];
  console.log(JSON.stringify({ shadow: true, decisions: replay(bot, events), audit: bot.audit }, null, 2));
} else { console.error('Usage: ruvbot-proactive demo|doctor'); process.exitCode = 1; }
