import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(10, 10, 10, 0.95)",
      border: "1px solid #242424",
      borderLeft: "2px solid #f5a623",
      borderRadius: "2px",
      padding: "12px 16px",
      fontSize: 12,
      fontFamily: "'JetBrains Mono', monospace",
      backdropFilter: "blur(8px)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 0 16px rgba(245,166,35,0.08)",
    }}>
      <div style={{ color: "#444", fontSize: 9, marginBottom: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {formatTime(payload[0]?.payload?.t)}
      </div>
      <div style={{ color: "#f5a623", fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", lineHeight: 1 }}>
        {payload[0]?.value?.toFixed(0)}
        <span style={{ fontSize: 13, fontWeight: 400, opacity: 0.5, marginLeft: 3 }}>W</span>
      </div>
    </div>
  );
};

export default function PowerChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{
        height: 240,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#2e2e2e",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        gap: 12,
        borderRadius: "1px",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        Awaiting power data
      </div>
    );
  }

  const peak = Math.max(...data.map((d) => d.v));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 6, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#f5a623" stopOpacity={0.3} />
            <stop offset="60%"  stopColor="#f5a623" stopOpacity={0.06} />
            <stop offset="100%" stopColor="#f5a623" stopOpacity={0} />
          </linearGradient>
          <filter id="lineGlow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <CartesianGrid stroke="#171717" strokeDasharray="3 6" vertical={false} />
        <XAxis
          dataKey="t"
          tickFormatter={formatTime}
          tick={{ fill: "#333", fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em" }}
          tickLine={false}
          axisLine={{ stroke: "#1a1a1a" }}
          interval="preserveStartEnd"
          minTickGap={70}
        />
        <YAxis
          dataKey="v"
          tick={{ fill: "#333", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}W`}
          width={46}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: "rgba(245,166,35,0.3)", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        {peak > 0 && (
          <ReferenceLine
            y={peak}
            stroke="rgba(245, 166, 35, 0.15)"
            strokeDasharray="4 6"
            label={{
              value: `${peak.toFixed(0)}W peak`,
              fill: "#3a3a3a",
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              position: "insideTopRight",
              letterSpacing: "0.08em",
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="v"
          stroke="#f5a623"
          strokeWidth={2.5}
          fill="url(#amberGrad)"
          dot={false}
          activeDot={{
            r: 5,
            fill: "#f5a623",
            stroke: "#060606",
            strokeWidth: 2,
            filter: "url(#lineGlow)",
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
