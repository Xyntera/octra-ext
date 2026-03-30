import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure output dirs exist
const dirs = ['dist', 'dist/background', 'dist/popup', 'dist/content', 'dist/wasm', 'dist/icons'];
for (const d of dirs) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

const common = {
  bundle: true,
  minify: false,
  sourcemap: false,
  target: 'es2020',
  define: { 'process.env.NODE_ENV': '"production"' },
};

await Promise.all([
  // Background service worker
  esbuild.build({
    ...common,
    entryPoints: ['src/background/service_worker.ts'],
    outfile: 'dist/background/service_worker.js',
    platform: 'browser',
    format: 'esm',
  }),

  // Content script
  esbuild.build({
    ...common,
    entryPoints: ['src/content/provider.ts'],
    outfile: 'dist/content/provider.js',
    platform: 'browser',
    format: 'iife',
  }),

  // Popup - JSX automatic runtime
  esbuild.build({
    ...common,
    entryPoints: ['src/popup/main.tsx'],
    outfile: 'dist/popup/main.js',
    platform: 'browser',
    format: 'esm',
    jsx: 'automatic',
  }),
]);

// Build CSS with Tailwind
try {
  execSync('npx tailwindcss -i src/popup/style.css -o dist/popup/style.css --minify', { stdio: 'inherit' });
  console.log('\u2705 CSS built');
} catch(e) {
  // Fallback: copy plain CSS
  try {
    copyFileSync('src/popup/style.css', 'dist/popup/style.css');
  } catch(_) {
    writeFileSync('dist/popup/style.css', 'body{margin:0;background:#030712;color:#f9fafb;font-family:system-ui}');
  }
}

// Copy static files
copyFileSync('src/popup/index.html', 'dist/popup/index.html');
copyFileSync('manifest.json', 'dist/manifest.json');

// Copy WASM files
try {
  copyFileSync('src/wasm/pvac.js', 'dist/wasm/pvac.js');
  copyFileSync('src/wasm/pvac.wasm', 'dist/wasm/pvac.wasm');
  console.log('\u2705 WASM files copied');
} catch(e) {
  console.warn('\u26a0\ufe0f  WASM files not found, skipping:', e.message);
}

// Create placeholder icons (indigo square PNG base64)
const ICON_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
for (const size of [16, 48, 128]) {
  const iconPath = `dist/icons/icon${size}.png`;
  if (!existsSync(iconPath)) writeFileSync(iconPath, ICON_PNG);
}

console.log('\u2705 Extension built \u2192 dist/');
console.log('\ud83d\udce6 Load dist/ in chrome://extensions (Load unpacked)');
