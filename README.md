# 武侠人生模拟器

网页文字人生模拟：出身入世 → 按岁推演 → 抉择改命运 → 结算短传与分享图。当前交付至 **Phase 7**（品味 / 收集 / 发布）。

## 功能概览

- **入世**：随机出身、属性、天赋；可重开；种子房支持同种不同抉择
- **模式**：全自动（约 2–4 分钟）/ 半自动重大抉择（约 8–15 分钟，暂停约 8–20 次）
- **身份**：门派离派契约、主线聚焦、主称号对齐（Phase 5～6）
- **品味**：多样死法与结局标签、高品武学/称号仪式条、情缘/师徒/仇敌具名回调
- **收集**：图鉴色阶与结局标签进度；成就未解锁不剧透
- **分享**：复制短传（含种子/主线/高光/人事）+ 下载分享图

## 本地开发

```bash
npm install
npm run dev
```

浏览器打开终端提示的本地地址即可游玩。

## 测试与审计

```bash
npm test                 # 单元测试
npm run sect-fork        # 门派分叉 / Phase 6 契约回归
npm run choice-audit     # 空气抉择应为 0
npm run death-audit      # 死因种类与寿终占比（可选）
```

## 生产构建与静态托管

```bash
npm run build
```

产物在 `dist/`。本地预览：

```bash
npm run preview
```

### GitHub Pages

本仓库已配置 Actions 自动部署（`.github/workflows/deploy-pages.yml`），构建 `base` 为 `/TheSims/`。

1. 将代码推送到 `main`（含 `package-lock.json`）
2. 打开仓库 **Settings → Pages**
3. **Source** 选择 **GitHub Actions**
4. 推送后等待 Actions 跑完，站点地址：

`https://kuang1988.github.io/TheSims/`

也可在 Actions 页手动触发 **Deploy to GitHub Pages**。

## 设计与计划

- `设计文档.md` — 玩法与数据口径
- `迭代计划.md` — Phase 7 路线图与验收
- `优化规划.md` — 前序优化脉络
