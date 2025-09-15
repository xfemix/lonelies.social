export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome to LONELIES</h1>
      <p className="text-zinc-600 max-w-2xl">
        A community that values honesty over comfort. You opted in.
      </p>
      <p>
        <a className="border border-zinc-200 rounded p-3" href="/create">Create Post</a>
      </p>
      <section>
        <h2 className="text-xl font-medium mb-2">Categories</h2>
        <CategoriesList />
      </section>
      <section>
        <h2 className="text-xl font-medium mb-2">Perspective Roulette</h2>
        <RouletteList />
      </section>
    </div>
  );
}

async function fetchCategories() {
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
  const res = await fetch(`${base}/categories`, { next: { revalidate: 30 } });
  if (!res.ok) return [];
  return res.json();
}

async function CategoriesList() {
  const categories = await fetchCategories();
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      {categories.map((c: any) => (
        <li key={c.id} className="border border-zinc-200 rounded p-3 hover:bg-zinc-50">
          <div className="font-medium">{c.name}</div>
          <div className="text-sm text-zinc-600">{c.description}</div>
        </li>
      ))}
    </ul>
  );
}

async function fetchRoulette() {
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
  const res = await fetch(`${base}/roulette`, { next: { revalidate: 5 } });
  if (!res.ok) return [];
  return res.json();
}

async function RouletteList() {
  const posts = await fetchRoulette();
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {posts.map((p: any) => (
        <li key={p.id} className="border border-zinc-200 rounded p-3 hover:bg-zinc-50">
          <a href={`/post/${p.id}`}>{p.title}</a>
          <div className="text-sm text-zinc-600">Score {p.truthScore}</div>
        </li>
      ))}
    </ul>
  );
}
