import { describe, it, expect } from 'vitest';
import {
  upsertListingDraftSchema,
  authoringDraftSchema,
  submissionReadinessSchema,
} from '../../src/contracts/listing';

describe('Phase 1: Listing Schema Boundaries & Split Validation', () => {
  const dummyUUID = '123e4567-e89b-12d3-a456-426614174000';

  const validWireListing = {
    name: 'AgentFlow',
    slug: 'agent-flow-app',
    tagline: 'Autonomous AI workflow orchestrator for teams',
    category: 'ai_agents',
    websiteUrl: 'https://agentflow.dev',
    demoUrl: 'https://demo.agentflow.dev',
    githubUrl: 'https://github.com/agentflow/agentflow',
    twitterUrl: 'https://x.com/agentflow',
    logoAssetId: dummyUUID,
    coverAssetId: dummyUUID,
    blocks: [
      {
        id: 'block-1',
        order: 0,
        content: {
          type: 'hero_banner',
          title: 'AgentFlow',
          tagline: 'Autonomous AI workflow orchestrator',
          badges: ['TypeScript', 'AI'],
        },
      },
    ],
  };

  it('upsertListingDraftSchema accepts valid wire payload', () => {
    const result = upsertListingDraftSchema.safeParse(validWireListing);
    expect(result.success).toBe(true);
  });

  it('upsertListingDraftSchema rejects non-HTTPS URLs', () => {
    const invalidHttp = {
      ...validWireListing,
      websiteUrl: 'http://insecure.dev',
    };
    const result = upsertListingDraftSchema.safeParse(invalidHttp);
    expect(result.success).toBe(false);
  });

  it('upsertListingDraftSchema rejects reserved system slugs', () => {
    const reserved = {
      ...validWireListing,
      slug: 'admin',
    };
    const result = upsertListingDraftSchema.safeParse(reserved);
    expect(result.success).toBe(false);
  });

  it('authoringDraftSchema permits permissive local drafts with empty optional fields', () => {
    const inProgressDraft = {
      name: 'Draft App',
      slug: 'draft-app',
      tagline: '', // empty allowed in draft
      category: 'developer_tools',
      websiteUrl: '', // empty allowed in draft
      logoMediaRef: './assets/logo.png', // local mediaRef allowed in draft
      blocks: [],
    };
    const result = authoringDraftSchema.safeParse(inProgressDraft);
    expect(result.success).toBe(true);
  });

  it('submissionReadinessSchema enforces local completeness before submit', () => {
    const incompleteDraft = {
      name: 'Draft App',
      slug: 'draft-app',
      tagline: 'Short', // Less than 5 chars
      category: 'developer_tools',
      websiteUrl: 'https://draft.dev',
      logoAssetId: dummyUUID,
      blocks: [], // Empty blocks
    };
    const result = submissionReadinessSchema.safeParse(incompleteDraft);
    expect(result.success).toBe(false);

    const readyDraft = {
      ...validWireListing,
    };
    const readyResult = submissionReadinessSchema.safeParse(readyDraft);
    expect(readyResult.success).toBe(true);
  });
});
