import { describe, test, expect, mock } from 'bun:test';
import { OutlookAdapter } from './adapter.js';

const mockMcpClient = {
  call: mock(async (server: string, tool: string, params: Record<string, unknown>) => {
    if (tool === 'get-auth-status') {
      return {
        isReady: true,
        tokenStatus: { isExpired: false, expiresOn: '2026-05-07T00:00:00Z' },
        graphPermissionScopes: ['Mail.Read', 'Mail.ReadWrite', 'Calendars.Read'],
      };
    }
    if (tool === 'Lokka-Microsoft') {
      const path = (params as any).path;
      if (path === '/me/messages' && (params as any).method === 'get') {
        return {
          raw: JSON.stringify({
            value: [
              {
                id: 'msg-outlook-001',
                subject: 'Q2 Planning Review',
                from: { emailAddress: { name: 'Robert McDonnell', address: 'robert@anubatechnologies.com' } },
                receivedDateTime: '2026-05-06T10:30:00Z',
                flag: { flagStatus: 'flagged' },
                isRead: false,
                importance: 'high',
                bodyPreview: 'Hi Jon, please review the Q2 planning document...',
                hasAttachments: true,
              },
              {
                id: 'msg-outlook-002',
                subject: 'Weekly GTM Sync',
                from: { emailAddress: { name: 'Dave Mathews', address: 'dave@anubatechnologies.com' } },
                receivedDateTime: '2026-05-06T09:00:00Z',
                flag: { flagStatus: 'notFlagged' },
                isRead: false,
                importance: 'normal',
                bodyPreview: 'Reminder: GTM sync at 2pm today...',
                hasAttachments: false,
              },
            ],
          }),
        };
      }
      if (path === '/me/messages' && (params as any).method === 'post') {
        return { id: 'draft-outlook-001', isDraft: true };
      }
    }
    return {};
  }),
};

describe('OutlookAdapter', () => {
  const adapter = new OutlookAdapter({}, mockMcpClient as any);

  test('healthCheck returns healthy when auth is valid with mail scopes', async () => {
    const result = await adapter.healthCheck();
    expect(result.status).toBe('healthy');
    expect(result.latencyMs).toBeDefined();
  });

  test('healthCheck returns unavailable when token is expired', async () => {
    const expiredClient = {
      call: mock(async () => ({
        isReady: true,
        tokenStatus: { isExpired: true },
        graphPermissionScopes: [],
      })),
    };
    const expiredAdapter = new OutlookAdapter({}, expiredClient as any);
    const result = await expiredAdapter.healthCheck();
    expect(result.status).toBe('unavailable');
    expect(result.message).toContain('expired');
  });

  test('healthCheck returns degraded when missing Mail.Read scope', async () => {
    const noScopeClient = {
      call: mock(async () => ({
        isReady: true,
        tokenStatus: { isExpired: false },
        graphPermissionScopes: ['User.Read'],
      })),
    };
    const noScopeAdapter = new OutlookAdapter({}, noScopeClient as any);
    const result = await noScopeAdapter.healthCheck();
    expect(result.status).toBe('degraded');
  });

  test('healthCheck returns unavailable without MCP client', async () => {
    const noMcp = new OutlookAdapter({});
    const result = await noMcp.healthCheck();
    expect(result.status).toBe('unavailable');
  });

  test('ingest returns normalized messages from Graph API', async () => {
    const messages = await adapter.ingest();
    expect(messages).toHaveLength(2);

    const first = messages[0]!;
    expect(first.source).toBe('outlook');
    expect(first.channel).toBe('outlook');
    expect(first.contactName).toBe('Robert McDonnell');
    expect(first.contactEmail).toBe('robert@anubatechnologies.com');
    expect(first.subject).toBe('Q2 Planning Review');
    expect(first.urgencySignals).toContain('flagged');
    expect(first.urgencySignals).toContain('high-importance');
  });

  test('ingest applies since filter to OData query', async () => {
    mockMcpClient.call.mockClear();
    await adapter.ingest({ since: new Date('2026-05-01T00:00:00Z') });

    const lokkaCall = mockMcpClient.call.mock.calls.find(
      (c) => c[1] === 'Lokka-Microsoft',
    );
    const params = lokkaCall?.[2] as any;
    expect(params.queryParams['$filter']).toContain('receivedDateTime ge 2026-05-01');
  });

  test('ingest applies from filter to OData query', async () => {
    mockMcpClient.call.mockClear();
    await adapter.ingest({ filters: { from: 'robert@anubatechnologies.com' } });

    const lokkaCall = mockMcpClient.call.mock.calls.find(
      (c) => c[1] === 'Lokka-Microsoft',
    );
    const params = lokkaCall?.[2] as any;
    expect(params.queryParams['$filter']).toContain("contains(from/emailAddress/address, 'robert@anubatechnologies.com')");
  });

  test('send creates a draft via Graph API (never auto-sends)', async () => {
    const result = await adapter.send!({
      itemId: 'robert@anubatechnologies.com',
      subject: 'Re: Q2 Planning Review',
      body: 'Thanks Robert, I will review today.',
      channel: 'outlook',
      tone: 'warm',
      status: 'draft',
      createdAt: new Date(),
    });

    expect(result.success).toBe(true);
    expect(result.channel).toBe('outlook');

    // Verify it called POST /me/messages with isDraft: true
    const postCall = mockMcpClient.call.mock.calls.find(
      (c) => c[1] === 'Lokka-Microsoft' && (c[2] as any).method === 'post',
    );
    expect(postCall).toBeDefined();
    expect((postCall![2] as any).body.isDraft).toBe(true);
  });

  test('ingest returns empty array without MCP client', async () => {
    const noMcp = new OutlookAdapter({});
    const messages = await noMcp.ingest();
    expect(messages).toEqual([]);
  });

  test('ingest extracts metadata (hasAttachments, importance)', async () => {
    const messages = await adapter.ingest();
    const first = messages[0]!;
    expect(first.metadata.hasAttachments).toBe(true);
    expect(first.metadata.importance).toBe('high');
  });
});
