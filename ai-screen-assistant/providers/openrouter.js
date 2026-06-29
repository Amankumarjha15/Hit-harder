import { analyzeImageOpenAICompatible } from './openaiCompatible.js';

export async function analyzeImage(params) {
  return analyzeImageOpenAICompatible({
    ...params,
    baseUrl: 'https://openrouter.ai/api/v1',
    providerLabel: 'OpenRouter',
    extraHeaders: {
      // Required-ish by OpenRouter for attribution; harmless if ignored.
      'HTTP-Referer': 'https://github.com/ai-screen-assistant',
      'X-Title': 'AI Screen Assistant'
    }
  });
}
