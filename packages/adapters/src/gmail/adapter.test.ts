import { describe, test, expect, mock } from 'bun:test';
import { GmailAdapter } from './adapter.js';

const mockMcpClient = {
  call: mock(async (server: string, tool: string, params: Record<string, unknown>) => {
    if (tool === 'search_gmail_messages') {
      return {
        result: `Found 2 messages:

Message 1:
  Message ID: msg-001
  Subject: Partnership Proposal
  From: Leon Davoyan <leon@dhc.com>
  Date: 2026-05-06T10:00:00Z
  Snippet: Hi Jon, wanted to follow up on our conversation...

Message 2:
  Message ID: msg-002
  Subject: Invoice #4521
  From: billing@vendor.com
  Date: 2026-05-06T09:00:00Z
  Snippet: Your invoice is ready for review...`,
      };
    }
    if (tool === 'draft_gmail_message') {
      return { id: 'draft-123', status: 'created' };
    }
    return {};
  }),
};

describe('GmailAdapter', () => {
  const adapter = new GmailAdapter(
    { accounts: ['test@gmail.com', 'work@gmail.com'] },
    mockMcpClient as any,
  );

  test('healthCheck returns healthy when MCP responds', async () => {
    const result = await adapter.healthCheck();
    expect(result.status).toBe('healthy');
    expect(result.latencyMs).toBeDefined();
  });

  test('healthCheck returns unavailable without MCP client', async () => {
    const noMcp = new GmailAdapter({ accounts: ['test@gmail.com'] });
    const result = await noMcp.healthCheck();
    expect(result.status).toBe('unavailable');
  });

  test('ingest returns normalized messages', async () => {
    const messages = await adapter.ingest();
    expect(messages.length).toBeGreaterThan(0);

    const first = messages[0]!;
    expect(first.source).toBe('gmail');
    expect(first.channel).toBe('gmail');
    expect(first.contactName).toBeDefined();
    expect(first.subject).toBeDefined();
  });

  test('ingest parses contact name and email', async () => {
    const messages = await adapter.ingest();
    const leon = messages.find((m) => m.contactName === 'Leon Davoyan');
    expect(leon).toBeDefined();
    expect(leon!.contactEmail).toBe('leon@dhc.com');
  });

  test('ingest builds query with filters', async () => {
    await adapter.ingest({
      since: new Date('2026-05-01'),
      filters: { from: 'leon@dhc.com' },
    });

    const lastCall = mockMcpClient.call.mock.calls.at(-1);
    const params = lastCall?.[2] as any;
    expect(params.query).toContain('after:2026-05-01');
    expect(params.query).toContain('from:leon@dhc.com');
  });

  test('ingest queries all configured accounts', async () => {
    mockMcpClient.call.mockClear();
    await adapter.ingest();

    const searchCalls = mockMcpClient.call.mock.calls.filter(
      (c) => c[1] === 'search_gmail_messages',
    );
    expect(searchCalls.length).toBe(2); // two accounts
  });

  test('send creates a draft via MCP', async () => {
    const result = await adapter.send!({
      itemId: 'leon@dhc.com',
      subject: 'Re: Partnership',
      body: 'Thanks for reaching out...',
      channel: 'gmail',
      templateUsed: 'follow-up-warm',
      tone: 'professional',
      status: 'draft',
      createdAt: new Date(),
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('draft-123');
  });

  test('ingest returns empty array without MCP client', async () => {
    const noMcp = new GmailAdapter({ accounts: ['test@gmail.com'] });
    const messages = await noMcp.ingest();
    expect(messages).toEqual([]);
  });
});
