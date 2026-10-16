import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeReview } from "./analyze.ts";
import { buildMockReplies, createMockGenerator } from "./mockGenerator.ts";
import { buildPrompt } from "./prompt.ts";
import { SAMPLE_REVIEWS } from "./samples.ts";
import type { ReplyRequest, Tone } from "./types.ts";

const sample = (label: string) => SAMPLE_REVIEWS.find((s) => s.label === label)!.review;

function req(label: string, tone: Tone = "polite", patch: Partial<ReplyRequest> = {}): ReplyRequest {
  return {
    shop: { name: "洋食キッチン ひだまり", industry: "restaurant", signature: "店長 山田" },
    review: sample(label),
    tone,
    length: "normal",
    ...patch,
  };
}

test("3つの案を返し、投稿者名・店名・署名が入る", () => {
  const r = req("高評価");
  const drafts = buildMockReplies(r, analyzeReview(r.review));
  assert.equal(drafts.length, 3);
  assert.deepEqual(drafts.map((d) => d.label), ["案A", "案B", "案C"]);
  assert.match(drafts[0].text, /^さくら様、この度は洋食キッチン ひだまりにご来店いただき/);
  assert.ok(drafts.every((d) => d.text.endsWith("\n\n店長 山田")));
  assert.equal(new Set(drafts.map((d) => d.text)).size, 3, "案ごとに文面が違う");
});

test("不満がある話題には謝罪し、改善の一文を入れる", () => {
  const r = req("賛否あり");
  const [a] = buildMockReplies(r, analyzeReview(r.review));
  assert.match(a.text, /長くお待たせしてしまった点、誠に申し訳ございません。/);
  assert.match(a.text, /改善に努めてまいります/);
});

test("投稿者名が空なら「お客様」、店名が空なら「当店」と呼ぶ", () => {
  const r = req("低評価", "polite", { shop: { name: "", industry: "clinic", signature: "" } });
  const [a] = buildMockReplies(r, analyzeReview(r.review));
  assert.match(a.text, /^お客様、この度は当店にご来院いただき/);
  assert.ok(!a.text.includes("\n\n"), "署名が空なら付けない");
});

test("要注意の口コミでは直接連絡をお願いする", () => {
  const r = req("要注意", "friendly");
  const drafts = buildMockReplies(r, analyzeReview(r.review));
  assert.ok(drafts.every((d) => d.text.includes("直接ご連絡")));
  // 「匿名」は名前として呼ばず、不満の口コミには「!」を使わない
  assert.match(drafts[0].text, /^お客様、/);
  assert.ok(!drafts[0].text.split("\n")[0].includes("!"));
});

test("お礼を先に、お詫びを後に並べる", () => {
  const r = req("賛否あり");
  const lines = buildMockReplies(r, analyzeReview(r.review))[0].text.split("\n");
  const praise = lines.findIndex((l) => l.includes("お気に召して"));
  const apology = lines.findIndex((l) => l.includes("お待たせ"));
  assert.ok(praise > 0 && praise < apology);
});

test("長さで触れる話題の数が変わる", () => {
  const base = req("高評価");
  const a = analyzeReview(base.review);
  const short = buildMockReplies({ ...base, length: "short" }, a)[0].text;
  const long = buildMockReplies({ ...base, length: "long" }, a)[0].text;
  assert.ok(long.split("\n").length > short.split("\n").length);
});

test("トーンごとに文面が変わる", async () => {
  const gen = createMockGenerator(0);
  const casual = await gen.generate(req("高評価", "casual"));
  const luxury = await gen.generate(req("高評価", "luxury"));
  assert.match(casual[0].text, /^さくらさん、/);
  assert.match(luxury[0].text, /御礼申し上げます/);
});

test("LLM 用のプロンプトに店舗情報・判定・本文が入る", () => {
  const r = req("賛否あり", "friendly");
  const p = buildPrompt(r, analyzeReview(r.review));
  assert.match(p.system, /飲食店「洋食キッチン ひだまり」/);
  assert.match(p.system, /口調: 親しみやすい/);
  assert.match(p.user, /待ち時間\(不満\)/);
  assert.match(p.user, /40分ほど待たされました/);
});
