import type { PreviewBlock } from '../project/compiler';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderImage(img: Record<string, unknown>): string {
  const src = typeof img.localPath === 'string' ? img.localPath : typeof img.assetId === 'string' ? img.assetId : '';
  const alt = escapeHtml(img.alt);
  const caption = typeof img.caption === 'string' && img.caption ? `<figcaption>${escapeHtml(img.caption)}</figcaption>` : '';
  if (!src) {
    return `<figure class="bwak-image bwak-image--placeholder"><div class="bwak-placeholder">Image pending upload</div>${caption}</figure>`;
  }
  return `<figure class="bwak-image"><img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" />${caption}</figure>`;
}

function renderBlockContent(block: PreviewBlock): string {
  const c = block.content;
  switch (block.type) {
    case 'hero_banner': {
      const badges = Array.isArray(c.badges)
        ? c.badges.map((b) => `<span class="bwak-badge">${escapeHtml(b)}</span>`).join('')
        : '';
      return `<div class="bwak-hero">
        <h1 class="bwak-hero__title">${escapeHtml(c.title)}</h1>
        <p class="bwak-hero__tagline">${escapeHtml(c.tagline)}</p>
        <div class="bwak-hero__badges">${badges}</div>
      </div>`;
    }
    case 'columns': {
      const variant = escapeHtml(c.variant);
      const items = Array.isArray(c.items)
        ? c.items
            .map(
              (item: Record<string, unknown>) =>
                `<div class="bwak-col"><h3>${escapeHtml(item.heading)}</h3><p>${escapeHtml(item.body)}</p></div>`
            )
            .join('')
        : '';
      return `<div class="bwak-columns bwak-columns--${variant}">${items}</div>`;
    }
    case 'agentkit_story': {
      const kits = Array.isArray(c.usedKits)
        ? c.usedKits.map((k) => `<span class="bwak-kit">${escapeHtml(k)}</span>`).join('')
        : '';
      return `<div class="bwak-story"><p>${escapeHtml(c.body)}</p><div class="bwak-story__kits">${kits}</div></div>`;
    }
    case 'tech_stack': {
      const tags = Array.isArray(c.tags)
        ? c.tags.map((t) => `<span class="bwak-tag">${escapeHtml(t)}</span>`).join('')
        : '';
      return `<div class="bwak-tech">${tags}</div>`;
    }
    case 'screenshot_gallery':
    case 'carousel_gallery': {
      const images = Array.isArray(c.images) ? c.images.map((img) => renderImage(img as Record<string, unknown>)).join('') : '';
      return `<div class="bwak-gallery">${images}</div>`;
    }
    case 'image_full': {
      return `<div class="bwak-image-full">${renderImage(c)}</div>`;
    }
    case 'maker_quote': {
      return `<blockquote class="bwak-quote">
        <p>${escapeHtml(c.quote)}</p>
        <cite>${escapeHtml(c.attribution)}${c.quoteSource ? ` — ${escapeHtml(c.quoteSource)}` : ''}</cite>
      </blockquote>`;
    }
    case 'outbound_cta': {
      const note = c.note ? `<span class="bwak-cta__note">${escapeHtml(c.note)}</span>` : '';
      return `<div class="bwak-cta"><span class="bwak-cta__label">${escapeHtml(c.label)}</span>${note}</div>`;
    }
    default:
      return `<div class="bwak-unknown">Unsupported block type: ${escapeHtml(block.type)}</div>`;
  }
}

export function renderBlock(block: PreviewBlock): string {
  return `<section class="bwak-block" data-block-type="${escapeHtml(block.type)}" data-block-id="${escapeHtml(block.id)}">
    ${renderBlockContent(block)}
  </section>`;
}
