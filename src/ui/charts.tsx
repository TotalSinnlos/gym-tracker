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
  /** Index into `SERIES_STYLES`: set 1 is a solid ink line, set 2 dashed amber, set 3 dotted grey. */
  style: number;
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

/** Line styles for several series, told apart by pattern as well as colour. */
export const SERIES_STYLES = [
  { stroke: "var(--ink)", dash: undefined },
  { stroke: "var(--amber-line)", dash: "5 4" },
  { stroke: "var(--ink-2)", dash: "1.5 4" },
];

export const seriesStyle = (index: number) => SERIES_STYLES[index % SERIES_STYLES.length];

const WIDTH = 334;
const PAD = { left: 30, right: 10, top: 10, bottom: 24 };

interface ChartProps {
  series: Series[];
  /** How many sessions the x axis spans. */
  count: number;
  /** The x-axis label for a session index (e.g. its date). */
  xLabel: (index: number) => string;
  /** Formats a y-axis label. */
  yLabel: (value: number) => string;
  height?: number;
  /** A shaded range across the chart, such as the target rep range. */
  band?: { from: number; to: number };
  /** What the chart shows, for screen readers. */
  title: string;
}

/**
 * A line chart. Light gridlines and labels at the lowest, middle and highest value (or the band's edges).
 * A single series shows a dot per session, hollow for incomplete ones, with the latest one in amber.
 */
export function Chart({ series, count, xLabel, yLabel, height = 170, band, title }: ChartProps) {
  const values = series.flatMap((s) => s.points.map((p) => p.value));
  if (count === 0 || values.length === 0) return null;

  let low = Math.min(...values, ...(band ? [band.from] : []));
  let high = Math.max(...values, ...(band ? [band.to] : []));
  if (low === high) {
    low -= 1;
    high += 1;
  }
  const ticks = band
    ? [...new Set([low, band.from, band.to, high])]
    : [low, Math.round(((low + high) / 2) * 10) / 10, high];
  const plotLeft = PAD.left + 8;
  const plotRight = WIDTH - PAD.right - 8;
  const plotTop = PAD.top;
  const plotBottom = height - PAD.bottom;
  const x = (index: number) => (count === 1 ? (plotLeft + plotRight) / 2 : plotLeft + ((plotRight - plotLeft) * index) / (count - 1));
  const y = (value: number) => plotBottom - ((plotBottom - plotTop) * (value - low)) / (high - low);
  const single = series.length === 1;
  const radius = count > 40 ? 2.5 : 3.5;
  const xTicks = count === 1 ? [0] : count < 5 ? [0, count - 1] : [0, Math.floor((count - 1) / 2), count - 1];

  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={title}>
      {band && (
        <g className="chart-band">
          <rect x={PAD.left} width={WIDTH - PAD.left - PAD.right} y={y(band.to)} height={Math.max(0, y(band.from) - y(band.to))} />
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(band.to)} y2={y(band.to)} />
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(band.from)} y2={y(band.from)} />
        </g>
      )}
      {ticks.map((tick) => (
        <g key={tick}>
          {!(band && (tick === band.from || tick === band.to)) && (
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
          )}
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
      {series.map((s, i) => {
        const style = seriesStyle(s.style);
        const last = s.points[s.points.length - 1];
        return (
          <g key={i}>
            {s.points.length > 1 && (
              <polyline
                points={s.points.map((p) => `${x(p.index)},${y(p.value)}`).join(" ")}
                className="chart-line"
                style={{ stroke: style.stroke, strokeDasharray: style.dash }}
              />
            )}
            {s.points.map((p) =>
              single || p.hollow ? (
                <circle
                  key={p.index}
                  cx={x(p.index)}
                  cy={y(p.value)}
                  r={single && p === last ? 5.5 : radius}
                  className={single && p === last ? "chart-point latest" : p.hollow ? "chart-point hollow" : "chart-point"}
                  style={single ? undefined : { stroke: style.stroke }}
                >
                  <title>{p.label}</title>
                </circle>
              ) : null,
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * A tiny trend line without axes: an ink line, hollow points for incomplete sessions and the latest
 * session as a larger amber point.
 */
export function Sparkline({ points, title, width = 80, height = 32 }: { points: DrawPoint[]; title: string; width?: number; height?: number }) {
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = 6;
  const x = (index: number) => (points.length === 1 ? width / 2 : pad + ((width - 2 * pad) * index) / (points.length - 1));
  // A flat line sits in the middle.
  const y = (value: number) => (high === low ? height / 2 : height - pad - ((height - 2 * pad) * (value - low)) / (high - low));
  const lastIndex = points.length - 1;
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={title}>
      {points.length > 1 && (
        <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} className="spark-line" />
      )}
      {points.map((p, i) =>
        i === lastIndex ? (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={4.5} className="spark-latest" />
        ) : (
          p.hollow && <circle key={i} cx={x(i)} cy={y(p.value)} r={2.5} className="spark-hollow" />
        ),
      )}
    </svg>
  );
}
