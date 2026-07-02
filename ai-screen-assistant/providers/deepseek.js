import { analyzeImageOpenAICompatible } from './openaiCompatible.js';

// NOTE: DeepSeek's public API has historically focused on text models.
// This adapter assumes an OpenAI-compatible vision endpoint at /chat/completions.
// Verify current model availability at platform.deepseek.com before relying on it —
// if vision isn't supported, this will surface a clear "unsupported model" error
// rather than failing silently.
export async function analyzeImage(params) {
  return analyzeImageOpenAICompatible({
    ...params,
    baseUrl: 'https://api.deepseek.com/v1',
    providerLabel: 'DeepSeek'
  });
}
