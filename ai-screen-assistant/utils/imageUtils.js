/**
 * imageUtils.js — small helpers for turning a captured tab screenshot
 * (a data: URL) into the shapes each provider's API expects.
 */

/**
 * Splits a data URL like "data:image/png;base64,AAAA..." into its parts.
 */
export function parseDataUrl(dataUrl) {
  const match = /^data:(image\/\w+);base64,(.*)$/.exec(dataUrl);
  if (!match) {
    throw new Error('Unexpected screenshot format returned by the browser.');
  }
  return { mediaType: match[1], base64: match[2] };
}
