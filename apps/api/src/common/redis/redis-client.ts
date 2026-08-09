import { createHash } from 'crypto';
import net from 'net';
import tls from 'tls';

type RedisValue = string | number | null | RedisValue[];

type PendingCommand = {
  resolve: (value: RedisValue) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

const DEFAULT_COMMAND_TIMEOUT_MS = 500;

class LightweightRedisClient {
  private socket: net.Socket | tls.TLSSocket | null = null;
  private buffer = Buffer.alloc(0);
  private pending: PendingCommand[] = [];
  private connecting: Promise<void> | null = null;
  private lastError: string | null = null;
  private connected = false;

  constructor(
    private readonly redisUrl = process.env.REDIS_URL,
    private readonly commandTimeoutMs = Number(
      process.env.REDIS_COMMAND_TIMEOUT_MS ?? DEFAULT_COMMAND_TIMEOUT_MS,
    ),
  ) {}

  isConfigured() {
    return Boolean(this.redisUrl?.trim());
  }

  isConnected() {
    return this.connected;
  }

  getLastError() {
    return this.lastError;
  }

  async ping() {
    const result = await this.command('PING');
    return result === 'PONG';
  }

  async get(key: string) {
    const value = await this.command('GET', key);
    return typeof value === 'string' ? value : null;
  }

  async setEx(key: string, seconds: number, value: string) {
    await this.command('SET', key, value, 'EX', String(Math.max(1, Math.floor(seconds))));
  }

  async incr(key: string) {
    const value = await this.command('INCR', key);
    return typeof value === 'number' ? value : Number(value);
  }

  async pexpire(key: string, ms: number) {
    await this.command('PEXPIRE', key, String(Math.max(1, Math.floor(ms))));
  }

  async pttl(key: string) {
    const value = await this.command('PTTL', key);
    return typeof value === 'number' ? value : Number(value);
  }

  async del(key: string) {
    await this.command('DEL', key);
  }

  async command(...parts: string[]) {
    if (!this.isConfigured()) {
      throw new Error('REDIS_URL is not configured.');
    }

    await this.ensureConnected();

    return new Promise<RedisValue>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = this.pending.filter((item) => item !== pending);
        const error = new Error(`Redis command timed out after ${this.commandTimeoutMs}ms.`);
        this.lastError = error.message;
        this.resetConnection();
        reject(error);
      }, this.commandTimeoutMs);

      const pending: PendingCommand = { resolve, reject, timer };
      this.pending.push(pending);

      try {
        this.socket?.write(encodeCommand(parts));
      } catch (error) {
        clearTimeout(timer);
        this.pending.pop();
        const commandError = toError(error);
        this.lastError = commandError.message;
        reject(commandError);
      }
    });
  }

  private async ensureConnected() {
    if (this.connected && this.socket) return;
    if (this.connecting) return this.connecting;

    this.connecting = new Promise<void>((resolve, reject) => {
      const parsed = new URL(this.redisUrl!);
      const port = parsed.port ? Number(parsed.port) : 6379;
      const host = parsed.hostname;
      const password = decodeURIComponent(parsed.password || '');
      const username = decodeURIComponent(parsed.username || '');
      const database = parsed.pathname.replace('/', '');
      const useTls = parsed.protocol === 'rediss:';
      const socket = useTls ? tls.connect({ host, port }) : net.connect({ host, port });

      const fail = (error: Error) => {
        this.lastError = error.message;
        this.connected = false;
        this.socket = null;
        reject(error);
      };

      socket.once('error', fail);
      socket.once(useTls ? 'secureConnect' : 'connect', async () => {
        socket.off('error', fail);
        this.socket = socket;
        this.connected = true;
        this.lastError = null;
        this.attachSocketHandlers(socket);

        try {
          if (password) {
            if (username) await this.command('AUTH', username, password);
            else await this.command('AUTH', password);
          }
          if (database) await this.command('SELECT', database);
          resolve();
        } catch (error) {
          fail(toError(error));
        }
      });
    }).finally(() => {
      this.connecting = null;
    });

    return this.connecting;
  }

  private attachSocketHandlers(socket: net.Socket | tls.TLSSocket) {
    socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.flushResponses();
    });

    socket.on('error', (error) => {
      this.lastError = error.message;
      this.connected = false;
      this.rejectPending(error);
    });

    socket.on('close', () => {
      this.connected = false;
      this.socket = null;
      this.rejectPending(new Error('Redis connection closed.'));
    });
  }

  private flushResponses() {
    while (this.pending.length) {
      const parsed = parseResp(this.buffer);
      if (!parsed) return;

      this.buffer = this.buffer.subarray(parsed.bytes);
      const pending = this.pending.shift()!;
      clearTimeout(pending.timer);

      if (parsed.value instanceof Error) {
        this.lastError = parsed.value.message;
        pending.reject(parsed.value);
      } else {
        pending.resolve(parsed.value);
      }
    }
  }

  private rejectPending(error: Error) {
    for (const pending of this.pending.splice(0)) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
  }

  private resetConnection() {
    this.buffer = Buffer.alloc(0);
    this.connected = false;
    this.socket?.destroy();
    this.socket = null;
  }
}

export const redisClient = new LightweightRedisClient();

export function hashRedisKey(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function encodeCommand(parts: string[]) {
  const chunks = [`*${parts.length}\r\n`];
  for (const part of parts) {
    const value = Buffer.from(part);
    chunks.push(`$${value.length}\r\n${part}\r\n`);
  }
  return chunks.join('');
}

function parseResp(buffer: Buffer): { value: RedisValue | Error; bytes: number } | null {
  if (!buffer.length) return null;

  const type = String.fromCharCode(buffer[0]);
  const lineEnd = buffer.indexOf('\r\n');
  if (lineEnd === -1) return null;

  const line = buffer.subarray(1, lineEnd).toString('utf8');

  if (type === '+') return { value: line, bytes: lineEnd + 2 };
  if (type === '-') return { value: new Error(line), bytes: lineEnd + 2 };
  if (type === ':') return { value: Number(line), bytes: lineEnd + 2 };

  if (type === '$') {
    const length = Number(line);
    if (length === -1) return { value: null, bytes: lineEnd + 2 };
    const start = lineEnd + 2;
    const end = start + length;
    if (buffer.length < end + 2) return null;
    return {
      value: buffer.subarray(start, end).toString('utf8'),
      bytes: end + 2,
    };
  }

  if (type === '*') {
    const count = Number(line);
    if (count === -1) return { value: null, bytes: lineEnd + 2 };

    const values: RedisValue[] = [];
    let offset = lineEnd + 2;
    for (let i = 0; i < count; i += 1) {
      const parsed = parseResp(buffer.subarray(offset));
      if (!parsed) return null;
      if (parsed.value instanceof Error) return { value: parsed.value, bytes: offset + parsed.bytes };
      values.push(parsed.value);
      offset += parsed.bytes;
    }
    return { value: values, bytes: offset };
  }

  return { value: new Error(`Unsupported Redis RESP type: ${type}`), bytes: buffer.length };
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}
