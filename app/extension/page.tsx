"use client";
/** In-app Chrome extension page: what it does, download ZIP, install guide. */
import Link from "next/link";
import { Header, StatusBar, PwaHelper } from "@/components/ui";
import { Logo } from "@/components/icons";
import { usePrices } from "@/hooks/usePrices";

const STEPS = [
  {
    t: "۱. دانلود و باز کردن فایل",
    d: "دکمه دانلود را بزنید و فایل extension.zip را در یک پوشه باز (Extract) کنید. جای پوشه را عوض نکنید.",
  },
  {
    t: "۲. حالت توسعه‌دهنده",
    d: "در کروم به آدرس chrome://extensions بروید و بالا سمت راست Developer mode را روشن کنید.",
  },
  {
    t: "۳. نصب",
    d: "دکمه Load unpacked را بزنید و همان پوشه‌ای که فایل‌ها را در آن باز کردید (پوشه extension) را انتخاب کنید.",
  },
  {
    t: "۴. سنجاق کردن",
    d: "روی آیکون پازل تولبار کلیک کنید و کنار «قیمت لحظه‌ای» Pin را بزنید تا قیمت دلار همیشه جلوی چشمتان باشد.",
  },
];

export default function ExtensionPage() {
  const { snap, online, stale } = usePrices();
  return (
    <>
      <Header />
      <main className="container">
        <div className="breadcrumb">
          <Link href="/">خانه</Link> / اکستنشن کروم
        </div>

        <div className="panel">
          <div className="row-flex">
            <Logo size={52} />
            <div>
              <h1 style={{ margin: 0, fontSize: "1.3rem" }}>اکستنشن کروم قیمت لحظه‌ای</h1>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                پاپ‌آپ ۷ قیمت کلیدی + بج لحظه‌ای قیمت دلار روی آیکون تولبار
              </div>
            </div>
          </div>
          <div className="row-flex mt">
            <a className="btn accent" href="/extension.zip" download="price-pwa-extension.zip">
              ⬇ دانلود اکستنشن (ZIP)
            </a>
            <small style={{ color: "var(--muted)" }}>
              نسخه همراه همین اپ بسته‌بندی می‌شود — همیشه تازه.
            </small>
          </div>
        </div>

        <div className="panel">
          <h2>راهنمای نصب (۱ دقیقه)</h2>
          {STEPS.map((s) => (
            <div key={s.t} style={{ marginBottom: 12 }}>
              <b>{s.t}</b>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>{s.d}</p>
            </div>
          ))}
          <div className="alert-banner">
            بدون هیچ تنظیمی به نسخه آنلاین وصل است. اگر نسخه لوکال خودتان را
            اجرا می‌کنید (<code dir="ltr">npm run dev</code>)، آدرس را در صفحه
            Options خود اکستنشن عوض کنید.
          </div>
        </div>

        <div className="panel">
          <h2>نکات</h2>
          <ul style={{ paddingInlineStart: 18, fontSize: "0.9rem", color: "var(--muted)" }}>
            <li>اکستنشن فقط به API همین اپ وصل می‌شود؛ سهمیه منابع را مصرف نمی‌کند.</li>
            <li>بج تولبار هر چند دقیقه (قابل تنظیم: ۱ تا ۳۰ دقیقه) به‌روز می‌شود.</li>
            <li>کروم اکستنشن‌های خارج از Web Store را فقط با Load unpacked قبول می‌کند — همین روش بالا رسمی و امن است و فایل‌ها روی سیستم خودتان می‌مانند.</li>
          </ul>
        </div>
      </main>
      <StatusBar snap={snap} online={online} stale={stale} />
      <PwaHelper />
    </>
  );
}
