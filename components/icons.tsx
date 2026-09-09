"use client";
/**
 * Brand logo + per-item artwork.
 *  - Logo: inline SVG mark (gradient coin/pulse), no external asset needed.
 *  - ItemIcon priority: CoinGecko image (crypto) → country flag (fiat,
 *    flagcdn.com) → category SVG (gold/coin/oil/metal) → letter badge.
 * Every <img> has an onError fallback so a blocked CDN never breaks the UI.
 */
import { useState } from "react";
import type { AggregatedItem, Category } from "@/lib/types";
import { flagUrl } from "@/lib/catalog";

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden style={{ flex: "none" }}>
      <defs>
        <linearGradient id="pp-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0e7c7b" />
          <stop offset="100%" stopColor="#7c5cff" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#pp-logo-g)" />
      {/* pulse / chart line */}
      <path
        d="M10 30 L17 30 L21 20 L26 34 L30 25 L33 28 L38 28"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="38" cy="28" r="2.6" fill="#fff" />
    </svg>
  );
}

function GoldIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      {/* gold bars */}
      <rect x="9" y="27" width="30" height="10" rx="2" fill="#b8860b" />
      <rect x="13" y="18" width="22" height="10" rx="2" fill="#d4a017" />
      <rect x="17" y="9" width="14" height="10" rx="2" fill="#f0c420" />
      <rect x="17" y="9" width="14" height="4" rx="2" fill="#ffe066" />
    </svg>
  );
}

function CoinIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <ellipse cx="24" cy="12" rx="14" ry="6" fill="#f0c420" />
      <path d="M10 12 v22 c0 3.3 6.3 6 14 6 s14 -2.7 14 -6 v-22" fill="#d4a017" />
      <ellipse cx="24" cy="34" rx="14" ry="6" fill="#b8860b" />
      <ellipse cx="24" cy="12" rx="14" ry="6" fill="#ffe066" />
      <ellipse cx="24" cy="12" rx="8" ry="3.2" fill="#f0c420" />
    </svg>
  );
}

function OilIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        d="M24 4 C24 4 10 22 10 30 a14 14 0 0 0 28 0 C38 22 24 4 24 4 Z"
        fill="#334155"
      />
      <path d="M18 30 a6 6 0 0 0 6 6" fill="none" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function MetalIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="16" fill="#94a3b8" />
      <circle cx="24" cy="24" r="16" fill="none" stroke="#64748b" strokeWidth="3" />
      <circle cx="24" cy="24" r="9" fill="#cbd5e1" />
      <circle cx="24" cy="24" r="9" fill="none" stroke="#64748b" strokeWidth="2" />
    </svg>
  );
}

function CurrencyIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="6" y="13" width="36" height="22" rx="4" fill="#0e7c7b" />
      <rect x="6" y="13" width="36" height="22" rx="4" fill="none" stroke="#0a5e5d" strokeWidth="2" />
      <circle cx="24" cy="24" r="7" fill="none" stroke="#fff" strokeWidth="2.5" />
      <path d="M24 19 v10 M21 21.5 h6 M21 26.5 h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CategoryArt({ category, id, size }: { category: Category; id: string; size: number }) {
  if (category === "gold") {
    return id.startsWith("COIN_") ? <CoinIcon size={size} /> : <GoldIcon size={size} />;
  }
  if (category === "oil") return <OilIcon size={size} />;
  if (category === "metal") return <MetalIcon size={size} />;
  if (category === "crypto") return <CurrencyIcon size={size} />;
  return <CurrencyIcon size={size} />;
}

export function ItemIcon({ item, size = 40 }: { item: AggregatedItem; size?: number }) {
  const [imgOk, setImgOk] = useState(true);
  const [flagOk, setFlagOk] = useState(true);
  const flag = flagUrl(item.id);
  const box: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: Math.max(8, size * 0.3),
    flex: "none",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    background: "var(--accent-soft)",
    color: "var(--accent)",
    fontWeight: 800,
    fontSize: size * 0.32,
  };
  // 1) CoinGecko artwork for crypto
  if (item.icon && imgOk) {
    return (
      <span style={box}>
        <img
          src={item.icon}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setImgOk(false)}
          style={{ objectFit: "cover" }}
        />
      </span>
    );
  }
  // 2) country flag for fiat
  if (flag && flagOk && !(item.icon && imgOk)) {
    return (
      <span style={{ ...box, background: "var(--surface-2)" }}>
        <img
          src={flag}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFlagOk(false)}
          style={{ objectFit: "cover" }}
        />
      </span>
    );
  }
  // 3) category artwork (gold/coin/oil/metal)
  if (item.category !== "currency") {
    return (
      <span style={box}>
        <CategoryArt category={item.category} id={item.id} size={Math.round(size * 0.85)} />
      </span>
    );
  }
  // 4) letter badge fallback
  return <span style={box}>{item.badge.slice(0, 2)}</span>;
}
