import { z } from "zod";

export const fcmTokenSchema = z.object({
  id: z.string(),          // the FCM registration token (also the doc id)
  ownerId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type FcmToken = z.infer<typeof fcmTokenSchema>;

export function parseFcmToken(input: unknown): FcmToken {
  return fcmTokenSchema.parse(input);
}
