import { SiteHeader } from "../site-header";

const SECTIONS = [
  { title: "Scans", empty: "No scans yet. Upload a scan or choose one from the library." },
  { title: "Designs", empty: "No designs yet. Describe a part to start one." },
  { title: "Orders", empty: "No orders yet." },
];

export default function Dashboard() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {SECTIONS.map((s) => (
            <section
              key={s.title}
              className="rounded border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <h2 className="font-medium">{s.title}</h2>
              <p className="mt-2 text-sm text-zinc-500">{s.empty}</p>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
