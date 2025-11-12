#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const VALID_COMMANDS = new Set([
	'moveTo',
	'lineTo',
	'rect',
	'circle',
	'text',
	'arc',
	'bezier',
]);

const VALID_FOCUS_ACTIONS = new Set(['point', 'tap', 'trace']);

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const readJson = async (filePath) => {
	const absolute = path.resolve(process.cwd(), filePath);
	const raw = await fs.promises.readFile(absolute, 'utf-8');
	return JSON.parse(raw);
};

const validateSvgHints = (svgHints, errors, chapterId) => {
	if (!Array.isArray(svgHints) || svgHints.length === 0) {
		errors.push(`[${chapterId}] diagram.svgHints must be a non-empty array.`);
		return;
	}

	svgHints.forEach((hint, index) => {
		if (!hint || typeof hint !== 'object') {
			errors.push(`[${chapterId}] svgHints[${index}] must be an object.`);
			return;
		}

		if (!VALID_COMMANDS.has(hint.cmd)) {
			errors.push(
				`[${chapterId}] svgHints[${index}].cmd must be one of ${Array.from(VALID_COMMANDS).join(', ')}`
			);
		}

		switch (hint.cmd) {
			case 'moveTo':
			case 'lineTo':
				if (!isNumber(hint.x) || !isNumber(hint.y)) {
					errors.push(`[${chapterId}] svgHints[${index}] move/line commands require numeric x and y.`);
				}
				break;
			case 'rect':
				if (!isNumber(hint.x) || !isNumber(hint.y) || !isNumber(hint.w ?? hint.width) || !isNumber(hint.h ?? hint.height)) {
					errors.push(`[${chapterId}] svgHints[${index}] rect requires x, y, w, h.`);
				}
				break;
			case 'circle':
				if (!isNumber(hint.x ?? hint.cx) || !isNumber(hint.y ?? hint.cy) || !isNumber(hint.r)) {
					errors.push(`[${chapterId}] svgHints[${index}] circle requires center (x/y or cx/cy) and radius r.`);
				}
				break;
			case 'arc':
				if (!isNumber(hint.x) || !isNumber(hint.y)) {
					errors.push(`[${chapterId}] svgHints[${index}] arc requires target x and y.`);
				}
				break;
			case 'bezier':
				if (!Array.isArray(hint.points) || hint.points.length < 2) {
					errors.push(`[${chapterId}] svgHints[${index}] bezier requires points array with at least 2 control points.`);
				}
				break;
			case 'text':
				if (!isNumber(hint.x) || !isNumber(hint.y) || typeof hint.text !== 'string') {
					errors.push(`[${chapterId}] svgHints[${index}] text requires x, y and text string.`);
				}
				break;
			default:
				break;
		}
	});
};

const validateFocusEvents = (focusEvents, svgHintsLength, durationSeconds, errors, chapterId) => {
	if (focusEvents == null) {
		return;
	}

	if (!Array.isArray(focusEvents)) {
		errors.push(`[${chapterId}] focusEvents must be an array when provided.`);
		return;
	}

	focusEvents.forEach((event, index) => {
		if (!event || typeof event !== 'object') {
			errors.push(`[${chapterId}] focusEvents[${index}] must be an object.`);
			return;
		}

		if (!VALID_FOCUS_ACTIONS.has(event.action)) {
			errors.push(
				`[${chapterId}] focusEvents[${index}].action must be one of ${Array.from(VALID_FOCUS_ACTIONS).join(', ')}`
			);
		}

		if (!isNumber(event.time) || event.time < 0 || (isNumber(durationSeconds) && event.time > durationSeconds + 1)) {
			errors.push(`[${chapterId}] focusEvents[${index}].time must be within the chapter duration.`);
		}

		const target = event.target;
		if (!target || typeof target !== 'object') {
			errors.push(`[${chapterId}] focusEvents[${index}] requires a target object.`);
			return;
		}

		if (typeof target.cmdIndex === 'number') {
			if (target.cmdIndex < 0 || target.cmdIndex >= svgHintsLength) {
				errors.push(`[${chapterId}] focusEvents[${index}].target.cmdIndex is out of range for svgHints.`);
			}
		} else if (!(isNumber(target.x) && isNumber(target.y))) {
			errors.push(
				`[${chapterId}] focusEvents[${index}].target must specify a cmdIndex or numeric x/y coordinates.`
			);
		}
	});
};

const validateChapter = (chapter, errors) => {
	if (!chapter || typeof chapter !== 'object') {
		errors.push('Chapter must be an object.');
		return;
	}

	const chapterId = chapter.id ?? chapter.title ?? 'unknown-chapter';

	if (chapter.diagram?.visualType !== 'whiteboard') {
		return;
	}

	validateSvgHints(chapter.diagram.svgHints, errors, chapterId);
	validateFocusEvents(
		chapter.diagram.focusEvents,
		Array.isArray(chapter.diagram.svgHints) ? chapter.diagram.svgHints.length : 0,
		chapter.durationSeconds,
		errors,
		chapterId
	);
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
