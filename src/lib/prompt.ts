import { INDUSTRY_LABELS, LENGTH_LABELS, TONE_LABELS } from "./types.ts";
import type { ReplyRequest, ReviewAnalysis } from "./types.ts";

/**
 * LLM に渡すプロンプトを組み立てる。モック実装では使わないが、
 * 本実装(Workers 側)でそのまま使えるようにフロントと共通の純関数にしてある。
 */
export interface ReplyPrompt {
  system: string;
  user: string;
}

const LENGTH_HINT = { short: "2〜3文", normal: "4〜6文", long: "6〜9文" } as const;

export function buildPrompt(req: ReplyRequest, analysis: ReviewAnalysis): ReplyPrompt {
  const shopName = req.shop.name.trim() || "当店";
  const system = [
    `あなたは${INDUSTRY_LABELS[req.shop.industry]}「${shopName}」の店長として、Googleマップの口コミに返信します。`,
    `口調: ${TONE_LABELS[req.tone]}。長さ: ${LENGTH_LABELS[req.length]}(${LENGTH_HINT[req.length]})。`,
    "守ること:",
    "- 口コミに書かれた具体的な内容に触れる。書かれていない事実を作らない",
    "- 不満点には言い訳をせず謝罪し、改善の姿勢を示す",
    "- 健康被害・返金などの重大な内容は、責任の有無を断定せず、店舗への直接連絡をお願いする",
    "- 投稿者や他の客の個人情報、来店日時など特定につながる情報は書かない",
    "- 割引やクーポンなど、店が決めていない約束をしない",
    "- 返信案を3つ、JSON 配列 [{\"label\":\"案A\",\"text\":\"...\"}] で返す",
  ].join("\n");

  const facts = [
    `星: ${req.review.rating ?? "不明"}`,
    `投稿者名: ${req.review.reviewerName.trim() || "不明(「お客様」と呼ぶ)"}`,
    `判定: ${analysis.sentiment}`,
    `話題: ${analysis.topics.map((t) => `${t.label}(${t.polarity === "negative" ? "不満" : "好評"})`).join("、") || "特になし"}`,
    analysis.needsCare ? `要注意: ${analysis.careReasons.join("、")}` : "",
    req.shop.signature.trim() ? `署名: ${req.shop.signature.trim()}` : "",
  ].filter(Boolean);

  const user = `${facts.join("\n")}\n\n口コミ本文:\n"""\n${req.review.text.trim()}\n"""`;
  return { system, user };
}
