import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const entry = path.resolve(root, 'src/userscripts/control-panel/src/index.js');
const outfile = path.resolve(root, 'src/userscripts/control-panel/index.user.js');

const metadata = `// ==UserScript==\n`
  + `// @name         刷新马 + 景阳岗控制面板（含限速检测, 继续为a标签）\n`
  + `// @namespace    http://tampermonkey.net/\n`
  + `// @version      1.5\n`
  + `// @description  模块化控制面板：刷新马 & 景阳岗模块默认关闭且开关持久化；出现“您的点击频度过快”时暂停并在1秒后自动点文本为“继续”的<a>再恢复；景阳岗模块优先检测带“攻击”的项\n`
  + `// @match        http://81.68.161.24/*\n`
  + `// @grant        none\n`
  + `// ==/UserScript==\n`;

await build({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  outfile,
  banner: { js: metadata },
  target: ['es2017'],
});
