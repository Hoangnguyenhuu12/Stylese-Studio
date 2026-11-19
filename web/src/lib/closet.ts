"use client";

import { useSyncExternalStore } from "react";

export type ClosetItem = { id: string; name: string; category: "top" | "bottom" | "dress" | "outerwear" | "shoes" | "accessory"; color: string; image?: string; folderId?: string; createdAt: string };
export const categories: Record<ClosetItem["category"], string> = { top: "Áo", bottom: "Quần / chân váy", dress: "Váy liền", outerwear: "Áo khoác", shoes: "Giày", accessory: "Phụ kiện" };
const englishCategories: Record<ClosetItem["category"], string> = { top: "Tops", bottom: "Bottoms", dress: "Dresses", outerwear: "Outerwear", shoes: "Shoes", accessory: "Accessories" };
export function categoryLabel(category: ClosetItem["category"], language: "vi" | "en") { return (language === "vi" ? categories : englishCategories)[category] || category; }
const key = "stylese-closet-v1";
const changed = "stylese-closet-changed";

function subscribe(callback: () => void) {
  window.addEventListener(changed, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(changed, callback); window.removeEventListener("storage", callback); };
}
function snapshot() { try { return localStorage.getItem(key) || "[]"; } catch { return "[]"; } }
export function useCloset(): ClosetItem[] {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  try { const data = JSON.parse(raw); return Array.isArray(data) ? data : []; } catch { return []; }
}
export function saveCloset(items: ClosetItem[]) {
  localStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new Event(changed));
}
export function combinationCount(items: ClosetItem[]) {
  const tops = items.filter((item) => item.category === "top").length;
  const bottoms = items.filter((item) => item.category === "bottom").length;
  const dresses = items.filter((item) => item.category === "dress").length;
  return tops * bottoms + dresses;
}

export type ClosetFolder = { id: string; name: string };
const folderKey = "stylese-closet-folders-v1";
function folderSnapshot() { try { return localStorage.getItem(folderKey) || "[]"; } catch { return "[]"; } }
export function useClosetFolders(): ClosetFolder[] {
  const raw = useSyncExternalStore(subscribe, folderSnapshot, () => "[]");
  try { const value = JSON.parse(raw); return Array.isArray(value) ? value.filter((folder) => folder && typeof folder.id === "string" && typeof folder.name === "string") : []; } catch { return []; }
}
export function saveClosetFolders(folders: ClosetFolder[]) {
  localStorage.setItem(folderKey, JSON.stringify(folders));
  window.dispatchEvent(new Event(changed));
}
