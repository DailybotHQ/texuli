/**
 * Draws a fictional harbor at dawn on a canvas and returns it as a JPEG data
 * URL, so the examples need no network and no external asset. Deterministic:
 * the same shapes every time.
 */
export function harborSceneDataUrl(documentRef: Document, width = 960, height = 540): string {
  const canvas = documentRef.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.62);
  sky.addColorStop(0, '#1e3a8a');
  sky.addColorStop(0.55, '#f472b6');
  sky.addColorStop(1, '#fdba74');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(width * 0.68, height * 0.56, height * 0.11, 0, Math.PI * 2);
  ctx.fill();
  const sea = ctx.createLinearGradient(0, height * 0.6, 0, height);
  sea.addColorStop(0, '#0e7490');
  sea.addColorStop(1, '#082f49');
  ctx.fillStyle = sea;
  ctx.fillRect(0, height * 0.6, width, height * 0.4);
  ctx.strokeStyle = 'rgba(253, 230, 138, 0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    const y = height * (0.66 + i * 0.045);
    ctx.beginPath();
    ctx.moveTo(width * (0.58 - i * 0.02), y);
    ctx.lineTo(width * (0.78 + i * 0.02), y);
    ctx.stroke();
  }
  // The pier, on the inline start of the picture.
  ctx.fillStyle = '#3f2a1d';
  ctx.fillRect(0, height * 0.58, width * 0.34, height * 0.05);
  for (let i = 0; i < 6; i++)
    ctx.fillRect(width * (0.02 + i * 0.06), height * 0.6, 10, height * 0.16);
  // A small boat.
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(width * 0.42, height * 0.7);
  ctx.lineTo(width * 0.54, height * 0.7);
  ctx.lineTo(width * 0.51, height * 0.76);
  ctx.lineTo(width * 0.45, height * 0.76);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e11d48';
  ctx.beginPath();
  ctx.moveTo(width * 0.48, height * 0.69);
  ctx.lineTo(width * 0.48, height * 0.52);
  ctx.lineTo(width * 0.535, height * 0.69);
  ctx.closePath();
  ctx.fill();
  return canvas.toDataURL('image/jpeg', 0.88);
}
