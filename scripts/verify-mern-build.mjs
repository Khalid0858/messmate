import { readFile } from 'node:fs/promises';
// Check the exact compiled runtime modules imported by the Vercel entry point.
const entry = new URL('../api/index.ts', import.meta.url);
const text = await readFile(entry, 'utf8');
const imports = [...text.matchAll(/from\s+["'](\.\.\/server\/dist\/[^"']+)["']/g)];
if (!imports.length) throw new Error('No server entry imports found');
for (const [, relative] of imports) await import(new URL(relative, entry).href);
console.log('Verified ' + imports.length + ' compiled Vercel runtime modules');
