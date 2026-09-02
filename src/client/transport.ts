import {
  BuildWithAkError,
  BuildWithAkAuthError,
  BuildWithAkConflictError,
  BuildWithAkValidationError,
  BuildWithAkNotFoundError,
  BuildWithAkRateLimitError,
} from './errors';

export type FetchLike = typeof fetch;

export interface TransportConfig {
  apiKey: string;
  baseUrl: string;
  fetch?: FetchLike;
  timeoutMs?: number;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface TransportRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
  options?: RequestOptions;
}

interface ErrorEnvelope {
  error?: string;
  message?: string;
  code?: string;
  details?: unknown;
}

function resolveFetch(explicit?: FetchLike): FetchLike {
  if (explicit) return explicit;
  if (typeof globalThis.fetch === 'function') return globalThis.fetch.bind(globalThis);
  throw new BuildWithAkError('No fetch implementation available in this runtime.', 500, 'NO_FETCH');
}

async function safeParseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function mapErrorResponse(status: number, envelope: ErrorEnvelope | undefined): BuildWithAkError {
  const message = envelope?.error || envelope?.message || `Request failed with status ${status}`;
  const code = envelope?.code;
  const details = envelope?.details;

  if (status === 401 || status === 403) {
    return new BuildWithAkAuthError(message, status);
  }
  if (status === 404) {
    return new BuildWithAkNotFoundError(message);
  }
  if (status === 409) {
    return new BuildWithAkConflictError(message, code || 'STALE_REVISION');
  }
  if (status === 422) {
    return new BuildWithAkValidationError(message, details);
  }
  if (status === 429) {
    return new BuildWithAkRateLimitError(message);
  }
  return new BuildWithAkError(message, status, code, details);
}

export class Transport {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly defaultTimeoutMs: number;

  constructor(config: TransportConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = resolveFetch(config.fetch);
    this.defaultTimeoutMs = config.timeoutMs ?? 30000;
  }

  private buildUrl(path: string, query?: Record<string, string | undefined>): string {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    if (!query) return url;
    const pairs = Object.entries(query).filter(([, v]) => v !== undefined && v !== '') as [string, string][];
    if (pairs.length === 0) return url;
    const qs = pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return `${url}?${qs}`;
  }

  async request<T>(req: TransportRequest): Promise<T> {
    const url = this.buildUrl(req.path, req.query);
    const headers: Record<string, string> = {
      'x-api-key': this.apiKey,
    };

    const init: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(req.body);
    }

    const timeoutMs = req.options?.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Chain caller-provided signal into our controller
    if (req.options?.signal) {
      if (req.options.signal.aborted) {
        controller.abort();
      } else {
        req.options.signal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }
    init.signal = controller.signal;

    let response: Response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new BuildWithAkError(`Request timed out or was cancelled after ${timeoutMs}ms`, 408, 'TIMEOUT');
      }
      throw new BuildWithAkError(`Network request failed: ${(error as Error).message}`, 0, 'NETWORK_ERROR');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const envelope = (await safeParseJson(response)) as ErrorEnvelope | undefined;
      throw mapErrorResponse(response.status, envelope);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await safeParseJson(response)) as T;
  }
}
