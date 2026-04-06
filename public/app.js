const form = document.getElementById('letter-form');
const nicknameInput = document.getElementById('nickname');
const letterInput = document.getElementById('letter');
const postsRoot = document.getElementById('posts');
const refreshButton = document.getElementById('refresh');
const statusNode = document.getElementById('form-status');
const template = document.getElementById('post-template');
const searchInput = document.getElementById('search');
const fromDateInput = document.getElementById('from-date');
const toDateInput = document.getElementById('to-date');
const sortSelect = document.getElementById('sort');
const applyFiltersButton = document.getElementById('apply-filters');
const clearFiltersButton = document.getElementById('clear-filters');

function hasDraft() {
  return Boolean(nicknameInput.value.trim() || letterInput.value.trim());
}

function setStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle('error', Boolean(isError));
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function postShareUrl(postId) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('post', String(postId));
  return url.toString();
}

function highlightLinkedPost() {
  const params = new URLSearchParams(window.location.search);
  const requestedPost = Number(params.get('post'));
  if (!Number.isInteger(requestedPost) || requestedPost <= 0) return;

  const postNode = document.getElementById(`post-${requestedPost}`);
  if (!postNode) return;

  postNode.classList.add('targeted');
  postNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => {
    postNode.classList.remove('targeted');
  }, 2200);
}

function renderPosts(posts) {
  postsRoot.innerHTML = '';

  if (!posts.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No letters yet. Be the first voice in the archive.';
    postsRoot.append(empty);
    return;
  }

  for (const post of posts) {
    const clone = template.content.cloneNode(true);
    const postNode = clone.querySelector('.post');
    const readButton = clone.querySelector('.read-button');
    const shareButton = clone.querySelector('.share-button');
    const readNode = clone.querySelector('.post-reads');
    const safeName = post.nickname || 'anonymous';

    postNode.id = `post-${post.id}`;

    clone.querySelector('.post-name').textContent = safeName;
    clone.querySelector('.post-date').textContent = formatDate(post.created_at);
    clone.querySelector('.post-letter').textContent = post.letter;
    readNode.textContent = `${post.read_count || 0} reads`;
    readButton.dataset.id = String(post.id);
    shareButton.dataset.id = String(post.id);
    shareButton.dataset.name = safeName;
    shareButton.dataset.letter = post.letter;

    postsRoot.append(clone);
  }

  highlightLinkedPost();
}

function buildQueryString() {
  const params = new URLSearchParams();
  const search = searchInput.value.trim();
  const fromDate = fromDateInput.value;
  const toDate = toDateInput.value;
  const sort = sortSelect.value;

  if (search) params.set('search', search);
  if (fromDate) params.set('from', fromDate);
  if (toDate) params.set('to', toDate);
  if (sort === 'asc') params.set('sort', 'asc');

  const query = params.toString();
  return query ? `?${query}` : '';
}

async function loadPosts() {
  try {
    const response = await fetch(`/api/posts${buildQueryString()}`, { method: 'GET' });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Could not load posts.');
    }

    renderPosts(data.posts || []);
  } catch (error) {
    renderPosts([]);
    setStatus(error.message || 'Could not load posts.', true);
  }
}

async function submitLetter(event) {
  event.preventDefault();
  setStatus('Sending...');

  const payload = {
    nickname: nicknameInput.value,
    letter: letterInput.value,
  };

  try {
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Could not post letter.');
    }

    setStatus('Posted. Your letter is now part of the archive.');
    nicknameInput.value = '';
    letterInput.value = '';
    await loadPosts();
  } catch (error) {
    setStatus(error.message || 'Could not post letter.', true);
  }
}

async function incrementRead(postId) {
  const response = await fetch('/api/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'read', id: postId }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not update read count.');
  }

  return data.read_count;
}

async function sharePost(button) {
  const postId = Number(button.dataset.id);
  if (!Number.isInteger(postId) || postId <= 0) return;

  const name = button.dataset.name || 'anonymous';
  const letter = button.dataset.letter || '';
  const snippet = letter.trim().slice(0, 120);
  const url = postShareUrl(postId);
  const sharePayload = {
    title: 'lonelies.social letter',
    text: `${name}: ${snippet}${letter.length > 120 ? '...' : ''}`,
    url,
  };

  try {
    if (navigator.share) {
      await navigator.share(sharePayload);
      setStatus('Shared.');
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied to clipboard.');
      return;
    }

    const accepted = window.prompt('Copy this link:', url);
    if (accepted !== null) setStatus('Link ready to copy.');
  } catch (error) {
    if (error?.name === 'AbortError') return;
    setStatus('Could not share this post right now.', true);
  }
}

form.addEventListener('submit', submitLetter);
refreshButton.addEventListener('click', () => {
  if (hasDraft()) {
    const ok = window.confirm('You have unsent text. Refreshing may interrupt your writing. Continue?');
    if (!ok) return;
  }

  setStatus('Refreshing archive...');
  loadPosts().finally(() => {
    setStatus('');
  });
});

applyFiltersButton.addEventListener('click', () => {
  loadPosts();
});

clearFiltersButton.addEventListener('click', () => {
  searchInput.value = '';
  fromDateInput.value = '';
  toDateInput.value = '';
  sortSelect.value = 'desc';
  loadPosts();
});

postsRoot.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.classList.contains('share-button')) {
    await sharePost(target);
    return;
  }

  if (!target.classList.contains('read-button')) {
    return;
  }

  const postId = Number(target.dataset.id);
  if (!Number.isInteger(postId) || postId <= 0) {
    return;
  }

  const originalText = target.textContent;
  target.disabled = true;
  target.textContent = 'Counting...';

  try {
    const nextReadCount = await incrementRead(postId);
    const readsNode = target.parentElement && target.parentElement.querySelector('.post-reads');
    if (readsNode) readsNode.textContent = `${nextReadCount} reads`;
  } catch (error) {
    setStatus(error.message || 'Could not update read count.', true);
  } finally {
    target.disabled = false;
    target.textContent = originalText;
  }
});

window.addEventListener('beforeunload', (event) => {
  if (!hasDraft()) return;
  event.preventDefault();
  event.returnValue = '';
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    loadPosts();
  }
});

loadPosts();
