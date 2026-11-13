// One vector master for the PWA, Apple touch icon, and browser favicon.
const fs = require("node:fs/promises");
const sharp = require("sharp");
async function main() {
  const source = await fs.readFile("public/brand/club-icon.svg");
  for (const [name, size] of [
    ["icon-1024", 1024],
    ["icon-512", 512],
    ["icon-maskable-512", 512],
    ["icon-192", 192],
    ["apple-touch-icon", 180],
  ]) {
    await sharp(source)
      .resize(size, size)
      .png()
      .toFile(`public/icons/${name}.png`);
  }
  const sizes = [16, 32, 48];
  const images = await Promise.all(
    sizes.map((size) => sharp(source).resize(size, size).png().toBuffer()),
  );
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  images.forEach((png, i) => {
    const start = 6 + 16 * i;
    header[start] = sizes[i];
    header[start + 1] = sizes[i];
    header.writeUInt16LE(1, start + 4);
    header.writeUInt16LE(32, start + 6);
    header.writeUInt32LE(png.length, start + 8);
    header.writeUInt32LE(offset, start + 12);
    offset += png.length;
  });
  await fs.writeFile("app/favicon.ico", Buffer.concat([header, ...images]));
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
