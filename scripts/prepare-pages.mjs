import { readFileSync } from 'node:fs';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const pagesBaseHref = '/';
export const pagesCname = 'transient.notarist.art';

export function readShippedCname() {
  return readFileSync(new URL('../public/CNAME', import.meta.url), 'utf8').trim();
}

/** Point the exported page at the domain root and keep it out of search indexes. */
export function prepareHtml(html) {
  let next = html;
  if (/<base\b/i.test(next)) {
    next = next.replace(/<base\b[^>]*>/i, `<base href="${pagesBaseHref}" />`);
  } else {
    next = next.replace('<head>', `<head>\n    <base href="${pagesBaseHref}" />`);
  }
  if (!next.includes('name="robots"')) {
    next = next.replace('<head>', '<head>\n    <meta name="robots" content="noindex, nofollow" />');
  }
  return next;
}

async function main() {
  const dist = path.resolve('dist');
  const indexPath = path.join(dist, 'index.html');
  const html = await readFile(indexPath, 'utf8');
  await writeFile(indexPath, prepareHtml(html));
  await copyFile(indexPath, path.join(dist, '404.html'));
  await writeFile(path.join(dist, 'CNAME'), `${pagesCname}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
