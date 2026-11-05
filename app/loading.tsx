import Image from "next/image";

export default function AppLoading() {
  return (
    <div className="app-initial-loading" role="status" aria-label="Caricamento in corso" style={{ background: "#1c1c1a" }}>
      <Image src="/Logo_black_trasparent.png" alt="Il Caffè delle Valli" width={2843} height={820} priority style={{ width: "min(12rem, 55vw)", height: "auto" }} />
      <span aria-hidden="true" />
    </div>
  );
}
