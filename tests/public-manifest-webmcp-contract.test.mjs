import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatorSource = path.join(repoRoot, 'scripts', 'generate-public-manifest.mjs');

test('public manifest ignores the .git control file used by Git worktrees', async (context) => {
	const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'projects-webmcp-manifest-'));
	context.after(() => fs.rm(fixtureRoot, { recursive: true, force: true }));

	const scriptsRoot = path.join(fixtureRoot, 'scripts');
	await fs.mkdir(scriptsRoot);
	await fs.copyFile(generatorSource, path.join(scriptsRoot, 'generate-public-manifest.mjs'));
	await fs.writeFile(path.join(fixtureRoot, '.git'), 'gitdir: ../fixture.git\n', 'utf8');
	await fs.writeFile(path.join(fixtureRoot, 'visible.txt'), 'public\n', 'utf8');
	await fs.writeFile(
		path.join(fixtureRoot, 'PUBLIC_SOURCE_MANIFEST.txt'),
		'PUBLIC_SOURCE_MANIFEST.txt\nscripts/generate-public-manifest.mjs\nvisible.txt\n',
		'utf8'
	);

	const result = spawnSync(process.execPath, [path.join(scriptsRoot, 'generate-public-manifest.mjs')], {
		cwd: fixtureRoot,
		encoding: 'utf8',
		windowsHide: true
	});

	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /Public source manifest matches 3 files\./u);
});
