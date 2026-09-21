'use strict';

const crypto = require('node:crypto');

const DEFAULT_WORKER_URL = 'https://great-class-quest-ai-proxy.nvasedis-cc5.workers.dev';
const CHAT_MODEL = 'deepseek/deepseek-v4-flash';

function workerUrl() {
  return String(process.env.GCQ_AI_PROXY_URL || DEFAULT_WORKER_URL).replace(/\/$/, '');
}

function serviceKey() {
  return String(process.env.GCQ_AI_SERVICE_KEY || '').trim();
}

function extractJsonFromAiText(text) {
  let cleaned = String(text || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (_) { /* fall through */ }
  const arrStart = cleaned.indexOf('[');
  const arrEnd = cleaned.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      return JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
    } catch (_) { /* fall through */ }
  }
  throw new SyntaxError(`Could not extract JSON from AI response: ${cleaned.slice(0, 120)}`);
}

async function shopAiFetch(payload, { expect = 'json' } = {}) {
  const key = serviceKey();
  if (!key) throw new Error('GCQ_AI_SERVICE_KEY is not configured.');
  const requestId = crypto.randomUUID();
  const response = await fetch(workerUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GCQ-Service-Key': key,
      'X-GCQ-Request-ID': requestId
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`Shop AI proxy failed (${response.status})`);
    error.status = response.status;
    error.detail = detail.slice(0, 300);
    throw error;
  }
  if (expect === 'bytes') return Buffer.from(await response.arrayBuffer());
  return response.json();
}

async function shopAiChat(systemPrompt, userPrompt) {
  const payload = {
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: String(systemPrompt || '').slice(0, 8000) },
      { role: 'user', content: String(userPrompt || '').slice(0, 8000) }
    ],
    max_tokens: 1200
  };
  const body = await shopAiFetch(payload, { expect: 'json' });
  const content = body?.choices?.[0]?.message?.content
    || body?.response
    || '';
  return String(content || '').trim();
}

async function shopAiImage(prompt, negativePrompt = '', options = {}) {
  const width = Number(options.width) || 1024;
  const height = Number(options.height) || 1024;
  return shopAiFetch({
    prompt: String(prompt || '').slice(0, 5000),
    negative_prompt: String(negativePrompt || '').slice(0, 2000),
    num_steps: Number(options.num_steps) || 20,
    guidance: Number(options.guidance) || 7.5,
    width,
    height
  }, { expect: 'bytes' });
}

function simpleHashCode(value) {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

module.exports = {
  extractJsonFromAiText,
  shopAiChat,
  shopAiImage,
  simpleHashCode,
  serviceKey
};
