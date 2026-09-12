import type { PreviewBlock } from '../project/compiler';
import { blockContentSchema, parseYouTubeVideoId } from '../contracts/blocks';

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
    case 'activities': {
      const parsed = blockContentSchema.safeParse(c);
      if (!parsed.success || parsed.data.type !== 'activities') {
        return '<p class="bwak-placeholder">Invalid activities content. Run build-with-ak validate.</p>';
      }
      const items = [...parsed.data.items].sort((a, b) => b.date.localeCompare(a.date));
      const rows = items.map((item) => `<li><time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>
        <h3>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>` : escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p></li>`).join('');
      return `<div class="bwak-activities"><h2>${escapeHtml(parsed.data.title)}</h2>${rows ? `<ol>${rows}</ol>` : '<p>No activities yet.</p>'}</div>`;
    }
    case 'pulse': {
      return `<div class="bwak-pulse"><h2>${escapeHtml(c.title ?? 'Pulse')}</h2>
        <p class="bwak-pulse__status">Not monitored in preview</p>
        <div class="bwak-pulse__line" aria-hidden="true"></div>
        <p>Health checks begin after publication and target the published product website. No monitoring samples are available in local preview.</p></div>`;
    }
    case 'video': {
      const videoId = typeof c.url === 'string' ? parseYouTubeVideoId(c.url) : null;
      if (!videoId) return '<p class="bwak-placeholder">Invalid YouTube video URL.</p>';
      return `<div class="bwak-video"><h2>${escapeHtml(c.title ?? 'Video')}</h2>
        <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a>
        ${c.caption ? `<p>${escapeHtml(c.caption)}</p>` : ''}</div>`;
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
