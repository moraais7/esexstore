import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
const forbidden = new RegExp('base' + '44', 'i');
const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
const paths = [...walk('src'), ...walk('server'), 'package.json', 'package-lock.json', 'vite.config.js', 'index.html'];
const failures = paths.filter(file => /\.(jsx?|tsx?|json|html)$/.test(file) && forbidden.test(readFileSync(file, 'utf8')));
if (failures.length) { console.error('Dependência anterior encontrada:', failures.join(', ')); process.exit(1); }
console.log('Código e dependências independentes verificados.');
