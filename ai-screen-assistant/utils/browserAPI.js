/**
 * browserAPI.js
 * ---------------------------------------------------------------------------
 * Tiny cross-browser shim so the rest of the codebase can call one consistent,
 * Promise-based API regardless of whether it's running in Chrome or Firefox.
 *
 * - Firefox exposes `browser.*` and it is Promise-based natively.
 * - Chrome (MV3, Chrome 88+) exposes `chrome.*`. Most namespaces we use
 *   (storage, tabs, scripting, commands, runtime) already return Promises
 *   when no callback is supplied, so we can use the same object directly.
 *
 * We intentionally avoid pulling in a third-party polyfill bundle: MV3 store
 * policies discourage remote/bundled code that isn't fully understood, and
 * this project's surface area is small enough that a thin shim is clearer
 * and easier to audit.
 */

export const ext = (typeof globalThis.browser !== 'undefined')
  ? globalThis.browser
  : globalThis.chrome;

/** True when running under Firefox's `browser` namespace. */
export const isFirefox = typeof globalThis.browser !== 'undefined';

/**
 * Wraps chrome.* callback-style calls in a Promise for the rare API that
 * doesn't yet support the Promise form in older Chrome versions.
 * Not needed for browser.* (already Promise-based).
 */
export function callbackToPromise(fn, ...args) {
  if (isFirefox) {
    return fn(...args);
  }
  return new Promise((resolve, reject) => {
    fn(...args, (result) => {
      const err = ext.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
      } else {
        resolve(result);
      }
    });
  });
}
