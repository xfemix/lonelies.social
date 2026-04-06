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
const yearSelect = document.getElementById('year-select');
const monthSelect = document.getElementById('month-select');
const monthFilterButton = document.getElementById('month-filter');
const clearMonthFilterButton = document.getElementById('clear-month-filter');
const calendarGrid = document.getElementById('calendar-grid');
const calendarSummary = document.getElementById('calendar-summary');
const totalLettersNode = document.getElementById('total-letters');

const DEFAULT_TITLE = 'lonelies.social | Anonymous Letters, Archive, and Search';
let latestPosts = [];

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function hasDraft() {
  return Boolean(nicknameInput.value.trim() || letterInput.value.trim());
}

function setStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle('error', Boolean(isError));
}

function setTotalLetters(count) {
  if (!totalLettersNode) return;
  const safeCount = Number.isFinite(Number(count)) ? Number(count) : 0;
  totalLettersNode.textContent = String(safeCount);
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

function toIsoDate(isoString) {
  return new Date(isoString).toISOString().slice(0, 10);
}

function currentActivitySelection() {
  const year = Number(yearSelect.value);
  const month = Number(monthSelect.value);
  return {
    year: Number.isInteger(year) ? year : undefined,
    month: Number.isInteger(month) ? month : undefined,
  };
}

function titleForPost(post) {
  const datePart = toIsoDate(post.created_at);
  return `Archive ${datePart} #${post.id} | lonelies.social`;
}

function setTitleFromLinkedPost(posts) {
  const params = new URLSearchParams(window.location.search);
  const requestedPost = Number(params.get('post'));
  if (!Number.isInteger(requestedPost) || requestedPost <= 0) {
    document.title = DEFAULT_TITLE;
    return;
  }

  const found = posts.find((post) => Number(post.id) === requestedPost);
  if (!found) return;
  document.title = titleForPost(found);
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
  latestPosts = posts;
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
    shareButton.dataset.createdAt = post.created_at;

    postsRoot.append(clone);
  }

  highlightLinkedPost();
  setTitleFromLinkedPost(posts);
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

    setTotalLetters(data.totalLetters);
    renderPosts(data.posts || []);
  } catch (error) {
    setTotalLetters(0);
    renderPosts([]);
    setStatus(error.message || 'Could not load posts.', true);
  }
}

function renderCalendar(activity) {
  const year = Number(activity.selectedYear);
  const month = Number(activity.selectedMonth);
  const todayYear = Number(activity.today?.year || 0);
  const todayMonth = Number(activity.today?.month || 0);
  const todayDay = Number(activity.today?.day || 0);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const countsByDay = new Map();
  const maxCount = activity.days.reduce((max, item) => Math.max(max, Number(item.count || 0)), 0);

  for (const item of activity.days) {
    countsByDay.set(item.day, Number(item.count || 0));
  }

  calendarGrid.innerHTML = '';

  for (let i = 0; i < firstWeekDay; i += 1) {
    const spacer = document.createElement('div');
    spacer.className = 'day-cell empty';
    spacer.setAttribute('aria-hidden', 'true');
    calendarGrid.append(spacer);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayNode = document.createElement('button');
    const dateValue = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const count = countsByDay.get(dateValue) || 0;
    const isFutureDay = year === todayYear && month === todayMonth && day > todayDay;
    dayNode.type = 'button';
    dayNode.className = 'day-cell';
    dayNode.textContent = String(day);
    dayNode.dataset.date = dateValue;

    if (isFutureDay) {
      dayNode.classList.add('future');
      dayNode.disabled = true;
      dayNode.title = `${dateValue} is in the future`;
    } else if (count > 0) {
      dayNode.classList.add('active');
      const ratio = maxCount ? count / maxCount : 0;
      if (ratio <= 0.25) dayNode.classList.add('level-1');
      else if (ratio <= 0.5) dayNode.classList.add('level-2');
      else if (ratio <= 0.75) dayNode.classList.add('level-3');
      else dayNode.classList.add('level-4');
      dayNode.title = `${count} letters on ${dateValue}`;
    } else {
      dayNode.classList.add('no-activity');
      dayNode.disabled = true;
      dayNode.title = `No letters on ${dateValue}`;
    }

    calendarGrid.append(dayNode);
  }

  calendarSummary.textContent = `${monthNames[month - 1]} ${year}: ${activity.monthTotal} letters`;
}

function renderYearOptions(years, selectedYear) {
  yearSelect.innerHTML = '';
  const safeYears = years.length ? years : [new Date().getUTCFullYear()];

  for (const year of safeYears) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    if (Number(year) === Number(selectedYear)) option.selected = true;
    yearSelect.append(option);
  }
}

