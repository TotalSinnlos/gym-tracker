// The scalloped badge: a check when every exercise is done, an arrow when a weight goes up.

export function Badge({ size = 64, mark = "check" }: { size?: number; mark?: "check" | "up" }) {
  const scallops = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI) / 4;
    return <circle key={i} cx={48 + 30 * Math.cos(angle)} cy={48 + 30 * Math.sin(angle)} r="14" />;
  });
  return (
    <svg className="badge-svg" aria-hidden="true" width={size} height={size} viewBox="0 0 96 96">
      <g fill="var(--ink)">
        <circle cx="48" cy="48" r="32" />
        {scallops}
      </g>
      <path
        d={mark === "check" ? "M31 49l11 11 23-24" : "M48 66V32M34 45l14-14 14 14"}
        fill="none"
        stroke="var(--amber)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
