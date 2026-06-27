export function hasDatabaseUrl() {
  const value = process.env.DATABASE_URL;

  return Boolean(value && value.startsWith("postgresql://"));
}

export function hasRedisUrl() {
  const value = process.env.REDIS_URL;

  return Boolean(value && value.startsWith("redis"));
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
