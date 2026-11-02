// Copies the web app into www/ (Capacitor webDir) and bundles the native bridge.
import { rmSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const FILES = ['index.html', 'app.js', 'substances-db.js', 'interactions.js', 'privacy.html', 'support.html',
  'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-512.png', 'vendor'];

rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const f of FILES) cpSync(f, `www/${f}`, { recursive: true });

await build({ entryPoints: ['native/bridge.js'], bundle: true, minify: true, format: 'iife', target: 'safari15', outfile: 'www/native.js' });

// Load the bridge before app.js in the native build only.
const html = readFileSync('www/index.html', 'utf8');
if (!html.includes('<script src="app.js"></script>')) throw new Error('index.html: app.js script tag not found');
writeFileSync('www/index.html', html.replace('<script src="app.js"></script>', '<script src="native.js"></script>\n<script src="app.js"></script>'));
console.log('www/ built');
