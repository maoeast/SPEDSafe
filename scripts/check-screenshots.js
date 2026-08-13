/**
 * 截图质量自检（无图像视觉能力时的替代校验）：
 * 解析 PNG（IHDR + zlib 解压 + 反滤波），输出尺寸、平均亮度、色彩数、四角与中心采样。
 * 用法：node scripts/check-screenshots.js [文件名]
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIR = path.join(__dirname, '..', 'docs', 'manual-images');
const only = process.argv[2];

function parsePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let off = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  if (interlace !== 0) throw new Error('不支持隔行 PNG');
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!channels || bitDepth !== 8) throw new Error(`不支持的格式 colorType=${colorType} bitDepth=${bitDepth}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height * channels);
  let pos = 0;
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const row = raw.subarray(pos, pos + stride);
    pos += stride;
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = x >= channels && prev ? prev[x - channels] : 0;
      let v = row[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      out[x] = v & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

function sample(png, x, y, w, h) {
  const { width, height, channels, pixels } = png;
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(width, Math.ceil(x + w)), y1 = Math.min(height, Math.ceil(y + h));
  let r = 0, g = 0, b = 0, n = 0;
  const colors = new Set();
  for (let py = y0; py < y1; py += 2) {
    for (let px = x0; px < x1; px += 2) {
      const i = (py * width + px) * channels;
      r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2];
      n++;
      colors.add(((pixels[i] >> 4) << 8) | ((pixels[i + 1] >> 4) << 4) | (pixels[i + 2] >> 4));
    }
  }
  return {
    avg: `rgb(${(r / n) | 0},${(g / n) | 0},${(b / n) | 0})`,
    colors: colors.size,
    n,
  };
}

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.png')).sort()) {
  if (only && !file.includes(only)) continue;
  try {
    const png = parsePng(fs.readFileSync(path.join(DIR, file)));
    const center = sample(png, png.width * 0.25, png.height * 0.25, png.width * 0.5, png.height * 0.5);
    const tl = sample(png, 0, 0, png.width * 0.2, png.height * 0.2);
    const br = sample(png, png.width * 0.8, png.height * 0.8, png.width * 0.2, png.height * 0.2);
    console.log(
      `${file.padEnd(22)} ${String(png.width).padStart(4)}x${String(png.height).padStart(4)} 中:${center.avg}(${center.colors}) 左上:${tl.avg} 右下:${br.avg}`
    );
  } catch (e) {
    console.log(`${file} ❌ ${e.message}`);
  }
}
