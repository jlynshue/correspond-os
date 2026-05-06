import type { IngestOptions, NormalizedMessage, AdapterHealthResult, DraftResponse, SendResult } from '@correspond-os/shared';
import { generateId, daysBetween } from '@correspond-os/shared';
import { BaseAdapter } from '../base.js';

export interface OutlookAdapterConfig {
  /** MCP server name (default: 'lokka-microsoft-anuba') */
  mcpServer?: string;
  /** Default max results */
  defaultMaxResults?: number;
  /** User email for display purposes */
  userEmail?: string;
}

interface McpClient {
  call(server: string, tool: string, params: Record<string, unknown>): Promise<unknown>;
}

/**
 * Outlook adapter — ingests email from Microsoft 365 via Lokka MCP (Microsoft Graph API).
 *
 * Uses the Lokka-Microsoft MCP tool which proxies Microsoft Graph API:
 * - GET /me/messages (list/filter messages)
 * - GET /me/messages/{id} (full message content)
 * - POST /me/messages (create draft)
 * - POST /me/sendMail (send — only with explicit user confirmation)
 */
export class OutlookAdapter extends BaseAdapter {
  readonly name = 'outlook' as const;
  readonly displayName = 'Outlook (Microsoft 365)';

  private config: Required<OutlookAdapterConfig>;
  private mcpClient: McpClient | null = null;

  constructor(config: OutlookAdapterConfig = {}, mcpClient?: McpClient) {
    super();
    this.config = {
      mcpServer: config.mcpServer ?? 'lokka-microsoft-anuba',
      defaultMaxResults: config.defaultMaxResults ?? 25,
      userEmail: config.userEmail ?? 'jonathan.lynshue@anubatechnologies.com',
    };
    this.mcpClient = mcpClient ?? null;
  }

  async healthCheck(): Promise<AdapterHealthResult> {
    if (!this.mcpClient) {
      return this.unavailable('MCP client not configured');
    }

    const start = Date.now();
    try {
      const result = await this.mcpClient.call(this.config.mcpServer, 'get-auth-status', {});
      const authData = result as any;

      if (authData?.tokenStatus?.isExpired) {
        return this.unavailable('Lokka token expired — run `az login` to refresh');
      }

      if (!authData?.isReady) {
        return this.unavailable('Lokka MCP not ready');
      }

      // Check for mail scopes
      const scopes = authData?.graphPermissionScopes ?? [];
      const hasMailRead = scopes.some((s: string) => s.toLowerCase().includes('mail.read'));
      if (!hasMailRead) {
        return this.degraded('Connected but missing Mail.Read scope', Date.now() - start);
      }

      return this.healthy('Outlook MCP connected', Date.now() - start);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return this.unavailable(`Outlook MCP error: ${message}`);
    }
  }

  async ingest(options: IngestOptions = {}): Promise<NormalizedMessage[]> {
    if (!this.mcpClient) {
      return [];
    }

    const maxResults = options.maxResults ?? this.config.defaultMaxResults;
    const filter = this.buildODataFilter(options);

    try {
      const result = await this.mcpClient.call(this.config.mcpServer, 'Lokka-Microsoft', {
        apiType: 'graph',
        path: '/me/messages',
        method: 'get',
        queryParams: {
          '$filter': filter,
          '$orderby': 'receivedDateTime desc',
          '$top': String(maxResults),
          '$select': 'id,subject,from,receivedDateTime,flag,isRead,importance,bodyPreview,hasAttachments',
        },
      });

      return this.parseGraphResponse(result);
    } catch (err) {
      console.warn(`[OutlookAdapter] Failed to ingest:`, err);
      return [];
    }
  }

