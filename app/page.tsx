import Image from "next/image";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center">
      <Image
        src="/Logo_black_trasparent.png"
        alt="Il Caffè delle Valli"
        width={860}
        height={460}
        priority
      />

      <div className="mt-10 space-y-2 text-sm text-gray-400">
        <p>📧 info@ilcaffedellevalli.it</p>
        <p>📍 Paladina (BG)</p>
      </div>
    </main>
  );
}