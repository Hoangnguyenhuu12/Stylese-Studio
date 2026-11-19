"use client";
import Link from "next/link";
import { Compass, Home, Shirt, UserRound, WandSparkles } from "lucide-react";
import { NavBar } from "@/components/ui/tubelight-navbar";
import { flushSync } from "react-dom";
import { usePreferences } from "./preferences";

const items = [
  { name: "Home", url: "/", icon: Home },
  { name: "Explore", url: "/explore", icon: Compass },
  { name: "Stylist", url: "/chat", icon: WandSparkles },
  { name: "Closet", url: "/closet", icon: Shirt },
  { name: "Profile", url: "/profile", icon: UserRound },
];

export default function SiteHeader() {
  const { language, theme, setLanguage, setTheme } = usePreferences();
  function toggleLanguage() {
    const next = language === "vi" ? "en" : "vi";
    const content = document.querySelector<HTMLElement>(".page-transition");
    if (!content || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setLanguage(next); return; }
    const fade = content.animate([{ opacity: 1 }, { opacity: 0.25 }], { duration: 280, easing: "ease-in", fill: "forwards" });
    fade.onfinish = () => { flushSync(() => setLanguage(next)); fade.cancel(); content.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 480, easing: "ease-out" }); };
  }
  function toggleTheme(event: React.MouseEvent<HTMLButtonElement>) {
    const next = theme === "light" ? "dark" : "light";
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setTheme(next); return; }
    const box = event.currentTarget.getBoundingClientRect();
    if (!document.startViewTransition) {
      const overlay = document.createElement("div");
      overlay.setAttribute("aria-hidden", "true");
      Object.assign(overlay.style, { position: "fixed", inset: "0", zIndex: "9999", pointerEvents: "none", background: next === "dark" ? "#181818" : "#f7f7f7" });
      document.body.appendChild(overlay);
      const origin = (box.left + box.width / 2) + "px " + (box.top + box.height / 2) + "px";
      const animation = overlay.animate([{ clipPath: "circle(0 at " + origin + ")" }, { clipPath: "circle(150vmax at " + origin + ")" }], { duration: 950, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" });
      animation.onfinish = () => { flushSync(() => setTheme(next)); overlay.remove(); };
      animation.oncancel = () => { setTheme(next); overlay.remove(); };
      return;
    }
    root.style.setProperty("--theme-x", box.left + box.width / 2 + "px");
    root.style.setProperty("--theme-y", box.top + box.height / 2 + "px");
    root.classList.add("theme-transition");
    const transition = document.startViewTransition(() => { flushSync(() => setTheme(next)); root.dataset.theme = next; });
    void transition.finished.finally(() => root.classList.remove("theme-transition"));
  }
  return <header className="site-header">
    <Link href="/" className="wordmark" aria-label="Stylese Studio - trang chủ"><span className="brand-symbol" aria-hidden="true"/><span className="brand-reveal"><span className="brand-name">stylese</span></span></Link>
    <NavBar items={items} label={language === "vi" ? "Điều hướng chính" : "Main navigation"} />
    <div className="header-controls">
      <button type="button" className="preference-button language-button" onClick={toggleLanguage} aria-label={language === "vi" ? "Switch to English" : "Chuyển sang tiếng Việt"}><span>{language === "vi" ? "ENG" : "VIE"}</span><span className={`language-flag language-flag-${language === "vi" ? "en" : "vi"}`} aria-hidden="true">{language === "vi" ? "🇺🇸" : "🇻🇳"}</span></button>
      <button type="button" className="preference-button theme-button" onClick={toggleTheme} aria-label={language === "vi" ? (theme === "light" ? "Chuyển sang nền tối" : "Chuyển sang nền sáng") : (theme === "light" ? "Switch to dark theme" : "Switch to light theme")} aria-pressed={theme === "dark"}><span className="theme-icon" aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span></button>
    </div>
  </header>;
}
