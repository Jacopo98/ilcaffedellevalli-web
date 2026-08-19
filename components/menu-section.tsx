"use client";

import { useState } from "react";
import { Leaf, Wheat } from "lucide-react";
import Image from "next/image";

const categories = ["Caffetteria", "Colazione", "Aperitivo"] as const;
type Category = (typeof categories)[number];
type Item = { name: string; description: string; price: string; tag?: "veg" | "glutine" };

const menuItems: Record<Category, Item[]> = {
  Caffetteria: [
    { name: "Espresso delle Valli", description: "Miscela 100% arabica, note di cacao e frutta secca", price: "1,30 €" },
    { name: "Cappuccino", description: "Espresso, latte fresco e crema vellutata", price: "1,80 €", tag: "veg" },
    { name: "V60 del giorno", description: "Caffè filtro monorigine, estratto al momento", price: "3,50 €" },
    { name: "Cold brew", description: "Infusione a freddo per 18 ore, morbido e aromatico", price: "4,00 €" },
  ],
  Colazione: [
    { name: "Croissant artigianale", description: "Vuoto, crema, albicocca o cioccolato", price: "1,80 €", tag: "glutine" },
    { name: "Pane, burro e confettura", description: "Pane tostato, burro di latteria e confettura locale", price: "4,50 €", tag: "glutine" },
    { name: "Yogurt delle Valli", description: "Yogurt, granola croccante, miele e frutta fresca", price: "5,50 €" },
    { name: "Toast del mattino", description: "Pane ai cereali, prosciutto cotto e formaggio", price: "6,00 €", tag: "glutine" },
  ],
  Aperitivo: [
    { name: "Spritz delle Valli", description: "Bitter all’arancia, bollicine e soda", price: "7,00 €" },
    { name: "Americano", description: "Vermouth rosso, bitter e soda", price: "8,00 €" },
    { name: "Calice del territorio", description: "Selezione quotidiana di vini lombardi", price: "6,00 €" },
    { name: "Tagliere della casa", description: "Salumi, formaggi e accompagnamenti del giorno", price: "14,00 €" },
  ],
};

export function MenuSection() {
  const [activeCategory, setActiveCategory] = useState<Category>("Caffetteria");

  return (
    <section id="menu" className="relative overflow-hidden bg-cream py-24 lg:py-36">
      <div className="scroll-bean menu-bean menu-bean-left" data-move-x="220" data-move-y="-360" data-rotate="120" data-scale="0.35" aria-hidden="true"><Image src="/coffee-beans.png" alt="" width={1536} height={1024} /></div>
      <div className="scroll-bean menu-bean menu-bean-right" data-move-x="-260" data-move-y="380" data-rotate="-150" data-scale="-0.28" aria-hidden="true"><Image src="/coffee-beans.png" alt="" width={1536} height={1024} /></div>
      <div className="site-container relative z-10">
        <div className="flex flex-col gap-8 border-b border-ink/15 pb-10 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="section-number">01 — Il menu</p><h2 className="mt-5 font-display text-5xl tracking-tight sm:text-7xl">Scegli il tuo momento.</h2></div>
          <p className="max-w-sm text-sm leading-relaxed text-ink/50">Questa è una selezione dimostrativa. Ingredienti, disponibilità e prezzi verranno aggiornati con il menu definitivo.</p>
        </div>
        <div className="mt-10 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Categorie del menu">
          {categories.map((category) => (
            <button className={`menu-tab ${activeCategory === category ? "menu-tab-active" : ""}`} key={category} onClick={() => setActiveCategory(category)} role="tab" aria-selected={activeCategory === category} type="button">{category}</button>
          ))}
        </div>
        <div className="mt-10 grid gap-x-16 lg:grid-cols-2">
          {menuItems[activeCategory].map((item) => (
            <article className="menu-item" key={item.name}>
              <div className="min-w-0">
                <div className="flex items-center gap-2"><h3 className="font-display text-xl sm:text-2xl">{item.name}</h3>{item.tag === "veg" && <Leaf className="text-orange" size={15} aria-label="Opzione vegetale disponibile" />}{item.tag === "glutine" && <Wheat className="text-orange" size={15} aria-label="Contiene glutine" />}</div>
                <p className="mt-2 text-sm leading-relaxed text-ink/50">{item.description}</p>
              </div>
              <p className="shrink-0 font-display text-xl text-orange">{item.price}</p>
            </article>
          ))}
        </div>
        <p className="mt-10 text-xs leading-relaxed text-ink/40">Segnalaci eventuali allergie o intolleranze. Il nostro personale è a disposizione per tutte le informazioni.</p>
      </div>
    </section>
  );
}
