import { describe, expect, it } from 'vitest';

import { buildOutboxEvent } from '@/lib/integration-outbox';

describe('integration outbox', () => {
  it('creates a pending, versioned event for later delivery', () => {
    const event = buildOutboxEvent({
      id: 'evt-1',
      eventType: 'obligation.completed',
      aggregateType: 'obligation',
      aggregateId: 'date-1',
      occurredAt: '2026-09-01T12:00:00.000Z',
      actor: 'Selina Armstrong',
      payload: { contractId: 'con-1' },
    });
    expect(event.status).toBe('pending');
    expect(event.attemptCount).toBe(0);
    expect(JSON.parse(event.payloadJson)).toMatchObject({
      version: 'integration-outbox-2026.1',
      actor: 'Selina Armstrong',
      contractId: 'con-1',
    });
  });

  it('rejects an event without an aggregate id', () => {
    expect(() =>
      buildOutboxEvent({
        id: 'evt-1',
        eventType: 'contract.amended',
        aggregateType: 'contract',
        aggregateId: '',
        occurredAt: '2026-09-01T12:00:00.000Z',
        actor: 'System',
        payload: {},
      }),
    ).toThrow('aggregate id');
  });
});
