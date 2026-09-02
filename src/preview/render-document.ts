import type { PreviewModel } from '../project/compiler';
import { renderBlock, escapeHtml } from './render-blocks';

const BASE_STYLES = `
:root {
  --bg: #0a0a0b; --surface: #141416; --border: #26262b; --text: #f4f4f5;
  --muted: #a1a1aa; --accent: #7c6cff; --radius: 14px;
  font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); line-height: 1.6; }
.bwak-shell { max-width: 960px; margin: 0 auto; padding: 48px 24px 96px; }
.bwak-masthead { display: flex; align-items: center; gap: 16px; padding-bottom: 32px; border-bottom: 1px solid var(--border); margin-bottom: 40px; }
.bwak-masthead__logo { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; background: var(--surface); border: 1px solid var(--border); }
.bwak-masthead__name { font-size: 28px; font-weight: 700; margin: 0; }
.bwak-masthead__tagline { color: var(--muted); margin: 4px 0 0; }
.bwak-block { margin: 40px 0; padding: 28px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.bwak-hero__title { font-size: 40px; font-weight: 800; margin: 0 0 8px; }
.bwak-hero__tagline { font-size: 18px; color: var(--muted); margin: 0 0 16px; }
.bwak-badge, .bwak-tag, .bwak-kit { display: inline-block; padding: 4px 12px; margin: 4px 6px 0 0; font-size: 13px; background: rgba(124,108,255,0.12); color: var(--accent); border-radius: 999px; }
.bwak-columns { display: grid; gap: 20px; }
.bwak-columns--two { grid-template-columns: repeat(2, 1fr); }
.bwak-columns--three { grid-template-columns: repeat(3, 1fr); }
.bwak-columns--bento { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
.bwak-col h3 { margin: 0 0 8px; font-size: 17px; }
.bwak-col p { margin: 0; color: var(--muted); }
.bwak-gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.bwak-image img { width: 100%; border-radius: 10px; display: block; }
.bwak-image--placeholder .bwak-placeholder, .bwak-placeholder { display: flex; align-items: center; justify-content: center; min-height: 160px; background: #1c1c20; border: 1px dashed var(--border); border-radius: 10px; color: var(--muted); font-size: 13px; }
.bwak-quote { border-left: 3px solid var(--accent); padding-left: 20px; margin: 0; font-size: 19px; }
.bwak-quote cite { display: block; margin-top: 12px; font-size: 14px; color: var(--muted); font-style: normal; }
.bwak-cta { display: inline-flex; flex-direction: column; padding: 16px 28px; background: var(--accent); color: #fff; border-radius: 12px; font-weight: 600; }
.bwak-cta__note { font-size: 13px; opacity: 0.85; font-weight: 400; }
figcaption { color: var(--muted); font-size: 13px; margin-top: 6px; }
`;

export interface RenderOptions {
  liveReload?: boolean;
  csp?: string;
}

export function renderDocument(model: PreviewModel, options: RenderOptions = {}): string {
  const logoSrc = model.logo?.localPath ?? model.logo?.assetId ?? '';
  const logoHtml = logoSrc
    ? `<img class="bwak-masthead__logo" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(model.listing.name)} logo" />`
    : `<div class="bwak-masthead__logo"></div>`;

  const blocksHtml = model.blocks.map((b) => renderBlock(b)).join('\n');

  const liveReloadScript = options.liveReload
    ? `<script>
        const es = new EventSource('/__events');
        es.addEventListener('draft-changed', () => location.reload());
      </script>`
    : '';

  const cspMeta = options.csp
    ? `<meta http-equiv="Content-Security-Policy" content="${options.csp.replace(/"/g, '&quot;')}" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${cspMeta}
  <title>${escapeHtml(model.listing.name)} — Build with AK Preview</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <main class="bwak-shell">
    <header class="bwak-masthead">
      ${logoHtml}
      <div>
        <h1 class="bwak-masthead__name">${escapeHtml(model.listing.name)}</h1>
        <p class="bwak-masthead__tagline">${escapeHtml(model.listing.tagline)}</p>
      </div>
    </header>
    ${blocksHtml}
  </main>
  ${liveReloadScript}
</body>
</html>`;
}
