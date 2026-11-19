"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const phrases = {
  en: ["fresh inspiration.", "your AI stylist.", "what you own.", "your own vibe."],
  vi: ["cảm hứng mới mỗi ngày.", "stylist AI của bạn.", "những gì bạn có.", "chất riêng của bạn."],
};

export function HeroHeadline({ language }: { language: "vi" | "en" }) {
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const lines = phrases[language];
  const heading = language === "vi" ? "Mặc đẹp hơn," : "Dress better,";
  const prefix = language === "vi" ? "với" : "with";

  useEffect(() => {
    if (reducedMotion) return;
    // Hold each phrase for 3.5s; allow another second for exit and entry.
    let interval: number | undefined;
    const advance = () => setIndex(current => (current + 1) % 4);
    const timeout = window.setTimeout(() => { advance(); interval = window.setInterval(advance, 4500); }, 3500);
    return () => { window.clearTimeout(timeout); if (interval !== undefined) window.clearInterval(interval); };
  }, [reducedMotion]);

  return <h1 aria-label={`${heading} ${prefix} ${lines[0]}`}>
    <span className="hero-static">{heading}</span>
    <span className="hero-rotating-line" aria-hidden="true">
      <em className="hero-prefix">{prefix}&nbsp;</em>
      <span className="hero-rotator">
        <em className="hero-phrase-sizer">{lines[1]}</em>
        <AnimatePresence mode="wait" initial={false}>
          <motion.em className="hero-phrase" key={`${language}-${index}`} initial={reducedMotion ? false : { y: 12, opacity: 0, filter: "blur(4px)" }} animate={{ y: 0, opacity: 1, filter: "blur(0px)" }} exit={reducedMotion ? { opacity: 1 } : { y: -12, opacity: 0, filter: "blur(4px)" }} transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}>{lines[index]}</motion.em>
        </AnimatePresence>
      </span>
    </span>
  </h1>;
}
