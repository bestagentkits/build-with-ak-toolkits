import { randomUUID } from 'node:crypto';
import type { BuildWithAkBlock } from './blocks';

export type TemplateId =
  | 'minimalist_showcase'
  | 'saas_product_launch'
  | 'devtool_open_source'
  | 'visual_media_app'
  | 'comprehensive_case_study';

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  description: string;
  recommendedFor: string;
  blockTypes: string[];
}

export const BUILD_WITH_AK_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'minimalist_showcase',
    name: 'Minimalist Showcase',
    description: 'Clean and compact 4-block layout focusing on story, key screenshots, and call to action.',
    recommendedFor: 'Early-stage projects, utilities, focused tools',
    blockTypes: ['hero_banner', 'agentkit_story', 'screenshot_gallery', 'outbound_cta'],
  },
  {
    id: 'saas_product_launch',
    name: 'SaaS Product Launch',
    description: 'High-converting launch layout with bento feature grid, social proof, and tech highlights.',
    recommendedFor: 'Commercial SaaS, AI platforms, team collaboration apps',
    blockTypes: ['hero_banner', 'columns (bento)', 'screenshot_gallery', 'maker_quote', 'tech_stack', 'outbound_cta'],
  },
  {
    id: 'devtool_open_source',
    name: 'DevTool & Open Source',
    description: 'Developer-first layout showcasing architecture, agent story, tech stack, and documentation.',
    recommendedFor: 'CLI tools, libraries, SDKs, developer platforms',
    blockTypes: ['hero_banner', 'agentkit_story', 'tech_stack', 'columns (two)', 'screenshot_gallery', 'outbound_cta'],
  },
  {
    id: 'visual_media_app',
    name: 'Visual & Media App',
    description: 'Media-rich presentation with screenshot gallery, bento feature breakdowns, and user quote.',
    recommendedFor: 'Creative tools, video/audio processors, design platforms',
    blockTypes: ['hero_banner', 'screenshot_gallery', 'columns (bento)', 'maker_quote', 'outbound_cta'],
  },
  {
    id: 'comprehensive_case_study',
    name: 'Comprehensive Case Study',
    description: 'In-depth narrative layout with architecture breakdown, maker testimonial, and stack details.',
    recommendedFor: 'Flagship products, enterprise solutions, complex multi-agent systems',
    blockTypes: ['hero_banner', 'agentkit_story', 'columns (two)', 'tech_stack', 'screenshot_gallery', 'maker_quote', 'outbound_cta'],
  },
];

export interface TemplateMetadataInput {
  name: string;
  tagline: string;
  category?: string;
  websiteUrl?: string;
  badges?: string[];
  tags?: string[];
  makerName?: string;
  makerRole?: string;
  quoteSource?: string;
  story?: string;
}

