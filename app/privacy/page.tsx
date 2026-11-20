import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Norme sulla privacy | Il Caffè delle Valli",
  description: "Informativa sul trattamento dei dati e sull'integrazione con Google Drive del gestionale Il Caffè delle Valli.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f5f2ed] px-5 py-10 text-[#1c1c1a] sm:px-8 sm:py-16">
      <article className="mx-auto max-w-4xl rounded-[2rem] border border-black/10 bg-white p-7 shadow-sm sm:p-12">
        <p className="text-xs font-bold uppercase tracking-[.24em] text-[#ef6100]">Il Caffè delle Valli</p>
        <h1 className="mt-4 font-display text-4xl leading-tight sm:text-6xl">Norme sulla privacy</h1>
        <p className="mt-5 text-sm text-black/50">Ultimo aggiornamento: 20 novembre 2026</p>

        <div className="mt-10 space-y-9 text-base leading-8 text-black/70">
          <section>
            <h2 className="text-xl font-bold text-black">Titolare e ambito dell’informativa</h2>
            <p className="mt-2">Il Caffè delle Valli, con sede in Via Provinciale 6, 24030 Paladina (BG), gestisce un’applicazione privata destinata agli amministratori e al personale autorizzato. Per richieste relative alla privacy è possibile scrivere a <a className="font-semibold text-[#d95700] underline" href="mailto:info@ilcaffedellevalli.it">info@ilcaffedellevalli.it</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black">Accesso a Google Drive</h2>
            <p className="mt-2">L’integrazione Google Drive consente agli utenti autorizzati di consultare e gestire una specifica cartella condivisa. L’app può visualizzare metadati di file e cartelle, creare cartelle, caricare file, rinominare elementi e spostarli nel cestino, esclusivamente su richiesta dell’utente.</p>
            <p className="mt-2">L’applicazione non utilizza i dati Google Drive per pubblicità, profilazione o finalità diverse dalla gestione dell’archivio richiesto dall’utente.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black">Dati conservati</h2>
            <p className="mt-2">Sono conservati l’indirizzo Google collegato, i token OAuth cifrati, la scadenza dell’autorizzazione e le informazioni tecniche necessarie al collegamento. I file rimangono in Google Drive: il gestionale non mantiene una copia permanente autonoma del loro contenuto.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black">Condivisione, protezione e conservazione</h2>
            <p className="mt-2">I dati non vengono venduti. Possono essere trattati soltanto dai fornitori tecnici indispensabili all’erogazione e alla sicurezza dell’applicazione, come hosting e database, secondo le rispettive condizioni e misure di protezione. Le credenziali OAuth sono cifrate e le operazioni sono limitate agli utenti autenticati e autorizzati.</p>
            <p className="mt-2">I dati di collegamento vengono conservati finché l’integrazione resta attiva o finché l’utente ne richiede la cancellazione.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black">Revoca e cancellazione</h2>
            <p className="mt-2">L’utente può revocare l’accesso in qualsiasi momento dalle impostazioni di sicurezza del proprio Account Google. Può inoltre richiedere la cancellazione dei dati di collegamento scrivendo all’indirizzo indicato sopra. La revoca impedisce all’applicazione di effettuare nuove operazioni su Google Drive.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black">Uso limitato dei dati Google</h2>
            <p className="mt-2">L’uso e il trasferimento ad altre applicazioni delle informazioni ricevute dalle API di Google rispettano la Google API Services User Data Policy, inclusi i requisiti di Limited Use. I dati Google non vengono utilizzati per determinare affidabilità creditizia, pubblicità personalizzata o addestramento di modelli generalizzati.</p>
          </section>
        </div>

        <Link className="mt-12 inline-flex rounded-full bg-[#1c1c1a] px-6 py-3 text-sm font-bold text-white" href="/">Torna al sito</Link>
      </article>
    </main>
  );
}
