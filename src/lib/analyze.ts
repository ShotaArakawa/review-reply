import type { ReviewAnalysis, ReviewInput, Sentiment, TopicHit, TopicId } from "./types.ts";

interface TopicRule {
  id: TopicId;
  label: string;
  pattern: RegExp;
}

export const TOPIC_RULES: TopicRule[] = [
  { id: "food", label: "料理・味", pattern: /味|料理|美味|おいし|うま|メニュー|ランチ|コーヒー|ケーキ|ドリンク/ },
  { id: "service", label: "接客", pattern: /接客|店員|スタッフ|対応|笑顔|説明|愛想/ },
  { id: "wait", label: "待ち時間", pattern: /待|遅|提供時間|時間がかか|混ん|予約/ },
  { id: "price", label: "価格", pattern: /値段|価格|料金|高い|安い|コスパ|お得/ },
  { id: "clean", label: "清潔さ", pattern: /清潔|綺麗|きれい|汚|掃除|トイレ|衛生/ },
  { id: "atmosphere", label: "雰囲気", pattern: /雰囲気|内装|居心地|BGM|落ち着|おしゃれ|空間/ },
  { id: "skill", label: "技術・仕上がり", pattern: /施術|カット|カラー|仕上がり|技術|腕|治療|マッサージ/ },
];

const NEGATIVE_WORDS =
  /残念|不満|悪い|悪かった|最悪|遅い|遅かった|待たされ|汚い|汚かった|冷た|高すぎ|二度と|がっかり|不快|ひど|イマイチ|いまいち|微妙|うるさ|雑|失礼|ぬる|まず(い|かった)/;
const POSITIVE_WORDS =
  /美味|おいし|うま|最高|良かった|よかった|良い|いい|丁寧|親切|満足|また来|また行|リピ|おすすめ|オススメ|素敵|快適|ありがと|きれい|綺麗|清潔|落ち着|お得|安い/;

const CARE_RULES: { pattern: RegExp; reason: string }[] = [
  { pattern: /食中毒|お腹を壊|腹痛|体調|吐き|アレルギー|蕁麻疹/, reason: "健康被害に関する記載" },
  { pattern: /異物|髪の毛|虫が/, reason: "異物混入に関する記載" },
  { pattern: /返金|弁償|補償/, reason: "返金・補償の要求" },
  { pattern: /警察|訴え|弁護士|保健所/, reason: "法的対応・行政への言及" },
  { pattern: /怪我|けが|火傷|やけど/, reason: "怪我に関する記載" },
];

const NEGATED = /(良く|よく|おいしく|美味しく|きれいじゃ|綺麗じゃ|丁寧じゃ)(なかった|ない|ありません)/;

/** いずれかのパターンに最初に一致した位置。なければ -1 */
function firstIndex(s: string, patterns: RegExp[]): number {
  const hits = patterns.map((p) => s.search(p)).filter((i) => i >= 0);
  return hits.length ? Math.min(...hits) : -1;
}

/** パターンの一致箇所のうち、基準位置に一番近いものまでの距離。一致しなければ -1 */
function distanceTo(s: string, pattern: RegExp, from: number): number {
  const indexes = [...s.matchAll(new RegExp(pattern.source, "g"))].map((m) => m.index);
  if (indexes.length === 0) return -1;
  return from < 0 ? 0 : Math.min(...indexes.map((i) => Math.abs(i - from)));
}

/** 句点・改行・感嘆符で文に分ける */
export function splitSentences(text: string): string[] {
  return text
    .split(/[。!?!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function analyzeReview(review: ReviewInput): ReviewAnalysis {
  const sentences = splitSentences(review.text);
  let posCount = 0;
  let negCount = 0;
  const topics = new Map<TopicId, TopicHit>();

  for (const s of sentences) {
    // 「良くなかった」のような否定は簡易的にネガティブとして扱う
    const negIndex = firstIndex(s, [NEGATIVE_WORDS, NEGATED]);
    const isNeg = negIndex >= 0;
    const isPos = !isNeg && POSITIVE_WORDS.test(s);
    if (isNeg) negCount++;
    if (isPos) posCount++;

    const matched = TOPIC_RULES.map((rule) => ({ rule, distance: distanceTo(s, rule.pattern, negIndex) })).filter(
      (m) => m.distance >= 0,
    );
    // 1文に複数の話題があるときは、不満の言葉に一番近い話題だけを不満とみなす
    // (「料理が出るまで待たされた」で料理まで謝らないように)
    const blamed = isNeg ? matched.reduce((a, b) => (b.distance < a.distance ? b : a), matched[0]) : undefined;

    for (const { rule } of matched) {
      const prev = topics.get(rule.id);
      if (isNeg && blamed?.rule !== rule) continue;
      const polarity = isNeg ? "negative" : "positive";
      // 同じ話題で良い点と悪い点が両方あれば、悪い点を優先して拾う(謝罪漏れを防ぐ)
      if (!prev || polarity === "negative") {
        topics.set(rule.id, { id: rule.id, label: rule.label, polarity });
      }
    }
  }

  const careReasons = CARE_RULES.filter((r) => r.pattern.test(review.text)).map((r) => r.reason);

  return {
    sentiment: decideSentiment(review.rating, posCount, negCount),
    topics: [...topics.values()],
    needsCare: careReasons.length > 0,
    careReasons,
  };
}

function decideSentiment(rating: number | null, pos: number, neg: number): Sentiment {
  if (rating !== null) {
    if (rating <= 2) return "negative";
    if (rating === 3) return "mixed";
    return neg > 0 ? "mixed" : "positive";
  }
  if (neg === 0) return "positive";
  return pos > 0 ? "mixed" : "negative";
}
