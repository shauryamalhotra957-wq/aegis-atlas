import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CommandCircuitBreaker, CommandCircuitOpenError, resilientCommandExecute } from '../src/utils/commandResilience.mjs';

describe('Command Center Resilience & Boundary Suite', () => {
  test('CommandCircuitBreaker transitions to OPEN upon consecutive telemetry errors', () => {
    const cb = new CommandCircuitBreaker({ failureThreshold: 3, recoveryTimeoutMs: 100 });
    assert.equal(cb.state, 'CLOSED');
    assert.equal(cb.canExecute(), true);

    cb.recordFailure();
    cb.recordFailure();
    assert.equal(cb.state, 'CLOSED');

    cb.recordFailure();
    assert.equal(cb.state, 'OPEN');
    assert.equal(cb.canExecute(), false);
  });

  test('CommandCircuitBreaker recovers to HALF_OPEN after timeout and closes on telemetry restore', async () => {
    const cb = new CommandCircuitBreaker({ failureThreshold: 2, recoveryTimeoutMs: 50 });
    cb.recordFailure();
    cb.recordFailure();
    assert.equal(cb.state, 'OPEN');

    await new Promise((r) => setTimeout(r, 60));
    assert.equal(cb.canExecute(), true);
    assert.equal(cb.state, 'HALF_OPEN');

    cb.recordSuccess();
    assert.equal(cb.state, 'CLOSED');
  });

  test('resilientCommandExecute safely invokes fallback upon telemetry feed failure', async () => {
    let attempts = 0;
    const failingFeed = async () => {
      attempts += 1;
      throw new Error('Satellite signal loss');
    };

    const cachedTelemetry = { status: 'OFFLINE_CACHE', satsTracked: 48 };
    const res = await resilientCommandExecute(failingFeed, {
      fallback: () => cachedTelemetry,
      maxRetries: 3,
      baseDelayMs: 5
    });

    assert.equal(attempts, 3);
    assert.deepEqual(res, cachedTelemetry);
  });

  test('resilientCommandExecute succeeds and returns telemetry payload', async () => {
    const liveTelemetry = { status: 'OPTIMAL_TELEMETRY', fps: 60 };
    const res = await resilientCommandExecute(async () => liveTelemetry);
    assert.deepEqual(res, liveTelemetry);
  });
});
