import { useEffect, useMemo, useState } from "react";
import { analyzeReview } from "./lib/analyze.ts";
import { createGenerator } from "./lib/generator.ts";
import { SAMPLE_REVIEWS } from "./lib/samples.ts";
import { HISTORY_LIMIT, localStore } from "./lib/storage.ts";
import type { AppState } from "./lib/storage.ts";
import { INDUSTRY_LABELS, LENGTH_LABELS, TONE_LABELS } from "./lib/types.ts";
import type { Industry, ReplyDraft, ReplyLength, ReviewInput, Tone } from "./lib/types.ts";
import { PLAN_LIMITS, consume, currentUsage, remaining } from "./lib/usage.ts";

const generator = createGenerator();

const SENTIMENT_LABELS = { positive: "好評", mixed: "賛否あり", negative: "不満" } as const;

const EMPTY_REVIEW: ReviewInput = { text: "", rating: null, reviewerName: "" };

export function App() {
  const [state, setState] = useState<AppState>(() => localStore.load());
  const [review, setReview] = useState<ReviewInput>(EMPTY_REVIEW);
  const [drafts, setDrafts] = useState<ReplyDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");

  useEffect(() => localStore.save(state), [state]);

  const analysis = useMemo(() => (review.text.trim() ? analyzeReview(review) : null), [review]);
  const now = new Date();
  const left = remaining(currentUsage(state.usage, now), state.plan, now);

  const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }));

  async function handleGenerate() {
    if (!review.text.trim()) return setError("口コミの本文を貼り付けてください。");
    if (left <= 0) return setError("今月の無料枠を使い切りました。有料プラン(モック)で上限が増えます。");
    setError("");
    setLoading(true);
    try {
      const result = await generator.generate({
        shop: state.shop,
        review,
        tone: state.tone,
        length: state.length,
      });
      setDrafts(result);
      setState((s) => ({ ...s, usage: consume(currentUsage(s.usage, new Date()), new Date()) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(draft: ReplyDraft) {
    try {
      await navigator.clipboard.writeText(draft.text);
    } catch {
      // クリップボードが使えない環境では履歴への保存だけ行う
    }
    setCopiedId(draft.id);
    setTimeout(() => setCopiedId(""), 1500);
    setState((s) => ({
      ...s,
      history: [
        {
          id: `${Date.now()}`,
          createdAt: new Date().toISOString(),
          reviewText: review.text,
          rating: review.rating,
          tone: s.tone,
          reply: draft.text,
        },
        ...s.history,
      ].slice(0, HISTORY_LIMIT),
    }));
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>口コミ返信メーカー</h1>
          <p className="lead">Googleマップの口コミを貼るだけで、お店の口調に合わせた返信案を3つ作ります。</p>
        </div>
        <div className="plan">
          <label className="check">
            <input
              type="checkbox"
              checked={state.plan === "pro"}
              onChange={(e) => update({ plan: e.target.checked ? "pro" : "free" })}
            />
            有料プラン(モック)
          </label>
          <span className="quota">
            今月の残り <strong>{left}</strong> / {PLAN_LIMITS[state.plan]} 回
          </span>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <details className="shop" open={!state.shop.name}>
            <summary>お店の設定{state.shop.name && `:${state.shop.name}`}</summary>
            <label>
              店名
              <input
                value={state.shop.name}
                placeholder="例: 洋食キッチン ひだまり"
                onChange={(e) => update({ shop: { ...state.shop, name: e.target.value } })}
              />
            </label>
            <label>
              業種
              <select
                value={state.shop.industry}
                onChange={(e) => update({ shop: { ...state.shop, industry: e.target.value as Industry } })}
              >
                {Object.entries(INDUSTRY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              署名(任意)
              <input
                value={state.shop.signature}
                placeholder="例: 店長 山田"
                onChange={(e) => update({ shop: { ...state.shop, signature: e.target.value } })}
              />
            </label>
          </details>

          <div className="samples">
            サンプル:
            {SAMPLE_REVIEWS.map((s) => (
              <button key={s.label} type="button" className="chip" onClick={() => setReview(s.review)}>
                {s.label}
              </button>
            ))}
          </div>

          <label>
            口コミ本文
            <textarea
              rows={6}
              value={review.text}
              placeholder="Googleマップの口コミをここに貼り付け"
              onChange={(e) => setReview({ ...review, text: e.target.value })}
            />
          </label>
          <div className="row">
            <label>
              星の数
              <select
                value={review.rating ?? ""}
                onChange={(e) => setReview({ ...review, rating: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">不明</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              投稿者名(任意)
              <input
                value={review.reviewerName}
                placeholder="空欄なら「お客様」"
                onChange={(e) => setReview({ ...review, reviewerName: e.target.value })}
              />
            </label>
          </div>

          <fieldset>
            <legend>トーン</legend>
            <div className="segmented">
              {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={state.tone === t ? "active" : ""}
                  onClick={() => update({ tone: t })}
                >
                  {TONE_LABELS[t]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>長さ</legend>
            <div className="segmented">
              {(Object.keys(LENGTH_LABELS) as ReplyLength[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  className={state.length === l ? "active" : ""}
                  onClick={() => update({ length: l })}
                >
                  {LENGTH_LABELS[l]}
                </button>
              ))}
            </div>
          </fieldset>

          {analysis && (
            <div className="analysis" aria-label="口コミの判定">
              <span className={`badge ${analysis.sentiment}`}>{SENTIMENT_LABELS[analysis.sentiment]}</span>
              {analysis.topics.map((t) => (
                <span key={t.id} className={`badge topic ${t.polarity}`}>
                  {t.polarity === "negative" ? "▼" : "▲"} {t.label}
                </span>
              ))}
            </div>
          )}
          {analysis?.needsCare && (
            <p className="warn">
              ⚠ {analysis.careReasons.join("・")}が含まれています。定型文で済ませず、事実確認のうえ個別に対応してください。
            </p>
          )}

          {error && <p className="error">{error}</p>}
          <button type="button" className="primary" onClick={handleGenerate} disabled={loading}>
            {loading ? "作成中…" : "返信案を作る"}
          </button>
        </section>

        <section className="panel">
          <h2>返信案</h2>
          {drafts.length === 0 && <p className="muted">口コミを入力して「返信案を作る」を押すと、ここに3つの案が出ます。</p>}
          {drafts.map((d) => (
            <article key={d.id} className="draft">
              <div className="draft-head">
                <strong>{d.label}</strong>
                <span className="muted">{d.text.length} 文字</span>
              </div>
              <textarea
                rows={7}
                value={d.text}
                onChange={(e) => setDrafts((ds) => ds.map((x) => (x.id === d.id ? { ...x, text: e.target.value } : x)))}
              />
              <button type="button" onClick={() => handleCopy(d)}>
                {copiedId === d.id ? "コピーしました" : "コピーして履歴に保存"}
              </button>
            </article>
          ))}
          <p className="muted small">
            ※ 現在はダミー生成(ルールベース)です。投稿前に内容を必ず確認・編集してください。
          </p>

          <h2>履歴</h2>
          {state.history.length === 0 ? (
            <p className="muted">コピーした返信がここに残ります(最新{HISTORY_LIMIT}件)。</p>
          ) : (
            <ul className="history">
              {state.history.map((h) => (
                <li key={h.id}>
                  <div className="muted small">
                    {new Date(h.createdAt).toLocaleString("ja-JP")} ・ {TONE_LABELS[h.tone]}
                    {h.rating !== null && ` ・ ${"★".repeat(h.rating)}`}
                  </div>
                  <div className="history-review">{h.reviewText}</div>
                  <div className="history-reply">{h.reply}</div>
                </li>
              ))}
            </ul>
          )}
          {state.history.length > 0 && (
            <button type="button" className="link" onClick={() => update({ history: [] })}>
              履歴を消す
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
