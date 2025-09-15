import Link from 'next/link';

async function getPost(id: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
  const res = await fetch(`${base}/posts/${id}`, { next: { revalidate: 5 } });
  if (!res.ok) return null;
  return res.json();
}

async function getReplies(id: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
  const res = await fetch(`${base}/replies/${id}`, { next: { revalidate: 5 } });
  if (!res.ok) return [];
  return res.json();
}

export default async function PostDetail({ params }: { params: { id: string } }) {
  const post = await getPost(params.id);
  const replies = await getReplies(params.id);
  if (!post) return <div>Not found</div>;
  return (
    <div className="space-y-6">
      <Link href="/">← Back</Link>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
        <div className="text-zinc-600">{post.category?.name} • {post.type} {post.realityCheck ? '• Reality Check' : ''}</div>
        <p>{post.content}</p>
        <VoteButtons postId={post.id} />
      </div>
      <ReplyForm postId={post.id} />
      <section className="space-y-2">
        <h2 className="text-xl font-medium">Replies</h2>
        <ul className="space-y-2">
          {replies.map((r:any) => (
            <li key={r.id} className="border border-zinc-200 rounded p-3">
              <div className="text-zinc-600 text-sm">{new Date(r.createdAt).toLocaleString()}</div>
              <div>{r.content}</div>
              <ReplyVoteButtons replyId={r.id} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function VoteButtons({ postId }: { postId: string }) {
  async function vote(tag: 'HELPFUL_TRUTH'|'JUST_CRUEL') {
    const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
    await fetch(`${base}/votes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, tag }) });
  }
  return (
    <div className="flex gap-3">
      <button className="border border-zinc-200 rounded p-3" onClick={()=>vote('HELPFUL_TRUTH')}>Helpful Truth</button>
      <button className="border border-zinc-200 rounded p-3" onClick={()=>vote('JUST_CRUEL')}>Just Cruel</button>
    </div>
  );
}

function ReplyVoteButtons({ replyId }: { replyId: string }) {
  async function vote(tag: 'HELPFUL_TRUTH'|'JUST_CRUEL') {
    const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
    await fetch(`${base}/reply-votes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ replyId, tag }) });
  }
  return (
    <div className="flex gap-3 mt-2">
      <button className="border border-zinc-200 rounded p-3" onClick={()=>vote('HELPFUL_TRUTH')}>Helpful Truth</button>
      <button className="border border-zinc-200 rounded p-3" onClick={()=>vote('JUST_CRUEL')}>Just Cruel</button>
    </div>
  );
}

function ReplyForm({ postId }: { postId: string }) {
  async function action(formData: FormData) {
    'use server';
    const content = formData.get('content') as string;
    const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
    await fetch(`${base}/replies`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, content }) });
  }
  return (
    <form action={action} className="space-y-2">
      <textarea name="content" className="border border-zinc-200 rounded p-3 w-full" rows={4} placeholder="Write a reply..." />
      <button className="border border-zinc-200 rounded p-3" type="submit">Reply</button>
    </form>
  );
}
