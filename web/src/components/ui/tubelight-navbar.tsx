"use client";

import { motion, useReducedMotion, useSpring } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";

type NavItem = { name: string; url: string; icon: LucideIcon };
type NavBarProps = { items: NavItem[]; label: string; className?: string };

export function NavBar({ items, label, className = "" }: NavBarProps) {
  const pathname = usePathname();
  const activePath = pathname === "/quiz" ? "/profile" : pathname;
  const reducedMotion = useReducedMotion();
  const navRef = useRef<HTMLElement>(null);
  const positioned = useRef(false);
  const x = useSpring(0, { stiffness: 140, damping: 24, mass: 1 });
  const width = useSpring(0, { stiffness: 140, damping: 24, mass: 1 });

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const update = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active) return;
      const navRect = nav.getBoundingClientRect();
      const itemRect = active.getBoundingClientRect();
      const left = itemRect.left - navRect.left;
      if (!positioned.current || reducedMotion) {
        x.jump(left);
        width.jump(itemRect.width);
        positioned.current = true;
      } else {
        x.set(left);
        width.set(itemRect.width);
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    nav.querySelectorAll('.glass-nav-link').forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, [activePath, reducedMotion, width, x]);

  const hasActive = items.some(item => item.url === activePath);
  return <nav ref={navRef} className={`glass-nav ${className}`} aria-label={label}>
    <motion.span className="tubelight-indicator" style={{ x, width, opacity: hasActive ? 1 : 0 }} aria-hidden="true"><span className="tubelight-glow" /></motion.span>
    {items.map(({ name, url, icon: Icon }) => <Link key={url} href={url} className="glass-nav-link" aria-current={activePath === url ? "page" : undefined}>
      <Icon className="tubelight-icon" size={18} strokeWidth={1.7} aria-hidden="true" />
      <span className="tubelight-label">{name}</span>
    </Link>)}
  </nav>;
}
