"use client";
import Link from "next/link";
import { usePreferences } from "../components/preferences";

const styles = [
  {name:"Minimalist", vi:"Tối giản", description:"Ít chi tiết, dễ phối và chú trọng phom dáng.", en:"Clean lines, thoughtful shapes and effortless combinations.", className:"style-minimal", number:"01"},
  {name:"Korean", vi:"Phong cách Hàn", description:"Nhẹ nhàng, hiện đại với những lớp trang phục linh hoạt.", en:"Soft, contemporary layers that are easy to adapt.", className:"style-korean", number:"02"},
  {name:"Streetwear", vi:"Đường phố", description:"Thoải mái, cá tính và dễ biến tấu theo cách của bạn.", en:"Relaxed layers with room for personal expression.", className:"style-street", number:"03"},
  {name:"Elegant", vi:"Thanh lịch", description:"Phom dáng chỉn chu cho những dịp cần sự tinh tế.", en:"Refined shapes for moments that call for polish.", className:"style-elegant", number:"04"},
  {name:"Vintage", vi:"Cổ điển", description:"Gợi nhắc những chi tiết quen thuộc theo cách riêng.", en:"Familiar details reinterpreted in your own way.", className:"style-vintage", number:"05"},
  {name:"Sporty", vi:"Thể thao", description:"Ưu tiên sự năng động và thoải mái mỗi ngày.", en:"Everyday pieces that put movement and comfort first.", className:"style-sporty", number:"06"},
];
export default function ExplorePage() {
  const { language } = usePreferences(); const vi = language === "vi";
  return <main className="site-shell"><div className="workspace"><div className="workspace-heading"><div><h1>{vi ? "Tìm cảm hứng mới" : "Find your inspiration"}</h1><p>{vi ? "Khám phá các phong cách và tìm điều khiến bạn thấy thật là mình." : "Explore different style directions and find what feels like you."}</p></div><Link href="/quiz" className="glass-button">{vi ? "Tìm gu của mình" : "Find my style"} <span className="action-icon" aria-hidden="true">↗</span></Link></div><p className="storage-note">{vi ? "Mình đang giới thiệu một vài phong cách. Hình ảnh và sản phẩm sẽ xuất hiện khi dữ liệu sẵn sàng nhé." : "These cards introduce style directions; product images will appear when the catalog is available."}</p><div className="explore-grid">{styles.map(style => <article key={style.name} className={`explore-card ${style.className}`}><div className="explore-art" aria-hidden="true"><span>{style.number}</span><strong>{style.name}</strong><div className="explore-line" /></div><div className="explore-copy"><span>{vi ? style.vi : style.name}</span><p>{vi ? style.description : style.en}</p></div></article>)}</div></div></main>;
}
