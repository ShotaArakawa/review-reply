import { analyzeReview } from "./analyze.ts";
import type {
  Industry,
  ReplyDraft,
  ReplyGenerator,
  ReplyRequest,
  ReviewAnalysis,
  TopicId,
  Tone,
} from "./types.ts";

/**
 * ルールベースのダミー生成器。外部 API を使わずに UI と流れを確認するためのもの。
 * 文面の質は LLM 実装で上げる前提で、ここでは「話題を拾って謝罪/お礼を返す」骨格だけを持つ。
 */

interface TonePhrases {
  greet: ((who: string, shop: string, visit: string) => string)[];
  reviewThanks: string;
  positive: (core: string) => string;
  negative: (core: string) => string;
  genericPositive: string;
  genericNegative: string;
  improve: string;
  care: string;
  closePositive: ((visit: string) => string)[];
  closeNegative: ((visit: string) => string)[];
}

const TONES: Record<Tone, TonePhrases> = {
  polite: {
    greet: [
      (w, s, v) => `${w}様、この度は${s}に${v}いただき、誠にありがとうございます。`,
      (w, s) => `${w}様、${s}をご利用いただきありがとうございます。`,
      (w) => `${w}様、口コミのご投稿ありがとうございます。`,
    ],
    reviewThanks: "貴重なご意見をお寄せいただき、心より感謝申し上げます。",
    positive: (c) => `${c}、大変うれしく思います。`,
    negative: (c) => `${c}、誠に申し訳ございません。`,
    genericPositive: "温かいお言葉をいただき、スタッフ一同大変励みになっております。",
    genericNegative: "ご期待に沿えず、誠に申し訳ございません。",
    improve: "いただいたご指摘はスタッフ全員で共有し、改善に努めてまいります。",
    care: "詳しい状況をお伺いしたく、お手数ですが店舗まで直接ご連絡いただけますと幸いです。",
    closePositive: [
      (v) => `またの${v}を心よりお待ちしております。`,
      (v) => `今後ともよろしくお願いいたします。またの${v}をお待ちしております。`,
      () => "またお会いできる日を楽しみにしております。",
    ],
    closeNegative: [
      () => "またの機会がございましたら、より良いサービスでお迎えできるよう努めてまいります。",
      () => "この度は誠に申し訳ございませんでした。",
      (v) => `改善した姿をご覧いただけるよう、またの${v}をお待ちしております。`,
    ],
  },
  friendly: {
    greet: [
      (w, s, v) => `${w}様、${s}に${v}いただきありがとうございます!`,
      (w) => `${w}様、素敵な口コミをありがとうございます!`,
      (w, s) => `${w}様、${s}を選んでいただきありがとうございます!`,
    ],
    reviewThanks: "口コミを書いていただけて、とてもうれしいです。",
    positive: (c) => `${c}、スタッフ一同とても喜んでいます!`,
    negative: (c) => `${c}、本当に申し訳ありません。`,
    genericPositive: "温かいお言葉に、スタッフ一同元気をもらいました!",
    genericNegative: "ご期待に応えられず、本当に申し訳ありません。",
    improve: "いただいたご意見はみんなで共有して、もっと良いお店にしていきます。",
    care: "詳しくお話をお伺いしたいので、お手数ですがお店まで直接ご連絡いただけるとうれしいです。",
    closePositive: [
      (v) => `またの${v}をお待ちしています!`,
      () => "またお会いできるのを楽しみにしています!",
      (v) => `季節ごとの新しいメニューもご用意していますので、ぜひまた${v}ください!`,
    ],
    closeNegative: [
      () => "次は満足していただけるよう、がんばります。",
      (v) => `もしよろしければ、また${v}いただけるとうれしいです。`,
      () => "貴重なご意見、本当にありがとうございました。",
    ],
  },
  casual: {
    greet: [
      (w) => `${w}さん、来てくれてありがとうございます!`,
      (w) => `${w}さん、口コミありがとうございます!`,
      (w, s) => `${w}さん、${s}に遊びに来てくれてありがとうございます!`,
    ],
    reviewThanks: "書いてもらえて本当にうれしいです。",
    positive: (c) => `${c}、めちゃくちゃうれしいです!`,
    negative: (c) => `${c}、申し訳ありませんでした。`,
    genericPositive: "その一言でスタッフみんな元気が出ました!",
    genericNegative: "期待に応えられず、申し訳ありませんでした。",
    improve: "ご意見はスタッフみんなで共有して、改善していきます。",
    care: "詳しく聞かせてほしいので、お手数ですがお店まで直接連絡をもらえると助かります。",
    closePositive: [
      () => "またいつでも遊びに来てください!",
      () => "また会えるのを楽しみにしてます!",
      () => "次回もお待ちしてます!",
    ],
    closeNegative: [
      () => "次は満足してもらえるよう、がんばります。",
      () => "また機会があれば、ぜひリベンジさせてください。",
      () => "正直なご意見、ありがとうございました。",
    ],
  },
  luxury: {
    greet: [
      (w, s, v) => `${w}様、このたびは${s}へ${v}賜り、心より御礼申し上げます。`,
      (w, s) => `${w}様、数ある中から${s}をお選びいただき、誠にありがとうございます。`,
      (w) => `${w}様、丁寧なお言葉をお寄せいただき、厚く御礼申し上げます。`,
    ],
    reviewThanks: "ご感想をお聞かせいただけましたこと、大変光栄に存じます。",
    positive: (c) => `${c}、何よりの励みでございます。`,
    negative: (c) => `${c}、心よりお詫び申し上げます。`,
    genericPositive: "身に余るお言葉を頂戴し、スタッフ一同大変光栄に存じます。",
    genericNegative: "ご期待に添えず、深くお詫び申し上げます。",
    improve: "頂戴したご指摘を真摯に受け止め、より一層のおもてなしに努めてまいります。",
    care: "詳しい状況をお伺いいたしたく、恐れ入りますが店舗まで直接ご連絡を賜れますと幸いです。",
    closePositive: [
      (v) => `またの${v}を心よりお待ち申し上げております。`,
      () => "再びお目にかかれる日を、スタッフ一同楽しみにしております。",
      (v) => `次回の${v}の際も、変わらぬおもてなしでお迎えいたします。`,
    ],
    closeNegative: [
      () => "次の機会には、ご満足いただけるおもてなしでお迎えできるよう努めてまいります。",
      () => "このたびは誠に申し訳ございませんでした。",
      (v) => `改めてお迎えできる機会を賜れましたら、またの${v}を心よりお待ち申し上げております。`,
    ],
  },
};

