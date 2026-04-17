"use client";

import { useCallback, useMemo, useState } from "react";

const LESSON = [
  {
    title: "One token at a time",
    body: "Large language models decode **autoregressively**: they output token 1, then 2, then 3… At step *t* the model already “knows” tokens 0…*t*−1 and predicts the next one.",
  },
  {
    title: "Attention needs Queries, Keys, Values",
    body: "Scaled dot-product attention compares a **Query** from the *current* position to **Keys** at *every* position, then mixes **Values** using those weights. For the next-token prediction, the “current” position is the new partial token (or a special “write head” in some diagrams).",
  },
  {
    title: "The expensive part: past tokens",
    body: "If you recomputed **K** and **V** for *all* past tokens on every step, work would grow roughly like 1 + 2 + 3 + … + *n* (quadratic in length). In practice that’s far too slow for long contexts.",
  },
  {
    title: "KV cache = store past K and V",
    body: "A **KV cache** keeps the projected **K** and **V** tensors for tokens you’ve already processed. On step *t* you **only** compute fresh projections for the *new* token (and reuse cached K/V for 0…*t*−1). **Q** for the new position is still computed each step so it can attend to the whole prefix.",
  },
  {
    title: "What grows?",
    body: "Cache size scales with **sequence length × layers × (d_k + d_v) × bytes per element × batch** (often **2×** if K and V share the same width). This is why long chats cost more VRAM even if the *new* token is tiny.",
  },
];

