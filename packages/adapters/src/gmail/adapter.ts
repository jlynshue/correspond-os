import type { IngestOptions, NormalizedMessage, AdapterHealthResult, DraftResponse, SendResult } from '@correspond-os/shared';
import { generateId } from '@correspond-os/shared';
import { BaseAdapter } from '../base.js';

export interface GmailAdapterConfig {
  /** Gmail accounts to query */
  accounts: string[];
  /** MCP server name (default: 'google-workspace') */
  mcpServer?: string;
  /** Default max results per account */
  defaultMaxResults?: number;
}

interface McpClient {
  call(server: string, tool: string, params: Record<string, unknown>): Promise<unknown>;
}

/**
 * Gmail adapter — ingests unread email from Google Workspace via MCP.
 *
 * Connects to the google-workspace MCP server and uses:
 * - search_gmail_messages (search/filter)
 * - get_gmail_message_content (full body fetch)
 * - draft_gmail_message (save drafts)
 * - send_gmail_message (send with confirmation)
 */
export class GmailAdapter extends BaseAdapter {
  readonly name = 'gmail' as const;
  readonly displayName = 'Gmail';

  private config: Required<GmailAdapterConfig>;
  private mcpClient: McpClient | null = null;

  constructor(config: GmailAdapterConfig, mcpClient?: McpClient) {
    super();
    this.config = {
      accounts: config.accounts,
      mcpServer: config.mcpServer ?? 'google-workspace',
      defaultMaxResults: config.defaultMaxResults ?? 25,
    };
    this.mcpClient = mcpClient ?? null;
  }

  async healthCheck(): Promise<AdapterHealthResult> {
    if (!this.mcpClient) {
      return this.unavailable('MCP client not configured');
    }

    const start = Date.now();
    try {
      // Try a minimal search to verify connectivity
      await this.mcpClient.call(this.config.mcpServer, 'search_gmail_messages', {
        user_google_email: this.config.accounts[0],
        query: 'is:unread',
        page_size: 1,
      });
      return this.healthy('Gmail MCP connected', Date.now() - start);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return this.unavailable(`Gmail MCP error: ${message}`);
    }
  }

  async ingest(options: IngestOptions = {}): Promise<NormalizedMessage[]> {
    if (!this.mcpClient) {
      return [];
    }

    const messages: NormalizedMessage[] = [];
    const maxResults = options.maxResults ?? this.config.defaultMaxResults;
    const query = this.buildQuery(options);

    for (const account of this.config.accounts) {
      try {
        const result = await this.mcpClient.call(this.config.mcpServer, 'search_gmail_messages', {
          user_google_email: account,
          query,
          page_size: maxResults,
        });

        const parsed = this.parseSearchResult(result, account);
        messages.push(...parsed);
      } catch (err) {
        // Graceful degradation: log error, continue with other accounts
        console.warn(`[GmailAdapter] Failed to ingest from ${account}:`, err);
      }
    }

    return messages;
  }

  async send(draft: DraftResponse): Promise<SendResult> {
    if (!this.mcpClient) {
      return { success: false, error: 'MCP client not configured', channel: 'gmail', sentAt: new Date() };
    }

    try {
      // Default to draft mode (never auto-send)
      const result = await this.mcpClient.call(this.config.mcpServer, 'draft_gmail_message', {
        user_google_email: this.config.accounts[0],
        to: draft.itemId, // The recipient would come from the queue item
        subject: draft.subject,
        body: draft.body,
      });

      return {
        success: true,
        messageId: typeof result === 'object' && result !== null ? (result as any).id : undefined,
        channel: 'gmail',
        sentAt: new Date(),
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Send failed',
        channel: 'gmail',
        sentAt: new Date(),
      };
    }
  }

  /** Build a Gmail search query from IngestOptions */
  private buildQuery(options: IngestOptions): string {
    const parts: string[] = ['is:unread'];

    if (options.since) {
      const dateStr = options.since.toISOString().split('T')[0];
      parts.push(`after:${dateStr}`);
    }

    if (options.filters) {
      if (options.filters.from) parts.push(`from:${options.filters.from}`);
      if (options.filters.subject) parts.push(`subject:${options.filters.subject}`);
      if (options.filters.label) parts.push(`label:${options.filters.label}`);
    }

    return parts.join(' ');
  }

  /** Parse MCP search results into NormalizedMessages */
  private parseSearchResult(result: unknown, account: string): NormalizedMessage[] {
    // The MCP google-workspace tool returns a string with message data
    const resultStr = typeof result === 'object' && result !== null
      ? (result as any).result ?? JSON.stringify(result)
      : String(result);

    const messages: NormalizedMessage[] = [];

    // Parse the result string (format varies by MCP implementation)
    // This handles the common format: "Message ID: xxx | Thread ID: yyy | Subject: zzz"
    const messageBlocks = resultStr.split(/Message \d+:/);

    for (const block of messageBlocks) {
      if (!block.trim()) continue;

      const subject = this.extractField(block, 'Subject') ?? 'No subject';
      const from = this.extractField(block, 'From') ?? 'Unknown';
      const date = this.extractField(block, 'Date');
      const messageId = this.extractField(block, 'Message ID') ?? this.extractField(block, 'ID');

      messages.push({
        id: generateId(),
        source: 'gmail',
        sourceMessageId: messageId ?? undefined,
        contactName: this.extractName(from),
        contactEmail: this.extractEmail(from),
        subject,
        bodySnippet: this.extractField(block, 'Snippet') ?? undefined,
        timestamp: date ? new Date(date) : new Date(),
        channel: 'gmail',
        urgencySignals: [],
        relationshipTier: 'unknown',
        metadata: { account, messageId },
      });
    }

    return messages;
  }

  /** Extract a field value from a text block */
  private extractField(block: string, field: string): string | null {
    const regex = new RegExp(`${field}:\\s*(.+?)(?:\\n|$)`, 'i');
    const match = block.match(regex);
    return match?.[1]?.trim() ?? null;
  }

  /** Extract display name from "Name <email>" format */
  private extractName(from: string): string {
    const match = from.match(/^(.+?)\s*<.+>$/);
    return match?.[1]?.trim().replace(/"/g, '') ?? from;
  }

  /** Extract email from "Name <email>" format */
  private extractEmail(from: string): string | undefined {
    const match = from.match(/<(.+?)>/);
    return match?.[1] ?? (from.includes('@') ? from : undefined);
  }
}
