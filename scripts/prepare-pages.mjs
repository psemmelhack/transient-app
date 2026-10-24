import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
const indexPath = path.join(dist, 'index.html');
let html = await readFile(indexPath, 'utf8');

if (!html.includes('<base ')) {
  html = html.replace('<head>', '<head>\n    <base href="/transient-app/" />');
}
if (!html.includes('name="robots"')) {
  html = html.replace('<head>', '<head>\n    <meta name="robots" content="noindex, nofollow" />');
}

await writeFile(indexPath, html);
await copyFile(indexPath, path.join(dist, '404.html'));
