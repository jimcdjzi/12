# 我的搜书

这是一个可公开部署的搜书页面。网页只显示搜索框，访问口令保存在部署平台的环境变量中，不会出现在浏览器页面或 GitHub 仓库里。

## 生成公开访问链接

1. 在 GitHub 新建一个空仓库，把本文件夹内的全部文件上传到仓库根目录。
2. 打开 [Vercel](https://vercel.com/)，使用 GitHub 登录。
3. 选择 **Add New → Project**，导入刚才的 GitHub 仓库。
4. 展开 **Environment Variables**，添加：
   - 名称：`BOOK_TOKEN`
   - 值：原站口令
5. 点击 **Deploy**。完成后会得到一个 `https://项目名.vercel.app` 地址，其他人可直接打开。

以后修改 GitHub 仓库内容，Vercel 会自动更新网站。也可以在 Vercel 的项目设置中绑定自己的域名。

> GitHub Pages 不能直接运行这个项目。搜索时需要服务端访问原站，而 GitHub Pages 只能托管静态文件。

## 本地运行

在 PowerShell 中进入本文件夹后运行：

```powershell
$env:BOOK_TOKEN = '原站口令'
node server.mjs
```

然后打开 <http://127.0.0.1:18736>。

## 文件说明

- `public/`：网页界面
- `api/`：Vercel 在线接口
- `lib/upstream.js`：原站接口适配
- `server.mjs`：本地预览服务器
- `vercel.json`：Vercel 部署配置

请确认你有权使用和公开展示上游内容，并遵守上游服务规则。


## 星灯小屋 · 塔罗应用

本仓库的塔罗项目位于 [starlit-cabin/](starlit-cabin/README.md)：全屏 Three.js 小屋、78 张随机抽牌、原书 RAG 与 DeepSeek 综合解读。安装、密钥配置与本地资料导入步骤见该目录说明。
