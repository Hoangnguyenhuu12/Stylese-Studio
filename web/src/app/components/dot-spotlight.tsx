"use client";

import { useEffect, useRef } from "react";

export default function DotSpotlight() {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = layer.current;
    if (!element) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let x = 0;
    let y = 0;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || reducedMotion.matches) return;
      x = event.clientX;
      y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        element.style.setProperty("--spotlight-x", `${x}px`);
        element.style.setProperty("--spotlight-y", `${y}px`);
        element.dataset.visible = "true";
        frame = 0;
      });
    };
    const leave = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && !event.relatedTarget) {
        if (frame) { cancelAnimationFrame(frame); frame = 0; }
        delete element.dataset.visible;
      }
    };
    const hide = () => { if (frame) { cancelAnimationFrame(frame); frame = 0; } delete element.dataset.visible; };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerout", leave);
    window.addEventListener("blur", hide);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", hide);
    };
  }, []);
  return <div ref={layer} className="dot-spotlight" aria-hidden="true" />;
}
