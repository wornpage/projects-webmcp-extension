import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function collectFiles(directory, extension, files = []) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) collectFiles(absolute, extension, files);
		else if (entry.isFile() && entry.name.endsWith(extension)) files.push(absolute);
	}
	return files;
}

function relative(absolute) {
	return path.relative(root, absolute).split(path.sep).join('/');
}

function sideBorderWidths(source) {
	const widths = [];
	for (const match of source.matchAll(/\bborder-(?:left|right|inline-start|inline-end)(?:-width)?\s*:\s*([^;{}]+)/giu)) {
		for (const width of match[1].matchAll(/(-?(?:\d+|\d*\.\d+))px\b/giu)) widths.push(Number(width[1]));
	}
	return widths;
}

function horizontalInsetRails(source) {
	const rails = [];
	for (const declaration of source.matchAll(/\bbox-shadow\s*:\s*([^;}]+)/giu)) {
		for (const shadow of declaration[1].matchAll(/\binset\s+(-?(?:\d+|\d*\.\d+))px\s+0(?:px)?\s+0(?:px)?\b/giu)) {
			if (Number(shadow[1]) !== 0) rails.push(shadow[0]);
		}
	}
	return rails;
}

test('the Full Border Rule covers every authored extension CSS and Svelte source', () => {
	const sources = [
		...collectFiles(path.join(root, 'assets'), '.css'),
		...collectFiles(path.join(root, 'svelte-frontend', 'src'), '.svelte')
	].sort((left, right) => left.localeCompare(right));

	assert.ok(sources.length > 0, 'authored style source set is not empty');
	assert.ok(sources.some((file) => relative(file) === 'assets/demo.css'));
	assert.ok(sources.some((file) => relative(file) === 'assets/landing.css'));
	assert.ok(sources.some((file) => relative(file) === 'svelte-frontend/src/lib/components/WorkGridCard.svelte'));

	const violations = sources.flatMap((file) => {
		const source = readFileSync(file, 'utf8');
		const wideSides = sideBorderWidths(source).filter((width) => Math.abs(width) > 1);
		const insetRails = horizontalInsetRails(source);
		return wideSides.length || insetRails.length
			? [{ file: relative(file), wideSides, insetRails }]
			: [];
	});

	assert.deepEqual(violations, []);
});

test('the extension design contract documents the Full Border Rule', () => {
	const design = readFileSync(path.join(root, 'DESIGN.md'), 'utf8');
	assert.match(design, /five task routes/iu);
	assert.match(design, /eight supported themes/iu);
	assert.match(design, /Full Border Rule/u);
	assert.match(design, /full 1px borders or background tints/iu);
	assert.match(design, /never a colored side stripe/iu);
});