export function instantiateTemplate(templateId: TemplateId, metadata: TemplateMetadataInput): BuildWithAkBlock[] {
  const name = metadata.name || 'Product Showcase';
  const tagline = metadata.tagline || 'Built with AgentKit';
  const badges = metadata.badges && metadata.badges.length > 0 ? metadata.badges.slice(0, 5) : ['AI Powered', 'AgentKit'];
  const tags = metadata.tags && metadata.tags.length > 0 ? metadata.tags.slice(0, 20) : ['TypeScript', 'Node.js', 'AgentKit'];

  switch (templateId) {
    case 'minimalist_showcase':
      return [
        {
          id: randomUUID(),
          order: 0,
          content: {
            type: 'hero_banner',
            title: name,
            tagline,
            badges,
          },
        },
        {
          id: randomUUID(),
          order: 1,
          content: {
            type: 'agentkit_story',
            body: metadata.story || `${name} was created to solve core developer workflow challenges using AgentKit specialized agents and automation.`,
            usedKits: ['engineer'],
          },
        },
        {
          id: randomUUID(),
          order: 2,
          content: {
            type: 'screenshot_gallery',
            images: [],
          },
        },
        {
          id: randomUUID(),
          order: 3,
          content: {
            type: 'outbound_cta',
            label: `Visit ${name}`,
            note: 'Free and open to try',
          },
        },
      ];

    case 'saas_product_launch':
      return [
        {
          id: randomUUID(),
          order: 0,
          content: {
            type: 'hero_banner',
            title: name,
            tagline,
            badges,
          },
        },
        {
          id: randomUUID(),
          order: 1,
          content: {
            type: 'columns',
            variant: 'bento',
            items: [
              {
                heading: 'Autonomous Multi-Agent Core',
                body: 'Orchestrates complex tasks across specialized agents with strict deterministic verification.',
              },
              {
                heading: 'Real-time Telemetry & Feedback',
                body: 'Instant visibility into agent reasoning, tool execution, and delivery status.',
              },
              {
                heading: 'Cloudflare Edge Deployment',
                body: 'Ultra-low latency global execution powered by Workers and Streamable HTTP transports.',
              },
            ],
          },
        },
        {
          id: randomUUID(),
          order: 2,
          content: {
            type: 'screenshot_gallery',
            images: [],
          },
        },
        {
          id: randomUUID(),
          order: 3,
          content: {
            type: 'maker_quote',
            quote: `${name} allows developers and agents to collaborate seamlessly with zero friction.`,
            attribution: metadata.makerName ? `${metadata.makerName}${metadata.makerRole ? `, ${metadata.makerRole}` : ''}` : 'Founder & Lead Engineer',
            quoteSource: metadata.quoteSource || 'Launch Announcement',
          },
        },
        {
          id: randomUUID(),
          order: 4,
          content: {
            type: 'tech_stack',
            tags,
          },
        },
        {
          id: randomUUID(),
          order: 5,
          content: {
            type: 'outbound_cta',
            label: `Get Started with ${name}`,
            note: 'Instant access online',
          },
        },
      ];

    case 'devtool_open_source':
      return [
        {
          id: randomUUID(),
          order: 0,
          content: {
            type: 'hero_banner',
            title: name,
            tagline,
            badges: [...badges.slice(0, 3), 'Open Source'],
          },
        },
        {
          id: randomUUID(),
          order: 1,
          content: {
            type: 'agentkit_story',
            body: metadata.story || `Built with AgentKit engineer tooling, ${name} provides high-performance CLI utilities and MCP servers designed for modern AI development environments.`,
            usedKits: ['engineer', 'app'],
          },
        },
        {
          id: randomUUID(),
          order: 2,
          content: {
            type: 'tech_stack',
            tags,
          },
        },
        {
          id: randomUUID(),
          order: 3,
          content: {
            type: 'columns',
            variant: 'two',
            items: [
              {
                heading: 'CLI & Terminal Studio',
                body: 'Full-featured command-line interface with keyboard-driven TUI layout management.',
              },
              {
                heading: 'Dual-Transport MCP Server',
                body: 'Connect seamlessly via local stdio or edge Streamable HTTP for Claude Desktop and Cursor.',
              },
            ],
          },
        },
        {
          id: randomUUID(),
          order: 4,
          content: {
            type: 'screenshot_gallery',
            images: [],
          },
        },
        {
          id: randomUUID(),
          order: 5,
          content: {
            type: 'outbound_cta',
            label: 'View Repository & Documentation',
            note: 'MIT Licensed',
          },
        },
      ];

    case 'visual_media_app':
      return [
        {
          id: randomUUID(),
          order: 0,
          content: {
            type: 'hero_banner',
            title: name,
            tagline,
            badges,
          },
        },
        {
          id: randomUUID(),
          order: 1,
          content: {
            type: 'screenshot_gallery',
            images: [],
          },
        },
        {
          id: randomUUID(),
          order: 2,
          content: {
            type: 'columns',
            variant: 'bento',
            items: [
              {
                heading: 'High-Fidelity Rendering',
                body: 'Pixel-perfect visual fidelity optimized for dark-mode and modern editorial layouts.',
              },
              {
                heading: 'Asset Pipeline with Cloudflare R2',
                body: 'Direct streaming uploads with anti-tampering verification and CDN delivery.',
              },
              {
                heading: 'Instant Live Preview',
                body: 'Local loopback EventSource server delivers instant updates on every file save.',
              },
            ],
          },
        },
        {
          id: randomUUID(),
          order: 3,
          content: {
            type: 'maker_quote',
            quote: `We focused on visual craft and responsiveness to give users the highest quality experience possible.`,
            attribution: metadata.makerName || 'Product Design Lead',
            quoteSource: metadata.quoteSource || 'Design Retrospective',
          },
        },
        {
          id: randomUUID(),
          order: 4,
          content: {
            type: 'outbound_cta',
            label: `Launch ${name}`,
            note: 'Experience the live demo',
          },
        },
      ];

    case 'comprehensive_case_study':
      return [
        {
          id: randomUUID(),
          order: 0,
          content: {
            type: 'hero_banner',
            title: name,
            tagline,
            badges,
          },
        },
        {
          id: randomUUID(),
          order: 1,
          content: {
            type: 'agentkit_story',
            body: metadata.story || `${name} was developed to provide end-to-end automation across multi-agent workflows, combining high throughput, edge scalability, and robust security controls.`,
            usedKits: ['engineer', 'marketing', 'combo'],
          },
        },
        {
          id: randomUUID(),
          order: 2,
          content: {
            type: 'columns',
            variant: 'two',
            items: [
              {
                heading: 'Architecture & Resilience',
                body: 'Built on decoupled microservices with atomic CAS state transitions preventing concurrency races.',
              },
              {
                heading: 'OAuth 2.1 & Security Gates',
                body: 'Zero-trust protected resource server supporting RFC 9728 metadata and cryptographic token verification.',
              },
            ],
          },
        },
        {
          id: randomUUID(),
          order: 3,
          content: {
            type: 'tech_stack',
            tags,
          },
        },
        {
          id: randomUUID(),
          order: 4,
          content: {
            type: 'screenshot_gallery',
            images: [],
          },
        },
        {
          id: randomUUID(),
          order: 5,
          content: {
            type: 'maker_quote',
            quote: `${name} demonstrated how AI-assisted engineering accelerates product delivery while maintaining rigorous correctness.`,
            attribution: metadata.makerName || 'Principal Systems Architect',
            quoteSource: metadata.quoteSource || 'Engineering Case Study',
          },
        },
        {
          id: randomUUID(),
          order: 6,
          content: {
            type: 'outbound_cta',
            label: `Explore ${name}`,
            note: 'Read the complete case study',
          },
        },
      ];

    default:
      throw new Error(`Unknown template ID: "${templateId}". Available templates: ${BUILD_WITH_AK_TEMPLATES.map((t) => t.id).join(', ')}`);
  }
}
