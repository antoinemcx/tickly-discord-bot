import { displayDetailedError } from "@src/utils/logger";
import Redis from "ioredis";

/**
 * Redis-backed caching layer.
 *
 * All public methods are silent no-ops when the service is unavailable,
 * so callers never need to check availability before calling them.
 * Must be initialised by calling {@link initialize} before use.
 */
export class RedisService {
  private readonly client: Redis;
  private readonly maxMemoryMb: number;
  private available: boolean = false;

  /**
   * Creates a RedisService with a lazy connection.
   * The connection is not attempted until {@link initialize} is called.
   *
   * @param host Redis server hostname
   * @param port Redis server port
   * @param maxMemoryMb maximum memory in MB to apply via CONFIG SET on connect
   * @param password optional Redis password: omit for no auth
   */
  public constructor(host: string, port: number, maxMemoryMb: number, password?: string) {
    this.maxMemoryMb = maxMemoryMb;
    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      lazyConnect: true,
    });

    this.client.on("error", (error: Error) => {
      displayDetailedError("Redis connection error.", error);
      this.available = false;
    });
  }

  /**
   * Connects to Redis and applies memory configuration.
   * On connection failure, the service becomes a silent no-op.
   */
  public async initialize(): Promise<void> {
    try {
      await this.client.connect();
      this.available = true;
    } catch (error) {
      displayDetailedError(
        "Failed to connect to Redis. Caching is disabled.",
        error,
      );
      this.available = false;
      return;
    }

    /* Apply memory limits */
    try {
      await this.client.config("SET", "maxmemory", `${this.maxMemoryMb}mb`);
      await this.client.config("SET", "maxmemory-policy", "allkeys-lru");
    } catch (error) { // not fatal
      displayDetailedError(
        "Failed to apply Redis memory configuration. Continuing without memory limits.",
        error,
      );
    }
  }

  /** @returns whether the Redis connection is currently available or not */
  public isAvailable(): boolean {
    return this.available;
  }

  /**
   * Retrieves and JSON-deserialises a cached value by key.
   * Returns null when the key is missing, the service is unavailable, or an
   * error occurs.
   *
   * @param key Redis cache key
   * @returns the deserialised value, or null if not retrievable
   */
  public async get<T>(key: string): Promise<T | null> {
    if (!this.available) {
      return null;
    }

    try {
      const raw = await this.client.get(key);
      return raw === null ? null : JSON.parse(raw) as T;
    } catch (error) {
      displayDetailedError(`Failed to get Redis key '${key}'.`, error);
      return null;
    }
  }

  /**
   * JSON-serialises and stores a value in the cache with a TTL.
   * Silently no-ops when the service is unavailable.
   *
   * @param key Redis cache key
   * @param value the value to cache
   * @param ttlSeconds time-to-live in seconds
   */
  public async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (this.available) {
      try {
        await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
      } catch (error) {
        displayDetailedError(`Failed to set Redis key '${key}'.`, error);
      }
    }
  }

  /**
   * Deletes a key from the cache.
   * Silently no-ops when the service is unavailable.
   *
   * @param key Redis cache key to delete
   */
  public async delete(key: string): Promise<void> {
    if (this.available) {
      try {
        await this.client.del(key);
      } catch (error) {
        displayDetailedError(`Failed to delete Redis key '${key}'.`, error);
      }
    }
  }
}
