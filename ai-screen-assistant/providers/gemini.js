/**
 * providers/gemini.js
 * Uses the generateContent REST endpoint with an inlineData image part.
 */
import { AIProviderError, errorFromStatus, ERROR_TYPES } from '../utils/errors.js';
import { parseDataUrl } from '../utils/imageUtils.js';

export async function analyzeImage({ apiKey, model, imageDataUrl, systemPrompt, userPrompt, signal }) {
  const { mediaType, base64 } = parseDataUrl(imageDataUrl);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: userPrompt || 'Analyze this screenshot.' },
              { inlineData: { mimeType: mediaType, data: base64 } }
            ]
          }
        ],
        generationConfig: { maxOutputTokens: 1500 }
      })
    });
  } catch (err) {
    throw new AIProviderError(`Could not reach Gemini: ${err.message}`, { type: ERROR_TYPES.NETWORK });
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw errorFromStatus(response.status, 'Gemini', bodyText);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
  if (!text) {
    throw new AIProviderError('Gemini returned an empty response (it may have blocked the content).', { type: ERROR_TYPES.UNKNOWN });
  }
  return text;
}
