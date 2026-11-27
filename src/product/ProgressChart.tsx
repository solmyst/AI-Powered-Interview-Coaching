import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Summary } from "./types";

export default function ProgressChart({
  sessions,
  open,
}: {
  sessions: Summary[];
  open: (id: string) => void;
}) {
  const data = sessions
    .slice(0, 10)
    .reverse()
    .map((s, i) => ({
      session: i + 1,
      score: s.score,
      roleTitle: s.role,
      id: s.id,
    }));
  return (
    <>
      <div
        className="progress-chart"
        role="img"
        aria-label="Practice score trend. Exact scores and report links follow below."
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart
            data={data}
            margin={{ top: 16, right: 16, bottom: 4, left: -20 }}
            accessibilityLayer
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--line)"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="session"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              tickMargin={12}
            />
            <YAxis
              domain={[0, 100]}
              tickCount={5}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                borderColor: "var(--line)",
                borderRadius: 8,
                color: "var(--ink)",
              }}
              labelFormatter={(label) => `Practice ${label}`}
            />
            <Area
              dataKey="score"
              name="AI coaching estimate"
              type="linear"
              stroke="var(--accent)"
              fill="var(--teal)"
              fillOpacity={0.12}
              strokeWidth={2.5}
              dot={{
                r: 4,
                fill: "var(--accent)",
                stroke: "var(--surface)",
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ul
        className="chart-session-links"
        aria-label="Practice scores and reports"
      >
        {data.map((s) => (
          <li key={s.id}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => open(s.id)}
              aria-label={`Session ${s.session}, score ${s.score}, ${s.roleTitle}`}
            >
              <span>#{s.session}</span>
              <strong>{s.score}/100</strong>
              <ArrowUpRight size={14} aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}
