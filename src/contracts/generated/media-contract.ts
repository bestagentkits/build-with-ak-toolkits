import { z } from 'zod';

export const uploadIntentBodySchema = z.object({
  kind: z.enum(['logo', 'cover', 'screenshot']),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
});

export const finalizeBodySchema = z.object({
  stagingKey: z.string().min(1),
  kind: z.enum(['logo', 'cover', 'screenshot']),
});

export type UploadIntentBody = z.infer<typeof uploadIntentBodySchema>;
export type FinalizeBody = z.infer<typeof finalizeBodySchema>;
