#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const readJson = async (filePath) => {
	const absolute = path.resolve(process.cwd(), filePath);
	const raw = await fs.promises.readFile(absolute, 'utf-8');
	return JSON.parse(raw);
};

const validateImagePrompts = (diagram, errors, chapterId) => {
	if (!diagram || (diagram.visualType ?? diagram.type) !== 'whiteboard') {
		return;
	}

	if (!Array.isArray(diagram.imagePrompts) || diagram.imagePrompts.length === 0) {
		errors.push(`[${chapterId}] whiteboard chapters should provide at least one diagram.imagePrompts entry describing the sketch.`);
		return;
	}

	diagram.imagePrompts.forEach((prompt, index) => {
		if (typeof prompt !== 'string' || prompt.trim().length === 0) {
			errors.push(`[${chapterId}] imagePrompts[${index}] must be a non-empty string.`);
		}
	});
};

const validateChapter = (chapter, errors) => {
	if (!chapter || typeof chapter !== 'object') {
		errors.push('Chapter must be an object.');
		return;
	}

	const chapterId = chapter.id ?? chapter.title ?? 'unknown-chapter';

	validateImagePrompts(chapter.diagram, errors, chapterId);
};

const main = async () => {
	const [, , inputPath] = process.argv;
	if (!inputPath) {
		console.error('Usage: node tools/validate-whiteboard-json.js <path/to/json>');
		process.exit(1);
	}

	try {
		const data = await readJson(inputPath);
		const chapters = data?.chapters ?? [];
		const errors = [];

		chapters.forEach((chapter) => validateChapter(chapter, errors));

		if (errors.length) {
			errors.forEach((message) => console.error(`❌ ${message}`));
			process.exit(1);
		}

		console.log('✅ Whiteboard JSON looks good.');
	} catch (error) {
		console.error('❌ Failed to validate JSON:', error.message ?? error);
		process.exit(1);
	}
};

main();
