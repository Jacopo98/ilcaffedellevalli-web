"use client";

import Image from "next/image";
import { Leaf, Wheat } from "lucide-react";
import { useState } from "react";
import type { MenuCategory } from "@/lib/menu";

const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

export function MenuSection({ categories }: { categories: MenuCategory[] }) {
  const [activeSlug, setActiveSlug] = useState(categories[0]?.slug ?? "");

  const activeCategory = categories.find((category) => category.slug === activeSlug) ?? categories[0];

  return (
    <section id="menu" className="relative bg-cream py-24 lg:py-36">
      <div className="scroll-bean menu-bean menu-bean-left" data-move-x="0" data-move-y="-360" data-rotate="70" data-scale="0.18" aria-hidden="true">
        <Image src="/coffee-beans.png" alt="" width={1536} height={1024} />
      </div>
      <div className="site-container relative z-10">
        <div className="flex flex-col gap-8 border-b border-ink/15 pb-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-number">01 — Il menu</p>
            <h2 className="mt-5 font-display text-5xl tracking-tight sm:text-7xl">Scegli il tuo momento.</h2>
          </div>
        </div>

        <div className="menu-tabs mt-10" role="tablist" aria-label="Categorie del menu">
          {categories.map((category) => (
            <button
              className={`menu-tab ${activeCategory?.slug === category.slug ? "menu-tab-active" : ""}`}
              key={category.id}
              onClick={() => setActiveSlug(category.slug)}
              role="tab"
              aria-selected={activeCategory?.slug === category.slug}
              type="button"
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="mt-10 grid gap-x-16 lg:grid-cols-2">
          {activeCategory?.items.map((item) => (
            <article className="menu-item" key={item.id}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-xl sm:text-2xl">{item.name}</h3>
                  {item.isVegetarian && <Leaf className="text-orange" size={15} aria-label="Opzione vegetariana" />}
                  {item.allergens.includes("glutine") && <Wheat className="text-orange" size={15} aria-label="Contiene glutine" />}
                </div>
                {item.description && <p className="mt-2 text-sm leading-relaxed text-ink/50">{item.description}</p>}
              </div>
              <p className="shrink-0 font-display text-xl text-orange">{euroFormatter.format(item.priceCents / 100)}</p>
            </article>
          ))}
        </div>

        {activeCategory && activeCategory.items.length === 0 && (
          <p className="mt-10 text-sm text-ink/50">Le proposte di questa categoria saranno disponibili a breve.</p>
        )}

        <p className="mt-10 text-xs leading-relaxed text-ink/40">Segnalaci eventuali allergie o intolleranze. Il nostro personale è a disposizione per tutte le informazioni.</p>
      </div>
    </section>
  );
}
