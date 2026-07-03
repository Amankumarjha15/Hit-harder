/**
 * providers/anthropic.js
 * Uses the Messages API with a base64 image content block.
 * Note: api.anthropic.com requires the "anthropic-dangerous-direct-browser-access"
 * header to allow calls directly from a browser extension context instead of a
 * backend server, since the standard SDK assumes server-side use.
 */
import { AIProviderError, errorFromStatus, ERROR_TYPES } from '../utils/errors.js';
import { parseDataUrl } from '../utils/imageUtils.js';

export async function analyzeImage({ apiKey, model, imageDataUrl, systemPrompt, userPrompt, signal }) {
  const { mediaType, base64 } = parseDataUrl(imageDataUrl);

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      signal,
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: userPrompt || 'Analyze this screenshot.' }
            ]
          }
        ]
      })
    });
  } catch (err) {
    throw new AIProviderError(`Could not reach Anthropic: ${err.message}`, { type: ERROR_TYPES.NETWORK });
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw errorFromStatus(response.status, 'Anthropic', bodyText);
  }

  const data = await response.json();
  const text = data?.content?.find((c) => c.type === 'text')?.text;
  if (!text) {
    throw new AIProviderError('Anthropic returned an empty response.', { type: ERROR_TYPES.UNKNOWN });
  }
  return text;
}