function renderMonthOptions(months, monthCounts, selectedMonth, selectedYear, today) {
  monthSelect.innerHTML = '';
  const activeMonths = new Set((months || []).map((month) => Number(month)));
  const countsByMonth = new Map();
  for (const item of monthCounts || []) {
    countsByMonth.set(Number(item.month), Number(item.count));
  }

  const currentYear = Number(today?.year || 0);
  const currentMonth = Number(today?.month || 0);
  let selectedExists = false;

  for (let month = 1; month <= 12; month += 1) {
    const isFutureMonth = Number(selectedYear) === currentYear && month > currentMonth;
    if (isFutureMonth) continue;

    const count = countsByMonth.get(month) || 0;
    const hasActivity = activeMonths.has(month) || count > 0;
    const option = document.createElement('option');
    option.value = String(month);
    option.textContent = `${monthNames[month - 1]} (${count})`;
    option.disabled = !hasActivity;
    if (Number(month) === Number(selectedMonth)) {
      option.selected = true;
      selectedExists = true;
    }
    monthSelect.append(option);
  }

  if (!selectedExists) {
    const fallback = Array.from(monthSelect.options).find((option) => !option.disabled) || monthSelect.options[0];
    if (fallback) fallback.selected = true;
  }

  const selectedOption = monthSelect.selectedOptions[0];
  monthFilterButton.disabled = !selectedOption || selectedOption.disabled;
}

async function loadActivity(year, month) {
  const params = new URLSearchParams();
  params.set('view', 'activity');
  if (Number.isInteger(year)) params.set('year', String(year));
  if (Number.isInteger(month)) params.set('month', String(month));

  try {
    const response = await fetch(`/api/posts?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Could not load archive calendar.');
    }

    renderYearOptions(data.years || [], data.selectedYear);
    renderMonthOptions(
      data.months || [],
      data.monthCounts || [],
      data.selectedMonth,
      data.selectedYear,
      data.today || {}
    );
    renderCalendar(data);
  } catch (error) {
    calendarGrid.innerHTML = '';
    calendarSummary.textContent = 'Calendar unavailable right now.';
    setStatus(error.message || 'Could not load archive calendar.', true);
  }
}

function applyMonthFilter() {
  const year = Number(yearSelect.value);
  const month = Number(monthSelect.value);
  const selectedOption = monthSelect.selectedOptions[0];
  if (selectedOption?.disabled) return;
  if (!Number.isInteger(year) || !Number.isInteger(month)) return;

  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  fromDateInput.value = first;
  toDateInput.value = last;
  loadPosts();
}

async function ensureSharedTitleFromServer() {
  const params = new URLSearchParams(window.location.search);
  const requestedPost = Number(params.get('post'));
  if (!Number.isInteger(requestedPost) || requestedPost <= 0) return;

  if (latestPosts.some((post) => Number(post.id) === requestedPost)) return;

  try {
    const response = await fetch(`/api/posts?id=${requestedPost}`);
    const data = await response.json();
    if (!response.ok || !data.post) return;
    document.title = titleForPost(data.post);
  } catch {
    // Keep default title if single post lookup fails.
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
    const selection = currentActivitySelection();
    await loadActivity(selection.year, selection.month);
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
  const createdAt = button.dataset.createdAt || '';
  const snippet = letter.trim().slice(0, 120);
  const url = postShareUrl(postId);
  const shareTitle = createdAt
    ? `Archive ${toIsoDate(createdAt)} #${postId}`
    : `Archive #${postId}`;
  const sharePayload = {
    title: shareTitle,
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

yearSelect.addEventListener('change', () => {
  loadActivity(Number(yearSelect.value), Number(monthSelect.value));
});

monthSelect.addEventListener('change', () => {
  loadActivity(Number(yearSelect.value), Number(monthSelect.value));
});

monthFilterButton.addEventListener('click', applyMonthFilter);

clearMonthFilterButton.addEventListener('click', () => {
  fromDateInput.value = '';
  toDateInput.value = '';
  loadPosts();
  const selection = currentActivitySelection();
  loadActivity(selection.year, selection.month);
});

calendarGrid.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const dateValue = target.dataset.date;
  if (!dateValue || target.disabled) return;
  fromDateInput.value = dateValue;
  toDateInput.value = dateValue;
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

loadPosts().then(ensureSharedTitleFromServer);
loadActivity();

window.setInterval(() => {
  const selection = currentActivitySelection();
  loadActivity(selection.year, selection.month);
}, 60000);
