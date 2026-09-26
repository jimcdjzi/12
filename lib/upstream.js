import vm from 'node:vm';

const UPSTREAM = 'http://83.147.36.135';
const cookies = new Map();
const cache = new Map();
const pending = new Map();

function token() {
  const value = process.env.BOOK_TOKEN?.trim();
  if (!value) throw new Error('网站尚未配置访问口令，请联系网站管理员。');
  return value;
}

function rememberCookies(response) {
  const list = response.headers.getSetCookie?.() || [];
  for (const item of list) {
    const pair = item.split(';', 1)[0];
    const eq = pair.indexOf('=');
    if (eq > 0) cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

export async function upstreamRequest(route, params) {
  const url = new URL(route, UPSTREAM);
  url.search = new URLSearchParams({ ...params, token: token() });

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(40_000),
      headers: {
        Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
        'User-Agent': 'Mozilla/5.0',
      },
    });
    rememberCookies(response);
    if (!response.ok) throw new Error(`原站暂时无法访问（${response.status}），请稍后重试。`);

    const body = await response.text();
    const challenge = body.match(/setCookie\('sec_defend',([\s\S]*?)\);setCookie\('sec_defend_time'/);
    if (!challenge) return body;

    const expression = challenge[1];
    if (expression.length > 20_000 || !/^[\[\]()!+{}\s]+$/.test(expression)) {
      throw new Error('原站验证方式已变化，请网站管理员更新程序。');
    }
    const value = String(vm.runInNewContext(expression, Object.create(null), { timeout: 100 }));
    if (!/^[a-f\d]{64}$/i.test(value)) throw new Error('原站验证未通过，请稍后重试。');
    cookies.set('sec_defend', value);
    cookies.set('sec_defend_time', '1');
  }
  throw new Error('原站验证未通过，请稍后重试。');
}

function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (all, key) => {
    if (key[0] !== '#') return named[key.toLowerCase()];
    const value = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
    return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : all;
  });
}

function plainText(html) {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>|<\/(?:p|div|h[1-6])>/gi, '\n')
      .replace(/<[^>]*>/g, ''),
  ).trim();
}

export async function readBook(params) {
  const key = `${params.type}:${params.q}`;
  const saved = cache.get(key);
  if (saved && Date.now() - saved.time < 10 * 60 * 1000) return saved.value;
  if (pending.has(key)) return pending.get(key);

  const task = (async () => {
    const html = await upstreamRequest('/read', params);
    const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
    if (!article || !plainText(article[1])) {
      throw new Error('原站未返回正文。请检查链接是否受支持，或稍后重试。');
    }
    const titleHtml = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || params.name || '书籍';
    const value = { name: plainText(titleHtml).split(' · ')[0], content: plainText(article[1]) };
    if (cache.size >= 12) cache.delete(cache.keys().next().value);
    cache.set(key, { time: Date.now(), value });
    return value;
  })();

  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}

export function parseSupportedLink(input) {
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('链接格式不正确。');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('只支持 HTTP 或 HTTPS 链接。');
  if (parsed.origin === UPSTREAM && parsed.pathname === '/read') {
    const type = parsed.searchParams.get('type');
    if (['bookid', 'url'].includes(type)) {
      return { type, q: parsed.searchParams.get('q') || '', name: parsed.searchParams.get('name') || '' };
    }
  }
  return { type: 'url', q: input, name: '' };
}

export function publicError(error) {
  return /timeout|fetch failed|aborted/i.test(error?.message || '')
    ? '连接原站超时，请稍后重试。'
    : error?.message || '服务暂时不可用，请稍后重试。';
}
