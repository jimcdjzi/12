export default function handler(req, res) {
  res.status(200).json({ app: 'my-book-search', version: 1, tokenConfigured: Boolean(process.env.BOOK_TOKEN) });
}
