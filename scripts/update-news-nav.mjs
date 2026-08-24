import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let changed = 0;

for (const name of fs.readdirSync(root)) {
  if (!name.toLowerCase().endsWith(".html")) continue;
  const file = path.join(root, name);
  const html = fs.readFileSync(file, "utf8");
  let next = html;

  next = next.replace(/<a href="underconst\.html">News<\/a>/g, '<a href="news.html">News</a>');
  next = next.replace(/<a href="underconst\.html">Blog<\/a>/g, '<a href="blog.html">Blog</a>');

  if (next !== html) {
    fs.writeFileSync(file, next, "utf8");
    changed += 1;
  }
}

console.log(`Updated News/Blog navigation in ${changed} HTML files.`);
