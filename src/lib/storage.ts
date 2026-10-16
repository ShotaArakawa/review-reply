import type { ReplyLength, ShopProfile, Tone } from "./types.ts";
import type { Plan, Usage } from "./usage.ts";

export interface HistoryItem {
  id: string;
  createdAt: string;
  reviewText: string;
  rating: number | null;
  tone: Tone;
  reply: string;
}

export interface AppState {
  shop: ShopProfile;
  tone: Tone;
  length: ReplyLength;
  plan: Plan;
  usage: Usage | null;
  history: HistoryItem[];
}

export const HISTORY_LIMIT = 20;

export const DEFAULT_STATE: AppState = {
  shop: { name: "", industry: "restaurant", signature: "" },
  tone: "polite",
  length: "normal",
  plan: "free",
  usage: null,
  history: [],
};

/** 保存先の差し替えポイント。今は localStorage、本実装では Supabase など */
export interface StateStore {
  load(): AppState;
  save(state: AppState): void;
}

const KEY = "review-reply:v1";

export const localStore: StateStore = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return DEFAULT_STATE;
      const parsed = JSON.parse(raw) as Partial<AppState>;
      return { ...DEFAULT_STATE, ...parsed, shop: { ...DEFAULT_STATE.shop, ...parsed.shop } };
    } catch {
      return DEFAULT_STATE;
    }
  },
  save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // 容量超過やプライベートモードでは保存しない(動作は続ける)
    }
  },
};
