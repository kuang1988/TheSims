# 江湖列传

网页文字武侠人生模拟（原「武侠人生模拟器」）：出身入世 → 按岁推演 → 抉择改命运 → 结算短传与分享图。当前交付至 **Phase 19**（`design/迭代计划-v13.md`：角色选项一图一选项 · 实时文生图成本调研）。

## 功能概览

- **开场**：书房进入；「列传书架」本地收藏已完结传记；「功业印记」收集成就/武学/称号
- **入世**：随机出身、属性、天赋；可重开；种子房支持同种不同抉择
- **模式**：全自动（约 2–4 分钟）/ 半自动重大抉择（约 8–15 分钟，暂停约 8–20 次）
- **身份**：门派离派契约、主线聚焦、主称号对齐（Phase 5～6）
- **凡尘**：士农工商 / 江湖客全生涯保底队列（入世→归宿→本业死法）
- **品味**：多样死法与结局标签、高品武学/称号仪式条、情缘/师徒/仇敌具名回调
- **书本**：一生一书分页；结算与书架支持仿真 3D 翻页
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
- `design/迭代计划-v13.md` — **第十三版 / Phase 19**（角色选项一图一选项 · 实时文生图成本调研）✅
- `design/迭代计划-v12.md` — Phase 18 已交付（薄链/事件/抉择配图审计 · 立绘补洞）
- `design/迭代计划-v11.md` — Phase 17 已交付（产品内审 · 武学/身份/称号/特质 · 文生图）
- `design/迭代计划-v10.md` — Phase 16 已交付（内容薄链 · +200 事件）
- `design/迭代计划-v9.md` — Phase 15 已交付（人生书阅读体验 · 去叠字 · 网文阅读器样式）
- `design/迭代计划-v8.md` — Phase 14 已交付（实体书感 · 完局去冗余 · 页面整体交互）
- `design/迭代计划-v7.md` — Phase 13 已交付（开场界面 · 人生书架 · 仿真翻书）
- `design/迭代计划-v6.md` — Phase 12 已交付（内容盘点 · +50 人生事件 · 书本翻页）
- `design/迭代计划-v5.md` — Phase 11 已交付（立绘 · 高潮/终局配图）
- `design/迭代计划-v4.md` — Phase 10 已交付（死因 · 凡尘全生涯）
- `design/迭代计划-v3.md` — Phase 9 已交付（样式 · 排版 · 交互）
- `design/迭代计划-v2.md` — Phase 8 已交付
- `design/迭代计划.md` — Phase 7 已交付
- `design/优化规划.md` — 前序优化脉络
