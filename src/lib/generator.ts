import { analyzeReview } from "./analyze.ts";
import { createMockGenerator } from "./mockGenerator.ts";
import { buildPrompt } from "./prompt.ts";
import type { ReplyDraft, ReplyGenerator } from "./types.ts";

/**
 * 本実装用の生成器(未使用)。API キーをブラウザに置かないよう、
 * Cloudflare Workers の /api/reply がプロンプトを受け取り LLM を呼ぶ想定。
 * 回数制限の判定もサーバー側で行う。
 */
export function createHttpGenerator(endpoint = "/api/reply"): ReplyGenerator {
  return {
    name: "http",
    async generate(req) {
      const prompt = buildPrompt(req, analyzeReview(req.review));
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompt),
      });
      if (!res.ok) throw new Error(`返信案の生成に失敗しました (${res.status})`);
      const data = (await res.json()) as { drafts: Omit<ReplyDraft, "id">[] };
      return data.drafts.map((d, i) => ({ ...d, id: `http-${i}` }));
    },
  };
}

/** 差し替えポイント: ここを createHttpGenerator() に変えれば本物の生成に切り替わる */
export function createGenerator(): ReplyGenerator {
  return createMockGenerator();
}
