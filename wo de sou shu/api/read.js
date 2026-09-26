import { publicError, readBook } from '../lib/upstream.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: '不支持此操作。' });
  const type = String(req.query.type || '');
  const q = String(req.query.q || '');
  const name = String(req.query.name || '');
  if (!['bookid', 'url'].includes(type) || !q || q.length > 2000 || (type === 'url' && !/^https?:\/\//i.test(q))) {
    return res.status(400).json({ error: '书籍参数不正确。' });
  }
  try {
    return res.status(200).json(await readBook({ type, q, name }));
  } catch (error) {
    return res.status(502).json({ error: publicError(error) });
  }
}
