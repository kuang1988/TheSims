# 武侠人生模拟器

网页文字人生模拟：出身入世 → 按岁推演 → 抉择改命运 → 结算短传与分享图。当前交付至 **Phase 12**；下一版规划见 `design/迭代计划-v7.md`（开场界面 · 人生书架 · 仿真翻书）。

## 功能概览

- **入世**：随机出身、属性、天赋；可重开；种子房支持同种不同抉择
- **模式**：全自动（约 2–4 分钟）/ 半自动重大抉择（约 8–15 分钟，暂停约 8–20 次）
- **身份**：门派离派契约、主线聚焦、主称号对齐（Phase 5～6）
- **凡尘**：士农工商 / 江湖客全生涯保底队列（入世→归宿→本业死法）
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
npm run death-audit      # 死因种类、霸榜、凡尘分桶（Phase 10/12）
npm run event-census     # 事件池盘点（Phase 12）
```

## 生产构建与 GitHub Pages

```bash
npm run build
```

产物输出到 **`docs/`**（并提交到仓库），供 GitHub Pages 直接托管。

### 仓库 Settings

1. 打开 https://github.com/kuang1988/TheSims/settings/pages
2. **Source** 选 **Deploy from a branch**
3. Branch 选 **main**，文件夹选 **/docs**
4. Save 后等待约 1 分钟，访问：

`https://kuang1988.github.io/TheSims/`

之后每次改代码，本地执行 `npm run build`，把更新后的 `docs/` 一并提交推送即可。

本地预览构建结果：

```bash
npm run preview
```

## 设计与计划

- `design/设计文档.md` — 玩法与数据口径
- `design/迭代计划-v7.md` — **第七版 / Phase 13**（开场界面 · 人生书架 · 仿真翻书）
- `design/迭代计划-v6.md` — Phase 12 已交付（内容盘点 · +50 人生事件 · 书本翻页）
- `design/迭代计划-v5.md` — Phase 11 已交付（立绘 · 高潮/终局配图）
- `design/迭代计划-v4.md` — Phase 10 已交付（死因 · 凡尘全生涯）
- `design/迭代计划-v3.md` — Phase 9 已交付（样式 · 排版 · 交互）
- `design/迭代计划-v2.md` — Phase 8 已交付
- `design/迭代计划.md` — Phase 7 已交付
- `design/优化规划.md` — 前序优化脉络
