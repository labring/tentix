import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const userIdValidator = zValidator(
  "query",
  z.object({
    userId: z.string(),
  }),
);


export const contentBlockType = z
  .object({
    type: z.enum(["text", "image", "code", "link", "mention", "quote", "file"]),
    meta: z.string(),
  });
export type ContentBlock = z.infer<typeof contentBlockType>;

export function isContentBlockArray(
  obj: any,
): asserts obj is ContentBlock[] {
  if (contentBlockType.safeParse(obj).success) {
    throw new ValidationError("Content block type is invalid!");
  }
}