const POSITIVE_CORE: Record<TopicId, string> = {
  food: "お料理をお気に召していただけたとのこと",
  service: "スタッフの対応をお褒めいただき",
  wait: "スムーズにご案内できたとのこと",
  price: "価格にもご満足いただけたとのこと",
  clean: "店内の清潔さに気づいていただき",
  atmosphere: "お店の雰囲気を気に入っていただけたとのこと",
  skill: "仕上がりにご満足いただけたとのこと",
};

const NEGATIVE_CORE: Record<TopicId, string> = {
  food: "お料理がご期待に沿えなかった点",
  service: "スタッフの対応でご不快な思いをおかけした点",
  wait: "長くお待たせしてしまった点",
  price: "価格に見合うご満足をお届けできなかった点",
  clean: "清掃が行き届いていなかった点",
  atmosphere: "店内の環境でご不便をおかけした点",
  skill: "仕上がりがご期待に沿えなかった点",
};

const VISIT_WORD: Record<Industry, string> = {
  restaurant: "ご来店",
  cafe: "ご来店",
  beauty: "ご来店",
  clinic: "ご来院",
  retail: "ご来店",
  other: "ご利用",
};

const TOPIC_LIMIT = { short: 1, normal: 2, long: 4 } as const;
const VARIANT_LABELS = ["案A", "案B", "案C"];

/** 空欄や「匿名」のような名前は「お客(様/さん)」にする */
export function displayName(name: string): string {
  const n = name.trim();
  return !n || /^(匿名|名無し|anonymous|google ?ユーザー)$/i.test(n) ? "お客" : n;
}

export function buildMockReplies(req: ReplyRequest, analysis: ReviewAnalysis): ReplyDraft[] {
  const p = TONES[req.tone];
  const who = displayName(req.review.reviewerName);
  const shop = req.shop.name.trim() || "当店";
  const visit = VISIT_WORD[req.shop.industry];
  const isNegative = analysis.sentiment !== "positive";

  // 字数制限で謝罪が漏れないよう不満の話題を優先して選び、文面ではお礼 → お詫びの順に並べる
  const byNegativeFirst = (a: { polarity: string }, b: { polarity: string }) =>
    a.polarity === b.polarity ? 0 : a.polarity === "negative" ? -1 : 1;
  const topics = [...analysis.topics]
    .sort(byNegativeFirst)
    .slice(0, TOPIC_LIMIT[req.length])
    .sort((a, b) => byNegativeFirst(b, a));

  return VARIANT_LABELS.map((label, i) => {
    const greet = p.greet[i % p.greet.length](who, shop, visit);
    // 不満の口コミに「!」で明るく返すと軽く見えるので落ち着かせる
    const lines: string[] = [isNegative ? greet.replace(/!/g, "。") : greet];

    if (req.length === "long") lines.push(p.reviewThanks);

    if (topics.length === 0) {
      lines.push(isNegative ? p.genericNegative : p.genericPositive);
    } else {
      for (const t of topics) {
        lines.push(
          t.polarity === "negative" ? p.negative(NEGATIVE_CORE[t.id]) : p.positive(POSITIVE_CORE[t.id]),
        );
      }
      if (isNegative && !topics.some((t) => t.polarity === "negative")) {
        lines.push(p.genericNegative);
      }
    }

    if (analysis.needsCare) lines.push(p.care);
    if (isNegative && req.length !== "short") lines.push(p.improve);

    const closes = isNegative ? p.closeNegative : p.closePositive;
    lines.push(closes[i % closes.length](visit));

    const signature = req.shop.signature.trim();
    const body = lines.join("\n");
    return { id: `mock-${i}`, label, text: signature ? `${body}\n\n${signature}` : body };
  });
}

export function createMockGenerator(delayMs = 400): ReplyGenerator {
  return {
    name: "mock",
    async generate(req) {
      // 本物の API 呼び出しに近い体験にするため少し待つ
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      return buildMockReplies(req, analyzeReview(req.review));
    },
  };
}