  async send(draft: DraftResponse): Promise<SendResult> {
    if (!this.mcpClient) {
      return { success: false, error: 'MCP client not configured', channel: 'outlook', sentAt: new Date() };
    }

    try {
      // Create draft only — never auto-send
      const result = await this.mcpClient.call(this.config.mcpServer, 'Lokka-Microsoft', {
        apiType: 'graph',
        path: '/me/messages',
        method: 'post',
        body: {
          subject: draft.subject,
          body: { contentType: 'Text', content: draft.body },
          toRecipients: [{ emailAddress: { address: draft.itemId } }],
          isDraft: true,
        },
      });

      const responseData = result as any;
      return {
        success: true,
        messageId: responseData?.id,
        channel: 'outlook',
        sentAt: new Date(),
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Draft creation failed',
        channel: 'outlook',
        sentAt: new Date(),
      };
    }
  }

  /** Build OData $filter from IngestOptions */
  private buildODataFilter(options: IngestOptions): string {
    const parts: string[] = ['isRead eq false'];

    if (options.since) {
      parts.push(`receivedDateTime ge ${options.since.toISOString()}`);
    }

    if (options.filters) {
      if (options.filters.from) {
        parts.push(`contains(from/emailAddress/address, '${options.filters.from}')`);
      }
      if (options.filters.flagged === 'true') {
        parts.push("flag/flagStatus eq 'flagged'");
      }
      if (options.filters.importance) {
        parts.push(`importance eq '${options.filters.importance}'`);
      }
    }

    return parts.join(' and ');
  }

  /** Parse Microsoft Graph /me/messages response into NormalizedMessages */
  private parseGraphResponse(result: unknown): NormalizedMessage[] {
    // Lokka returns { raw: "..." } with stringified JSON inside
    const resultStr = typeof result === 'object' && result !== null
      ? (result as any).raw ?? JSON.stringify(result)
      : String(result);

    try {
      // Try direct JSON parse first
      const parsed = JSON.parse(resultStr);
      if (parsed?.value && Array.isArray(parsed.value)) {
        return parsed.value.map((item: any) => this.graphMessageToNormalized(item));
      }
      // If parsed but no .value, might be the full object differently shaped
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => this.graphMessageToNormalized(item));
      }
      return [];
    } catch {
      // Fallback: parse as text output from Lokka
      return this.parseTextResponse(resultStr);
    }
  }

  /** Convert a Graph API message object to NormalizedMessage */
  private graphMessageToNormalized(item: any): NormalizedMessage {
    const from = item.from?.emailAddress ?? {};
    const urgencySignals: string[] = [];

    if (item.flag?.flagStatus === 'flagged') urgencySignals.push('flagged');
    if (item.importance === 'high') urgencySignals.push('high-importance');

    return {
      id: generateId(),
      source: 'outlook',
      sourceMessageId: item.id,
      contactName: from.name ?? from.address ?? 'Unknown',
      contactEmail: from.address,
      subject: item.subject ?? 'No subject',
      bodySnippet: item.bodyPreview?.substring(0, 200),
      timestamp: new Date(item.receivedDateTime ?? Date.now()),
      channel: 'outlook',
      urgencySignals: urgencySignals as any[],
      relationshipTier: 'unknown',
      metadata: {
        hasAttachments: item.hasAttachments,
        importance: item.importance,
        messageId: item.id,
      },
    };
  }

  /** Fallback: parse Lokka's text-format response */
  private parseTextResponse(text: string): NormalizedMessage[] {
    const messages: NormalizedMessage[] = [];
    // Lokka sometimes returns formatted text — extract what we can
    const subjectMatches = text.matchAll(/"subject"\s*:\s*"([^"]+)"/gi);
    const fromMatches = text.matchAll(/"name"\s*:\s*"([^"]+)"/gi);

    const subjects = [...subjectMatches].map(m => m[1]);
    const froms = [...fromMatches].map(m => m[1]);

    for (let i = 0; i < subjects.length; i++) {
      messages.push({
        id: generateId(),
        source: 'outlook',
        contactName: froms[i] ?? 'Unknown',
        subject: subjects[i] ?? 'No subject',
        timestamp: new Date(),
        channel: 'outlook',
        urgencySignals: [],
        relationshipTier: 'unknown',
        metadata: {},
      });
    }

    return messages;
  }
}
