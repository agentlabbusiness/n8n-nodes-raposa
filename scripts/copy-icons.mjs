// tsc does not copy non-TS assets; n8n resolves the icon relative to the compiled node file.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'nodes', 'Raposa', 'raposa.svg');
const dst = join(root, 'dist', 'nodes', 'Raposa', 'raposa.svg');
mkdirSync(dirname(dst), { recursive: true });
copyFileSync(src, dst);
console.log('icon copied →', dst);