function softmax(scores) {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** Toy 2D keys/values for pedagogy (not learned weights). */
function tokenData(index) {
  const angle = (index + 1) * 0.9;
  const k = [Math.cos(angle), Math.sin(angle)];
  const v = [
    0.35 + 0.15 * (index % 3),
    0.4 + 0.1 * ((index + 1) % 2),
    0.25 + 0.12 * (index % 2),
  ];
  return { k, v, label: String.fromCharCode(65 + (index % 26)) };
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}

export default function KVCacheLab() {
  const [lessonIndex, setLessonIndex] = useState(0);
  const [prefixLen, setPrefixLen] = useState(4);
  const [decodeStep, setDecodeStep] = useState(0);
  const [showNoCache, setShowNoCache] = useState(false);

  const maxTokens = 12;
  const tokens = useMemo(() => {
    return Array.from({ length: maxTokens }, (_, i) => ({
      i,
      ...tokenData(i),
    }));
  }, []);

  const activePrefix = Math.min(prefixLen, maxTokens);
  const step = Math.min(decodeStep, activePrefix);

  /** Query for “new” position at decode step (toy: rotates with step). */
  const query = useMemo(() => {
    const t = step + 0.5;
    return [Math.cos(t * 1.1), Math.sin(t * 1.1)];
  }, [step]);

  const keysInScope = tokens.slice(0, step + 1);
  const scores = keysInScope.map((tok) => dot(query, tok.k));
  const weights = softmax(scores);

  const recomputeOps = useMemo(() => {
    let sum = 0;
    for (let t = 1; t <= activePrefix; t++) sum += t;
    return sum;
  }, [activePrefix]);

  const cachedOps = activePrefix;

  const advanceLesson = useCallback(() => {
    setLessonIndex((i) => Math.min(i + 1, LESSON.length - 1));
  }, []);

  const resetFlow = useCallback(() => {
    setDecodeStep(0);
  }, []);

  return (
    <div className="lab">
      <header className="lab__hero">
        <p className="lab__eyebrow">Interactive primer</p>
        <h1>KV cache in transformers</h1>
        <p className="lab__lede">
          Move through a tiny autoregressive decode. Watch which **K/V** rows are
          **reused** (cache hit) vs **recomputed** (new token only)—and why that
          saves work.
        </p>
      </header>

      <section className="panel panel--lesson">
        <div className="panel__head">
          <h2>
            Lesson{" "}
            <span className="muted">
              {lessonIndex + 1}/{LESSON.length}
            </span>
          </h2>
          <button type="button" className="btn" onClick={advanceLesson}>
            {lessonIndex < LESSON.length - 1 ? "Next idea →" : "✓ End of tour"}
          </button>
        </div>
        <h3>{LESSON[lessonIndex].title}</h3>
        <p
          className="lesson-body"
          dangerouslySetInnerHTML={{
            __html: LESSON[lessonIndex].body.replace(
              /\*\*(.*?)\*\*/g,
              "<strong>$1</strong>"
            ),
          }}
        />
      </section>

      <div className="lab__grid">
        <section className="panel">
          <h2>Prefix length (past tokens in cache)</h2>
          <p className="muted small">
            After prefill, the cache holds one row per past token per layer
            (here: one layer, 2D keys for drawing).
          </p>
          <div className="row">
            <label className="grow">
              <span className="slider-label">
                Cached tokens: <strong>{activePrefix}</strong>
              </span>
              <input
                type="range"
                min={1}
                max={maxTokens}
                value={activePrefix}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setPrefixLen(n);
                  setDecodeStep((s) => Math.min(s, n - 1));
                }}
              />
            </label>
          </div>

          <div className="toggle-row">
            <label className="check">
              <input
                type="checkbox"
                checked={showNoCache}
                onChange={(e) => setShowNoCache(e.target.checked)}
              />
              Compare “no KV cache” (recompute all K,V each step)
            </label>
          </div>

          {showNoCache && (
            <div className="callout callout--warn">
              <strong>Naive recompute:</strong> step <em>t</em> touches{" "}
              <em>t</em> positions → total ops ∝ 1+2+…+<em>n</em> ≈{" "}
              <strong>{recomputeOps}</strong> token-rows (toy units).
              <br />
              <strong>With KV cache:</strong> one new row per step →{" "}
              <strong>{cachedOps}</strong> token-rows.
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Decode step</h2>
          <p className="muted small">
            Step <strong>{step + 1}</strong> of {activePrefix}: attending with
            current <strong>Q</strong> over keys 0…{step}.
          </p>
          <div className="step-controls">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={step <= 0}
              onClick={() => setDecodeStep((s) => Math.max(0, s - 1))}
            >
              ← Prev step
            </button>
            <button
              type="button"
              className="btn"
              disabled={step >= activePrefix - 1}
              onClick={() =>
                setDecodeStep((s) => Math.min(activePrefix - 1, s + 1))
              }
            >
              Next step →
            </button>
            <button type="button" className="btn btn--ghost" onClick={resetFlow}>
              Reset to start
            </button>
          </div>
        </section>
      </div>

      <section className="panel panel--viz">
        <h2>Attention from the current query</h2>
        <p className="muted small">
          Width of each ribbon ≈ attention mass. Cached keys are{" "}
          <span className="pill pill--cache">reused</span>; the rightmost key is{" "}
          <span className="pill pill--fresh">just computed</span> for this step.
        </p>

        <AttentionViz
          keys={keysInScope}
          query={query}
          weights={weights}
          step={step}
        />

        <div className="kv-grid">
          <div>
            <h3 className="kv-title">K rows (cache)</h3>
            <MatrixRows rows={keysInScope.map((t) => t.k)} highlightIndex={step} />
          </div>
          <div>
            <h3 className="kv-title">V rows (cache)</h3>
            <MatrixRows
              rows={keysInScope.map((t) => t.v)}
              highlightIndex={step}
              wide
            />
          </div>
        </div>
      </section>

      <section className="panel panel--calc">
        <h2>Back-of-the-envelope VRAM</h2>
        <MemoryCalculator />
      </section>

      <section className="panel panel--quiz">
        <h2>Check yourself</h2>
        <MiniQuiz />
      </section>
    </div>
  );
}

function AttentionViz({ keys, query, weights, step }) {
  const w = 520;
  const h = 220;
  const baseY = 140;
  const qx = w - 40;
  const qy = 70;

  return (
    <div className="svg-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="att-svg" role="img" aria-label="Attention diagram">
        <defs>
          <marker
            id="arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
          </marker>
        </defs>

        <text x="16" y="28" className="svg-caption">
          Keys (positions 0…{step})
        </text>

        {keys.map((tok, idx) => {
          const n = keys.length;
          const gap = (w - 120) / Math.max(1, n - 1);
          const x = 40 + idx * gap;
          const weight = weights[idx] ?? 0;
          const strokeW = 2 + weight * 18;
          const isLast = idx === step;
          return (
            <g key={tok.i}>
              <line
                x1={x}
                y1={baseY}
                x2={qx}
                y2={qy + 10}
                stroke={isLast ? "var(--accent-2)" : "var(--accent)"}
                strokeOpacity={0.35 + weight * 0.65}
                strokeWidth={strokeW}
                strokeLinecap="round"
              />
              <circle
                cx={x}
                cy={baseY}
                r={isLast ? 14 : 11}
                className={isLast ? "node node--fresh" : "node node--cache"}
              />
              <text x={x} y={baseY + 4} textAnchor="middle" className="node-label">
                {tok.label}
              </text>
              <text x={x} y={baseY + 36} textAnchor="middle" className="weight-label">
                {(weight * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}

        <circle cx={qx} cy={qy} r={18} className="node node--q" />
        <text x={qx} y={qy + 5} textAnchor="middle" className="node-label node-label--q">
          Q
        </text>
        <text x={qx - 52} y={qy - 26} className="svg-caption">
          Current query
        </text>
      </svg>
    </div>
  );
}

function MatrixRows({ rows, highlightIndex, wide }) {
  return (
    <div className={`matrix ${wide ? "matrix--wide" : ""}`}>
      {rows.map((row, r) => (
        <div
          key={r}
          className={`matrix__row ${
            r === highlightIndex ? "matrix__row--hot" : ""
          } ${r < highlightIndex ? "matrix__row--cached" : ""}`}
        >
          <span className="matrix__idx">{r}</span>
          {row.map((cell, c) => (
            <span
              key={c}
              className="cell"
              style={{
                background: `color-mix(in oklab, var(--cell-${c % 3}) ${Math.round(
                  cell * 100
                )}%, transparent)`,
              }}
              title={cell.toFixed(3)}
            >
              {cell.toFixed(2)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function MemoryCalculator() {
  const [layers, setLayers] = useState(32);
  const [seq, setSeq] = useState(4096);
  const [hidden, setHidden] = useState(4096);
  const [heads, setHeads] = useState(32);
  const [bytes, setBytes] = useState(2);
  const [batch, setBatch] = useState(1);

  const headDim = Math.max(1, Math.round(hidden / heads));
  const kvPerLayer = seq * headDim * 2 * bytes * batch;
  const totalGb = (kvPerLayer * layers) / 1024 ** 3;

  return (
    <div className="calc">
      <p className="muted small">
        Rough KV cache only: <code>2 × layers × seq × head_dim × bytes × batch</code>
        (per common MHA layout; real models add overhead).
      </p>
      <div className="calc__grid">
        <label>
          Layers
          <input
            type="number"
            min={1}
            max={128}
            value={layers}
            onChange={(e) => setLayers(Number(e.target.value))}
          />
        </label>
        <label>
          Sequence length
          <input
            type="number"
            min={1}
            max={2000000}
            value={seq}
            onChange={(e) => setSeq(Number(e.target.value))}
          />
        </label>
        <label>
          Hidden size
          <input
            type="number"
            min={64}
            max={65536}
            value={hidden}
            onChange={(e) => setHidden(Number(e.target.value))}
          />
        </label>
        <label>
          Attention heads
          <input
            type="number"
            min={1}
            max={128}
            value={heads}
            onChange={(e) => setHeads(Number(e.target.value))}
          />
        </label>
        <label>
          Bytes / param (bf16/fp16=2)
          <input
            type="number"
            min={1}
            max={4}
            value={bytes}
            onChange={(e) => setBytes(Number(e.target.value))}
          />
        </label>
        <label>
          Batch size
          <input
            type="number"
            min={1}
            max={512}
            value={batch}
            onChange={(e) => setBatch(Number(e.target.value))}
          />
        </label>
      </div>
      <p className="calc__result">
        Implied <strong>head_dim</strong> ≈ {headDim}.<br />
        KV cache ≈ <strong>{totalGb.toFixed(2)} GB</strong>
      </p>
    </div>
  );
}

function MiniQuiz() {
  const [picked, setPicked] = useState(null);

  const q = {
    prompt: "During decode with a KV cache, what is recomputed for each new token?",
    options: [
      { id: "a", text: "K and V for all past tokens", correct: false },
      { id: "b", text: "Q, K, and V only for the new token (past K,V reused)", correct: true },
      { id: "c", text: "Nothing—only the final softmax", correct: false },
    ],
  };

  return (
    <div className="quiz">
      <p>{q.prompt}</p>
      <ul className="quiz__opts">
        {q.options.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              className={`quiz__btn ${
                picked === o.id
                  ? o.correct
                    ? "quiz__btn--ok"
                    : "quiz__btn--bad"
                  : ""
              }`}
              onClick={() => setPicked(o.id)}
            >
              {o.text}
            </button>
          </li>
        ))}
      </ul>
      {picked && (
        <p className="quiz__fb muted small">
          {q.options.find((x) => x.id === picked)?.correct
            ? "Yes — that’s why decode per step stays ~O(n) in attention length instead of recomputing the full prefix each time."
            : "Not quite — the cache stores past K/V; the new token gets fresh projections (and a new Q row to attend with)."}
        </p>
      )}
    </div>
  );
}
