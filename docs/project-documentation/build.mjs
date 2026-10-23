// Builds HoneyBroiler_POS_Project_Documentation.pdf from the Markdown next to this file.
//
//   DOC_TOOLS=<folder with node_modules> node docs/project-documentation/build.mjs
//
// The PDF tools are NOT dependencies of the project. Install them once in any scratch folder, outside the repository:
//   npm install mermaid@11 puppeteer-core@24 marked@15 pdfjs-dist@4
// and point DOC_TOOLS at that folder. Microsoft Edge or Google Chrome must be installed (set CHROME_PATH to override).
//
// What it does: Markdown -> HTML (marked) -> diagrams drawn as SVG (mermaid, in the browser) -> A4 PDF with bookmarks
// (puppeteer-core). It runs twice: the first PDF tells which page each section starts on, the second prints those
// page numbers in the table of contents.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const tools = process.env.DOC_TOOLS;
if (!tools || !existsSync(join(tools, 'node_modules'))) {
  console.error('Set DOC_TOOLS to a folder that contains node_modules with mermaid, puppeteer-core, marked and pdfjs-dist.');
  process.exit(1);
}
const need = createRequire(join(tools, 'package.json'));
const markedModule = need('marked');
const marked = markedModule.marked ?? markedModule;
const puppeteer = need('puppeteer-core');
const mermaidFile = join(tools, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
const pdfjs = await import(pathToFileURL(join(tools, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs')).href);

const NAME = 'HoneyBroiler_POS_Project_Documentation';
const SOURCE = join(here, `${NAME}.md`);
const OUT = join(here, `${NAME}.pdf`);
const AUDIT_DATE = process.env.AUDIT_DATE ?? '22 October 2026';
const COMMIT = process.env.AUDIT_COMMIT ?? execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repo }).toString().trim();

const chrome =
  process.env.CHROME_PATH ??
  ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
if (!chrome) throw new Error('No Edge or Chrome found. Set CHROME_PATH.');

// ---------------------------------------------------------------- Markdown to HTML
const slug = (text) => text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sections = []; // { id, title } for every level-2 heading
let figureNo = 0;

marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const html = this.parser.parseInline(tokens);
      const plain = html.replace(/<[^>]+>/g, '');
      const num = /^(\d+(?:\.\d+)?)\.?\s/.exec(plain);
      const id = num ? `sec-${num[1].replace('.', '-')}` : slug(plain);
      if (depth === 2) sections.push({ id, title: plain });
      return `<h${depth} id="${id}">${html}</h${depth}>\n`;
    },
    code({ text, lang }) {
      if (lang === 'mermaid') {
        const caption = /^%%\s*caption:\s*(.+)$/m.exec(text)?.[1] ?? '';
        const source = text.replace(/^%%\s*caption:.*$/m, '').trim();
        figureNo += 1;
        return `<figure class="diagram"><div class="mm" data-src="${encodeURIComponent(source)}"></div><figcaption>${caption}</figcaption></figure>\n`;
      }
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre><code>${escaped}</code></pre>\n`;
    },
    codespan({ text }) {
      const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<code>${safe.replace(/\//g, '/<wbr>').replace(/_/g, '_<wbr>')}</code>`;
    },
    link({ href, tokens }) {
      const label = this.parser.parseInline(tokens);
      return `<a href="${href}">${label}</a>`;
    },
  },
});

function bodyHtml() {
  let html = marked.parse(readFileSync(SOURCE, 'utf8'));
  html = html.replace(/<table>/g, '<div class="tw"><table>').replace(/<\/table>/g, '</table></div>');
  return html;
}

