"use client";

import { useMemo, useState } from "react";

const solutions = [
  {
    key: "quotas",
    title: "Resource quotas",
    description: "Caps the noisy tenant so it cannot consume the entire shared node.",
  },
  {
    key: "isolation",
    title: "Workload isolation",
    description: "Moves the bursty workload onto its own infrastructure.",
  },
  {
    key: "autoscaling",
    title: "Autoscaling",
    description: "Adds capacity when overall demand rises.",
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function percent(value, total) {
  if (total <= 0) {
    return 0;
  }

  return clamp(Math.round((value / total) * 100), 0, 100);
}

function computeScenario({ noisyLoad, appLoad, quotas, isolation, autoscaling }) {
  if (isolation) {
    const appCapacity = 100 + (autoscaling ? 20 : 0);
    const noisyCapacity = 100 + (autoscaling ? 35 : 0);
    const appServed = Math.min(appLoad, appCapacity);
    const noisyServed = Math.min(noisyLoad, noisyCapacity);
    const appShortfall = Math.max(0, appLoad - appServed);
    const appShortfallRate = appLoad === 0 ? 0 : appShortfall / appLoad;
    const appLatency = Math.max(
      12,
      Math.round(16 + appShortfallRate * 85 - (autoscaling ? 4 : 0)),
    );

    return {
      layout: "isolated",
      capacity: appCapacity,
      saturation: percent(appServed, appCapacity),
      appLatency,
      appAvailability: Math.round(100 - appShortfallRate * 100),
      appServed,
      noisyServed,
      appDropped: appShortfall,
      noisyDropped: Math.max(0, noisyLoad - noisyServed),
      message:
        "The sensitive workload is protected on its own node, so the burst stays local.",
      status:
        appShortfallRate > 0.18 ? "Protected but busy" : "Stable and isolated",
    };
  }

  const capacity = 100 + (autoscaling ? 35 : 0);
  let noisyServed;

  if (quotas) {
    const protectedShare = Math.min(appLoad, 45);
    noisyServed = Math.min(noisyLoad, Math.max(0, capacity - protectedShare), 60);
  } else {
    const burstBonus = Math.max(0, noisyLoad - 50) * 0.55;
    noisyServed = Math.min(capacity, noisyLoad + burstBonus);
  }

  const appServed = Math.min(appLoad, Math.max(0, capacity - noisyServed));
  const appShortfall = Math.max(0, appLoad - appServed);
  const appShortfallRate = appLoad === 0 ? 0 : appShortfall / appLoad;
  const saturation = percent(noisyServed + appServed, capacity);
  const appLatency = Math.max(
    12,
    Math.round(
      18 +
        appShortfallRate * 120 +
        Math.max(0, saturation - 85) * 1.4 -
        (quotas ? 5 : 0) -
        (autoscaling ? 6 : 0),
    ),
  );

  return {
    layout: "shared",
    capacity,
    saturation,
    appLatency,
    appAvailability: Math.round(100 - appShortfallRate * 100),
    appServed,
    noisyServed,
    appDropped: appShortfall,
    noisyDropped: Math.max(0, noisyLoad - noisyServed),
    message: quotas
      ? "The quota reins in the burst, leaving room for the critical app."
      : "The noisy workload absorbs most of the shared capacity and starves its neighbor.",
    status:
      appShortfallRate > 0.35
        ? "Severe contention"
        : appShortfallRate > 0.12
          ? "Noticeable slowdown"
          : "Healthy",
  };
}

function formatDelta(current, baseline, suffix) {
  const difference = current - baseline;

  if (difference === 0) {
    return `No change ${suffix}`;
  }

  const sign = difference > 0 ? "+" : "";
  return `${sign}${difference}${suffix}`;
}

function ResourceBar({ segments }) {
  return (
    <div className="resource-bar">
      {segments.map((segment) => (
        <div
          key={segment.label}
          className={`resource-segment ${segment.tone}`}
          style={{ width: `${segment.width}%` }}
        >
          {segment.width > 12 ? (
            <>
              <span>{segment.label}</span>
              <strong>{segment.width}%</strong>
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, detail, emphasis }) {
  return (
    <div className={`metric-card ${emphasis ? "metric-card-emphasis" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export default function Home() {
  const [noisyLoad, setNoisyLoad] = useState(85);
  const [appLoad, setAppLoad] = useState(55);
  const [activeSolutions, setActiveSolutions] = useState({
    quotas: false,
    isolation: false,
    autoscaling: false,
  });

  const baseline = useMemo(
    () =>
      computeScenario({
        noisyLoad,
        appLoad,
        quotas: false,
        isolation: false,
        autoscaling: false,
      }),
    [noisyLoad, appLoad],
  );

  const current = useMemo(
    () =>
      computeScenario({
        noisyLoad,
        appLoad,
        ...activeSolutions,
      }),
    [noisyLoad, appLoad, activeSolutions],
  );

  const comparison = {
    latency: baseline.appLatency - current.appLatency,
    availability: current.appAvailability - baseline.appAvailability,
  };
  const activeSolutionCount = Object.values(activeSolutions).filter(Boolean).length;
  const currentPanelTitle =
    current.layout === "isolated"
      ? "Protected topology"
      : activeSolutionCount > 0
        ? "Shared host with guardrails"
        : "Same shared host";
  const currentStatusClass =
    current.appDropped > 0 ? "status-warning" : "status-good";

  const sharedSegments = [
    { label: "Noisy tenant", width: percent(current.noisyServed, current.capacity), tone: "segment-noisy" },
    { label: "Sensitive app", width: percent(current.appServed, current.capacity), tone: "segment-app" },
    {
      label: "Headroom",
      width: clamp(
        100 -
          percent(current.noisyServed, current.capacity) -
          percent(current.appServed, current.capacity),
        0,
        100,
      ),
      tone: "segment-free",
    },
  ];

  const baselineSegments = [
    { label: "Noisy tenant", width: percent(baseline.noisyServed, baseline.capacity), tone: "segment-noisy" },
    { label: "Sensitive app", width: percent(baseline.appServed, baseline.capacity), tone: "segment-app" },
    {
      label: "Headroom",
      width: clamp(
        100 -
          percent(baseline.noisyServed, baseline.capacity) -
          percent(baseline.appServed, baseline.capacity),
        0,
        100,
      ),
      tone: "segment-free",
    },
  ];

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Interactive systems explainer</p>
          <h1>Noisy neighbor problem visualizer</h1>
          <p className="hero-text">
            Move the sliders to create contention on shared infrastructure, then
            turn on solutions to see how quotas, isolation, and autoscaling
            change the outcome for the latency-sensitive application.
          </p>
        </div>
        <div className="hero-summary">
          <MetricCard
            label="Current app latency"
            value={`${current.appLatency} ms`}
            detail={current.status}
            emphasis
          />
          <MetricCard
            label="Latency improvement"
            value={`${comparison.latency > 0 ? "-" : ""}${Math.abs(comparison.latency)} ms`}
            detail="Compared with no protections"
          />
          <MetricCard
            label="Availability improvement"
            value={formatDelta(current.appAvailability, baseline.appAvailability, "%")}
            detail="Sensitive app request success"
          />
        </div>
      </section>

      <section className="control-panel">
        <div className="card">
          <h2>1. Create pressure</h2>
          <label className="slider-control">
            <div>
              <span>Noisy tenant load</span>
              <strong>{noisyLoad}% of a node</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={noisyLoad}
              onChange={(event) => setNoisyLoad(Number(event.target.value))}
            />
          </label>
          <label className="slider-control">
            <div>
              <span>Sensitive app load</span>
              <strong>{appLoad}% of a node</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={appLoad}
              onChange={(event) => setAppLoad(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="card">
          <h2>2. Turn on solutions</h2>
          <div className="solution-list">
            {solutions.map((solution) => (
              <label key={solution.key} className="solution-toggle">
                <input
                  type="checkbox"
                  checked={activeSolutions[solution.key]}
                  onChange={() =>
                    setActiveSolutions((previous) => ({
                      ...previous,
                      [solution.key]: !previous[solution.key],
                    }))
                  }
                />
                <div>
                  <strong>{solution.title}</strong>
                  <p>{solution.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="viz-grid">
        <div className="card scenario-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Without solutions</p>
              <h2>Shared host baseline</h2>
            </div>
            <span className="status-badge status-warning">{baseline.status}</span>
          </div>
          <ResourceBar segments={baselineSegments} />
          <div className="stat-row">
            <MetricCard
              label="Sensitive app served"
              value={`${baseline.appServed}%`}
              detail={`${baseline.appDropped}% demand dropped`}
            />
            <MetricCard
              label="Latency"
              value={`${baseline.appLatency} ms`}
              detail="Requests slow down under contention"
            />
            <MetricCard
              label="Availability"
              value={`${baseline.appAvailability}%`}
              detail="Successful app requests"
            />
          </div>
          <p className="scenario-message">{baseline.message}</p>
        </div>

        <div className="card scenario-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">With current selections</p>
              <h2>{currentPanelTitle}</h2>
            </div>
            <span className={`status-badge ${currentStatusClass}`}>{current.status}</span>
          </div>

          {current.layout === "isolated" ? (
            <div className="isolated-layout">
              <div className="node-card">
                <span>Critical app node</span>
                <ResourceBar
                  segments={[
                    {
                      label: "Sensitive app",
                      width: percent(current.appServed, current.capacity),
                      tone: "segment-app",
                    },
                    {
                      label: "Headroom",
                      width: clamp(100 - percent(current.appServed, current.capacity), 0, 100),
                      tone: "segment-free",
                    },
                  ]}
                />
              </div>
              <div className="node-card">
                <span>Noisy tenant node</span>
                <ResourceBar
                  segments={[
                    {
                      label: "Noisy tenant",
                      width: percent(current.noisyServed, 100 + (activeSolutions.autoscaling ? 35 : 0)),
                      tone: "segment-noisy",
                    },
                    {
                      label: "Headroom",
                      width: clamp(
                        100 -
                          percent(
                            current.noisyServed,
                            100 + (activeSolutions.autoscaling ? 35 : 0),
                          ),
                        0,
                        100,
                      ),
                      tone: "segment-free",
                    },
                  ]}
                />
              </div>
            </div>
          ) : (
            <ResourceBar segments={sharedSegments} />
          )}

          <div className="stat-row">
            <MetricCard
              label="Sensitive app served"
              value={`${current.appServed}%`}
              detail={`${current.appDropped}% demand dropped`}
            />
            <MetricCard
              label="Latency"
              value={`${current.appLatency} ms`}
              detail="Lower is better"
            />
            <MetricCard
              label="Availability"
              value={`${current.appAvailability}%`}
              detail="Successful app requests"
            />
          </div>
          <p className="scenario-message">{current.message}</p>
        </div>
      </section>

      <section className="card takeaway-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">What changed</p>
            <h2>Outcome summary</h2>
          </div>
        </div>
        <div className="takeaway-grid">
          <div>
            <span className="takeaway-label">Latency delta</span>
            <strong>{formatDelta(current.appLatency, baseline.appLatency, " ms")}</strong>
          </div>
          <div>
            <span className="takeaway-label">Availability delta</span>
            <strong>{formatDelta(current.appAvailability, baseline.appAvailability, "%")}</strong>
          </div>
          <div>
            <span className="takeaway-label">Noisy tenant served</span>
            <strong>{current.noisyServed}%</strong>
          </div>
          <div>
            <span className="takeaway-label">Explanation</span>
            <strong>{current.message}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
