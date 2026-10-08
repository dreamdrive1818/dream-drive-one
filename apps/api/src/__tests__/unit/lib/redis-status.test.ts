import { isTransientRedisError, redisNeedsConnect, redisStatusDead } from '../../../lib/redis-status';

describe('redisStatusDead', () => {
  it('treats missing, end, and close as dead', () => {
    expect(redisStatusDead(undefined)).toBe(true);
    expect(redisStatusDead(null)).toBe(true);
    expect(redisStatusDead('end')).toBe(true);
    expect(redisStatusDead('close')).toBe(true);
  });

  it('treats ready/wait as reusable', () => {
    expect(redisStatusDead('ready')).toBe(false);
    expect(redisStatusDead('wait')).toBe(false);
    expect(redisStatusDead('connecting')).toBe(false);
  });
});

describe('redisNeedsConnect', () => {
  it('is true only for wait/connecting', () => {
    expect(redisNeedsConnect('wait')).toBe(true);
    expect(redisNeedsConnect('connecting')).toBe(true);
    expect(redisNeedsConnect('ready')).toBe(false);
    expect(redisNeedsConnect('end')).toBe(false);
  });
});

describe('isTransientRedisError', () => {
  it('matches closed-connection ping failures from production logs', () => {
    expect(isTransientRedisError('Connection is closed.')).toBe(true);
    expect(isTransientRedisError('connect ETIMEDOUT')).toBe(true);
    expect(isTransientRedisError('READONLY')).toBe(false);
  });
});
