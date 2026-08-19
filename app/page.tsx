import Image from "next/image";
import { ArrowUpRight, Clock3, MapPin, Phone } from "lucide-react";
import { LandingHero } from "@/components/landing-hero";
import { MenuSection } from "@/components/menu-section";

const highlights = [
  { value: "7/7", label: "Aperti ogni giorno" },
  { value: "04:00", label: "Ogni mattina" },
  { value: "25", label: "Tipi di brioche" },
];

export default function Home() {
  return (
    <main className="overflow-hidden bg-cream text-ink">
      <LandingHero />

      <div className="bg-cream">
        <div className="site-container grid border-b border-ink/15 sm:grid-cols-3">
          {highlights.map((item) => (
            <div className="flex items-baseline gap-4 border-ink/15 py-7 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0" key={item.label}>
              <span className="font-display text-3xl text-orange">{item.value}</span>
              <span className="text-xs uppercase tracking-[0.16em] text-ink/45">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <MenuSection />

      <section id="storia" className="relative bg-white">
        <div className="scroll-bean section-bean section-bean-one" data-speed="-0.035" aria-hidden="true"><Image src="/coffee-beans.png" alt="" width={1536} height={1024} /></div>
        <div className="site-container grid gap-16 py-24 lg:grid-cols-[0.9fr_1.1fr] lg:py-36">
        <div>
          <p className="section-number">02 — Il locale</p>
          <h2 className="mt-7 max-w-lg font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl">Semplice nelle cose. <span className="text-orange">Speciale</span> nel modo.</h2>
        </div>
        <div className="flex flex-col justify-end lg:pt-28">
          <p className="max-w-xl text-xl leading-relaxed text-ink/65 sm:text-2xl">Il Caffè delle Valli nasce come luogo quotidiano: accogliente, contemporaneo e senza formalità. Materie prime scelte, gesti fatti con cura e il piacere di stare insieme.</p>
          <div className="mt-12 grid gap-8 border-t border-ink/15 pt-8 sm:grid-cols-2">
            <div><h3 className="font-display text-2xl">Dalla colazione</h3><p className="mt-2 leading-relaxed text-ink/55">Caffetteria, lievitati fragranti e proposte per iniziare con il ritmo giusto.</p></div>
            <div><h3 className="font-display text-2xl">Fino all’aperitivo</h3><p className="mt-2 leading-relaxed text-ink/55">Cocktail, vini e piccoli piatti pensati per il momento più bello della giornata.</p></div>
          </div>
        </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-orange text-white">
        <div className="scroll-bean section-bean section-bean-two" data-speed="-0.06" aria-hidden="true"><Image src="/coffee-beans.png" alt="" width={1536} height={1024} /></div>
        <div className="site-container grid gap-10 py-20 lg:grid-cols-[1fr_auto] lg:items-end lg:py-28">
          <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-white/65">Un posto, tanti momenti</p><p className="mt-5 max-w-4xl font-display text-4xl leading-tight sm:text-6xl lg:text-7xl">Ci vediamo per un caffè?<br />Il primo lo scegli tu.</p></div>
          <a className="button button-light shrink-0" href="tel:+390000000000">Chiamaci <Phone size={17} /></a>
        </div>
      </section>

      <footer id="contatti" className="bg-ink text-white">
        <div className="site-container py-20 lg:py-28">
          <div className="grid gap-16 lg:grid-cols-2">
            <div>
              <Image className="h-auto w-full max-w-md" src="/Logo_black_trasparent.png" alt="Il Caffè delle Valli" width={2843} height={820} />
              <p className="mt-8 max-w-md text-lg leading-relaxed text-white/55">Il tuo nuovo punto d’incontro a Paladina. Passa a trovarci, c’è sempre un buon motivo.</p>
            </div>
            <div className="grid gap-10 sm:grid-cols-2">
              <div><p className="footer-label"><MapPin size={15} /> Dove siamo</p><p className="mt-4 text-lg">Via Roma, 00<br />24030 Paladina (BG)</p><a className="footer-link" href="https://maps.google.com" target="_blank" rel="noreferrer">Apri la mappa <ArrowUpRight size={15} /></a></div>
              <div><p className="footer-label"><Clock3 size={15} /> Orari</p><p className="mt-4 text-lg">Lun — Dom<br />07:00 — 23:00</p><p className="mt-2 text-sm text-white/40">Orari di esempio</p></div>
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
