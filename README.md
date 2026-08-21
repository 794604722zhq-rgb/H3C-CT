# 新华三产品智能选型助手

这是两个新华三产品选型助手的 GitHub Pages 静态版本：

- `h3c-selector/`：新华三正式交换机与无线产品选型助手，包含招标引导功能。
- `xiaobei-selector/`：小贝优选分销产品选型工具。

## 在线使用

- 助手首页：<https://794604722zhq-rgb.github.io/H3C-CT/>
- GitHub 仓库：<https://github.com/794604722zhq-rgb/H3C-CT>

网页所需的程序、产品数据库和招标引导均已包含在仓库中。更换电脑后，直接访问在线地址即可使用；需要继续修改时，再克隆仓库。

## 本地查看

直接打开根目录的 `index.html`，或使用任意静态文件服务器打开本目录。

新电脑恢复：

```text
git clone https://github.com/794604722zhq-rgb/H3C-CT.git
```

克隆完成后打开 `H3C-CT/index.html`。详细的目录说明、匹配规则和新账号接续方式见 [继续维护说明](docs/继续维护说明.md)。

## 发布到 GitHub Pages

1. 在 GitHub 创建仓库，建议设置为私有仓库。
2. 将本目录提交并推送到仓库的 `main` 分支。
3. 在仓库 `Settings → Pages` 中，将 Source 选择为 `GitHub Actions`。
4. 推送后，`.github/workflows/pages.yml` 会自动发布网站。

## 重要安全提示

正式产品助手包含招标引导、竞品对比及内部参数说明。请勿在未完成内容审查的情况下发布到公开仓库或公开 GitHub Pages。即使仓库设为私有，也需要确认当前 GitHub 套餐下 Pages 网站的可见性设置符合内部资料要求。

## 数据说明

网页数据已经内置，不依赖 Excel 文件或 Windows 启动脚本。产品参数、价格和供货状态仍需以新华三官网及最新渠道政策为准。

源 Excel、价格源表和 Windows 启动脚本未提交到此公开仓库；它们不影响网页助手运行。如需把这些原始资料也做云端备份，建议另建私有仓库或使用私有云盘。
