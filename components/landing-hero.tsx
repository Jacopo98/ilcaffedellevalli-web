"use client";

import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function LandingHero() {
  const [scrolled, setScrolled] = useState(false);
  const clicks = useRef<number[]>([]);
  const router = useRouter();

  function handleLogoClick() {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((time) => now - time < 900), now];
    if (clicks.current.length >= 3) {
      clicks.current = [];
      router.push("/login");
    }
  }

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > Math.min(140, window.innerHeight * 0.16));
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        document.querySelectorAll<HTMLElement>(".scroll-bean").forEach((bean) => {
          const section = bean.parentElement;
          if (!section) return;
          const rect = section.getBoundingClientRect();
          const progress = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
          const centered = reduceMotion ? 0 : progress - 0.5;
          const moveX = Number(bean.dataset.moveX ?? 0);
          const moveY = Number(bean.dataset.moveY ?? 120);
          const rotate = Number(bean.dataset.rotate ?? 25);
          const scale = Number(bean.dataset.scale ?? 0.12);
          bean.style.setProperty("--scroll-x", `${centered * moveX}px`);
          bean.style.setProperty("--scroll-y", `${centered * moveY}px`);
          bean.style.setProperty("--scroll-rotate", `${centered * rotate}deg`);
          bean.style.setProperty("--scroll-scale", `${1 + centered * scale}`);
        });
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <>
      <header className={`floating-header ${scrolled ? "floating-header-visible" : ""}`}>
        <div className="site-container flex h-20 items-center sm:h-24">
          <a className="header-logo" href="#home" aria-label="Il Caffè delle Valli — Home">
            <Image src="/Logo_black_trasparent.png" alt="Il Caffè delle Valli" width={2843} height={820} priority />
          </a>
        </div>
        <nav className="header-nav flex items-center text-sm font-medium text-white/80">
          <a className="nav-link" href="#menu">Menu</a>
          <a className="nav-link" href="#storia">Il locale</a>
          <a className="nav-link" href="#contatti">Contatti</a>
        </nav>
      </header>

      <section id="home" className={`simple-hero ${scrolled ? "hero-scrolled" : ""}`}>
        <div className="hero-grain" aria-hidden="true" />
        <div className="scroll-bean hero-bean hero-bean-right" data-move-x="-240" data-move-y="420" data-rotate="75" data-scale="0.35" aria-hidden="true">
          <Image src="/coffee-beans.png" alt="" width={1536} height={1024} priority />
        </div>
        <div className="scroll-bean hero-bean hero-bean-left" data-move-x="180" data-move-y="-320" data-rotate="-80" data-scale="-0.28" aria-hidden="true">
          <Image src="/coffee-beans.png" alt="" width={1536} height={1024} />
        </div>
        <div className="hero-center">
          <h1 className="sr-only">Il Caffè delle Valli</h1>
          <button className="hero-login-trigger" type="button" onClick={handleLogoClick} aria-label="Il Caffè delle Valli">
            <Image className="hero-main-logo" src="/Logo_black_trasparent.png" alt="Il Caffè delle Valli" width={2843} height={820} priority />
          </button>
          <p className="hero-tagline">Piccoli piaceri, <span>grandi abitudini.</span></p>
        </div>
        <a className="scroll-cue" href="#menu" aria-label="Scopri il menu">
          <span>Scopri</span><ChevronDown className="scroll-cue-icon" size={22} />
        </a>
      </section>
    </>
  );
}
