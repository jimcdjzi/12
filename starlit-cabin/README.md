# 星灯小屋 · Starlit Cabin

全屏 Three.js 塔罗小屋：称呼欢迎、水晶球提问、微光引导、78 张牌展开、桌面揭牌、原书引用与 DeepSeek 综合解读。

## 安装与启动

Python 3.10+，浏览器支持 WebGL（不支持时仍可使用界面操作）。

```sh
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS / Linux: source .venv/bin/activate
pip install -r requirements.txt
```

将 `.env.example` 复制为 `.env`，填入自己的 `DEEPSEEK_API_KEY`。密钥仅在服务器读取，`.env` 已被 Git 忽略。

### 导入本机书籍资料

应用知识库对应《其实你已经很塔罗了》的 158 页 PDF 版本。提供自己的本机文件路径：

```sh
python build_tarot_jsonl.py --pdf "/path/to/《其实你已经很塔罗了》(1).pdf"
python tarot_rag.py build
python cabin/prepare_assets.py --pdf "/path/to/《其实你已经很塔罗了》(1).pdf"
```

PDF、知识库正文与数据库、原书卡面、用户占卜记录不包含在源码仓库中。导入步骤会在本地恢复知识库及 78 张插图；其他版本的 PDF 需调整清洗书签与版面规则。

```sh
python cabin/server.py --generator deepseek
```

打开 **http://127.0.0.1:8787**。Windows 也可运行 `cabin/启动小屋.ps1`。

## DeepSeek

- 固定官方地址：`https://api.deepseek.com/chat/completions`。
- `DEEPSEEK_MODEL` 可配置，默认 `deepseek-flash`，依据[官方接口文档](https://api-docs.deepseek.com/)。
- 每次发送用户问题、实际抽牌结果和最多 6 段原书证据，每段不超过 1500 字。不发送浏览器保存的称呼、完整书籍或历史记录。
- 模型不能决定牌序；回答页码必须属于本次证据。超时、限流、认证失败、无效引用时明确降级为原书解读，不伪装成模型成功。
- `--generator evidence` 为纯本地模式；`--generator codex` 保留旧版已登录 Codex 集成。

## 抽牌与前端

服务器使用操作系统随机源，洗牌后 78 张无重复、正逆位独立随机；用户点选固定位置。SHA-256 承诺用于校验牌序未在抽牌过程中更改。SQLite 事务防止重复或并发请求取到同一位置。

场景使用固定版本 Three.js 0.180.0，许可证位于 `cabin/web/vendor/LICENSE.three`。钢琴配乐由 `cabin/compose_music.py` 原创生成。减少动态效果设置可跳过推镜和散牌动画。

## 验证

```sh
python cabin/test_llm.py
python cabin/test_cabin.py
python tarot_rag.py eval --strict
```

`test_llm.py` 使用模拟 HTTP，不需要密钥，不收费。后两项需要先导入书籍。

可选浏览器验证：安装 Node.js，执行 `npm install`、`npx playwright install chromium`；启动已配置模型的服务后运行 `npm run test:e2e`。该检查会创建测试牌局并实际调用模型。也可设置 `BROWSER_CHANNEL=msedge` 使用已安装的 Edge。

当前服务面向本机开发，仅绑定 `127.0.0.1`。上传 GitHub 是发布源码，不等于网站已上线。公开托管需要进一步配置身份认证、HTTPS、限流、资料使用范围与数据保留策略。
