import { parseSupportedLink, publicError, readBook, upstreamRequest } from '../lib/upstream.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: '不支持此操作。' });
  const query = String(req.query.q || '').trim();
  if (!query || query.length > 2000) return res.status(400).json({ error: '请输入书名或有效链接。' });

  try {
    if (/^https?:\/\//i.test(query)) {
      const params = parseSupportedLink(query);
      const data = await readBook(params);
      return res.status(200).json({
        books: [{ name: data.name, author: '', intro: data.content.slice(0, 140), ...params }],
        resolved: data,
      });
    }

    const raw = await upstreamRequest('/api/search', { type: 'name', keyword: query });
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('原站返回了异常内容，请稍后重试。');
    }
    if (data.code !== 0 || !Array.isArray(data.data)) throw new Error(data.msg || '搜索失败，请稍后重试。');
    return res.status(200).json({
      books: data.data.map((item) => ({
        name: String(item.name || '未命名'),
        author: String(item.author || ''),
        intro: String(item.intro || ''),
        type: 'bookid',
        q: String(item.bookid || ''),
      })),
    });
  } catch (error) {
    return res.status(502).json({ error: publicError(error) });
  }
}
