import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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

  // Popup
  esbuild.build({
    ...common,
    entryPoints: ['src/popup/main.tsx'],
    outfile: 'dist/popup/main.js',
    platform: 'browser',
    format: 'esm',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  }),
]);

// Copy static files
copyFileSync('src/popup/index.html', 'dist/popup/index.html');
copyFileSync('manifest.json', 'dist/manifest.json');

// Copy WASM files
try {
  copyFileSync('src/wasm/pvac.js', 'dist/wasm/pvac.js');
  copyFileSync('src/wasm/pvac.wasm', 'dist/wasm/pvac.wasm');
  console.log('✅ WASM files copied');
} catch(e) {
  console.warn('⚠️  WASM files not found, skipping:', e.message);
}

// Create placeholder icons (1x1 transparent PNG)
const ICON_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
for (const size of [16, 48, 128]) {
  const iconPath = `dist/icons/icon${size}.png`;
  if (!existsSync(iconPath)) writeFileSync(iconPath, ICON_PNG);
}

console.log('✅ Extension built → dist/');
