# 本地 Mermaid

`mermaid.js` 是 Mermaid **11.17.2** 的 ESM 打包产物，按需加载，不访问 CDN。Mermaid 使用 MIT 许可证，见 `MERMAID-LICENSE.txt`；依赖的许可证注释保留在 bundle 中。

普通预览无需 npm。需要升级时，在独立临时目录安装固定版本，使用 esbuild 打包 `mermaid/dist/mermaid.core.mjs`：

```powershell
npm.cmd install --prefix "$env:TEMP/hello-agent-diagrams" --no-save --package-lock=false mermaid@11.17.2 esbuild
& "$env:TEMP/hello-agent-diagrams/node_modules/.bin/esbuild.cmd" "$env:TEMP/hello-agent-diagrams/node_modules/mermaid/dist/mermaid.core.mjs" --bundle --format=esm --minify --legal-comments=eof --outfile=web/vendor/mermaid.js
Copy-Item "$env:TEMP/hello-agent-diagrams/node_modules/mermaid/LICENSE" web/vendor/MERMAID-LICENSE.txt
```

升级后应检查全部文档图的解析、渲染和源码绑定。不要手改压缩产物。当前 bundle 约 3.3 MB，仅首次进入流程图视图时加载。
