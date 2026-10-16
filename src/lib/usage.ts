/**
 * 月ごとの生成回数の上限。今はブラウザ内で数えるだけのモックで、
 * 本実装ではサーバー側(ユーザー単位)で数える。
 */
export type Plan = "free" | "pro";

export const PLAN_LIMITS: Record<Plan, number> = { free: 10, pro: 300 };

export interface Usage {
  /** "2026-10" 形式 */
  month: string;
  count: number;
}

export function monthKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** 月が変わっていたら 0 回に戻す */
export function currentUsage(usage: Usage | null, now: Date): Usage {
  const month = monthKey(now);
  return usage && usage.month === month ? usage : { month, count: 0 };
}

export function remaining(usage: Usage, plan: Plan, now: Date): number {
  return Math.max(0, PLAN_LIMITS[plan] - currentUsage(usage, now).count);
}

export function consume(usage: Usage, now: Date): Usage {
  const cur = currentUsage(usage, now);
  return { month: cur.month, count: cur.count + 1 };
}
