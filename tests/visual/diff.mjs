import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const root = 'tests/visual';
const baselineDir = path.join(root, 'baseline');
const currentDir = path.join(root, 'current');
const diffDir = path.join(root, 'diff');
fs.mkdirSync(diffDir, { recursive: true });

if (!fs.existsSync(baselineDir)) {
  console.error(`Baseline directory not found: ${baselineDir}`);
  console.error('Run: npm run visual:baseline');
  process.exit(1);
}
if (!fs.existsSync(currentDir)) {
  console.error(`Current directory not found: ${currentDir}`);
  console.error('Run: TARGET_URL=<preview-url> npm run visual:current');
  process.exit(1);
}

const entries = fs.readdirSync(baselineDir).filter(f => f.endsWith('.png')).sort();

const rows = [];
for (const file of entries) {
  const bPath = path.join(baselineDir, file);
  const cPath = path.join(currentDir, file);
  if (!fs.existsSync(cPath)) {
    rows.push({ file, pct: null, note: 'missing on current' });
    continue;
  }
  const b = PNG.sync.read(fs.readFileSync(bPath));
  const c = PNG.sync.read(fs.readFileSync(cPath));

  // If sizes differ, resize diff to the smaller dimensions and pad diff with a frame
  const w = Math.min(b.width, c.width);
  const h = Math.min(b.height, c.height);

  if (b.width !== c.width || b.height !== c.height) {
    const resize = (src, tw, th) => {
      const out = new PNG({ width: tw, height: th });
      for (let y = 0; y < Math.min(src.height, th); y++) {
        for (let x = 0; x < Math.min(src.width, tw); x++) {
          const sIdx = (y * src.width + x) * 4;
          const dIdx = (y * tw + x) * 4;
          out.data[dIdx] = src.data[sIdx];
          out.data[dIdx + 1] = src.data[sIdx + 1];
          out.data[dIdx + 2] = src.data[sIdx + 2];
          out.data[dIdx + 3] = src.data[sIdx + 3];
        }
      }
      return out;
    };
    const bCrop = resize(b, w, h);
    const cCrop = resize(c, w, h);
    const diff = new PNG({ width: w, height: h });
    const count = pixelmatch(bCrop.data, cCrop.data, diff.data, w, h, { threshold: 0.15, includeAA: false });
    fs.writeFileSync(path.join(diffDir, file), PNG.sync.write(diff));
    const pct = (count / (w * h)) * 100;
    rows.push({ file, pct: +pct.toFixed(2), note: `size differs (b=${b.width}x${b.height}, c=${c.width}x${c.height})` });
    continue;
  }

  const diff = new PNG({ width: w, height: h });
  const count = pixelmatch(b.data, c.data, diff.data, w, h, { threshold: 0.15, includeAA: false });
  fs.writeFileSync(path.join(diffDir, file), PNG.sync.write(diff));
  const pct = (count / (w * h)) * 100;
  rows.push({ file, pct: +pct.toFixed(2), note: '' });
}

const now = new Date().toISOString();
rows.sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
const numBig = rows.filter(r => (r.pct ?? 0) > 10).length;

const html = `<!doctype html>
<meta charset="utf-8">
<title>Visual diff · InstaSecure</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; padding: 32px; max-width: 1400px; margin: 0 auto; color: #0f172a; }
  h1 { margin: 0 0 4px; }
  .meta { color: #64748b; margin-bottom: 24px; font-size: 14px; }
  .summary { background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 12px; margin-bottom: 28px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border-top: 1px solid #e2e8f0; padding: 12px; vertical-align: top; text-align: left; }
  th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; font-weight: 700; }
  td.file { font-family: ui-monospace, monospace; font-size: 13px; font-weight: 600; }
  td.pct { font-weight: 700; font-size: 18px; text-align: right; width: 80px; }
  td.pct.hi { color: #dc2626; }
  td.pct.md { color: #ea580c; }
  td.pct.lo { color: #16a34a; }
  td.pct.na { color: #94a3b8; font-weight: 400; font-style: italic; font-size: 14px; }
  img { max-width: 300px; border: 1px solid #e2e8f0; border-radius: 4px; display: block; }
  .note { color: #64748b; font-size: 12px; font-style: italic; display: block; margin-top: 4px; }
</style>
<h1>Visual diff</h1>
<div class="meta">Generated ${now} — ${rows.length} pages compared</div>
<div class="summary">
  <strong>${numBig}</strong> pages with &gt;10% diff · <strong>${rows.filter(r=>(r.pct??0)===0).length}</strong> pixel-identical · baseline: squarespace, current: astro preview
</div>
<table>
  <thead>
    <tr><th>File</th><th>% diff</th><th>Baseline (squarespace)</th><th>Current (astro)</th><th>Diff</th></tr>
  </thead>
  <tbody>
    ${rows.map(r => {
      const pct = r.pct;
      const cls = pct === null ? 'na' : pct > 30 ? 'hi' : pct > 10 ? 'md' : 'lo';
      return `<tr>
        <td class="file">${r.file}${r.note ? `<span class="note">${r.note}</span>` : ''}</td>
        <td class="pct ${cls}">${pct === null ? '—' : pct + '%'}</td>
        <td><img src="baseline/${r.file}" loading="lazy"></td>
        <td><img src="current/${r.file}" loading="lazy"></td>
        <td><img src="diff/${r.file}" loading="lazy"></td>
      </tr>`;
    }).join('')}
  </tbody>
</table>
`;
fs.writeFileSync(path.join(root, 'report.html'), html);
console.log(`Wrote ${root}/report.html — ${rows.length} pages, ${numBig} with >10% diff`);
