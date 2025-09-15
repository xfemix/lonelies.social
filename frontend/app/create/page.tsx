"use client";
import { useState } from 'react';

const TYPES = [
  { value: 'FIX_MY_LIFE', label: 'Fix My Life' },
  { value: 'AM_I_DELUSIONAL', label: 'Am I Delusional?' },
  { value: 'WHY_DO_PEOPLE_AVOID_ME', label: 'Why Do People Avoid Me?' },
  { value: 'RATE_MY_SITUATION', label: 'Rate My Situation' },
  { value: 'EXISTENTIAL_CRISIS', label: 'Existential Crisis' },
  { value: 'SOCIAL_AUTOPSY', label: 'Social Autopsy' }
];

export default function CreatePost() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState(TYPES[0].value);
  const [realityCheck, setRealityCheck] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<any[]>([]);

  useState(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
    fetch(`${base}/categories`).then(r => r.json()).then(setCategories);
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
    const res = await fetch(`${base}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, type, realityCheck, categoryId })
    });
    if (res.ok) window.location.href = '/';
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Create Post</h1>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block mb-2">Title</label>
          <input className="border border-zinc-200 rounded p-3 w-full" value={title} onChange={e=>setTitle(e.target.value)} />
        </div>
        <div>
          <label className="block mb-2">Content</label>
          <textarea className="border border-zinc-200 rounded p-3 w-full" rows={6} value={content} onChange={e=>setContent(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block mb-2">Type</label>
            <select className="border border-zinc-200 rounded p-3 w-full" value={type} onChange={e=>setType(e.target.value)}>
              {TYPES.map(t=> <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block mb-2">Category</label>
            <select className="border border-zinc-200 rounded p-3 w-full" value={categoryId} onChange={e=>setCategoryId(e.target.value)}>
              <option value="">Select</option>
              {categories.map((c:any)=> <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 mt-8">
            <input id="rc" type="checkbox" checked={realityCheck} onChange={e=>setRealityCheck(e.target.checked)} />
            <label htmlFor="rc">Reality Check flair</label>
          </div>
        </div>
        <button className="border border-zinc-200 rounded p-3" type="submit">Post</button>
      </form>
    </div>
  );
}
