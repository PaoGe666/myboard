# myboard

<p align="center">
  <img src="./readme/pc.png" height="300">
  <img src="./readme/mobile.png" height="300">
</p>

`myboard` 是基于 [`zashboard`](https://github.com/Zephyruso/zashboard)（当前对齐 **v3.26.0**）修改的中文自用版本，主要针对 Mihomo / OpenClash 配置做了更清晰的策略组、节点组、订阅提供商与图标展示，同时沿用 zashboard v3.26.0 的代理列表虚拟滚动 / 卡片头部等新渲染架构，并叠加 myboard 定制功能。

## 功能特点

- 将原来的 `代理` 视图重命名为 `策略组`
- 将高层策略组和地区节点组拆分为独立分页
- 支持将 `美国`、`香港`、`日本` 等地区组聚合到 `节点组`
- 新增 `兜底策略` 分组展示
- 节点组支持显示当前实际使用路径
- 关闭代理提供商后，相关节点不会再被策略组偷偷继续使用
- 策略组 / 节点组、二级菜单和侧边栏支持 `无可用节点 / 异常组数` 告警提示
- 新增 `优先使用品牌 SVG 图标源` 开关，支持在品牌图标源与 YAML / 自定义图标之间切换
- 品牌图标源加载失败时，会自动回退到原始图标配置
- 设置导入支持 URL / 本地 JSON 的失败兜底提示，导出文件名统一为 `zashboard-settings.json`

## 安装部署

myboard 有两种安装方式：**完整安装**（独立部署整个面板）或 **增量替换**（在原版 zashboard 基础上替换前端文件）。

---

### 一、完整安装

完整安装后，myboard 作为一个独立面板运行，自带完整的前端页面和后端通信能力。

#### 方式一：Docker 构建部署（推荐）

```bash
# 克隆仓库
git clone https://github.com/PaoGe666/myboard.git
cd myboard

# 构建镜像
docker build -t myboard:latest .

# 启动容器
docker run -d --name myboard -p 8080:80 myboard:latest
```

然后访问 `http://your-ip:8080`

这里的 `8080` 是面板网页的访问端口，不是 Mihomo / Clash API 端口。

#### 方式二：GitHub Pages

仓库已内置 GitHub Pages 工作流，推送到 `main` 后会自动构建并发布 `dist/`，同时生成两个供 OpenClash 自动更新使用的产物：

- `https://paoge666.github.io/myboard/myboard.zip` —— 打包好的 UI 静态文件
- `https://paoge666.github.io/myboard/myboard-version.json` —— 版本 / commit 元数据（myboard 的「UI 更新检测」会读取它对比）

> 部署环境要求：Node.js 22+ 与 `package.json` 中 `packageManager` 声明的 pnpm 版本（构建使用 `pnpm install --frozen-lockfile`）。

#### 方式三：源码构建 + 任意 Web 服务器

```bash
# 克隆仓库
git clone https://github.com/PaoGe666/myboard.git
cd myboard

# 安装依赖
pnpm install

# 构建
pnpm build

# 预览
pnpm preview
```

构建完成后，将 `dist/` 目录部署到任意 Web 服务器（Nginx、Caddy、Cloudflare Pages、Vercel 等）即可。

---

### 二、增量替换（在 OpenClash / ShellCrash 上替换 UI）

适用于 OpenClash、ShellCrash 等已内置原版 zashboard 的工具，只需替换前端文件，保留原有后端。

#### 方式一：external-ui 自动升级（推荐）

myboard 已内置 OpenClash 的 external-ui 逻辑（升级前先写入 `external-ui` / `external-ui-name` / `external-ui-url` 配置，再触发 `/upgrade/ui`）。在 mihomo 配置中声明：

```yaml
external-ui: /usr/share/openclash/ui
external-ui-name: myboard
external-ui-url: https://paoge666.github.io/myboard/myboard.zip
```

重启 OpenClash 后，核心会自动下载并替换 UI。之后每次推送 `main`，Pages 会重建 `myboard.zip` 与 `myboard-version.json`，面板内置的「UI 更新检测」会自动对比并提示/升级，无需手动操作。

#### 方式二：手动替换（离线 / 自定义 UI 路径）

```bash
# 1. 克隆并构建
git clone https://github.com/PaoGe666/myboard.git
cd myboard
pnpm install
pnpm build

# 2. 将构建产物复制到 OpenClash 的 UI 目录
# 替换前建议备份原版 zashboard 目录
cp -r dist/* /etc/openclash/ui/

# 3. 重启 OpenClash
/etc/init.d/openclash restart
```

也可直接下载线上打包好的 `myboard.zip`（见上面的 GitHub Pages 部分）解压到 UI 目录，跳过本地构建。

不同工具的 UI 路径不同，请根据实际工具查找对应目录（OpenClash 常见为 `/etc/openclash/ui/`，部分版本在 `/etc/openclash/web/`）。
myboard 的配置文件与 zashboard 完全兼容（导出文件名统一为 `zashboard-settings.json`），替换后原有配置不会丢失。

---

### 更新命令

后续需要升级到最新版本时，可以直接在现有目录执行更新命令，不需要重新安装。

#### Docker 部署更新

```bash
cd myboard
git pull
docker build --pull --no-cache -t myboard:latest .
docker rm -f myboard
docker run -d --name myboard -p 8080:80 myboard:latest
```

#### 源码构建更新

```bash
cd myboard
git pull
pnpm install
pnpm build
```

更新完成后，继续使用原来的访问地址即可。

如果已经拉到最新代码、容器也已重建，但网页看起来还是旧版本，请优先检查浏览器缓存。

这个项目启用了 PWA，浏览器可能会继续使用旧的静态资源缓存。遇到”仓库已经更新，但页面没有变化”时，按下面顺序处理：

1. 先执行上面的更新命令，确保容器已经重新构建并启动。
2. 打开面板页面后按一次强制刷新：
   - Windows / Linux：`Ctrl + F5` 或 `Ctrl + Shift + R`
   - macOS：`Cmd + Shift + R`
3. 如果还是旧页面，清除当前站点缓存或删除浏览器里的站点数据后再打开。
4. 如果你是以”安装到桌面 / 添加到主屏幕”的 PWA 方式打开，请先关闭旧窗口，再重新打开；必要时卸载旧的 PWA 后重新进入。

如果想快速确认容器里是否已经是新版本，也可以重新构建后查看页面底部或设置中的版本 / commit 信息是否变化。

## 配置使用

部署完成后，访问面板时需要在 URL 中填写 Clash API 的连接信息：

```
http://your-ip:port/#/setup?hostname=你的IP&port=9090&secret=你的密码
```

说明：
- `http://your-ip:8080` 中的 `8080` 是面板访问端口
- URL 参数里的 `port=9090` 是 Mihomo / Clash API 默认控制端口
- 两个端口用途不同，可以分别修改

参数说明：
- `hostname` - Clash API 的 IP 或域名
- `port` - Clash API 端口（默认 9090）
- `secret` - Clash API 密码（可选）

## 当前自定义内容

- `策略组` 中展示高层策略入口
- `节点组` 中展示地区 / 底层节点分组
- 地区节点组支持聚合展示
- 节点组按 auto / manual 拆分为独立标签页，auto 标签仅展示当前自动选中的节点
- 支持对 url-test 自动组节点进行定时自动优化（5分钟周期），自动选择最低延迟节点
- `兜底策略` 支持单独归类
- 支持代理提供商开关，并在关闭后自动从策略选择与路径解析中排除对应节点
- 支持 `节点根据提供商分组` 展示，可在设置中开启
- 策略组 / 节点组支持区分 `无可用节点` 与 `部分异常`
- 侧边栏与二级菜单同步显示告警数量
- 支持品牌 SVG 图标源开关，默认开启
- 自定义 / YAML 图标与品牌图标支持失败回退

## 使用说明

1. 打开面板后，在 `策略组` 中查看高层策略。
2. 在 `节点组` 中查看地区节点池。
3. 若关闭某个代理提供商，相关节点会自动从策略可选项与实际路径中移除。
4. 右键节点或节点组卡片可进行测速。
5. 可在 `设置 -> 策略组` 中切换品牌 SVG 图标源。

## 说明

这个仓库是个人修改版，不再保留原项目 README 中的在线地址、官方 Docker 镜像、赞助说明等内容。若需查看原始项目，请前往：

- [Zephyruso/zashboard](https://github.com/Zephyruso/zashboard)
