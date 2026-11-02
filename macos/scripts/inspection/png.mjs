import { inflateSync } from 'node:zlib';

// Chromium's captureScreenshot emits non-interlaced 8-bit RGB/RGBA PNGs.
// Unsupported formats are reported as unknown, never guessed as a pass.
export function readScreenshotPng(bytes) {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Invalid PNG');
  let width, height, channels, ended = false;
  const chunks = [];
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    if (start + length + 4 > bytes.length) throw new Error('Truncated PNG');
    if (type === 'IHDR') {
      if (length !== 13) throw new Error('Invalid PNG header');
      width = bytes.readUInt32BE(start); height = bytes.readUInt32BE(start + 4);
      const depth = bytes[start + 8], color = bytes[start + 9];
      channels = color === 2 ? 3 : color === 6 ? 4 : null;
      if (!channels || depth !== 8 || bytes[start + 10] || bytes[start + 11] || bytes[start + 12]
        || !width || !height || width * height > 32_000_000) throw new Error('Unsupported screenshot PNG format/size');
    } else if (type === 'IDAT') chunks.push(bytes.subarray(start, start + length));
    else if (type === 'IEND') { ended = true; break; }
    offset = start + length + 4;
  }
  if (!channels || !chunks.length || !ended) throw new Error('Incomplete PNG');
  const stride = width * channels, size = (stride + 1) * height;
  const packed = inflateSync(Buffer.concat(chunks), { maxOutputLength: size });
  if (packed.length !== size) throw new Error('Invalid PNG data length');
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = packed[y * (stride + 1)];
    if (filter > 4) throw new Error('Unsupported PNG filter');
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const a = x >= channels ? pixels[i - channels] : 0, b = y ? pixels[i - stride] : 0;
      const c = y && x >= channels ? pixels[i - stride - channels] : 0;
      const predictor = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter];
      pixels[i] = (packed[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  return { width, height, channels, pixels };
}
export function inspectScreenshotPopovers(bytes, popovers, viewport) {
  const { width, height, channels, pixels } = readScreenshotPng(bytes);
  const scaleX = width / viewport.width, scaleY = height / viewport.height;
  return popovers.map(({ kind, rect }) => {
    let bright = 0, total = 0;
    // Sample the interior of visible semantic popovers, not arbitrary white
    // images/messages. A bright result remains a candidate for human review.
    const left = Math.max(0, Math.ceil((rect.x + 4) * scaleX));
    const right = Math.min(width, Math.floor((rect.x + rect.width - 4) * scaleX));
    const top = Math.max(0, Math.ceil((rect.y + 4) * scaleY));
    const bottom = Math.min(height, Math.floor((rect.y + rect.height - 4) * scaleY));
    for (let y = top; y < bottom; y += Math.max(1, Math.round(4 * scaleY))) {
      for (let x = left; x < right; x += Math.max(1, Math.round(4 * scaleX))) {
        const i = (y * width + x) * channels;
        total++;
        if (pixels[i] > 220 && pixels[i + 1] > 220 && pixels[i + 2] > 220
          && (channels === 3 || pixels[i + 3] > 250)) bright++;
      }
    }
    const fraction = total ? bright / total : null;
    return { kind, rect, brightFraction: fraction, status: fraction === null ? 'unknown' : fraction > 0.4 ? 'warn' : 'pass' };
  });
}

export function inspectScreenshotEdges(bytes) {
  const { width, height, channels, pixels } = readScreenshotPng(bytes);
  const candidates = [];
  const bright = (x, y) => {
    const i = (y * width + x) * channels;
    return pixels[i] > 235 && pixels[i + 1] > 235 && pixels[i + 2] > 235 && (channels === 3 || pixels[i + 3] > 250);
  };
  // Each candidate is a continuous patch, reducing isolated text/star false positives.
  for (const side of ['top', 'bottom', 'left', 'right']) {
    const horizontal = ['top', 'bottom'].includes(side);
    const length = horizontal ? width : height;
    for (const inset of [0, 2, 8]) {
      if (inset >= Math.min(width, height)) continue;
      for (let pos = 8; pos < length - 8; pos += 16) {
        let count = 0;
        for (let delta = -6; delta <= 6; delta++) {
          const x = horizontal ? pos + delta : side === 'left' ? inset : width - 1 - inset;
          const y = horizontal ? side === 'top' ? inset : height - 1 - inset : pos + delta;
          if (bright(x, y)) count++;
        }
        if (count >= 11) candidates.push({ side, inset, position: pos });
      }
    }
  }
  return { width, height, status: candidates.length ? 'warn' : 'pass', candidates };
}