// ---------------------------------------------------------------- Page template
const css = `
@page { size: A4; margin: 19mm 17mm 20mm 17mm;
  @top-left { content: "Honey Broilers POS  |  Project Documentation"; font: 8pt "Segoe UI", sans-serif; color: #6b5a52; }
  @top-right { content: "Audited at commit ${COMMIT}"; font: 8pt "Segoe UI", sans-serif; color: #6b5a52; }
  @bottom-center { content: counter(page); font: 8.5pt "Segoe UI", sans-serif; color: #6b5a52; }
  @bottom-left { content: ""; }
}
@page :first { @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; } }
* { box-sizing: border-box; }
html { font-family: "Segoe UI", "Nirmala UI", "Noto Sans Tamil", sans-serif; font-size: 9.4pt; line-height: 1.45; color: #1f1512; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; }
h1, h2, h3 { font-family: "Segoe UI Semibold", "Segoe UI", sans-serif; color: #1f1512; break-after: avoid; }
h2 { font-size: 15pt; margin: 17pt 0 6pt; padding-bottom: 3pt; border-bottom: 1.5pt solid #d71920; }
h3 { font-size: 11pt; margin: 11pt 0 4pt; color: #a80f15; }
p { margin: 0 0 6pt; orphans: 3; widows: 3; }
ul, ol { margin: 0 0 6pt; padding-left: 15pt; }
li { margin: 0 0 2pt; }
a { color: #a80f15; text-decoration: none; }
code { font-family: Consolas, "Cascadia Mono", monospace; font-size: 8.3pt; background: #f6efe6; padding: 0 2pt; border-radius: 2pt; overflow-wrap: anywhere; }
th:nth-child(2), td:nth-child(2) { min-width: 21mm; }
pre { font-family: Consolas, "Cascadia Mono", monospace; font-size: 7.9pt; line-height: 1.35; background: #f6efe6; border: 0.5pt solid #eadccb; border-radius: 3pt; padding: 6pt 8pt; margin: 4pt 0 8pt; white-space: pre-wrap; break-inside: avoid; }
pre code { background: none; padding: 0; font-size: inherit; }
blockquote { margin: 6pt 0 8pt; padding: 5pt 9pt; background: #fff7e6; border-left: 3pt solid #f59e0b; border-radius: 0 3pt 3pt 0; break-inside: avoid; }
blockquote p { margin: 0; }
.tw { margin: 3pt 0 9pt; }
table { width: 100%; border-collapse: collapse; font-size: 8.2pt; line-height: 1.32; }
th code { background: none; color: #fff; }
th:first-child, td:first-child { min-width: 21mm; }
th { text-align: left; background: #3a2a24; color: #fff; padding: 3.5pt 5pt; font-weight: 600; }
td { padding: 3.2pt 5pt; border-bottom: 0.5pt solid #eadccb; vertical-align: top; overflow-wrap: break-word; }
tr { break-inside: avoid; }
tbody tr:nth-child(even) td { background: #fbf6ee; }
figure.diagram { margin: 6pt 0 10pt; break-inside: avoid; text-align: center; border: 0.5pt solid #eadccb; border-radius: 4pt; padding: 8pt 6pt 5pt; background: #fff; }
figure.diagram svg { width: auto; max-width: 100%; height: auto; max-height: 185mm; }
p:has(+ figure.diagram), p:has(+ .tw) { break-after: avoid; }
figcaption { font-size: 8.2pt; color: #6b5a52; margin-top: 4pt; text-align: left; font-style: italic; }
.cover { height: 257mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page; }
.cover .band { height: 14mm; background: #d71920; margin: 0 -17mm; }
.cover .titleblock { margin-top: 34mm; }
.cover .kicker { font-size: 10.5pt; letter-spacing: 2pt; text-transform: uppercase; color: #a80f15; font-weight: 600; }
.cover h1 { font-size: 34pt; line-height: 1.12; margin: 8pt 0 10pt; border: 0; padding: 0; }
.cover .sub { font-size: 14pt; color: #4b3b34; max-width: 135mm; }
.cover .rule { width: 38mm; height: 3pt; background: #f59e0b; margin: 16pt 0; }
.cover table { width: 100%; max-width: 135mm; font-size: 9.5pt; }
.cover td { border-bottom: 0.5pt solid #eadccb; background: none !important; padding: 4pt 4pt 4pt 0; }
.cover td:first-child { color: #6b5a52; width: 38mm; }
.cover .foot { font-size: 8.5pt; color: #6b5a52; }
.toc { break-after: page; }
.toc h2 { margin-top: 0; }
.toc ol { list-style: none; padding: 0; margin: 8pt 0 0; }
.toc li { display: flex; align-items: baseline; margin: 0; padding: 3.2pt 0; border-bottom: 0.4pt dotted #cdbba7; font-size: 10pt; }
.toc li a { color: #1f1512; flex: 1; }
.toc li .pg { color: #a80f15; font-variant-numeric: tabular-nums; font-weight: 600; }
.toc .note { margin-top: 14pt; font-size: 8.8pt; color: #4b3b34; }
`;

function tocHtml(pages) {
  const items = sections
    .map((s) => `<li><a href="#${s.id}">${s.title}</a><span class="pg">${pages?.[s.id] ?? ''}</span></li>`)
    .join('\n');
  return `<section class="toc"><h2 id="contents">Contents</h2><ol>${items}</ol>
<p class="note"><b>Evidence labels.</b> <b>Implemented</b>: code present and reachable. <b>Partial</b>: present with a stated gap. <b>Not built</b>: planned or requested, no code. <b>Unverified</b>: cannot be proved from the repository. Proposed work is labelled <i>Proposed</i> and never drawn as part of the current system. All file paths are relative to the repository root.</p></section>`;
}

const cover = `<section class="cover">
  <div class="band"></div>
  <div class="titleblock">
    <div class="kicker">Technical handover documentation</div>
    <h1>Honey Broilers POS</h1>
    <div class="sub">Project documentation for the butchery billing system: counter app, admin site, shared library and operations tooling</div>
    <div class="rule"></div>
    <table>
      <tr><td>Documentation version</td><td>1.0</td></tr>
      <tr><td>Audit date</td><td>${AUDIT_DATE}</td></tr>
      <tr><td>Source revision</td><td>commit <code>${COMMIT}</code>, branch <code>main</code></td></tr>
      <tr><td>Repository</td><td><a href="https://github.com/team-collabrate/broiler">github.com/team-collabrate/broiler</a></td></tr>
      <tr><td>Live sites</td><td><a href="https://broiler-pos.web.app">broiler-pos.web.app</a> (counter), <a href="https://broiler-pos-admin.web.app">broiler-pos-admin.web.app</a> (admin)</td></tr>
      <tr><td>Basis</td><td>Source code, manifests, lockfiles, rules and scripts of the repository. Nothing in this document is taken from a proposal.</td></tr>
    </table>
  </div>
  <div class="foot">Generated from <code>docs/project-documentation/${NAME}.md</code>. No secrets, PINs or production data appear in this document.</div>
</section>`;

