import concurrent.futures
import hashlib
import json
from pathlib import Path
import uuid
import threading
import time
import unittest
import urllib.request
import urllib.error
from unittest.mock import patch
import server


class CabinTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.STATE = server.ROOT / ('test-' + uuid.uuid4().hex + '.sqlite3')
        server.GENERATOR = 'evidence'
        server.initialize()
        cls.http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.base = f'http://127.0.0.1:{cls.http.server_port}'
        threading.Thread(target=cls.http.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        server.STATE.unlink()

    def request(self, path, body=None, origin=None):
        headers = {'Content-Type': 'application/json'}
        if origin:
            headers['Origin'] = origin
        request = urllib.request.Request(self.base + path, data=json.dumps(body).encode() if body is not None else None, headers=headers)
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)

    def create(self, spread='three'):
        status, session = self.request('/api/sessions', {'question': '面对工作变化我可以怎样寻找方向？', 'spread': spread})
        self.assertEqual(status, 201)
        self.assertNotIn('deck', session)
        self.assertNotIn('proof', session)
        return session

    def test_health_and_assets(self):
        status, data = self.request('/api/health')
        self.assertEqual((status, data['cards'], data['chunks']), (200, 78, 402))
        self.assertEqual(len({c['id'] for c in server.CARDS}), 78)
        for card in server.CARDS:
            self.assertTrue((server.ROOT / 'web' / card['image'].lstrip('/')).is_file())

    def test_draw_integrity_and_duplicate(self):
        s = self.create()
        for index in [0, 35, 77]:
            status, drawn = self.request(f"/api/sessions/{s['token']}/draw", {'index': index})
            self.assertEqual(status, 200)
        self.assertEqual(len({d['card']['id'] for d in drawn['draws']}), 3)
        self.assertEqual(hashlib.sha256(drawn['proof'].encode()).hexdigest(), s['commitment'])
        proof = json.loads(drawn['proof'])
        self.assertEqual(len({d['id'] for d in proof['deck']}), 78)
        for d in drawn['draws']:
            self.assertEqual(proof['deck'][d['index']], {'id': d['card']['id'], 'reversed': d['reversed']})
        self.assertEqual(self.request(f"/api/sessions/{s['token']}/draw", {'index': 1})[0], 400)

    def test_concurrent_repeat(self):
        s = self.create()
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            responses = list(pool.map(lambda _: self.request(f"/api/sessions/{s['token']}/draw", {'index': 12}), range(4)))
        self.assertEqual(sum(code == 200 for code, _ in responses), 1)
        self.assertEqual(len(self.request('/api/sessions/' + s['token'])[1]['draws']), 1)

    def test_invalid_inputs_and_origins(self):
        for q in ['', 'hi', 'x' * 301, None, '请判断我是不是得了癌症', '我不想活了怎么办']:
            self.assertEqual(self.request('/api/sessions', {'question': q, 'spread': 'single'})[0], 400)
        self.assertEqual(self.request('/api/sessions', {'question': '如何认识自己的感受', 'spread': 'single'}, 'https://evil.example')[0], 403)
        s = self.create()
        for index in [-1, 78, True, '1']:
            self.assertEqual(self.request(f"/api/sessions/{s['token']}/draw", {'index': index})[0], 400)
        self.assertEqual(self.request(f"/api/sessions/{s['token']}/interpret", {})[0], 400)

    def test_static_traversal_and_unknown_session(self):
        for path in ['/../server.py', '/%2e%2e/server.py', '/%2e%2e/state.sqlite3', '/api/sessions/missing']:
            self.assertEqual(self.request(path)[0], 404)

    def test_all_orientation_evidence(self):
        rag = server.TarotRAG()
        try:
            for card in server.CARDS:
                for rev in [False, True]:
                    evidence = server.card_evidence(rag, {'card': card, 'reversed': rev}, '我可以如何找到方向')
                    self.assertTrue(evidence, card['name'])
                    self.assertTrue(all(r['section'] == card['section'] for r in evidence))
                    self.assertTrue(all(r['subsection'] == ('倒立的意义' if rev else '大体上的意义') for r in evidence), card['name'])
                    self.assertTrue(all(r['source']['pdf_pages'] for r in evidence))
        finally:
            rag.close()

    def test_complete_reading_and_library(self):
        s = self.create('single')
        self.request(f"/api/sessions/{s['token']}/draw", {'index': 25})
        self.assertEqual(self.request(f"/api/sessions/{s['token']}/interpret", {})[0], 200)
        for _ in range(100):
            current = self.request('/api/sessions/' + s['token'])[1]
            if current['status'] == 'complete':
                break
            time.sleep(.1)
        self.assertEqual(current['status'], 'complete')
        self.assertEqual(current['reading']['mode'], 'evidence')
        self.assertEqual(current['reading']['cards'][0]['card_id'], current['draws'][0]['card']['id'])
        self.assertTrue(current['reading']['cards'][0]['sources'][0]['pages'])
        status, result = self.request('/api/knowledge?q=' + urllib.parse.quote('愚人逆位'))
        self.assertEqual(status, 200)
        self.assertIn('PDF', result['answer'])

    def test_failed_generation_can_retry_without_redrawing(self):
        previous = server.GENERATOR
        server.GENERATOR = 'deepseek'
        try:
            s = self.create('single')
            _, drawn = self.request(f"/api/sessions/{s['token']}/draw", {'index': 17})
            def wait_done():
                for _ in range(100):
                    current = self.request('/api/sessions/' + s['token'])[1]
                    if current['status'] == 'complete':
                        return current
                    time.sleep(.1)
                self.fail('generation did not complete')
            with patch.object(server, 'deepseek_answer', side_effect=server.GenerationError('provider_http_402')) as failed:
                self.request(f"/api/sessions/{s['token']}/interpret", {})
                current = wait_done()
                self.assertEqual(current['reading']['mode'], 'evidence')
                self.assertTrue(current['reading']['can_retry'])
                self.request(f"/api/sessions/{s['token']}/interpret", {})
                self.assertEqual(failed.call_count, 1)
            def answer(question, fixed, hits):
                page = hits[0]['record']['source']['pdf_pages'][0]
                return f'书中认为，可以借此认识自己的感受。（PDF 第{page}页）'
            with patch.object(server, 'deepseek_answer', side_effect=answer) as succeeded:
                self.request(f"/api/sessions/{s['token']}/interpret", {'retry': True})
                current = wait_done()
                self.assertEqual(current['reading']['mode'], 'model')
                self.assertFalse(current['reading']['can_retry'])
                self.assertEqual(current['draws'], drawn['draws'])
                self.assertEqual(current['commitment'], drawn['commitment'])
                self.request(f"/api/sessions/{s['token']}/interpret", {'retry': True})
                self.assertEqual(succeeded.call_count, 1)
            self.assertEqual(self.request(f"/api/sessions/{s['token']}/interpret", {'retry': 'yes'})[0], 400)
        finally:
            server.GENERATOR = previous


if __name__ == '__main__':
    unittest.main(verbosity=2)
