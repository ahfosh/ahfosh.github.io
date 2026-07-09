# 部署流程（Git → 上线）

本项目**无构建步骤**：根目录静态站点（HTML / CSS / JS / 数据文件）。  
**真正上线**依赖 Netlify CLI 直传，**不**走 Git 触发的 Build 队列，从而**不消耗 Netlify 构建额度**。

生产地址：https://ahfosh.netlify.app  
站点 ID：`436960d0-e806-404d-86db-9a07a1a682ed`（项目名 `ahfosh`）

---

## 0. 前置条件（只需做一次）

| 项 | 说明 |
|----|------|
| 仓库 | `git clone` 本仓库，具备 push 权限 |
| Node.js | 已安装 |
| Netlify CLI | `npm i -g netlify-cli` |
| 登录 | `netlify login`（浏览器授权） |
| 站点关联 | 仓库根目录存在 `.netlify/state.json`，指向上述站点 |

若尚未 link：

```powershell
netlify link --id 436960d0-e806-404d-86db-9a07a1a682ed
```

---

## 1. 改代码

按需修改站点根目录下的静态文件（如 `index.html`、`styles.css`、各子目录页面等）。

上传时会忽略 `.git`、`.github`、`scripts/`、`DEPLOY.md` 等（见 `.netlifyignore`）。

---

## 2. Git 提交并推送

```powershell
git add <相关文件>
git commit -m "简要说明本次改动"
git push origin main
```

说明：`git push` 只更新 GitHub 备份，**不会**自动把站点变成最新生产版本（本站不依赖 Git 触发的 Netlify Build）。

---

## 3. 真正上线：CLI 直部署

在仓库根目录执行：

```powershell
npm run deploy:netlify
```

等价于 `scripts/deploy-netlify.mjs` 两步：

1. **上传草稿**  
   `netlify deploy --dir=.`  
   - 按 `.netlifyignore` 上传静态文件  
   - **不跑** Netlify Git Build，不占构建分钟数  

2. **发布到生产**  
   `netlify api restoreSiteDeploy`（传入 `site_id` + 本次 `deploy_id`）  
   - 将草稿 deploy 设为当前生产  
   - 原因：本站对 `netlify deploy --prod` 可能返回 `Forbidden`，故用 API restore  

成功时控制台类似：

```text
Uploading site root (draft, no build) ...
Draft deploy ready: <deployId>
Publishing to production (restoreSiteDeploy) ...
Production live: https://ahfosh.netlify.app
Deploy: https://app.netlify.com/projects/ahfosh/deploys/<deployId>
```

---

## 4. 验收

1. 打开 https://ahfosh.netlify.app（必要时 Ctrl+F5 硬刷新）
2. 确认本次改动是否生效
3. 可在 Netlify Deploy 链接中确认对应 `deployId`

---

## 流程简图

```text
改代码 → git commit → git push（备份到 GitHub）
                    ↓
         npm run deploy:netlify
                    ↓
         上传站点根目录（draft，无 build）
                    ↓
         restoreSiteDeploy（切生产）
                    ↓
         https://ahfosh.netlify.app 已更新
```

---

## 为什么能绕过构建额度

| 方式 | 是否占 Netlify Build 额度 |
|------|---------------------------|
| Git push 触发 Netlify 自动 Build | 是（build minutes） |
| `npm run deploy:netlify` CLI 直传 | **否**（只上传已有文件，不 build） |

第三者只要具备：**本机 Node + 已 `netlify login` 的 CLI + 已 link 的站点权限**，即可按第 1–4 步独立完成上线，无需在 Netlify 网页上点 Deploy，也无需可用的 Build 额度。

---

## 5. GitHub Actions 自动部署（可选）

推送到 `main` 会跑 `.github/workflows/netlify-deploy.yml`：用 Netlify Deploy API（file digest，只上传变更文件），**不**走 Git 构建队列。

### 必填仓库 Secret

在 GitHub：**Settings → Secrets and variables → Actions → New repository secret**

| Secret | 说明 |
|--------|------|
| `NETLIFY_AUTH_TOKEN` | **必填**。Netlify Personal Access Token（[User settings → Applications → Personal access tokens](https://app.netlify.com/user/applications#personal-access-tokens)） |
| `NETLIFY_SITE_ID` | 可选。默认 workflow 已写入 `436960d0-e806-404d-86db-9a07a1a682ed`；若要覆盖再设此 secret |

未设置 `NETLIFY_AUTH_TOKEN` 时 workflow 会立刻失败并提示补 secret，不会误报成脚本参数问题。

手动触发：Actions → **Deploy to Netlify (API)** → Run workflow（可勾 Draft、填 message）。

---

## 相关路径

| 路径 | 职责 |
|------|------|
| 仓库根目录 | 前端静态资源（发布目录） |
| `.netlifyignore` | 部署时排除的文件 |
| `scripts/deploy-netlify.mjs` | 本机 CLI：上传草稿 + 发布生产 |
| `scripts/netlify-deploy.mjs` | API file-digest 部署（CI 与可选本机用） |
| `.github/workflows/netlify-deploy.yml` | push `main` 时自动 API 部署 |
| `.netlify/state.json` | CLI 关联的站点 ID |
