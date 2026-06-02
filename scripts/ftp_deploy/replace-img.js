const fs = require("fs");
const path = require("path");

const repo = process.env.REPO_NAME;
if (!repo) {
  console.error("❌ REPO_NAME env variable is not set!");
  process.exit(1);
}

const timestamp = Date.now();

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath));
    } else if (/\.(html|php)$/i.test(file)) {
      results.push(filePath);
    }
  });

  return results;
}

const files = getFiles(".");

files.forEach(file => {
  let content = fs.readFileSync(file, "utf8");

  const htmlFolder = path.dirname(file).replace(/^\.\//, "");
  console.log(`\n📄 Processing: ${file} (folder: ${htmlFolder})`);

  // -------------------------
  // Replace <img src="">
  // -------------------------
  content = content.replace(
    /<img\b([^>]*)\bsrc=(["'])([^"']+)\2/gi,
    (match, attrs, quote, src) => {
      if (/^https?:\/\//i.test(src)) return match; // external
      if (/\bno-cdn\b/i.test(attrs)) return match; // no-cdn

      // Determine path relative to repo
      let relativePath;
      if (src.startsWith("/")) {
        relativePath = src.replace(/^\/+/, "");
      } else {
        relativePath = path.join(htmlFolder, src).replace(/\\/g, "/");
      }

      // Force .webp
      relativePath = relativePath.replace(/\.\w+$/i, ".webp");

      // Append timestamp if not already present
      const newSrc = /\?v=\d+/.test(relativePath)
        ? `https://d3j6ngx7p7lglj.cloudfront.net/${repo}/${relativePath}`
        : `https://d3j6ngx7p7lglj.cloudfront.net/${repo}/${relativePath}?v=${timestamp}`;

      return match.replace(src, newSrc);
    }
  );

  // -------------------------
  // Replace srcset
  // -------------------------
  content = content.replace(
    /srcset=(["'])([^"']+)\1/gi,
    (match, quote, srcset) => {
      const updated = srcset
        .split(",")
        .map(entry => {
          let [url, size] = entry.trim().split(/\s+/);
          if (/^https?:\/\//i.test(url)) return entry;

          let relativePath;
          if (url.startsWith("/")) {
            relativePath = url.replace(/^\/+/, "");
          } else {
            relativePath = path.join(htmlFolder, url).replace(/\\/g, "/");
          }

          // Force .webp
          relativePath = relativePath.replace(/\.\w+$/i, ".webp");

          const newUrl = /\?v=\d+/.test(relativePath)
            ? `https://d3j6ngx7p7lglj.cloudfront.net/${repo}/${relativePath}`
            : `https://d3j6ngx7p7lglj.cloudfront.net/${repo}/${relativePath}?v=${timestamp}`;

          return `${newUrl}${size ? " " + size : ""}`;
        })
        .join(", ");

      return `srcset=${quote}${updated}${quote}`;
    }
  );

  fs.writeFileSync(file, content, "utf8");
  console.log(`✅ Updated all images to .webp`);
});