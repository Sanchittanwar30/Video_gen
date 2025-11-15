#!/usr/bin/env node
/**
 * Generate PNGs for Mermaid diagrams in the output JSON.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 540;

const loadJson = async (inputPath) => {
	const raw = await fs.promises.readFile(inputPath, 'utf-8');
	return JSON.parse(raw);
};

const htmlTemplate = (mermaidCode, width, height) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Mermaid Render</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: ${width}px;
      height: ${height}px;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      font-family: system-ui;
    }
    #container {
      width: ${Math.floor(width * 0.9)}px;
      height: ${Math.floor(height * 0.9)}px;
    }
    .mermaid {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="container">
    <div class="mermaid">
${mermaidCode}
    </div>
  </div>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({startOnLoad: true, theme: 'neutral'});
  </script>
</body>
</html>`;

const renderMermaid = async ({code, width, height, output}) => {
	const browser = await puppeteer.launch({
		headless: 'new',
		args: ['--no-sandbox', '--disable-setuid-sandbox'],
	});
	try {
		const page = await browser.newPage();
		await page.setViewport({width, height, deviceScaleFactor: 2});
		await page.setContent(htmlTemplate(code, width, height), {
			waitUntil: 'networkidle0',
		});
		await page.waitForSelector('.mermaid');
		const mermaidNode = await page.$('.mermaid');
		await mermaidNode.screenshot({path: output});
	} finally {
		await browser.close();
	}
};

const main = async () => {
	const args = process.argv.slice(2);
	const inputIdx = args.indexOf('--input');
	const outputIdx = args.indexOf('--out');

	const inputPath =
		(inputIdx !== -1 && args[inputIdx + 1]) || 'output/json/output.json';
	const outDir =
		(outputIdx !== -1 && args[outputIdx + 1]) || 'frames';

	const width =
		parseInt(process.env.FRAME_WIDTH ?? '', 10) || DEFAULT_WIDTH;
	const height =
		parseInt(process.env.FRAME_HEIGHT ?? '', 10) || DEFAULT_HEIGHT;

	const data = await loadJson(inputPath);
	const chapters = data.chapters ?? [];

	if (!chapters.length) {
		console.warn('No chapters found in JSON – nothing to render.');
		return;
	}

	await fs.promises.mkdir(outDir, {recursive: true});

	for (const chapter of chapters) {
		if (!chapter.diagram?.mermaid) {
			continue;
		}

		const filename = `${(chapter.id ?? chapter.title).replace(/\s+/g, '_')}.png`;
		const output = path.join(outDir, filename);
		console.log(`Rendering Mermaid diagram for ${chapter.title} → ${output}`);
		await renderMermaid({
			code: chapter.diagram.mermaid,
			width,
			height,
			output,
		});
	}
};

if (require.main === module) {
	main().catch((error) => {
		console.error('Failed to render frames:', error);
		process.exit(1);
	});
}

