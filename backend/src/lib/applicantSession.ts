import { cacheGet, cacheSet } from '../config/redis.js';

const key = (userId: string) => `applicant:session-kill:${userId}`;
const TTL_SECONDS = 60 * 60 * 24 * 400;

export async function invalidateApplicantSessions(userId: string) {
  await cacheSet(key(userId), Date.now(), TTL_SECONDS);
}

export async function applicantSessionWasInvalidated(userId: string, tokenIatSeconds: number) {
  const killedAt = await cacheGet<number>(key(userId));
  if (killedAt == null) return false;
  return tokenIatSeconds * 1000 < killedAt;
}
