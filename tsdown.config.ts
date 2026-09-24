import { defineConfig } from 'tsdown'

/** 包名（__ModuleLoader__ 注册 id）。 */
const PACKAGE_NAME = 'dsh-workspace-combiner'

/**
 * 双入口独立构建：host 与 client 分别成包，避免共享模块被拆成相对 chunk
 * （DSH 浏览器端 __ModuleLoader__ 只加载单一 client.js，无法解析相对 chunk）。
 *
 * - host 半面：node ESM，node:/@deepseek-ai/* 外部化 -> lib/host/index.js
 * - client 半面：浏览器 CJS，包成 window.__ModuleLoader__.load({...}) 单文件
 *   （与 dsh-community-market / 多根插件同套路）-> lib/client.js
 */
export default defineConfig([
  // ---- host 半面 ----
  {
    name: `${PACKAGE_NAME}/host`,
    entry: { 'host/index': 'src/host/index.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    fixedExtension: false,
    dts: true,
    clean: true,
    sourcemap: true,
    deps: { neverBundle: [/^node:/, /^@deepseek-ai\//, /^@chaoset\//] },
  },
  // ---- client 半面 ----
  {
    name: `${PACKAGE_NAME}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    fixedExtension: false,
    dts: false,
    clean: false,
    sourcemap: true,
    deps: { neverBundle: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', /^@deepseek-ai\//, /^@chaoset\//] },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])