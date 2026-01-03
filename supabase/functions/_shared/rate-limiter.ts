/**
 * Simple in-memory rate limiter for Edge Functions
 * Uses a sliding window algorithm with token bucket
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (will be per-instance in Deno Deploy)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns Object with isLimited flag and remaining count
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { isLimited: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // No entry or expired entry - create new
  if (!entry || entry.resetTime < now) {
    const resetTime = now + config.windowMs;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    return { isLimited: false, remaining: config.maxRequests - 1, resetTime };
  }

  // Increment counter
  entry.count += 1;

  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    return { isLimited: true, remaining: 0, resetTime: entry.resetTime };
  }

  return { 
    isLimited: false, 
    remaining: config.maxRequests - entry.count, 
    resetTime: entry.resetTime 
  };
}

/**
 * Extract client identifier from request
 * Priority: Authorization header user ID > IP address > default
 */
export function getClientIdentifier(req: Request): string {
  // Try to get user ID from authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    // Extract JWT token and decode (simplified - in production use proper JWT lib)
    const token = authHeader.replace('Bearer ', '');
    try {
      // Basic JWT decode without verification (Supabase handles auth)
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.sub) {
        return `user:${payload.sub}`;
      }
    } catch {
      // Fall through to IP-based limiting
    }
  }

  // Fall back to IP address
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return `ip:${ip}`;
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(
  remaining: number,
  resetTime: number
): Record<string, string> {
  return {
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
    'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
  };
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  // Strict limit for live price fetching (expensive API calls)
  LIVE_PRICES: {
    maxRequests: 30, // 30 requests
    windowMs: 60 * 1000, // per minute
  },
  // Moderate limit for push notifications
  PUSH_NOTIFICATION: {
    maxRequests: 100, // 100 requests
    windowMs: 60 * 1000, // per minute
  },
  // Generous limit for signal monitoring (internal cron)
  SIGNAL_MONITOR: {
    maxRequests: 1000, // 1000 requests
    windowMs: 60 * 1000, // per minute
  },
} as const;
