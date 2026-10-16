import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeReview, splitSentences } from "./analyze.ts";
import { SAMPLE_REVIEWS } from "./samples.ts";

const sample = (label: string) => SAMPLE_REVIEWS.find((s) => s.label === label)!.review;

test("文を句点・感嘆符・改行で分ける", () => {
  assert.deepEqual(splitSentences("美味しい!また来ます。\n店員さん親切"), ["美味しい", "また来ます", "店員さん親切"]);
});

test("高評価の口コミは好評で、話題をポジティブに拾う", () => {
  const a = analyzeReview(sample("高評価"));
  assert.equal(a.sentiment, "positive");
  const ids = a.topics.map((t) => t.id);
  assert.ok(ids.includes("food"));
  assert.ok(ids.includes("service"));
  assert.ok(ids.includes("atmosphere"));
  assert.ok(a.topics.every((t) => t.polarity === "positive"));
  assert.equal(a.needsCare, false);
});

test("星3で待ち時間に不満がある口コミは賛否ありで、待ち時間がネガティブ", () => {
  const a = analyzeReview(sample("賛否あり"));
  assert.equal(a.sentiment, "mixed");
  assert.equal(a.topics.find((t) => t.id === "wait")?.polarity, "negative");
  // 「料理が出てくるまで待たされた」で料理を不満扱いにしない
  assert.equal(a.topics.find((t) => t.id === "food")?.polarity, "positive");
});

test("星がなくても本文から不満を判定する", () => {
  const a = analyzeReview({ text: "スタッフの対応が雑でした。", rating: null, reviewerName: "" });
  assert.equal(a.sentiment, "negative");
  assert.equal(a.topics[0]?.polarity, "negative");
});

test("「美味しくなかった」は否定として扱う", () => {
  const a = analyzeReview({ text: "料理が美味しくなかった", rating: null, reviewerName: "" });
  assert.equal(a.sentiment, "negative");
});

test("健康被害・返金の記載は要注意にする", () => {
  const a = analyzeReview(sample("要注意"));
  assert.equal(a.needsCare, true);
  assert.deepEqual(a.careReasons, ["健康被害に関する記載", "返金・補償の要求"]);
});
