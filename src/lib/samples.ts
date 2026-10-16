import type { ReviewInput } from "./types.ts";

/** 動作確認用のサンプル口コミ(架空) */
export const SAMPLE_REVIEWS: { label: string; review: ReviewInput }[] = [
  {
    label: "高評価",
    review: {
      rating: 5,
      reviewerName: "さくら",
      text: "ランチで伺いました。日替わりのハンバーグがとても美味しかったです!スタッフさんの笑顔も素敵で、落ち着いた雰囲気でゆっくりできました。また来ます。",
    },
  },
  {
    label: "賛否あり",
    review: {
      rating: 3,
      reviewerName: "T.K",
      text: "料理は美味しいです。ただ週末は混んでいて、料理が出てくるまで40分ほど待たされました。もう少し早いと嬉しいです。",
    },
  },
  {
    label: "低評価",
    review: {
      rating: 1,
      reviewerName: "",
      text: "店員の対応が冷たく、注文を間違えられた上に謝罪もありませんでした。テーブルも汚かったです。二度と行きません。",
    },
  },
  {
    label: "要注意",
    review: {
      rating: 1,
      reviewerName: "匿名",
      text: "食べた日の夜に腹痛がありました。返金してほしいです。",
    },
  },
];
