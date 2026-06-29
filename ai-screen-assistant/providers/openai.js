/**
 * providers/openai.js
 * Uses the Chat Completions API with an image_url content part (data URL is
 * accepted directly, so no separate upload step is needed).
 */
import { AIProviderError, errorFromStatus, ERROR_TYPES } from '../utils/errors.js';

export async function analyzeImage({ apiKey, model, imageDataUrl, systemPrompt, userPrompt, signal }) {
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
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
    throw new AIProviderError(`Could not reach OpenAI: ${err.message}`, { type: ERROR_TYPES.NETWORK });
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw errorFromStatus(response.status, 'OpenAI', bodyText);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new AIProviderError('OpenAI returned an empty response.', { type: ERROR_TYPES.UNKNOWN });
  }
  return text;
}
