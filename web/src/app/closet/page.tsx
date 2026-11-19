/* Local images are supplied by the user and stored in the browser. */
/* eslint-disable @next/next/no-img-element */
"use client";
import { useRef, useState } from "react";
import { categories, categoryLabel, type ClosetItem, saveCloset, useCloset, saveClosetFolders, useClosetFolders } from "@/lib/closet";
import { usePreferences } from "../components/preferences";
import GlassFolder from "@/components/ui/glass-folder-cards";

const UNSORTED = "unsorted";
export default function ClosetPage() {
  const items = useCloset();
  const folders = useClosetFolders();
  const { language, theme } = usePreferences();
  const vi = language === "vi";
  const [active, setActive] = useState<string | null>(null);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClosetItem["category"]>("top");
  const [folderId, setFolderId] = useState("");
  const [color, setColor] = useState("");
  const [image, setImage] = useState<string>();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const knownIds = new Set(folders.map(folder => folder.id));
  const unsorted = items.filter(item => !item.folderId || !knownIds.has(item.folderId));
  const selected = active === UNSORTED ? unsorted : items.filter(item => item.folderId === active);
  const activeFolder = folders.find(folder => folder.id === active);

  function saveFolder(event: React.FormEvent) {
    event.preventDefault();
    const value = folderName.trim();
    if (!value) return;
    if (folders.some(folder => folder.id !== editingFolder && folder.name.toLocaleLowerCase() === value.toLocaleLowerCase())) { setError(vi ? "Tên thư mục đã tồn tại." : "A folder with this name already exists."); return; }
    try {
      if (editingFolder) saveClosetFolders(folders.map(folder => folder.id === editingFolder ? { ...folder, name: value } : folder));
      else { const folder = { id: crypto.randomUUID(), name: value }; saveClosetFolders([...folders, folder]); setActive(folder.id); }
      setFolderName(""); setEditingFolder(null); setShowFolderForm(false); setError("");
    } catch { setError(vi ? "Không thể lưu thư mục trên thiết bị." : "Could not save the folder on this device."); }
  }
  function deleteFolder(id: string, title: string) {
    if (!window.confirm(vi ? `Xóa thư mục “${title}”? Các món đồ sẽ được chuyển vào Chưa phân loại.` : `Delete “${title}”? Its items will move to Unsorted.`)) return;
    try { saveClosetFolders(folders.filter(folder => folder.id !== id)); setActive(items.some(item => item.folderId === id) || unsorted.length ? UNSORTED : null); setError(""); }
    catch { setError(vi ? "Không thể xóa thư mục." : "Could not delete the folder."); }
  }
  function selectImage(file?: File) {
    if (!file) { setImage(undefined); return; }
    if (!file.type.startsWith("image/") || file.size > 1024 * 1024) { setImage(undefined); setError(vi ? "Chọn ảnh dưới 1 MB." : "Choose an image under 1 MB."); if (fileRef.current) fileRef.current.value = ""; return; }
    setError(""); setReading(true);
    const reader = new FileReader();
    reader.onload = () => { setImage(typeof reader.result === "string" ? reader.result : undefined); setReading(false); };
    reader.onerror = () => { setReading(false); setError(vi ? "Không đọc được ảnh. Hãy chọn lại." : "Could not read the image. Try again."); };
    reader.readAsDataURL(file);
  }
  function add(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try { const destination = knownIds.has(folderId) ? folderId : undefined; saveCloset([...items, { id: crypto.randomUUID(), name: name.trim(), category, color: color.trim(), image, folderId: destination, createdAt: new Date().toISOString() }]); setName(""); setColor(""); setImage(undefined); if (fileRef.current) fileRef.current.value = ""; setShowItemForm(false); setActive(destination || UNSORTED); setError(""); }
    catch { setError(vi ? "Không đủ bộ nhớ trên thiết bị. Hãy dùng ảnh nhỏ hơn hoặc xóa bớt món đồ." : "Device storage is full. Use a smaller image or remove an item."); }
  }
  function move(item: ClosetItem, destination: string) {
    try { saveCloset(items.map(entry => entry.id === item.id ? { ...entry, folderId: destination || undefined } : entry)); setError(""); }
    catch { setError(vi ? "Không thể chuyển món đồ." : "Could not move the item."); }
  }
  function remove(item: ClosetItem) {
    if (!window.confirm(vi ? `Xóa “${item.name}” khỏi tủ đồ?` : `Remove “${item.name}” from your closet?`)) return;
    try { saveCloset(items.filter(entry => entry.id !== item.id)); setError(""); } catch { setError(vi ? "Không thể cập nhật tủ đồ." : "Could not update your closet."); }
  }
  function folderCard(id: string, title: string, entries: ClosetItem[]) {
    return <article className="folder-card" key={id}>
      <GlassFolder key={`${theme}-${language}-${id}-${entries.map(item => item.id).join("-")}`} label={title} meta={vi ? `${entries.length} món đồ` : `${entries.length} pieces`} tone={theme} locale={language} art="none" action="none" width={260} appear={false} open={active === id} onOpenChange={opened => setActive(opened ? id : null)} files={entries.slice(-4).map(item => ({ name: item.name, meta: categoryLabel(item.category, language), href: `#closet-item-${item.id}` }))} />
      <button className="folder-select" type="button" onClick={() => setActive(id)} aria-pressed={active === id}>{vi ? "Xem tất cả" : "View all"} <span aria-hidden="true">↗</span></button>
    </article>;
  }
  return <main className="site-shell"><div className="workspace closet-workspace">
    <div className="workspace-heading"><div><h1>{vi ? "Tủ đồ của bạn" : "Your closet"}</h1><p>{vi ? "Sắp xếp tủ đồ theo cách bạn thích và lưu lại những món mình yêu." : "Create your own folders and keep your favorite pieces together."}</p></div><div className="closet-actions"><button className="glass-button" type="button" aria-expanded={showFolderForm} onClick={() => { setEditingFolder(null); setFolderName(""); setShowFolderForm(!showFolderForm); setError(""); }}>{vi ? "+ Tạo thư mục" : "+ New folder"}</button><button className="glass-primary" type="button" aria-expanded={showItemForm} onClick={() => { setFolderId(active && active !== UNSORTED ? active : ""); setShowItemForm(!showItemForm); setError(""); }}>{vi ? "+ Thêm món đồ" : "+ Add an item"}</button></div></div>
    <p className="storage-note">{vi ? "Tủ đồ và hình ảnh được lưu trên trình duyệt của thiết bị này, chưa đồng bộ sang thiết bị khác." : "Your closet and images are stored in this browser, not synced across devices."}</p>
    {showFolderForm && <form className="glass-panel closet-form folder-form" aria-label={vi ? "Thông tin thư mục" : "Folder details"} onSubmit={saveFolder}><label>{vi ? "Tên thư mục" : "Folder name"}<input autoFocus className="form-input" value={folderName} onChange={e => setFolderName(e.target.value)} maxLength={60} required placeholder={vi ? "Ví dụ: Áo thun" : "e.g. T-shirts"}/></label><div className="closet-actions"><button className="glass-primary" type="submit">{vi ? "Lưu thư mục" : "Save folder"}</button><button className="glass-button" type="button" onClick={() => { setShowFolderForm(false); setEditingFolder(null); }}>{vi ? "Hủy" : "Cancel"}</button></div></form>}
    {showItemForm && <form className="glass-panel closet-form" aria-label={vi ? "Thông tin món đồ" : "Item details"} onSubmit={add}><div className="form-heading"><div><h2>{vi ? "Thêm vào tủ đồ" : "Add to your closet"}</h2><p>{vi ? "Chọn thư mục để cất món đồ này nhé." : "Choose a folder for your piece."}</p></div></div><div className="form-grid"><label>{vi ? "Tên món đồ" : "Item name"}<input className="form-input" value={name} onChange={e => setName(e.target.value)} maxLength={100} required placeholder={vi ? "Ví dụ: Áo sơ mi trắng" : "e.g. White shirt"}/></label><label>{vi ? "Thư mục" : "Folder"}<select className="form-input" value={folderId} onChange={e => setFolderId(e.target.value)}><option value="">{vi ? "Chưa phân loại" : "Unsorted"}</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><label>{vi ? "Loại" : "Category"}<select className="form-input" value={category} onChange={e => setCategory(e.target.value as ClosetItem["category"])}>{Object.keys(categories).map(value => <option key={value} value={value}>{categoryLabel(value as ClosetItem["category"], language)}</option>)}</select></label><label>{vi ? "Màu sắc (tùy chọn)" : "Color (optional)"}<input className="form-input" value={color} onChange={e => setColor(e.target.value)} maxLength={60}/></label><label>{vi ? "Hình ảnh (tùy chọn, tối đa 1 MB)" : "Image (optional, max 1 MB)"}<input ref={fileRef} className="form-input" type="file" accept="image/*" onChange={e => selectImage(e.target.files?.[0])}/></label></div><div className="closet-actions"><button className="glass-primary" type="submit" disabled={reading}>{reading ? (vi ? "Đang đọc ảnh…" : "Reading image…") : (vi ? "Lưu món đồ" : "Save item")}</button><button className="glass-button" type="button" onClick={() => setShowItemForm(false)}>{vi ? "Hủy" : "Cancel"}</button></div></form>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <section aria-labelledby="folders-heading"><div className="section-heading closet-list-heading"><h2 id="folders-heading">{vi ? "Thư mục của bạn" : "Your folders"}</h2></div><p className="folder-hint">{vi ? "Mở thư mục để xem những món đồ bên trong nhé." : "Open a folder to see its pieces."}</p>
      {folders.length || unsorted.length ? <div className="folder-grid">{folders.map(folder => folderCard(folder.id, folder.name, items.filter(item => item.folderId === folder.id)))}{unsorted.length > 0 && folderCard(UNSORTED, vi ? "Chưa phân loại" : "Unsorted", unsorted)}</div> : <div className="empty-closet glass-panel"><div className="empty-mark" aria-hidden="true" /><h2>{vi ? "Bắt đầu với một thư mục" : "Start with a folder"}</h2><p>{vi ? "Tạo thư mục cho áo thun, quần dài hoặc bất kỳ nhóm đồ nào bạn muốn." : "Create a folder for T-shirts, trousers, or any group you like."}</p><button type="button" className="glass-button" onClick={() => { setEditingFolder(null); setFolderName(""); setShowFolderForm(true); }}>{vi ? "Tạo thư mục" : "Create a folder"}</button></div>}
    </section>
    {active && (active === UNSORTED || activeFolder) && <section className="folder-contents" aria-labelledby="contents-heading"><div className="section-heading folder-contents-heading"><div><h2 id="contents-heading">{activeFolder?.name || (vi ? "Chưa phân loại" : "Unsorted")} <span className="item-count">{selected.length}</span></h2></div>{activeFolder && <div className="closet-actions"><button type="button" className="glass-button" onClick={() => { setEditingFolder(activeFolder.id); setFolderName(activeFolder.name); setShowFolderForm(true); window.scrollTo({top:0,behavior:"smooth"}); }}>{vi ? "Đổi tên" : "Rename"}</button><button type="button" className="glass-button" onClick={() => deleteFolder(activeFolder.id,activeFolder.name)}>{vi ? "Xóa thư mục" : "Delete folder"}</button></div>}</div>
      {selected.length ? <div className="closet-grid">{[...selected].reverse().map(item => <article id={`closet-item-${item.id}`} className="closet-card glass-panel" key={item.id}><div className="closet-image">{item.image ? <img src={item.image} alt={item.name}/> : <span>{categoryLabel(item.category, language)}</span>}</div><div className="closet-card-body"><div><h3>{item.name}</h3><p>{categoryLabel(item.category, language)}{item.color ? ` · ${item.color}` : ""}</p></div><button type="button" className="remove-item" onClick={() => remove(item)} aria-label={`${vi ? "Xóa" : "Remove"} ${item.name}`}>{vi ? "Xóa" : "Remove"}</button></div><label className="move-item">{vi ? "Chuyển đến" : "Move to"}<select className="form-input" value={knownIds.has(item.folderId || "") ? item.folderId : ""} onChange={e => move(item,e.target.value)} aria-label={`${vi ? "Chuyển" : "Move"} ${item.name}`}><option value="">{vi ? "Chưa phân loại" : "Unsorted"}</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label></article>)}</div> : <div className="folder-empty glass-panel"><p>{vi ? "Thư mục này còn trống. Thêm món đồ đầu tiên nhé!" : "This folder has no pieces yet."}</p><button type="button" className="glass-button" onClick={() => { setFolderId(active === UNSORTED ? "" : active); setShowItemForm(true); window.scrollTo({top:0,behavior:"smooth"}); }}>{vi ? "Thêm món đồ" : "Add an item"}</button></div>}
    </section>}
  </div></main>;
}
