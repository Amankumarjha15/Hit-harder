/**
 * errors.js — a single error shape all providers throw, so the overlay can
 * show one consistent, human-readable message regardless of which AI
 * service failed.
 */

export const ERROR_TYPES = {
  INVALID_KEY: 'INVALID_KEY',
  RATE_LIMIT: 'RATE_LIMIT',
  NETWORK: 'NETWORK',
  UNSUPPORTED_MODEL: 'UNSUPPORTED_MODEL',
  NO_API_KEY: 'NO_API_KEY',
  CAPTURE_FAILED: 'CAPTURE_FAILED',
  UNKNOWN: 'UNKNOWN'
};

export class AIProviderError extends Error {
  constructor(message, { type = ERROR_TYPES.UNKNOWN, status = null, providerId = null } = {}) {
    super(message);
    this.name = 'AIProviderError';
    this.type = type;
    this.status = status;
    this.providerId = providerId;
  }
}

/** Maps an HTTP status code (+ optional provider) to a friendly error. */
export function errorFromStatus(status, providerLabel, bodyText = '') {
  if (status === 401 || status === 403) {
    return new AIProviderError(
      `${providerLabel} rejected the API key (HTTP ${status}). Double-check the key in Settings.`,
      { type: ERROR_TYPES.INVALID_KEY, status }
    );
  }
  if (status === 429) {
    return new AIProviderError(
      `${providerLabel} rate limit reached. Wait a moment and try again, or check your plan/quota.`,
      { type: ERROR_TYPES.RATE_LIMIT, status }
    );
  }
  if (status === 404) {
    return new AIProviderError(
      `${providerLabel} model not found or doesn't support image input. Try a different model in Settings.`,
      { type: ERROR_TYPES.UNSUPPORTED_MODEL, status }
    );
  }
  if (status >= 500) {
    return new AIProviderError(
      `${providerLabel} is having server issues (HTTP ${status}). Try again shortly.`,
      { type: ERROR_TYPES.NETWORK, status }
    );
  }
  return new AIProviderError(
    `${providerLabel} returned an error (HTTP ${status}). ${bodyText ? bodyText.slice(0, 200) : ''}`.trim(),
    { type: ERROR_TYPES.UNKNOWN, status }
  );
}
