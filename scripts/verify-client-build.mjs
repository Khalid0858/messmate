import { access } from 'node:fs/promises';
for (const file of ['index.html','robots.txt','sitemap.xml','favicon.svg','social-preview.png']) {
  await access(new URL('../client/dist/' + file, import.meta.url));
}
console.log('Verified frontend entry and public SEO assets');
