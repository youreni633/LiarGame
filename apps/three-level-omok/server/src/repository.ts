import type { GameEvent, GameState } from "@three-level-omok/game-engine";
import { prisma } from "@three-level-omok/db";

export async function persistMatch(matchId: string, state: GameState, events: GameEvent[]): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await prisma.match.update({
      where: { id: matchId },
      data: {
        revision: state.revision,
        status: state.matchStatus,
        snapshot: state as unknown as object,
        events: {
          createMany: {
            data: events.map((item) => ({
              sequence: item.revision,
              type: item.type,
              playerId: item.playerId,
              payload: item.payload as object,
              occurredAt: new Date(item.at),
            })),
            skipDuplicates: true,
          },
        },
        commands: {
          createMany: {
            data: events.map((item) => ({ commandId: `${matchId}:${item.revision}`, revision: item.revision })),
            skipDuplicates: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("three-level-omok persistence failed", error);
  }
}
