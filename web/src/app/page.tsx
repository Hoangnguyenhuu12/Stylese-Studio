"use client";
import Link from "next/link";
import { useState } from "react";
import { usePreferences } from "./components/preferences";
import { HeroHeadline } from "./components/hero-headline";
import { categoryLabel, combinationCount, useCloset } from "@/lib/closet";

export default function Home() {
  const [activeStep, setActiveStep] = useState(0);
  const items = useCloset();
  const { language } = usePreferences();
  const vi = language === "vi";
  const combinations = combinationCount(items);
  const steps = vi ? [
    ["Xây dựng nền tảng", "Dữ liệu thời trang được gắn đặc điểm và kết nối thành đồ thị tương thích."],
    ["Trò chuyện cùng stylist", "Stylist tiếp nhận nhu cầu, hỏi thêm khi cần và tìm hướng phối đồ."],
    ["Tìm những món phù hợp", "Hệ thống tìm sản phẩm và kết hợp các món dựa trên đồ thị thời trang."],
    ["Cá nhân hóa gợi ý", "Sở thích từ bảng câu hỏi giúp sắp xếp gợi ý và đề xuất kích cỡ phù hợp."]
  ] : [
    ["Build the foundation", "Fashion items are tagged and linked in a compatibility graph."],
    ["Talk to your stylist", "The stylist interprets your request and asks for missing details."],
    ["Find matching pieces", "The system searches for items and combinations using the fashion graph."],
    ["Personalize the results", "Quiz preferences help rank suggestions and suggest sizes."]
  ];
  return <main className="site-shell"><div className="dashboard">
    <section className="dashboard-intro"><div><HeroHeadline language={language} /><p>{vi ? "Một góc nhỏ để bạn khám phá tủ đồ, tìm cảm hứng và phối đồ theo cách mình thích." : "A space to understand your wardrobe, discover inspiration and find your own style."}</p><div className="dashboard-actions"><Link className="glass-primary" href="/chat">{vi ? "Mở Stylist" : "Open Stylist"}<span aria-hidden="true">↗</span></Link><Link className="glass-button" href="/explore">{vi ? "Khám phá phong cách" : "Explore styles"}</Link></div></div></section>
    <section className="overview-section"><div className="section-heading"><div><h2>{vi ? "Nhìn lại tủ đồ" : "Your wardrobe at a glance"}</h2></div><Link href="/closet" className="inline-action">{vi ? "Xem tủ đồ" : "View closet"} ↗</Link></div><div className="overview-grid"><article className="overview-card"><span>{vi ? "Món đồ đã thêm" : "Items added"}</span><strong>{items.length.toLocaleString()}</strong><p>{vi ? "Được lưu trên thiết bị này" : "Stored on this device"}</p></article><article className="overview-card"><span>{vi ? "Tổ hợp cơ bản" : "Basic combinations"}</span><strong>{combinations.toLocaleString()}</strong><p>{vi ? "Áo × quần / chân váy + váy liền" : "Tops × bottoms + dresses"}</p></article><article className="overview-card overview-note"><p>{items.length ? (vi ? "Mỗi món đồ đều có thể mở ra một cách phối mới." : "Every item can open up a new look.") : (vi ? "Bắt đầu bằng việc thêm những món bạn yêu thích vào tủ đồ." : "Start by adding your favorite pieces to your closet.")}</p><Link href="/closet">{vi ? "Thêm món đầu tiên" : "Add an item"} ↗</Link></article></div><p className="stat-footnote">{vi ? "Đây là số cách kết hợp cơ bản, chưa xét màu sắc hay phong cách có hợp nhau không." : "Combinations are a simple count, not a compatibility assessment."}</p></section>
    <section className="how-it-works" aria-labelledby="how-heading">
      <div className="how-heading"><h2 id="how-heading">{vi ? "Cách Stylese hoạt động" : "How it works"}</h2><p>{vi ? "Bốn bước để Stylese tìm gợi ý dành riêng cho bạn." : "Four stages from fashion data to your recommendations."}</p></div>
      <div className="how-steps" style={{ "--how-active": activeStep } as React.CSSProperties}><span className="how-progress" aria-hidden="true" />{steps.map(([title, description], index) => <div className="how-step" key={index}><button type="button" className="how-trigger" aria-expanded={activeStep === index} aria-controls={`how-detail-${index}`} onMouseEnter={() => setActiveStep(index)} onFocus={() => setActiveStep(index)} onClick={() => setActiveStep(index)}><span className="how-number">{index + 1}</span><span className="how-title">{title}</span></button><p id={`how-detail-${index}`} hidden={activeStep !== index}>{description}</p></div>)}</div>
    </section>
    <section className="about-section" aria-labelledby="about-heading">
      <div className="about-copy"><h2 id="about-heading">{vi ? "Về chúng mình" : "About us"}</h2><p>{vi ? "Chúng mình là Lendo, nhóm đứng sau Stylese Studio. Dự án bắt nguồn từ môn học DPL302m tại FPT University TP.HCM, với mục tiêu phát triển một AI stylist cá nhân hóa cho người dùng Việt Nam, lấy cảm hứng từ phong cách châu Á." : "We are Lendo, the team behind Stylese Studio. The project began in the DPL302m course at FPT University in Ho Chi Minh City, with the goal of creating a personal AI stylist for people in Vietnam, inspired by Asian fashion."}</p><p>{vi ? "Stylese Studio kết hợp dữ liệu thời trang, trò chuyện cùng stylist và thông tin sở thích để hướng tới những gợi ý phù hợp hơn với mỗi người." : "Stylese Studio brings together fashion data, stylist conversations and personal preferences to work toward more relevant suggestions for each person."}</p></div>
      <div className="about-aspects" aria-label={vi ? "Thành viên nhóm Lendo" : "Lendo team members"}><div><strong>Nhật Quang</strong><span>{vi ? "Dữ liệu & cơ sở tri thức" : "Data & knowledge base"}</span></div><div><strong>Đình Lộc</strong><span>{vi ? "Mô hình & AI Stylist" : "Model & AI stylist"}</span></div><div><strong>Hữu Hoàng</strong><span>{vi ? "Truy xuất, quiz, giao diện & API" : "Retrieval, quiz, interface & API"}</span></div></div>
    </section>
    <section className="dashboard-lower"><div className="section-heading"><div><h2>{vi ? "Hôm nay bạn muốn khám phá gì?" : "What would you like to do?"}</h2></div></div><div className="feature-links"><Link href="/explore"><span>01</span><div><h3>Explore</h3><p>{vi ? "Tìm cảm hứng từ những phong cách khác nhau." : "Find inspiration in different styles."}</p></div><b>↗</b></Link><Link href="/chat"><span>02</span><div><h3>Stylist</h3><p>{vi ? "Kể mình nghe dịp bạn cần mặc đẹp, mình cùng tìm cách phối nhé." : "Talk about occasions and outfit ideas."}</p></div><b>↗</b></Link><Link href="/profile"><span>03</span><div><h3>Profile</h3><p>{vi ? "Chia sẻ thêm sở thích để mình hiểu gu của bạn hơn." : "Update your preferences for more relevant suggestions."}</p></div><b>↗</b></Link></div></section>
    <section className="recent-section"><div className="section-heading"><div><h2>{vi ? "Tin tức & cảm hứng" : "News & inspiration"}</h2></div></div><p className="storage-note">{vi ? "Mục tin tức chưa sẵn sàng. Trong lúc chờ, bạn có thể ghé Explore để tìm cảm hứng nhé." : "No news source is connected yet. Explore the available style directions in the meantime."}</p><Link href="/explore" className="glass-button">{vi ? "Đến Explore" : "Go to Explore"} <span className="action-icon" aria-hidden="true">↗</span></Link></section>
    {items.length > 0 && <section className="recent-section"><div className="section-heading"><div><h2>{vi ? "Từ tủ đồ của bạn" : "From your closet"}</h2></div></div><div className="recent-items">{items.slice(-4).reverse().map(item => <div className="recent-chip" key={item.id}><b>{item.name}</b><span>{categoryLabel(item.category, language)}</span></div>)}</div></section>}
  </div></main>;
}
