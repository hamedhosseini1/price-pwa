"use client";
/**
 * Dependency-free SVG charts (always LTR geometry).
 *  - Sparkline: lazy-loads 24h history when scrolled into view.
 *  - DetailChart: large chart with hover crosshair.
 *  - CompareChart: multi-series normalized to % change from first point.
 */
import { useEffect, useRef, useState } from "react";
import type { HistoryPoint } from "@/lib/types";
import { useSettings } from "@/lib/settings";
import { formatNumber } from "@/lib/format";

function useVisible<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setVis(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, vis];
}

function path(pts: HistoryPoint[], w: number, h: number, pad = 2): { d: string; last: { x: number; y: number } } {
  if (pts.length === 0) return { d: "", last: { x: 0, y: 0 } };
  const vs = pts.map((p) => p.price);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const tspan = t1 - t0 || 1;
  const X = (t: number) => pad + ((t - t0) / tspan) * (w - pad * 2);
  const Y = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)},${Y(p.price).toFixed(1)}`).join(" ");
  return { d, last: { x: X(pts[pts.length - 1].t), y: Y(pts[pts.length - 1].price) } };
}

export function Sparkline({ id, up }: { id: string; up: boolean | null }) {
  const [ref, vis] = useVisible<HTMLDivElement>();
  const [pts, setPts] = useState<HistoryPoint[] | null>(null);
  const { currency } = useSettings();
  useEffect(() => {
    if (!vis) return;
    let dead = false;
    fetch(`/api/history/${id}?range=24h&currency=${currency}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!dead && j?.points?.length > 1) setPts(j.points);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [vis, id, currency]);
  const color = up == null ? "var(--muted)" : up ? "var(--green)" : "var(--red)";
  if (!pts) return <div ref={ref} style={{ height: 36 }} />;
  const { d, last } = path(pts, 120, 36);
  return (
    <div ref={ref} className="chart-box">
      <svg viewBox="0 0 120 36" width="100%" height="36" preserveAspectRatio="none" aria-hidden>
        <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last.x} cy={last.y} r="2.4" fill={color} />
      </svg>
    </div>
  );
}

export function DetailChart({ points, height = 260 }: { points: HistoryPoint[]; height?: number }) {
  const { digits } = useSettings();
  const [hov, setHov] = useState<number | null>(null);
  const W = 720;
  const H = height;
  const PAD = { t: 12, r: 8, b: 22, l: 8 };
  if (points.length < 2) return <div className="empty">داده کافی برای نمودار وجود ندارد.</div>;
  const vs = points.map((p) => p.price);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const tspan = t1 - t0 || 1;
  const X = (t: number) => PAD.l + ((t - t0) / tspan) * (W - PAD.l - PAD.r);
  const Y = (v: number) => PAD.t + (1 - (v - min) / span) * (H - PAD.t - PAD.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)},${Y(p.price).toFixed(1)}`).join(" ");
  const up = points[points.length - 1].price >= points[0].price;
  const stroke = up ? "var(--green)" : "var(--red)";
  const gid = `g${Math.abs(t0 % 100000)}`;
  const hp = hov != null ? points[hov] : null;

  return (
    <div className="chart-box">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block" }}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          let bd = Infinity;
          points.forEach((p, i) => {
            const dd = Math.abs(X(p.t) - x);
            if (dd < bd) {
              bd = dd;
              best = i;
            }
          });
          setHov(best);
        }}
        onMouseLeave={() => setHov(null)}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? "#0d9d6c" : "#e5484d"} stopOpacity="0.25" />
            <stop offset="100%" stopColor={up ? "#0d9d6c" : "#e5484d"} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => {
          const v = min + span * f;
          return (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} stroke="var(--border)" strokeDasharray="4 4" />
              <text x={W - PAD.r} y={Y(v) - 4} fontSize="10" fill="var(--muted)" textAnchor="end">
                {formatNumber(v, digits)}
              </text>
            </g>
          );
        })}
        <path d={`${d} L${X(t1).toFixed(1)},${H - PAD.b} L${X(t0).toFixed(1)},${H - PAD.b} Z`} fill={`url(#${gid})`} />
        <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
        {hp && (
          <g>
            <line x1={X(hp.t)} x2={X(hp.t)} y1={PAD.t} y2={H - PAD.b} stroke="var(--muted)" strokeDasharray="3 3" />
            <circle cx={X(hp.t)} cy={Y(hp.price)} r="4" fill={stroke} stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
        <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--muted)">
          {new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" }).format(new Date(t0))}
        </text>
        <text x={W - PAD.r} y={H - 6} fontSize="10" fill="var(--muted)" textAnchor="end">
          {new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" }).format(new Date(t1))}
        </text>
      </svg>
      {hp && (
        <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: 4 }}>
          {new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(hp.t))}
          {" — "}
          <b style={{ color: "var(--text)" }}>{formatNumber(hp.price, digits)}</b>
        </div>
      )}
    </div>
  );
}

const PALETTE = ["#0e7c7b", "#7c5cff", "#e8930c", "#e5484d", "#2563eb"];

export interface CmpSeries {
  label: string;
  points: HistoryPoint[];
}

export function CompareChart({ series }: { series: CmpSeries[] }) {
  const { digits } = useSettings();
  const W = 720;
  const H = 280;
  const PAD = { t: 12, r: 8, b: 22, l: 44 };
  const normed = series.map((s) => {
    const base = s.points[0]?.price;
    return {
      label: s.label,
      pts: s.points.map((p) => ({ t: p.t, price: base ? ((p.price - base) / base) * 100 : 0 })),
    };
  });
  const all = normed.flatMap((s) => s.pts.map((p) => p.price));
  if (!all.length) return <div className="empty">آیتمی برای مقایسه انتخاب کنید.</div>;
  const min = Math.min(...all, 0);
  const max = Math.max(...all, 0);
  const span = max - min || 1;
  const t0 = Math.min(...normed.flatMap((s) => s.pts.map((p) => p.t)));
  const t1 = Math.max(...normed.flatMap((s) => s.pts.map((p) => p.t)));
  const X = (t: number) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r);
  const Y = (v: number) => PAD.t + (1 - (v - min) / span) * (H - PAD.t - PAD.b);
  return (
    <div className="chart-box">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = min + span * f;
          return (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} stroke="var(--border)" strokeDasharray={v === 0 ? undefined : "4 4"} strokeWidth={v === 0 ? 1.5 : 1} />
              <text x={PAD.l - 4} y={Y(v) + 3} fontSize="10" fill="var(--muted)" textAnchor="end">
                {formatNumber(v, digits, 1)}٪
              </text>
            </g>
          );
        })}
        {normed.map((s, i) => (
          <path
            key={s.label}
            d={s.pts.map((p, j) => `${j ? "L" : "M"}${X(p.t).toFixed(1)},${Y(p.price).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <div className="legend">
        {normed.map((s, i) => (
          <span key={s.label}>
            <i style={{ background: PALETTE[i % PALETTE.length] }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
