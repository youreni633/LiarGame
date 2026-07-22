import { z } from "zod";

export const positionSchema = z.object({ row: z.number().int().min(0).max(9), column: z.number().int().min(0).max(9) });
export const commandEnvelopeSchema = z.object({
  commandId: z.string().min(1).max(128),
  expectedRevision: z.number().int().nonnegative(),
  now: z.number().int().positive(),
});

export const gameCommandSchema = z.discriminatedUnion("type", [
  commandEnvelopeSchema.extend({ type: z.literal("READY"), playerId: z.string(), ready: z.boolean() }),
  commandEnvelopeSchema.extend({ type: z.literal("START_ROUND"), playerId: z.string(), blackPlayerId: z.string(), whitePlayerId: z.string() }),
  commandEnvelopeSchema.extend({ type: z.literal("OPENING_PLACE"), playerId: z.string(), position: positionSchema }),
  commandEnvelopeSchema.extend({ type: z.literal("PLACE"), playerId: z.string(), position: positionSchema }),
  commandEnvelopeSchema.extend({ type: z.literal("MOVE"), playerId: z.string(), from: positionSchema, to: positionSchema }),
  commandEnvelopeSchema.extend({ type: z.literal("TIMEOUT"), playerId: z.string() }),
  commandEnvelopeSchema.extend({ type: z.literal("FORCED_PASS"), playerId: z.string() }),
  commandEnvelopeSchema.extend({ type: z.literal("ROUND_RESIGN"), playerId: z.string() }),
  commandEnvelopeSchema.extend({ type: z.literal("MATCH_FORFEIT"), playerId: z.string() }),
  commandEnvelopeSchema.extend({ type: z.literal("SELECT_NEXT_COLOR"), playerId: z.string(), color: z.enum(["BLACK", "WHITE"]) }),
  commandEnvelopeSchema.extend({ type: z.literal("START_NEXT_ROUND"), playerId: z.string() }),
]);

export type GameCommandRequest = z.infer<typeof gameCommandSchema>;

export const roomCreateSchema = z.object({ nickname: z.string().trim().min(1).max(24) });
export const roomJoinSchema = z.object({ roomCode: z.string().trim().min(4).max(12), nickname: z.string().trim().min(1).max(24) });