function pageHtml(pages) {
  const body = bodyHtml(); // first: it collects the section list the contents page needs
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Honey Broilers POS: Project Documentation</title><style>${css}</style></head>
<body>${cover}${tocHtml(pages)}<main>${body}</main></body></html>`;
}

// ---------------------------------------------------------------- Render
const mermaidInit = `
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'loose',
  fontFamily: '"Segoe UI", "Nirmala UI", sans-serif',
  themeVariables: { fontSize: '15px', primaryColor: '#ffffff', primaryBorderColor: '#475569', primaryTextColor: '#1f1512', lineColor: '#475569',
    secondaryColor: '#fdebea', tertiaryColor: '#eef2f7', edgeLabelBackground: '#ffffff', noteBkgColor: '#fff7e6', noteTextColor: '#1f1512', noteBorderColor: '#b45309',
    actorBkg: '#ffffff', actorBorder: '#d71920', actorTextColor: '#1f1512', signalColor: '#475569', signalTextColor: '#1f1512',
    labelBoxBkgColor: '#fdebea', labelBoxBorderColor: '#a80f15', labelTextColor: '#1f1512', loopTextColor: '#1f1512',
    attributeBackgroundColorOdd: '#ffffff', attributeBackgroundColorEven: '#fbf6ee', clusterBkg: '#fbf6ee', clusterBorder: '#cdbba7' },
  flowchart: { htmlLabels: true, curve: 'basis', useMaxWidth: true, nodeSpacing: 28, rankSpacing: 38, padding: 10 },
  sequence: { useMaxWidth: true, actorMargin: 28, messageMargin: 26, boxMargin: 6, mirrorActors: false, wrap: true, width: 130, noteMargin: 8 },
  er: { useMaxWidth: true, fontSize: 13, minEntityWidth: 120, entityPadding: 10 },
});
`;

async function renderPdf(html, target) {
  const tmp = join(here, '.build');
  mkdirSync(tmp, { recursive: true });
  const htmlFile = join(tmp, 'doc.html');
  writeFileSync(htmlFile, html);
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error('page error:', e.message));
    await page.setViewport({ width: 794, height: 1123 });
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
    await page.addScriptTag({ path: mermaidFile });
    const failures = await page.evaluate(async (init) => {
      // eslint-disable-next-line no-eval
      (0, eval)(init);
      const bad = [];
      const nodes = [...document.querySelectorAll('.mm')];
      for (let i = 0; i < nodes.length; i += 1) {
        try {
          const { svg } = await window.mermaid.render(`mm${i}`, decodeURIComponent(nodes[i].dataset.src));
          nodes[i].innerHTML = svg;
        } catch (e) {
          bad.push(`diagram ${i + 1}: ${e.message}`);
        }
      }
      await document.fonts.ready;
      return bad;
    }, mermaidInit);
    if (failures.length) throw new Error(`Mermaid failed: ${failures.join('; ')}`);
    await page.pdf({ path: target, format: 'A4', printBackground: true, preferCSSPageSize: true, outline: true, tagged: true });
  } finally {
    await browser.close();
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function pageOfSections(file) {
  const data = new Uint8Array(readFileSync(file));
  const pdf = await pdfjs.getDocument({ data, useSystemFonts: true, verbosity: 0 }).promise;
  const texts = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    texts.push(content.items.map((i) => i.str).join(' ').replace(/\s+/g, ' '));
  }
  const pages = {};
  let from = 2; // after the cover and the contents page(s): the heading is searched from page 3 on
  for (const s of sections) {
    const needle = s.title.replace(/\s+/g, ' ');
    for (let n = from; n < texts.length; n += 1) {
      if (texts[n].includes(needle)) {
        pages[s.id] = n + 1;
        from = n;
        break;
      }
    }
  }
  return { pages, count: pdf.numPages };
}

// Pass 1 (no page numbers) tells where sections start; pass 2 prints them.
sections.length = 0;
let html = pageHtml(null);
await renderPdf(html, OUT);
const first = await pageOfSections(OUT);
sections.length = 0;
html = pageHtml(first.pages);
await renderPdf(html, OUT);
const second = await pageOfSections(OUT);
const moved = Object.keys(first.pages).filter((id) => first.pages[id] !== second.pages[id]);
if (moved.length) {
  // The table of contents grew a line and moved something: one more pass settles it.
  sections.length = 0;
  html = pageHtml(second.pages);
  await renderPdf(html, OUT);
}
const final = await pageOfSections(OUT);
console.log(`${OUT}\n${final.count} pages; sections found: ${Object.keys(final.pages).length}/${sections.length}`);
