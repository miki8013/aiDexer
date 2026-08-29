#!/usr/bin/env node
/**
 * Standalone Gemini key validator.
 *
 * Usage:  node test-gemini-key.cjs [optional-key]
 *         (with no argument it reads GEMINI_API_KEY from .env)
 *
 * Run this BEFORE putting a new key in .env. It tells you exactly
 * whether Google will accept the key, and if not, why.
 */

const fs = require('fs');
const path = require('path');

const key = process.argv[2] || readKeyFromEnv();
if (!key) {
  console.error('No key given and no GEMINI_API_KEY found in .env');
  process.exit(1);
}

console.log(`Key: ${key.slice(0, 8)}...${key.slice(-4)} (${key.length} chars)\n`);

const MODELS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.5-flash'];

function readKeyFromEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return null;
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('GEMINI_API_KEY='));
  return line ? line.split('=')[1].trim() : null;
}

async function testModel(model) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Reply with only: [1,2,3]' }] }],
        generationConfig: { maxOutputTokens: 32 },
      }),
    }
  );

  const body = await res.json().catch(() => ({}));

  if (res.ok) {
    const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
    console.log(`  ${model}: ✅ WORKS — model replied: "${text.trim().slice(0, 60)}"`);
    return true;
  }

  const msg = body?.error?.message || res.statusText;
  console.log(`  ${model}: ❌ HTTP ${res.status} — ${msg}`);
  if (body?.error?.status) console.log(`    status: ${body.error.status}`);
  return false;
}

(async () => {
  let anyWorks = false;
  for (const model of MODELS) {
    try {
      if (await testModel(model)) anyWorks = true;
    } catch (e) {
      console.log(`  ${model}: ❌ network error — ${e.message}`);
    }
  }

  console.log('\n--- Diagnosis ---');
  if (anyWorks) {
    console.log('✅ At least one model works. Put this key in .env as:');
    console.log('   GEMINI_API_KEY=' + key);
    console.log('Then restart the dev server and flip the "Use AI" toggle.');
  } else {
    console.log('❌ No model accepted this key. Common causes:');
    console.log('  • 403 "project denied access" → the PROJECT is blocked by Google.');
    console.log('    Create a NEW project in AI Studio, make the key there, wait a');
    console.log('    few minutes, and test again. If it persists, the ACCOUNT is');
    console.log('    flagged — try a different Google account or contact support.');
    console.log('  • 400 API_KEY_INVALID → the key was copied incompletely.');
    console.log('  • 429 → rate limited; wait a minute and retry.');
    console.log('\nWhen contacting support include: this exact error payload,');
    console.log('project ID, and the timestamp of your first API call.');
  }
})();
