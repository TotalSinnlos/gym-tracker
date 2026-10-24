// Small charts drawn with plain SVG, so they work offline without a chart library.
// They only draw what they're given: the numbers come from the core's graph queries.

import type { ChartPoint } from "../core";
import { formatNumber, formatShortDate } from "./format";

/** One point to draw. Sessions are spaced evenly from left to right, in the order given. */
export interface DrawPoint {
  /** Position from the left, counting sessions from 0. */
  index: number;
  value: number;
  /** Drawn hollow (incomplete session). */
  hollow: boolean;
  /** Shown when the point is long-pressed or hovered. */
  label: string;
}

export interface Series {
  points: DrawPoint[];
  color: string;
}

/** Points for a one-line chart: a session's weight, or its total reps. */
export function toDrawPoints(points: ChartPoint[], unit: string): DrawPoint[] {
  return points.map((p, index) => ({
    index,
    value: p.value,
    hollow: p.incomplete,
    label: `${formatShortDate(p.date, true)}: ${formatNumber(p.value)} ${unit}${p.incomplete ? " (incomplete)" : ""}`,
  }));
}

export const SERIES_COLORS = ["#f59e0b", "#38bdf8", "#a78bfa", "#34d399", "#f472b6"];

const WIDTH = 340;
const PAD = { left: 38, right: 12, top: 10, bottom: 24 };

interface ChartProps {
  series: Series[];
  /** How many sessions the x axis spans. */
  count: number;
  /** The x-axis label for a session index (e.g. its date). */
  xLabel: (index: number) => string;
  /** Formats a y-axis tick. */
  yLabel: (value: number) => string;
  height?: number;
  /** A shaded range across the chart, such as the target rep range. */
  band?: { from: number; to: number };
  /** What the chart shows, for screen readers. */
  title: string;
}

/** A line chart with a few labelled ticks on each axis. */
export function Chart({ series, count, xLabel, yLabel, height = 180, band, title }: ChartProps) {
  const values = series.flatMap((s) => s.points.map((p) => p.value));
  if (count === 0 || values.length === 0) return <p className="muted">No sessions yet.</p>;

  const ticks = niceTicks(Math.min(...values, ...(band ? [band.from] : [])), Math.max(...values, ...(band ? [band.to] : [])));
  const low = ticks[0];
  const high = ticks[ticks.length - 1];
  const plotLeft = PAD.left + 8;
  const plotRight = WIDTH - PAD.right - 8;
  const plotTop = PAD.top;
  const plotBottom = height - PAD.bottom;
  const x = (index: number) => (count === 1 ? (plotLeft + plotRight) / 2 : plotLeft + ((plotRight - plotLeft) * index) / (count - 1));
  const y = (value: number) => plotBottom - ((plotBottom - plotTop) * (value - low)) / (high - low);
  const radius = count > 40 ? 2 : count > 20 ? 3 : 4;
  const xTicks = count === 1 ? [0] : count < 5 ? [0, count - 1] : [0, Math.floor((count - 1) / 2), count - 1];

  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={title}>
      {band && (
        <rect
          x={PAD.left}
          width={WIDTH - PAD.left - PAD.right}
          y={y(band.to)}
          height={Math.max(0, y(band.from) - y(band.to))}
          className="chart-band"
        />
      )}
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
          <text x={PAD.left - 6} y={y(tick)} className="chart-label" textAnchor="end" dominantBaseline="middle">
            {yLabel(tick)}
          </text>
        </g>
      ))}
      {xTicks.map((index, i) => (
        <text
          key={index}
          x={x(index)}
          y={height - 6}
          className="chart-label"
          textAnchor={xTicks.length === 1 ? "middle" : i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
        >
          {xLabel(index)}
        </text>
      ))}
      {series.map((s, i) => (
        <g key={i}>
          {s.points.length > 1 && (
            <polyline
              points={s.points.map((p) => `${x(p.index)},${y(p.value)}`).join(" ")}
              className="chart-line"
              style={{ stroke: s.color }}
            />
          )}
          {s.points.map((p) => (
            <circle
              key={p.index}
              cx={x(p.index)}
              cy={y(p.value)}
              r={radius}
              className="chart-point"
              style={{ stroke: s.color, fill: p.hollow ? "var(--card)" : s.color }}
            >
              <title>{p.label}</title>
            </circle>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** A tiny trend line without axes, for lists. */
export function Sparkline({ points, title }: { points: DrawPoint[]; title: string }) {
  const width = 88;
  const height = 32;
  if (points.length === 0) return <span className="muted">No sessions</span>;
  const values = points.map((p) => p.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const x = (index: number) => (points.length === 1 ? width / 2 : 4 + ((width - 8) * index) / (points.length - 1));
  // A flat line sits in the middle.
  const y = (value: number) => (high === low ? height / 2 : height - 4 - ((height - 8) * (value - low)) / (high - low));
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={title}>
      {points.length > 1 && (
        <polyline
          points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")}
          className="chart-line"
          style={{ stroke: SERIES_COLORS[0] }}
        />
      )}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(p.value)}
          r={2.5}
          className="chart-point"
          style={{ stroke: SERIES_COLORS[0], fill: p.hollow ? "var(--card)" : SERIES_COLORS[0] }}
        />
      ))}
    </svg>
  );
}

/** Three to six round tick values covering `min`..`max`. */
export function niceTicks(min: number, max: number): number[] {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1);
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  const start = Math.max(0, Math.floor(min / step) * step);
  // Ticks up to the first one at or above `max`, so every value fits inside the chart.
  const ticks = [start];
  while (ticks[ticks.length - 1] < max - step * 1e-9) ticks.push(Number((start + ticks.length * step).toFixed(6)));
  if (ticks.length < 2) ticks.push(start + step);
  return ticks;
}
