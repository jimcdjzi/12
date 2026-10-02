import io
import json
import os
import unittest
from unittest.mock import patch
import urllib.error
from llm import deepseek_answer, GenerationError


class DeepSeekTests(unittest.TestCase):
    def test_missing_key(self):
        with patch.dict(os.environ, {'DEEPSEEK_API_KEY': ''}):
            with self.assertRaisesRegex(GenerationError, 'missing_api_key'):
                deepseek_answer('测试问题', [], [])

    def test_request_scope(self):
        evidence = [{'record': {'section': '愚人', 'subsection': '倒立的意义', 'source': {'pdf_pages': [108]}, 'text': '证据'*1000}}]*9
        response = io.BytesIO(json.dumps({'choices': [{'message': {'content': '书中认为……（PDF 第108页）'}}]}).encode())
        with patch.dict(os.environ, {'DEEPSEEK_API_KEY': 'test-only-key', 'DEEPSEEK_MODEL': 'deepseek-flash'}), patch('urllib.request.urlopen', return_value=response) as call:
            answer = deepseek_answer('如何理解变化？', [{'牌': '愚人', '状态': '逆位'}], evidence)
            request = call.call_args.args[0]
            self.assertEqual(request.full_url, 'https://api.deepseek.com/chat/completions')
            payload = json.loads(request.data)
            self.assertEqual(payload['model'], 'deepseek-flash')
            data = json.loads(payload['messages'][1]['content'])
            self.assertEqual(len(data['book_evidence']), 6)
            self.assertTrue(all(len(r['text']) <= 1500 for r in data['book_evidence']))
            self.assertEqual(data['drawn_cards'][0]['状态'], '逆位')
            self.assertIn('第108页', answer)
            self.assertNotIn('test-only-key', request.data.decode())

    def test_provider_error_does_not_leak_details(self):
        error = urllib.error.HTTPError('https://api.deepseek.com', 401, 'secret body', {}, None)
        with patch.dict(os.environ, {'DEEPSEEK_API_KEY': 'test-only-key'}), patch('urllib.request.urlopen', side_effect=error):
            with self.assertRaises(GenerationError) as caught:
                deepseek_answer('测试问题', [], [])
            self.assertEqual(str(caught.exception), 'provider_http_401')

    def test_empty_response(self):
        response = io.BytesIO(b'{"choices":[{"message":{"content":""}}]}')
        with patch.dict(os.environ, {'DEEPSEEK_API_KEY': 'test-only-key'}), patch('urllib.request.urlopen', return_value=response):
            with self.assertRaisesRegex(GenerationError, 'empty_response'):
                deepseek_answer('测试问题', [], [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
