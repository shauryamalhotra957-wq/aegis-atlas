/**
 * Command Center Resilience & Telemetry Engine.
 * Features Circuit Breaker, Exponential Jitter Retry, and Degradation Fallbacks.
 */

export class CommandCircuitOpenError extends Error {
  constructor(message = "Circuit is currently OPEN") {
    super(message);
    this.name = "CommandCircuitOpenError";
  }
}

export class CommandCircuitBreaker {
  constructor({ failureThreshold = 5, recoveryTimeoutMs = 500 } = {}) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeoutMs = recoveryTimeoutMs;
    this.failureCount = 0;
    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
    this.lastFailureTime = 0;
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  recordFailure() {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }

  canExecute() {
    if (this.state === "CLOSED") return true;
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime >= this.recoveryTimeoutMs) {
        this.state = "HALF_OPEN";
        return true;
      }
      return false;
    }
    if (this.state === "HALF_OPEN") return true;
    return false;
  }
}

export async function resilientCommandExecute(fn, {
  fallback = null,
  maxRetries = 3,
  baseDelayMs = 10,
  circuitBreaker = null
} = {}) {
  if (circuitBreaker && !circuitBreaker.canExecute()) {
    if (fallback) return fallback();
    throw new CommandCircuitOpenError();
  }

  let attempts = 0;
  let lastError = null;

  while (attempts < maxRetries) {
    try {
      const result = await fn();
      if (circuitBreaker) circuitBreaker.recordSuccess();
      return result;
    } catch (err) {
      attempts += 1;
      lastError = err;
      if (circuitBreaker) circuitBreaker.recordFailure();

      if (attempts < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempts - 1) + Math.random() * 5;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  if (fallback) return fallback();
  throw lastError;
}
