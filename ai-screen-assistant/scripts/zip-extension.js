/**
 * scripts/zip-extension.js
 * Zero-dependency packager: zips the extension source (excluding dev files)
 * into dist/ai-screen-assistant-chrome.zip, ready for upload to the Chrome
 * Web Store developer dashboard.
 *
 * Usage: node scripts/zip-extension.js chrome
 */
import { execSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';

const EXCLUDES = [
  'node_modules/*',
  'dist/*',
  'scripts/*',
  '.git/*',
  '.eslintrc.json',
  'package.json',
  'package-lock.json',
  'README.md',
  '*.zip'
];

if (!existsSync('dist')) mkdirSync('dist');

const target = 'dist/ai-screen-assistant-chrome.zip';
const excludeArgs = EXCLUDES.map((p) => `"${p}"`).join(' ');

try {
  execSync(`zip -r -X ${target} . -x ${excludeArgs}`, { stdio: 'inherit' });
  console.log(`\nPackaged: ${target}`);
} catch (err) {
  console.error('Zipping failed. Make sure the "zip" command-line tool is installed.');
  process.exit(1);
}
