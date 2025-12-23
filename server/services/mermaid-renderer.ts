import puppeteer from 'puppeteer';

let browserInstance: any = null;

/**
 * Gets or creates a shared Puppeteer browser instance
 */
export async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
      timeout: 60000,
    });
  }
  return browserInstance;
}

/**
 * MCP-like service: Renders Mermaid diagram code to SVG
 * This service acts as a dedicated Mermaid rendering service
 * 
 * @param mermaidCode - The Mermaid diagram code
 * @returns SVG string
 */
export async function renderMermaidToSvg(mermaidCode: string): Promise<string> {
  const browser = await getBrowser();
  let page: any = null;

  try {
    page = await browser.newPage();
    await page.setViewport({ width: 3840, height: 2160 }); // 4K for high quality

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body {
      margin: 0;
      padding: 40px;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .mermaid {
      max-width: 100%;
      max-height: 100%;
    }
    .mermaid-error {
      color: #dc2626;
      font-family: Arial, sans-serif;
      padding: 20px;
      border: 2px solid #dc2626;
      border-radius: 8px;
      background: #fef2f2;
    }
  </style>
</head>
<body>
  <div class="mermaid">
${mermaidCode}
  </div>
  <script>
    let mermaidError = null;
    try {
      mermaid.initialize({ 
        startOnLoad: true,
        theme: 'default',
        securityLevel: 'loose',
        fontFamily: 'Arial, sans-serif',
        fontSize: 18,
        flowchart: {
          useMaxWidth: false,
          htmlLabels: true,
          curve: 'basis',
        },
        sequence: {
          useMaxWidth: false,
          diagramMarginX: 50,
          diagramMarginY: 10,
        },
        themeVariables: {
          fontFamily: 'Arial, sans-serif',
        },
        errorCallback: (id, error, hash) => {
          console.error('Mermaid error:', error);
          mermaidError = error;
          const container = document.querySelector('.mermaid');
          if (container) {
            container.innerHTML = '<div class="mermaid-error">Diagram Error: ' + error.message + '</div>';
          }
        }
      });
    } catch (err) {
      mermaidError = err;
      const container = document.querySelector('.mermaid');
      if (container) {
        container.innerHTML = '<div class="mermaid-error">Failed to initialize Mermaid: ' + err.message + '</div>';
      }
    }
  </script>
</body>
</html>`;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait for either SVG to render or error to appear
    await Promise.race([
      page.waitForSelector('.mermaid svg', { timeout: 15000 }),
      page.waitForSelector('.mermaid-error', { timeout: 15000 })
    ]);
    
    // Check for error message first
    const errorElement = await page.$('.mermaid-error');
    if (errorElement) {
      const errorText = await page.$eval('.mermaid-error', (el: any) => el.textContent);
      throw new Error(`Mermaid syntax error: ${errorText}`);
    }
    
    // Extract SVG
    const svg = await page.$eval('.mermaid svg', (el: any) => {
      const svgElement = el as SVGElement;
      svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      return svgElement.outerHTML;
    });
    
    if (!svg || !svg.trim().startsWith('<svg')) {
      throw new Error('Mermaid diagram failed to render. Please check the diagram syntax.');
    }
    
    return svg;
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * Cleanup function to close browser instance
 */
export async function closeBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    await browserInstance.close();
    browserInstance = null;
  }
}

