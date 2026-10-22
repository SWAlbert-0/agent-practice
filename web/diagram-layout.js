// 固定阅读模式优先完整展示，但不把文字无限缩小。
export const MIN_FIXED_ZOOM = 0.9;

export function fixedDiagramLayout(size, width, height, zoom) {
  const padding = 24;
  const fitted = Math.min(1, (width - padding * 2) / size.width, (height - padding * 2) / size.height);
  const scale = Math.max(MIN_FIXED_ZOOM, Math.min(3, zoom ?? fitted));
  const contentWidth = Math.max(width, size.width * scale + padding * 2);
  const contentHeight = Math.max(height, size.height * scale + padding * 2);
  return {
    zoom: scale,
    width: contentWidth,
    height: contentHeight,
    x: (contentWidth - size.width * scale) / 2,
    y: (contentHeight - size.height * scale) / 2,
  };
}
