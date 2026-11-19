"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import { usePreferences } from "../components/preferences";
import { translate } from "../components/translations";

type Question = {
  key: string;
  label_vi: string;
  type: string;
  options?: { id: string; label_vi: string }[];
  max?: number;
};

export default function QuizPage() {
  const { language } = usePreferences();
  const t = (text: string) => translate(language, text);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[] | number>>({ style: [], occasions: [], favorite_colors: [], price_tier: "" });
  const [error, setError] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [colorInput, setColorInput] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const router = useRouter();

  const loadQuiz = () => {
    fetch(`${API_URL}/api/quiz`)
      .then((r) => { if (!r.ok) throw new Error("Quiz unavailable"); return r.json(); })
      .then((data) => { setError(false); setQuestions(data.questions || []); })
      .catch(() => setError(true));
  };

  useEffect(() => {
    loadQuiz();
    Promise.resolve().then(() => {
      try {
        const raw = localStorage.getItem("stylese-quiz-draft");
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft.answers && typeof draft.answers === "object") setAnswers(draft.answers);
          if (typeof draft.colors === "string") setColorInput(draft.colors);
        }
      } catch { /* An unreadable draft is ignored. */ }
      setDraftReady(true);
    });
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    try { localStorage.setItem("stylese-quiz-draft", JSON.stringify({ answers, colors: colorInput })); } catch { /* Submission reports storage failures. */ }
  }, [answers, colorInput, draftReady]);

  function handleSelect(key: string, optionId: string, isMulti: boolean) {
    if (isMulti) {
      setAnswers((prev) => {
        const value = prev[key];
        const current = Array.isArray(value) ? value : [];
        const updated = current.includes(optionId)
          ? current.filter((id: string) => id !== optionId)
          : [...current, optionId];
        return { ...prev, [key]: updated };
      });
    } else {
      setAnswers((prev) => ({ ...prev, [key]: optionId }));
    }
  }

  function handleSubmit() {
    if (!Array.isArray(answers.occasions) || !answers.occasions.length) {
      setValidationError("Vui lòng chọn ít nhất một dịp mặc.");
      return;
    }
    const height = answers.height_cm;
    const weight = answers.weight_kg;
    if (Array.isArray(answers.favorite_colors) && answers.favorite_colors.length > 3) {
      setValidationError("Vui lòng nhập tối đa 3 màu.");
      return;
    }
    if ((typeof height === "number" && (height < 80 || height > 250)) ||
        (typeof weight === "number" && (weight < 20 || weight > 300))) {
      setValidationError("Vui lòng kiểm tra chiều cao (80–250 cm) và cân nặng (20–300 kg).");
      return;
    }
    try {
      localStorage.setItem("quiz_answers", JSON.stringify(answers));
      localStorage.removeItem("stylese-quiz-draft");
      router.push("/results");
    } catch { setValidationError("Không thể lưu lựa chọn trên thiết bị."); }
  }

  return (
    <main className="site-shell">

      <div className="quiz-layout">
        <aside className="quiz-intro">

          <h1>{t("Hiểu gu của bạn")}<br /><em>{t("một chút nhé.")}</em></h1>
          <p>{t("Kể mình nghe vài điều bạn thích để cùng tìm những gợi ý hợp gu nhé.")}</p>
          <div className="intro-note"><span>✳</span><p>{t("Không có câu trả lời đúng hay sai.")}<br />{t("Chỉ cần chọn điều khiến bạn thấy là mình.")}</p></div>
        </aside>
        <section className="quiz-content" aria-labelledby="quiz-title">
          <div className="quiz-topline"><span>{t("Hồ sơ phong cách")}</span><span>{t("5 câu hỏi · Khoảng 2 phút")}</span></div>
          <h2 id="quiz-title">{t("Phong cách của bạn")}</h2>
          <p className="quiz-subtitle">{t("Bạn có thể thay đổi lựa chọn bất cứ lúc nào.")}</p>
          {error ? (
            <div role="alert" className="notice"><p>{t("Không thể tải câu hỏi. Hãy kiểm tra kết nối và thử lại.")}</p><button type="button" onClick={loadQuiz} className="text-link">{t("Thử lại")}</button></div>
          ) : questions.length === 0 ? <p className="quiz-subtitle">{t("Đang tải câu hỏi…")}</p> : (
            <form onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}>
              {questions.map((q, i) => (
                <fieldset className="question" key={q.key}>
                  <legend><span className="question-number">{String(i + 1).padStart(2, "0")}</span><span>{t(q.label_vi)}</span></legend>
                  {q.max && <p className="question-hint">{q.type === "text_multi" ? t("Tối đa 3 màu, cách nhau bằng dấu phẩy") : language === "vi" ? `Chọn tối đa ${q.max}` : `Choose up to ${q.max}`}</p>}
                  {q.options && q.options.length > 0 && <div className="choice-list" role={q.type === "single_select" ? "radiogroup" : undefined} aria-label={q.type === "single_select" ? t(q.label_vi) : undefined}>
                    {q.options.map((opt) => {
                      const isMulti = q.type === "multi_select";
                      const value = answers[q.key];
                      const selected = isMulti ? Array.isArray(value) && value.includes(opt.id) : value === opt.id;
                      if (!isMulti) return <label key={opt.id} className={`choice radio-choice ${selected ? "choice-selected" : ""}`}><input type="radio" name={q.key} value={opt.id} checked={selected} onChange={() => handleSelect(q.key, opt.id, false)} />{t(opt.label_vi)}</label>;
                      return <button key={opt.id} type="button" aria-pressed={selected} disabled={Boolean(q.max && Array.isArray(value) && value.length >= q.max && !selected)} onClick={() => {
                        handleSelect(q.key, opt.id, isMulti);
                      }} className={`choice ${selected ? "choice-selected" : ""}`}>{t(opt.label_vi)}</button>;
                    })}
                  </div>}
                  {q.type === "text_multi" && <input aria-label={t(q.label_vi)} className="form-input" value={colorInput} placeholder={t("Ví dụ: đen, trắng, xanh")} onChange={(event) => { const raw = event.target.value; setColorInput(raw); const colors = raw.split(",").map((v) => v.trim()).filter(Boolean); setAnswers((prev) => ({ ...prev, favorite_colors: colors })); }} />}
                  {q.type === "number_pair" && <div className="measurements">
                    {([["height_cm", "Chiều cao", "cm", 80, 250], ["weight_kg", "Cân nặng", "kg", 20, 300]] as const).map(([key, label, unit, min, max]) => <label key={key}>{t(label)}<span className="input-with-unit"><input className="form-input" type="number" min={min} max={max} value={typeof answers[key] === "number" ? answers[key] : ""} placeholder="—" onChange={(event) => { const value = event.target.value; setAnswers((prev) => { const next = { ...prev }; if (value) next[key] = Number(value); else delete next[key]; return next; }); }} /><span>{unit}</span></span></label>)}
                  </div>}
                </fieldset>
              ))}
              {validationError && <p role="alert" className="form-error">{t(validationError)}</p>}
              <div className="quiz-submit"><p>{language === "vi" ? "Bản nháp được lưu trên thiết bị này." : "Your draft is saved on this device."}</p><button type="submit" className="primary-button">{t("Xem gợi ý cho mình")} <span aria-hidden="true">↗</span></button></div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
