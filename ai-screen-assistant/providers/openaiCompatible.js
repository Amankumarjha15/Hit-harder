/**
 * providers/openaiCompatible.js
 * Groq, OpenRouter, and DeepSeek all expose an OpenAI-compatible
 * /chat/completions endpoint, so they share this single implementation
 * instead of duplicating the request/response handling three times.
 */
import { AIProviderError, errorFromStatus, ERROR_TYPES } from '../utils/errors.js';

export async function analyzeImageOpenAICompatible({
  apiKey, model, imageDataUrl, systemPrompt, userPrompt, signal,
  baseUrl, providerLabel, extraHeaders = {}
}) {
  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders
      },
      signal,
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt || 'Analyze this screenshot.' },
              { type: 'image_url', image_url: { url: imageDataUrl } }
            ]
          }
        ]
      })
    });
  } catch (err) {
    throw new AIProviderError(`Could not reach ${providerLabel}: ${err.message}`, { type: ERROR_TYPES.NETWORK });
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw errorFromStatus(response.status, providerLabel, bodyText);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new AIProviderError(`${providerLabel} returned an empty response.`, { type: ERROR_TYPES.UNKNOWN });
  }
  return text;
}
