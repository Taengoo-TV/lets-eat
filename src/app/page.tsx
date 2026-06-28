import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50">
      <main className="flex flex-col items-center gap-6 text-center px-6">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900">Let's Eat! 🍜</h1>
        <p className="text-xl text-zinc-500">Find the best time to eat out with your friends</p>
        <Link
          href="/create"
          className="mt-4 rounded-full px-8 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#E8593C" }}
        >
          Create a dining plan
        </Link>
      </main>
    </div>
  );
}
