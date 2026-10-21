import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const scannerVersion = '0.40.0';
const scannerRoot = mkdtempSync(join(tmpdir(), 'n8n-community-scanner-'));

try {
	execFileSync(
		'npm',
		[
			'install',
			'--prefix',
			scannerRoot,
			'--ignore-scripts',
			'--no-save',
			'--package-lock=false',
			`@n8n/scan-community-package@${scannerVersion}`,
		],
		{ stdio: 'inherit' },
	);
	const scannerPath = join(
		scannerRoot,
		'node_modules',
		'@n8n',
		'scan-community-package',
		'scanner',
		'scanner.mjs',
	);
	const { analyzePackage, analyzePackageByName, resolvePackage } = await import(
		pathToFileURL(scannerPath).href
	);

	const [packageSpec] = process.argv.slice(2);
	let result;
	if (packageSpec) {
		const { packageName, version } = resolvePackage(packageSpec);
		result = await analyzePackageByName(packageName, version);
	} else {
		result = await analyzePackage(process.cwd());
	}

	if (!result.passed) {
		console.error('n8n community scan failed');
		if (result.message) console.error(result.message);
		if (result.details) console.error(result.details);
		process.exitCode = 1;
	} else {
		console.log(
			`n8n community ${packageSpec ? `registry scan passed for ${packageSpec}` : 'source scan passed'}`,
		);
	}
} finally {
	rmSync(scannerRoot, { recursive: true, force: true });
}
