#!/usr/bin/env node
const fs = require('fs');
const Ajv = require('ajv');

const schema = {
	type: 'object',
	required: ['chapters'],
	properties: {
		topic: {type: 'string'},
		introCaption: {type: 'string'},
		outroCaption: {type: 'string'},
		callToAction: {type: 'string'},
		chapters: {
			type: 'array',
			minItems: 1,
			items: {
				type: 'object',
				required: ['title', 'summary'],
				properties: {
					id: {type: 'string'},
					title: {type: 'string'},
					summary: {type: 'string'},
					durationSeconds: {type: 'number', minimum: 1},
					audioFile: {type: 'string'},
					voiceoverScript: {type: 'string'},
					imagePrompts: {
						type: 'array',
						items: {type: 'string'},
					},
					table: {
						type: 'object',
						properties: {
							title: {type: 'string'},
							rows: {
								type: 'array',
								minItems: 1,
								items: {
									type: 'array',
									items: {type: 'string'},
								},
							},
						},
					},
					diagram: {
						type: 'object',
						properties: {
							type: {enum: ['mermaid', 'erd', 'whiteboard']},
							notes: {type: 'string'},
							mermaid: {type: 'string'},
							image: {type: 'string'},
							entities: {
								type: 'array',
								items: {
									type: 'object',
									required: ['id', 'title'],
									properties: {
										id: {type: 'string'},
										title: {type: 'string'},
										fields: {
											type: 'array',
											items: {type: 'string'},
										},
										description: {type: 'string'},
									},
								},
							},
							relationships: {
								type: 'array',
								items: {
									type: 'object',
									required: ['from', 'to'],
									properties: {
										from: {type: 'string'},
										to: {type: 'string'},
										label: {type: 'string'},
										fromAnchor: {
											enum: ['center', 'top', 'bottom', 'left', 'right'],
										},
										toAnchor: {
											enum: ['center', 'top', 'bottom', 'left', 'right'],
										},
									},
								},
							},
							pointer: {
								type: 'object',
								properties: {
									mode: {enum: ['tap', 'point', 'trace']},
									target: {type: 'string'},
									anchor: {
										enum: ['center', 'top', 'bottom', 'left', 'right'],
									},
									durationSeconds: {type: 'number'},
									points: {
										type: 'array',
										items: {
											type: 'object',
											required: ['x', 'y'],
											properties: {
												x: {type: 'number'},
												y: {type: 'number'},
											},
										},
									},
								},
							},
							whiteboard: {
								type: 'object',
								properties: {
									background: {enum: ['grid', 'dot', 'plain']},
									layers: {
										type: 'array',
										items: {
											type: 'object',
											required: ['title', 'items'],
											properties: {
												title: {type: 'string'},
												items: {
													type: 'array',
													items: {type: 'string'},
												},
											},
										},
									},
									callouts: {
										type: 'array',
										items: {type: 'string'},
									},
								},
							},
						},
					},
				},
			},
		},
	},
	additionalProperties: true,
};

const main = () => {
	const inputPath = process.argv[2] ?? 'output/json/output.json';
	if (!fs.existsSync(inputPath)) {
		console.error(`Input JSON not found: ${inputPath}`);
		process.exit(1);
	}

	let payload;
	try {
		payload = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
	} catch (error) {
		console.error(`JSON parse error in ${inputPath}:`, error.message);
		process.exit(1);
	}

	const ajv = new Ajv({allErrors: true});
	const validate = ajv.compile(schema);

	if (!validate(payload)) {
		console.error('Validation failed:');
		for (const error of validate.errors ?? []) {
			console.error(`- ${error.instancePath || '(root)'} ${error.message}`);
		}
		process.exit(1);
	}

	console.log(`✅ JSON valid (${inputPath})`);
};

if (require.main === module) {
	main();
}

