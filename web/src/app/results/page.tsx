"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import { usePreferences } from "../components/preferences";
import { translate } from "../components/translations";

type Outfit = {
  outfit_id: string;
  explanation_vi: string;
  price_total_vnd: number;
  items: {
    item_id: string;
    category: string;
    title_vi: string;
    price_vnd: number;
    store_name: string;
    product_url: string;
    image_path: string;
  }[];
};

function SkeletonCard() {
  return (
    <div className="border border-border bg-surface rounded-lg p-4 shadow-sm animate-pulse">
      <div className="h-5 w-24 bg-brand-soft rounded mb-3" />
      <div className="h-3 w-full bg-brand-soft rounded mb-2" />
      <div className="h-3 w-2/3 bg-brand-soft rounded mb-3" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-brand-soft rounded" />
        <div className="h-3 w-5/6 bg-brand-soft rounded" />
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const { language } = usePreferences();
  const t = (text: string) => translate(language, text);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sizes, setSizes] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.resolve().then(() => {
    const stored = localStorage.getItem("quiz_answers");
    if (!stored) {
      setLoading(false);
      return;
    }
    const answers = JSON.parse(stored);

    fetch(`${API_URL}/api/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        occasion: answers.occasions?.[0] || "cafe_hangout",
        quiz_answers: answers,
        height_cm: answers.height_cm || null,
        weight_kg: answers.weight_kg || null,
      }),
    })
      .then((r) => { if (!r.ok) throw new Error("Recommendations unavailable"); return r.json(); })
      .then((data) => {
        setOutfits(data.outfits || []);
        setSizes(data.suggested_sizes || {});
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
    }).catch(() => { setError(true); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <main className="site-shell"><div className="results-wrap">
        <h1 className="results-title">{t("Gợi ý dành cho bạn")}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div></main>
    );
  }

  return (
    <main className="site-shell"><div className="results-wrap">
      <h1 className="results-title">{t("Gợi ý dành cho bạn")}</h1><p className="results-description">{t("Một vài ý tưởng để bạn bắt đầu phối đồ theo cách riêng.")}</p>

      {Object.keys(sizes).length > 0 && <p className="mb-4 text-ink">{language === "vi" ? "Size gợi ý cho outfit đầu tiên" : "Suggested sizes for the first outfit"}: {Object.entries(sizes).map(([item, size]) => `${item}: ${size}`).join(", ")}</p>}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-brand-soft p-4 text-ink"
        >
          <p className="font-medium mb-2">
            {t("Mình chưa tải được gợi ý. Bạn thử lại sau nhé.")}
          </p>
          <Link
            href="/quiz"
            className="text-brand underline font-medium"
          >
            {t("Quay lại quiz")}
          </Link>
        </div>
      ) : outfits.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <p className="text-muted mb-3">
            {t("Chưa có gợi ý nào. Bạn làm quiz để mình hiểu gu hơn nhé.")}
          </p>
          <Link
            href="/quiz"
            className="glass-primary"
          >
            {t("Làm quiz ngay")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {outfits.map((outfit) => (
            <div
              key={outfit.outfit_id}
              className="border border-border bg-surface rounded-lg p-4 shadow-sm"
            >
              <p className="font-bold text-lg mb-2 text-ink">
                {outfit.outfit_id}
              </p>
              <p className="text-sm text-muted mb-2">
                {outfit.explanation_vi}
              </p>
              <p className="text-sm font-semibold mb-3 text-ink">
                {language === "vi" ? "Tổng" : "Total"}: {outfit.price_total_vnd.toLocaleString()} VND
              </p>
              <div className="mt-2 space-y-2">
                {outfit.items.map((item) => (
                  <div
                    key={item.item_id}
                    className="flex gap-3 items-start border-t border-border pt-2"
                  >
                    <div
                      className="h-12 w-12 shrink-0 rounded-md bg-brand-soft flex items-center justify-center text-brand font-bold text-sm"
                      aria-hidden="true"
                    >
                      {item.category.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <a
                        href={item.product_url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-ink hover:text-brand hover:underline truncate block"
                      >
                        {item.title_vi}
                      </a>
                      <p className="text-xs text-muted">
                        {item.store_name} — {item.price_vnd.toLocaleString()} VND
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div></main>
  );
}
