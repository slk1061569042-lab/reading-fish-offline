# Reading Fish Offline

一个纯前端、离线可玩的“早读养鱼”H5 Demo。

## 功能

- 麦克风权限获取
- 基于 Web Audio API 的声音活跃检测
- 仅在检测到持续朗读/发声时累计有效阅读时长
- 每 15 秒有效阅读获得 1 条鱼
- 鱼缸动画展示
- 本地记录与汇总（localStorage）
- 可部署到 GitHub Pages

## 技术栈

- Vite
- React
- TypeScript
- React Router
- Web Audio API
- localStorage

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

产物在 `dist/`。

## GitHub Pages 部署

当前 `vite.config.ts` 默认仓库名是：

- `reading-fish-offline`

如果你改了仓库名，需要同步修改：

```ts
const GITHUB_PAGES_REPO = '你的仓库名'
```

然后：

1. 创建 GitHub 仓库
2. 推送代码
3. 在 GitHub Pages 中选择从 `main` 分支 `/root` 部署，或使用 `dist` 配套 workflow

如果使用最简单方式，也可以：

- 将项目推到仓库
- 通过 GitHub Actions / Pages 工作流部署 `dist`

## 注意

- 麦克风权限通常要求 HTTPS 或 localhost
- GitHub Pages 自带 HTTPS，适合直接访问
- 本项目不上传音频，不依赖后端服务

## 目录结构

```text
src/
  components/
  hooks/
  modules/
  pages/
```

## 后续可扩展

- 名字输入与个性化存档
- 连续打卡天数
- 更丰富的小鱼种类/升级
- 班级导出/导入 JSON 排行榜
- PWA 离线安装
