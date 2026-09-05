// tsc does not copy non-TS assets; n8n resolves icons relative to the compiled node/credential file.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const dir of ['nodes/Raposa', 'credentials']) {
	for (const f of readdirSync(join(root, dir)).filter((n) => n.endsWith('.svg'))) {
		const dst = join(root, 'dist', dir, f);
		mkdirSync(dirname(dst), { recursive: true });
		copyFileSync(join(root, dir, f), dst);
		console.log('icon copied →', dst);
	}
}
