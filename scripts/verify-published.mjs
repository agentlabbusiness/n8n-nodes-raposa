import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const [packageSpec, expectedSha1] = process.argv.slice(2);
if (!packageSpec || !/^[a-f0-9]{40}$/.test(expectedSha1 ?? '')) {
	throw new Error('usage: verify-published.mjs <package@version> <local-tarball-sha1>');
}

let dist;
for (let attempt = 1; attempt <= 12; attempt += 1) {
	try {
		dist = JSON.parse(
			execFileSync('npm', ['view', packageSpec, 'dist', '--json'], { encoding: 'utf8' }),
		);
		if (dist?.shasum && dist.shasum !== expectedSha1) break;
		if (
			dist?.shasum === expectedSha1 &&
			dist?.attestations?.provenance?.predicateType === 'https://slsa.dev/provenance/v1'
		) {
			break;
		}
	} catch (error) {
		if (attempt === 12) throw error;
	}
	await delay(10_000);
}

if (dist?.shasum !== expectedSha1) {
	throw new Error(`published shasum ${String(dist?.shasum)} does not match ${expectedSha1}`);
}
if (dist?.attestations?.provenance?.predicateType !== 'https://slsa.dev/provenance/v1') {
	throw new Error('published package has no SLSA provenance attestation');
}

const destination = mkdtempSync(join(tmpdir(), 'raposa-npm-readback-'));
try {
	const packed = JSON.parse(
		execFileSync(
			'npm',
			['pack', packageSpec, '--json', '--ignore-scripts', '--pack-destination', destination],
			{ encoding: 'utf8' },
		),
	);
	const tarball = join(destination, packed[0].filename);
	const downloadedSha1 = createHash('sha1').update(readFileSync(tarball)).digest('hex');
	if (downloadedSha1 !== expectedSha1) {
		throw new Error(`downloaded tarball shasum ${downloadedSha1} does not match ${expectedSha1}`);
	}
} finally {
	rmSync(destination, { recursive: true, force: true });
}

console.log(`${packageSpec}: registry tarball and provenance verified`);
