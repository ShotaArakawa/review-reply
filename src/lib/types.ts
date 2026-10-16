export type Industry = "restaurant" | "cafe" | "beauty" | "clinic" | "retail" | "other";

export type Tone = "polite" | "friendly" | "casual" | "luxury";

export type ReplyLength = "short" | "normal" | "long";

export interface ShopProfile {
  name: string;
  industry: Industry;
  /** 返信の末尾に付ける署名(例: 「店長 山田」)。空なら付けない */
  signature: string;
}

export interface ReviewInput {
  text: string;
  /** 星の数(1〜5)。不明なら null */
  rating: number | null;
  /** 投稿者名。空なら「お客様」と呼ぶ */
  reviewerName: string;
}

export interface ReplyRequest {
  shop: ShopProfile;
  review: ReviewInput;
  tone: Tone;
  length: ReplyLength;
}

export type Sentiment = "positive" | "mixed" | "negative";

export type TopicId = "food" | "service" | "wait" | "price" | "clean" | "atmosphere" | "skill";

export interface TopicHit {
  id: TopicId;
  label: string;
  polarity: "positive" | "negative";
}

export interface ReviewAnalysis {
  sentiment: Sentiment;
  topics: TopicHit[];
  /** 健康被害・返金など、定型文で返さず個別対応した方がよい内容を含むか */
  needsCare: boolean;
  careReasons: string[];
}

export interface ReplyDraft {
  id: string;
  label: string;
  text: string;
}

/**
 * 返信文の生成器。今はモック(ルールベース)だけだが、
 * 本実装では Workers 経由で LLM を呼ぶ実装に差し替える。
 */
export interface ReplyGenerator {
  readonly name: string;
  generate(req: ReplyRequest): Promise<ReplyDraft[]>;
}

export const INDUSTRY_LABELS: Record<Industry, string> = {
  restaurant: "飲食店",
  cafe: "カフェ",
  beauty: "美容室・サロン",
  clinic: "クリニック・整体",
  retail: "小売店",
  other: "その他",
};

export const TONE_LABELS: Record<Tone, string> = {
  polite: "丁寧",
  friendly: "親しみやすい",
  casual: "カジュアル",
  luxury: "上品・高級感",
};

export const LENGTH_LABELS: Record<ReplyLength, string> = {
  short: "短め",
  normal: "ふつう",
  long: "長め",
};
