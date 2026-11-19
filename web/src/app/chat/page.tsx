"use client";

import { useState, useRef, useEffect, useCallback, Fragment } from "react";
import { API_URL } from "@/lib/api";
import { useCloset } from "@/lib/closet";
import { usePreferences } from "../components/preferences";
import { translate } from "../components/translations";

type OutfitCard = {
  outfit_id: string;
  explanation_vi: string;
  price_total_vnd: number;
  style?: string[];
  color_palette?: string[];
  compatibility_score?: number;
  suggested_sizes?: Record<string, string>;
  items: {
    item_id: string;
    category: string;
    title_vi: string;
    price_vnd: number;
    store_name: string;
    image_path: string;
    product_url: string;
  }[];
};

type ChatMessage = {
  role: "user" | "bot";
  text: string;
  outfits?: OutfitCard[];
};

const STORAGE_KEY = "stylese-ai-chat-session";

function newSessionId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `sess_${Date.now()}`;
}

function renderInlineFormatting(line: string) {
  const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-brand-soft text-xs font-mono font-semibold"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={idx}>{part}</Fragment>;
  });
}

function FormattedMessageText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-ink leading-relaxed">
      {lines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" aria-hidden="true" />;
        }
        const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={idx} className="flex gap-2 pl-1">
              <span aria-hidden="true" className="text-muted">
                •
              </span>
              <span className="flex-1">{renderInlineFormatting(bulletMatch[1])}</span>
            </div>
          );
        }
        return <p key={idx}>{renderInlineFormatting(rawLine)}</p>;
      })}
    </div>
  );
}

