export const OUTBOX_EVENT_VERSION = 'integration-outbox-2026.1' as const;

export type OutboxEventInput = {
  id: string;
  eventType: string;
  aggregateType: 'approval_request' | 'contract' | 'obligation' | 'supplier';
  aggregateId: string;
  occurredAt: string;
  actor: string;
  payload: Record<string, unknown>;
};

export function buildOutboxEvent(input: OutboxEventInput) {
  if (
    !input.id.trim() ||
    !input.eventType.trim() ||
    !input.aggregateId.trim()
  ) {
    throw new Error(
      'Outbox events require an id, event type, and aggregate id.',
    );
  }
  return {
    ...input,
    status: 'pending' as const,
    attemptCount: 0,
    payloadJson: JSON.stringify({
      version: OUTBOX_EVENT_VERSION,
      actor: input.actor,
      occurredAt: input.occurredAt,
      ...input.payload,
    }),
  };
}
