import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-[100dvh] bg-stone-50 flex flex-col">
      <nav className="px-5 py-4 flex items-center justify-between border-b border-stone-100 max-w-5xl mx-auto w-full">
        <span className="font-bold text-stone-900 tracking-tight text-lg">Let's Eat!</span>
        <Link
          href="/create"
          className="px-4 py-2 text-sm font-semibold text-white bg-orange-500 rounded-full hover:bg-orange-600 active:scale-[0.98] transition-all"
        >
          Create plan
        </Link>
      </nav>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 px-5 py-10 md:py-16 max-w-5xl mx-auto w-full items-center">
        <div className="flex flex-col gap-5">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-stone-900 leading-[1.05]">
            Let&apos;s<br />Eat!
          </h1>
          <p className="text-lg text-stone-500 leading-relaxed max-w-[36ch]">
            Find the best time to dine out with your friends. Pick dates, vote on slots, choose a spot together.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Link
              href="/create"
              className="inline-flex items-center justify-center px-7 py-3.5 text-base font-semibold text-white bg-orange-500 rounded-full hover:bg-orange-600 active:scale-[0.98] transition-all"
            >
              Create a dining plan
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-7 py-3.5 text-base font-semibold text-stone-600 border-2 border-stone-200 rounded-full hover:bg-stone-100 active:scale-[0.98] transition-all"
            >
              View dashboard
            </Link>
          </div>
        </div>

        <div>
          {/* ponytail: picsum for food image - replace with real photo in prod */}
          <img
            src="https://picsum.photos/seed/friends-restaurant-dinner-warm/600/650"
            alt="Friends enjoying a meal together"
            width={600}
            height={650}
            className="w-full h-56 md:h-[60vh] object-cover rounded-3xl shadow-sm"
          />
        </div>
      </main>
    </div>
  );
}
