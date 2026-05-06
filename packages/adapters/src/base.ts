import type { ChannelAdapter, AdapterHealthResult, IngestOptions, NormalizedMessage, SendResult, DraftResponse, Channel } from '@correspond-os/shared';

/**
 * Base adapter class that provides common functionality.
 * Extend this for concrete channel implementations.
 */
export abstract class BaseAdapter implements ChannelAdapter {
  abstract readonly name: Channel;
  abstract readonly displayName: string;
  readonly version = '0.1.0';

  abstract healthCheck(): Promise<AdapterHealthResult>;
  abstract ingest(options: IngestOptions): Promise<NormalizedMessage[]>;

  /** Default send is not supported — override in adapters that support sending */
  async send?(draft: DraftResponse): Promise<SendResult> {
    return {
      success: false,
      error: `Send not supported by ${this.displayName} adapter`,
      channel: this.name,
      sentAt: new Date(),
    };
  }

  /** Helper: create a healthy status */
  protected healthy(message = 'Connected', latencyMs?: number): AdapterHealthResult {
    return { status: 'healthy', message, latencyMs, lastChecked: new Date() };
  }

  /** Helper: create an unavailable status */
  protected unavailable(message: string): AdapterHealthResult {
    return { status: 'unavailable', message, lastChecked: new Date() };
  }

  /** Helper: create a degraded status */
  protected degraded(message: string, latencyMs?: number): AdapterHealthResult {
    return { status: 'degraded', message, latencyMs, lastChecked: new Date() };
  }
}
