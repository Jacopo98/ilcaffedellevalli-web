import Image from "next/image";
import { ArrowUpRight, Clock3, MapPin, Phone } from "lucide-react";
import { LandingHero } from "@/components/landing-hero";
import { MenuSection } from "@/components/menu-section";
import { getPublicMenu } from "@/lib/menu";

const highlights = [
  { value: "7/7", label: "Aperti ogni giorno" },
  { value: "04:00", label: "Orario di apertura" },
  { value: "25", label: "Tipi di brioche" },
];

export default async function Home() {
  const menu = await getPublicMenu();

  return (
    <main className="overflow-hidden bg-cream text-ink">
      <LandingHero />

      <div className="sections-flow relative isolate">
        <MenuSection categories={menu} />

      <section id="storia" className="relative bg-white">
        <div className="scroll-bean cross-section-bean" data-move-x="0" data-move-y="-180" data-rotate="70" data-scale="0.18" aria-hidden="true"><Image src="/coffee-beans.png" alt="" width={1536} height={1024} /></div>
        <div className="site-container relative z-10 grid gap-16 py-24 lg:grid-cols-[0.9fr_1.1fr] lg:py-36">
        <div>
          <p className="section-number">02 — Il locale</p>
          <h2 className="mt-7 max-w-lg font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl">Nuova apertura, <span className="text-orange">stessa passione.</span></h2>
        </div>
        <div className="flex flex-col justify-end lg:pt-28">
          <p className="max-w-xl text-xl leading-relaxed text-ink/65 sm:text-2xl">Abbiamo rinnovato il locale per renderlo ancora più accogliente, mantenendo la stessa passione e la cura di sempre.</p>
          <div className="mt-12 grid gap-8 border-t border-ink/15 pt-8 sm:grid-cols-3">
            <div><h3 className="font-display text-2xl">Dalla colazione</h3><p className="mt-2 leading-relaxed text-ink/55">Caffetteria, lievitati fragranti e proposte per iniziare con il ritmo giusto.</p></div>
            <div><h3 className="font-display text-2xl">Pranzi di lavoro</h3><p className="mt-2 leading-relaxed text-ink/55">Proposte semplici e gustose per una pausa pranzo veloce e piacevole.</p></div>
            <div><h3 className="font-display text-2xl">Fino all’aperitivo</h3><p className="mt-2 leading-relaxed text-ink/55">Cocktail, vini e piccoli piatti pensati per il momento più bello della giornata.</p></div>
          </div>
        </div>
        </div>
        <div className="site-container highlights-strip">
          {highlights.map((item) => (
            <div className="highlight-item" key={item.label}>
              <span className="font-display text-orange">{item.value}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>
      </div>

      <section className="relative overflow-hidden bg-orange text-white">
        <div className="scroll-bean section-bean section-bean-two" data-move-x="0" data-move-y="-260" data-rotate="-60" data-scale="0.12" aria-hidden="true"><Image src="/coffee-beans.png" alt="" width={1536} height={1024} /></div>
        <div className="site-container grid gap-10 py-20 lg:grid-cols-[1fr_auto] lg:items-end lg:py-28">
          <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-white/65">Siamo a disposizione</p><p className="mt-5 max-w-4xl font-display text-4xl leading-tight sm:text-6xl lg:text-7xl">Hai qualche richiesta?</p></div>
          <a className="button button-light shrink-0" href="tel:+390000000000">Chiamaci <Phone size={17} /></a>
        </div>
      </section>

      <footer id="contatti" className="bg-ink text-white">
        <div className="site-container py-20 lg:py-28">
          <div className="grid gap-16 lg:grid-cols-2">
            <div>
              <Image className="h-auto w-full max-w-md" src="/Logo_black_trasparent.png" alt="Il Caffè delle Valli" width={2843} height={820} />
              <p className="mt-8 max-w-md text-lg leading-relaxed text-white/55">Il tuo punto d’incontro a Paladina. Passa a trovarci, c’è sempre un buon motivo.</p>
            </div>
            <div className="grid gap-10 sm:grid-cols-2">
              <div><p className="footer-label"><MapPin size={15} /> Dove siamo</p><p className="mt-4 text-lg">Via Provinciale, 6<br />24030 Paladina (BG)</p><a className="footer-link" href="https://maps.google.com" target="_blank" rel="noreferrer">Apri la mappa <ArrowUpRight size={15} /></a></div>
              <div><p className="footer-label"><Clock3 size={15} /> Orari</p><p className="mt-4 text-lg">Lun — Ven: 04:00 — 15:00<br />Sab — Dom: 04:00 — 12:00</p></div>
            </div>
          </div>
          <div className="mt-20 flex flex-col gap-5 border-t border-white/15 pt-7 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Il Caffè delle Valli</p>
            <div className="flex gap-6"><a className="hover:text-white" href="mailto:info@ilcaffedellevalli.it">info@ilcaffedellevalli.it</a><a className="hover:text-white" href="#">Instagram</a></div>
          </div>
        </div>
      </footer>
    </main>
  );
}
