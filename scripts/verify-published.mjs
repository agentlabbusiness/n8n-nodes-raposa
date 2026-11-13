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

const separator = packageSpec.lastIndexOf('@');
if (separator <= 0 || separator === packageSpec.length - 1) {
	throw new Error('package spec must include an exact name and version');
}
const packageName = packageSpec.slice(0, separator);
const packageVersion = packageSpec.slice(separator + 1);
const packagePath = packageName.startsWith('@')
	? packageName.replace('/', '%2F')
	: encodeURIComponent(packageName);
const registryUrl = `https://registry.npmjs.org/${packagePath}/${encodeURIComponent(packageVersion)}`;
const maxAttempts = 36;
const provenancePredicate = 'https://slsa.dev/provenance/v1';

let dist;
let lastError;
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
	try {
		const response = await fetch(`${registryUrl}?cacheBust=${Date.now()}-${attempt}`, {
			headers: { accept: 'application/json', 'cache-control': 'no-cache' },
		});
		if (response.status === 404) {
			dist = undefined;
		} else if (!response.ok) {
			throw new Error(`registry returned HTTP ${response.status}`);
		} else {
			const metadata = await response.json();
			dist = metadata?.dist;
		}
		if (dist?.shasum && dist.shasum !== expectedSha1) {
			throw new Error(`published shasum ${dist.shasum} does not match ${expectedSha1}`);
		}
		if (
			dist?.shasum === expectedSha1 &&
			dist?.attestations?.provenance?.predicateType === provenancePredicate
		) {
			break;
		}
	} catch (error) {
		lastError = error;
	}
	if (dist?.shasum === expectedSha1 && dist?.attestations?.provenance?.predicateType === provenancePredicate) {
		break;
	}
	if (attempt < maxAttempts) await delay(10_000);
}

if (dist?.shasum !== expectedSha1) {
	throw new Error(
		`registry did not expose ${packageSpec} with the expected shasum after ${maxAttempts} attempts` +
			(lastError ? `: ${lastError.message}` : ''),
	);
}
if (dist?.attestations?.provenance?.predicateType !== provenancePredicate) {
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