export default function ChatPage() {
  const { language } = usePreferences();
  const closet = useCloset();
  const t = (text: string) => translate(language, text);

  const [sessionId, setSessionId] = useState<string>(() => newSessionId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [shareCloset, setShareCloset] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [currentText, setCurrentText] = useState("");
  const [pendingOutfits, setPendingOutfits] = useState<OutfitCard[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.sessionId === "string" && parsed.sessionId) {
            setSessionId(parsed.sessionId);
          }
          if (Array.isArray(parsed?.messages)) {
            setMessages(parsed.messages);
          }
        }
      } catch {
        /* ignore unreadable persisted session */
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ sessionId, messages: messages.slice(-40) }),
      );
    } catch {
      /* ignore storage quota failures */
    }
  }, [hydrated, sessionId, messages]);

  useEffect(() => {
    if (!isStreaming && messages.length === 0 && !currentText && pendingOutfits.length === 0) {
      return;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" });
  }, [messages, currentText, pendingOutfits, isStreaming, thinkingText]);

  const resetSession = useCallback(() => {
    if (isStreaming) return;
    const freshId = newSessionId();
    setSessionId(freshId);
    setMessages([]);
    setInput("");
    setCurrentText("");
    setThinkingText("");
    setPendingOutfits([]);
    setCopiedIndex(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [isStreaming]);

  const copyReply = useCallback(async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex((cur) => (cur === idx ? null : cur)), 1800);
    } catch {
      /* ignore clipboard errors */
    }
  }, []);

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const textToSend = (overrideText ?? input).trim();
      if (!textToSend || isStreaming) return;
      if (overrideText === undefined) setInput("");

      setMessages((prev) => [...prev, { role: "user", text: textToSend }]);
      setIsStreaming(true);
      setThinkingText(
        language === "vi" ? "Stylese AI đang suy nghĩ…" : "Stylese AI is thinking…",
      );
      setCurrentText("");
      setPendingOutfits([]);

      let botText = "";
      let outfits: OutfitCard[] = [];
      let rafId: number | null = null;
      const scheduleFlush = () => {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          setCurrentText(botText);
        });
      };

      try {
        let quizAnswers = null;
        try {
          quizAnswers = JSON.parse(localStorage.getItem("quiz_answers") || "null");
        } catch {
          quizAnswers = null;
        }

        const closetPayload = shareCloset
          ? closet.slice(0, 30).map((item) => ({
              name: item.name,
              category: item.category,
              color: item.color || "",
            }))
          : [];

        const resp = await fetch(`${API_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: textToSend,
            conversation_id: sessionId,
            history: messages.slice(-20).map((m) => ({
              role: m.role === "bot" ? "assistant" : "user",
              content: m.text,
            })),
            quiz_answers: quizAnswers,
            closet_items: closetPayload,
          }),
        });

        if (!resp.ok) {
          throw new Error(resp.status === 503 ? "STYLIST_UNAVAILABLE" : `HTTP ${resp.status}`);
        }
        if (!resp.body) throw new Error("No response body");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split(/\r?\n\r?\n/);
          buffer = parts.pop() || "";

          for (const part of parts) {
            const lines = part.split("\n");
            let eventType = "";
            let data = "";
            for (const line of lines) {
              if (line.startsWith("event:")) eventType = line.slice(6).trim();
              else if (line.startsWith("data:")) data = line.slice(5).trim();
            }

            if (eventType === "thinking") {
              try {
                const parsed = JSON.parse(data);
                if (typeof parsed === "string" && parsed) setThinkingText(parsed);
              } catch {
                /* ignore */
              }
            } else if (eventType === "token") {
              botText += JSON.parse(data);
              scheduleFlush();
            } else if (eventType === "outfit_cards") {
              try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) outfits = parsed;
                else if (parsed.outfits) outfits = parsed.outfits;
                setPendingOutfits(outfits);
              } catch {
                /* ignore parse errors */
              }
            } else if (eventType === "error") {
              botText += "\n[Error: " + JSON.parse(data) + "]";
              setCurrentText(botText);
            }
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            text: botText,
            outfits: outfits.length > 0 ? outfits : undefined,
          },
        ]);
      } catch (err) {
        console.error("Chat error:", err);
        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            text:
              err instanceof Error && err.message === "STYLIST_UNAVAILABLE"
                ? language === "vi"
                  ? "Mình chưa sẵn sàng tư vấn vì mô hình và dữ liệu chưa được kết nối. Bạn quay lại sau nhé."
                  : "Stylese AI is unavailable until the model and data are connected."
                : translate(language, "Mình gặp chút trục trặc rồi. Bạn thử lại nhé."),
          },
        ]);
      } finally {
        if (rafId !== null) cancelAnimationFrame(rafId);
        setIsStreaming(false);
        setThinkingText("");
        setCurrentText("");
        setPendingOutfits([]);
      }
    },
    [input, isStreaming, messages, language, sessionId, shareCloset, closet],
  );

  function renderOutfitCard(card: OutfitCard) {
    const sizeEntries = Object.entries(card.suggested_sizes || {});
    return (
      <div
        key={card.outfit_id}
        className="border border-border bg-surface rounded-lg p-4 mt-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold text-lg text-ink">{card.outfit_id}</p>
          {typeof card.compatibility_score === "number" && card.compatibility_score > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-soft text-ink font-semibold">
              {Math.round(card.compatibility_score * 100)}% {language === "vi" ? "ăn ý" : "match"}
            </span>
          )}
        </div>
        {card.explanation_vi && (
          <p className="text-sm text-muted mb-2">{card.explanation_vi}</p>
        )}
        <p className="text-sm font-semibold text-ink">
          {language === "vi" ? "Tổng" : "Total"}: {card.price_total_vnd.toLocaleString()} VND
        </p>
        {(card.style?.length || card.color_palette?.length) ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {card.style?.slice(0, 3).map((s) => (
              <span key={s} className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted">
                {s}
              </span>
            ))}
            {card.color_palette?.slice(0, 3).map((c) => (
              <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-brand-soft text-ink">
                {c}
              </span>
            ))}
          </div>
        ) : null}
        {sizeEntries.length > 0 && (
          <p className="text-xs text-muted mt-2">
            {language === "vi" ? "Size gợi ý" : "Suggested sizes"}:{" "}
            <strong className="text-ink">
              {sizeEntries.map(([cat, sz]) => `${cat}: ${sz}`).join(", ")}
            </strong>
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 mt-3">
          {card.items.map((item) => (
            <a
              key={item.item_id}
              href={item.product_url || "#"}
              target="_blank"
              rel="noreferrer"
              className="text-xs border border-border rounded-md p-2 hover:bg-brand-soft transition-colors"
            >
              <div
                className="h-10 w-full rounded bg-brand-soft mb-1 flex items-center justify-center text-brand font-bold"
                aria-hidden="true"
              >
                {item.category.slice(0, 2).toUpperCase()}
              </div>
              <p className="font-medium capitalize text-ink truncate">
                {item.category}
              </p>
              <p className="truncate text-ink">{item.title_vi}</p>
              <p className="text-muted">
                {item.store_name} - {item.price_vnd.toLocaleString()} VND
              </p>
            </a>
          ))}
        </div>
      </div>
    );
  }

  const starterPrompts =
    language === "vi"
      ? [
          "Mình nên mặc gì khi đi làm?",
          "Gợi ý phong cách tối giản",
          "Phối đồ cho buổi hẹn",
        ]
      : [
          "What should I wear to work?",
          "Suggest a minimalist style",
          "Help me dress for a date",
        ];

  const followUpPrompts =
    language === "vi"
      ? ["Ngân sách dưới 500k", "Đổi sang phong cách Hàn", "Gợi ý thêm đồ dự tiệc"]
      : ["Under 500k VND", "Try Korean style", "Suggest party outfits"];

  return (
    <main className="site-shell chat-stylist flex flex-col">
      <div className="chat-heading">
        <h1>{t("Hôm nay bạn muốn mặc gì?")}</h1>
        <p>{t("Kể mình nghe bạn định mặc đi đâu hoặc đang thích phong cách nào nhé.")}</p>
      </div>

      <div className="chat-toolbar">
        <label className="chat-closet-toggle">
          <input
            type="checkbox"
            checked={shareCloset}
            onChange={(e) => setShareCloset(e.target.checked)}
            disabled={isStreaming}
          />
          <span>
            {language === "vi"
              ? `Kèm tủ đồ của bạn (${closet.length})`
              : `Include my closet (${closet.length})`}
          </span>
        </label>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={resetSession}
            disabled={isStreaming}
            className="glass-button chat-reset-btn disabled:opacity-50"
          >
            {t("Cuộc trò chuyện mới")}
          </button>
        )}
      </div>

      <div className="chat-feed flex-1 space-y-4 max-w-3xl mx-auto w-full px-4">
        {messages.length === 0 && !isStreaming && (
          <div className="chat-welcome glass-panel">
            <p>{language === "vi" ? "Bắt đầu bằng một câu hỏi" : "Start with a question"}</p>
            <div className="chat-suggestions">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="glass-button"
                  onClick={() => void sendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <small>
              {shareCloset
                ? language === "vi"
                  ? `Đang bật chia sẻ ${closet.length} món từ tủ đồ của bạn để Stylese AI phối hợp chính xác hơn.`
                  : `Sharing ${closet.length} items from your local closet with Stylese AI.`
                : language === "vi"
                  ? "Stylese AI kết hợp dữ liệu thời trang thật và hồ sơ quiz của bạn. Bật công tắc phía trên nếu muốn gửi kèm tủ đồ."
                  : "Stylese AI combines real catalog outfits and your quiz profile. Toggle above to share your local closet."}
            </small>
          </div>
        )}

        {messages.map((msg, i) => {
          const isLastBot = msg.role === "bot" && i === messages.length - 1 && !isStreaming;
          return (
            <div
              key={i}
              className={`chat-message rounded-lg p-4 ${
                msg.role === "user"
                  ? "bg-brand-soft ml-8 sm:ml-16"
                  : "bg-surface border border-border mr-4 sm:mr-16"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-sm font-semibold text-ink">
                  {msg.role === "user" ? t("Bạn") : "Stylese AI"}
                </p>
                {msg.role === "bot" && msg.text && (
                  <button
                    type="button"
                    onClick={() => void copyReply(msg.text, i)}
                    className="chat-copy-btn"
                  >
                    {copiedIndex === i ? t("Đã chép") : t("Sao chép")}
                  </button>
                )}
              </div>
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap text-ink">{msg.text}</p>
              ) : (
                <FormattedMessageText text={msg.text} />
              )}
              {msg.outfits?.map((card) => renderOutfitCard(card))}
              {isLastBot && msg.outfits && msg.outfits.length > 0 && (
                <div className="chat-followup-row">
                  {followUpPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={isStreaming}
                      onClick={() => void sendMessage(prompt)}
                      className="chat-followup-chip"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isStreaming && (
          <div
            className="chat-message bg-surface border border-border mr-4 sm:mr-16 rounded-lg p-4"
            aria-live="polite"
          >
            <p className="text-sm font-semibold mb-1.5 text-ink">Stylese AI</p>
            {!currentText && (
              <div className="chat-thinking">
                <span className="chat-thinking-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span>{thinkingText || t("Stylese AI đang suy nghĩ…")}</span>
              </div>
            )}
            {currentText && <FormattedMessageText text={currentText} />}
            {pendingOutfits.map((card) => renderOutfitCard(card))}
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="chat-composer-wrap">
        <div className="chat-composer flex gap-2 max-w-3xl mx-auto w-full px-4 pb-6">
          <label htmlFor="chat-input" className="sr-only">
            {t("Tin nhắn cho Stylese AI")}
          </label>
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                void sendMessage();
              }
            }}
            disabled={isStreaming}
            placeholder={t("Hỏi về trang phục, phong cách, dịp đi...")}
            className="form-input flex-1 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={isStreaming || !input.trim()}
            className="glass-primary disabled:opacity-50"
          >
            {t("Gửi")}
          </button>
        </div>
      </div>
    </main>
  );
}
