import { analyzeImageOpenAICompatible } from './openaiCompatible.js';

export async function analyzeImage(params) {
  return analyzeImageOpenAICompatible({
    ...params,
    baseUrl: 'https://api.groq.com/openai/v1',
    providerLabel: 'Groq'
  });
}
