"use client";

import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

export function LandingHero() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > Math.min(140, window.innerHeight * 0.16));
        document.querySelectorAll<HTMLElement>(".scroll-bean").forEach((bean) => {
          const speed = Number(bean.dataset.speed ?? 0.08);
          bean.style.setProperty("--parallax-y", `${y * speed}px`);
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
        <div className="scroll-bean hero-bean hero-bean-right" data-speed="0.1" aria-hidden="true">
          <Image src="/coffee-beans.png" alt="" width={1536} height={1024} priority />
        </div>
        <div className="scroll-bean hero-bean hero-bean-left" data-speed="-0.05" aria-hidden="true">
          <Image src="/coffee-beans.png" alt="" width={1536} height={1024} />
        </div>
        <div className="hero-center">
          <h1 className="sr-only">Il Caffè delle Valli</h1>
          <Image className="hero-main-logo" src="/Logo_black_trasparent.png" alt="Il Caffè delle Valli" width={2843} height={820} priority />
          <p className="hero-tagline">Piccoli piaceri, <span>grandi abitudini.</span></p>
        </div>
        <a className="scroll-cue" href="#menu" aria-label="Scopri il menu">
          <span>Scopri</span><ChevronDown className="scroll-cue-icon" size={22} />
        </a>
      </section>
    </>
  );
}
