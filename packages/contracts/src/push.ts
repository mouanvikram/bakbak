import { z } from "zod";

// The VAPID public key the browser needs to create a push subscription.
// `null` means web push isn't configured on this server — clients silently
// stay on socket-only notifications.
export const pushConfigResponseSchema = z.object({
  publicKey: z.string().nullish(),
});

export type PushConfigResponseType = z.infer<typeof pushConfigResponseSchema>;

// A browser PushSubscription, sent as-is by the client. `endpoint` uniquely
// identifies the device (and is the update/delete key); the keys let the
// server encrypt payloads for it.
export const pushSubscriptionRequestSchema = z.object({
  endpoint: z.string().url().max(500),
  keys: z.object({
    p256dh: z.string().min(1).max(300),
    auth: z.string().min(1).max(300),
  }),
});

export type PushSubscriptionRequestType = z.infer<
  typeof pushSubscriptionRequestSchema
>;

export const pushSubscribeResponseSchema = z.object({
  ok: z.boolean(),
});

export type PushSubscribeResponseType = z.infer<
  typeof pushSubscribeResponseSchema
>;

export interface PushUpsertDto {
  userId: string;
  subscription: PushSubscriptionRequestType;
  userAgent?: string;
}

export interface PushDeleteDto {
  userId: string;
  subscription: PushSubscriptionRequestType;
}