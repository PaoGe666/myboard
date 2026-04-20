# myboard

<p align="center">
  <img src="./readme/pc.png" height="300">
  <img src="./readme/mobile.png" height="300">
</p>

`myboard` 是基于 [`zashboard`](https://github.com/Zephyruso/zashboard) 修改的中文自用版本，主要针对 Mihomo / OpenClash 配置做了更清晰的策略组、节点组、订阅提供商与图标展示。

## 功能特点

- 将原来的 `代理` 视图重命名为 `策略组`
- 将高层策略组和地区节点组拆分为独立分页
- 支持将 `美国`、`香港`、`日本` 等地区组聚合到 `节点组`
- 新增 `兜底策略` 分组展示
- 节点组支持显示当前实际使用路径
- 关闭代理提供商后，相关节点不会再被策略组偷偷继续使用
- 策略组、节点组、二级菜单和侧边栏支持 `无可用节点 / 异常组数` 告警提示
- 新增 `优先使用品牌 SVG 图标源` 开关，支持在品牌图标源与 YAML / 自定义图标之间切换
- 品牌图标源加载失败时，会自动回退到原始图标配置
- 设置导入支持 URL / 本地 JSON 的失败兜底提示，导出文件名统一为 `zashboard-settings.json`

## 安装部署

### 方式一：Docker 构建部署（推荐）

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

### 方式二：源码构建

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

构建完成后，将 `dist/` 目录部署到任意 Web 服务器（Nginx、Caddy 等）即可。

### 方式三：GitHub Pages

仓库已内置 GitHub Pages 工作流，推送到 `main` 后会自动构建并发布 `dist/`。

## 更新命令

后续需要升级到最新版本时，可以直接在现有目录执行更新命令，不需要重新安装。

### Docker 部署更新

```bash
cd myboard
git pull
docker build --pull --no-cache -t myboard:latest .
docker rm -f myboard
docker run -d --name myboard -p 8080:80 myboard:latest
```

### 源码构建更新

```bash
cd myboard
git pull
pnpm install
pnpm build
```

更新完成后，继续使用原来的访问地址即可。

如果已经拉到最新代码、容器也已重建，但网页看起来还是旧版本，请优先检查浏览器缓存。

这个项目启用了 PWA，浏览器可能会继续使用旧的静态资源缓存。遇到“仓库已经更新，但页面没有变化”时，按下面顺序处理：

1. 先执行上面的更新命令，确保容器已经重新构建并启动。
2. 打开面板页面后按一次强制刷新：
   - Windows / Linux：`Ctrl + F5` 或 `Ctrl + Shift + R`
   - macOS：`Cmd + Shift + R`
3. 如果还是旧页面，清除当前站点缓存或删除浏览器里的站点数据后再打开。
4. 如果你是以“安装到桌面 / 添加到主屏幕”的 PWA 方式打开，请先关闭旧窗口，再重新打开；必要时卸载旧的 PWA 后重新进入。

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

## 部署环境

构建后的 `dist/` 是纯静态文件，可部署到：

- Nginx / Caddy
- Docker
- Cloudflare Pages
- GitHub Pages
- Vercel
- 任意 Web 服务器

## 当前自定义内容

- `策略组` 中展示高层策略入口
- `节点组` 中展示地区 / 底层节点分组
- 地区节点组支持聚合展示
- `兜底策略` 支持单独归类
- 支持代理提供商开关，并在关闭后自动从策略选择与路径解析中排除对应节点
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
