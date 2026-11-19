"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/api";
import { usePreferences } from "../components/preferences";
import { translate } from "../components/translations";

type OutfitCard = {
  outfit_id: string;
  explanation_vi: string;
  price_total_vnd: number;
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

export default function ChatPage() {
  const { language } = usePreferences();
  const t = (text: string) => translate(language, text);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [pendingOutfits, setPendingOutfits] = useState<OutfitCard[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentText]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setIsStreaming(true);
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
      const resp = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history: messages.slice(-20).map((m) => ({ role: m.role === "bot" ? "assistant" : "user", content: m.text })), quiz_answers: JSON.parse(localStorage.getItem("quiz_answers") || "null") }),
      });

      if (!resp.ok) throw new Error(resp.status === 503 ? "STYLIST_UNAVAILABLE" : `HTTP ${resp.status}`);
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE: each event is "event:type\ndata:payload\n\n"
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() || ""; // keep incomplete chunk

        for (const part of parts) {
          const lines = part.split("\n");
          let eventType = "";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            else if (line.startsWith("data:")) data = line.slice(5).trim();
          }

          if (eventType === "token") {
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
          } else if (eventType === "done") {
            // stream complete
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
          text: err instanceof Error && err.message === "STYLIST_UNAVAILABLE" ? (language === "vi" ? "Mình chưa sẵn sàng tư vấn vì mô hình và dữ liệu chưa được kết nối. Bạn quay lại sau nhé." : "Stylist is unavailable until the model and data are connected.") : translate(language, "Mình gặp chút trục trặc rồi. Bạn thử lại nhé."),
        },
      ]);
    } finally {
      if (rafId !== null) cancelAnimationFrame(rafId);
      setIsStreaming(false);
      setCurrentText("");
      setPendingOutfits([]);
    }
  }, [input, isStreaming, messages, language]);

  function renderOutfitCard(card: OutfitCard) {
    return (
      <div
        key={card.outfit_id}
        className="border border-border bg-surface rounded-lg p-4 mt-2"
      >
        <p className="font-bold text-lg text-ink">{card.outfit_id}</p>
        <p className="text-sm text-muted mb-2">{card.explanation_vi}</p>
        <p className="text-sm font-semibold text-ink">
          {language === "vi" ? "Tổng" : "Total"}: {card.price_total_vnd.toLocaleString()} VND
        </p>
        <div className="grid grid-cols-2 gap-2 mt-2">
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

  return (
    <main className="site-shell flex flex-col">

      <div className="chat-heading"><p className="small-label">Stylese stylist</p><h1>{t("Hôm nay bạn muốn mặc gì?")}</h1><p>{t("Kể mình nghe bạn định mặc đi đâu hoặc đang thích phong cách nào nhé.")}</p></div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4 max-w-3xl mx-auto w-full">
        {messages.length === 0 && !isStreaming && <div className="chat-welcome glass-panel"><p>{language === "vi" ? "Bắt đầu bằng một câu hỏi" : "Start with a question"}</p><div className="chat-suggestions">{(language === "vi" ? ["Mình nên mặc gì khi đi làm?", "Gợi ý phong cách tối giản", "Phối đồ cho buổi hẹn"] : ["What should I wear to work?", "Suggest a minimalist style", "Help me dress for a date"]).map((prompt) => <button key={prompt} type="button" className="glass-button" onClick={() => setInput(prompt)}>{prompt}</button>)}</div><small>{language === "vi" ? "Mình dùng AI để tư vấn. Tủ đồ trên thiết bị của bạn chưa tự động được chia sẻ trong cuộc trò chuyện này." : "The stylist uses an AI service; your local closet is not shared automatically."}</small></div>}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-lg p-4 ${
              msg.role === "user"
                ? "bg-brand-soft ml-16"
                : "bg-surface border border-border mr-16"
            }`}
          >
            <p className="text-sm font-semibold mb-1 text-ink">
              {msg.role === "user" ? t("Bạn") : "Stylese Stylist"}
            </p>
            <p className="whitespace-pre-wrap text-ink">{msg.text}</p>
            {msg.outfits?.map((card) => renderOutfitCard(card))}
          </div>
        ))}

        {isStreaming && (currentText || pendingOutfits.length > 0) && (
          <div className="bg-surface border border-border mr-16 rounded-lg p-4">
            <p className="text-sm font-semibold mb-1 text-ink">
              Stylese Stylist
            </p>
            <p className="whitespace-pre-wrap text-ink">{currentText}</p>
            {pendingOutfits.map((card) => renderOutfitCard(card))}
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="flex gap-2 max-w-3xl mx-auto w-full px-4 pb-8">
        <label htmlFor="chat-input" className="sr-only">
          Tin nhắn cho stylist
        </label>
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) sendMessage(); }}
          disabled={isStreaming}
          placeholder={t("Hỏi về trang phục, phong cách, dịp đi...")}
          className="form-input flex-1 disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={isStreaming || !input.trim()}
          className="glass-primary disabled:opacity-50"
        >
          {t("Gửi")}
        </button>
      </div>
    </main>
  );
}
