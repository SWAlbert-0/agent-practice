// 类型由目录声明；新增类图、状态图等类型时自动进入筛选列表。
export function diagramKinds(scenes) {
  const counts = new Map();
  for (const scene of scenes) counts.set(scene.kind, (counts.get(scene.kind) || 0) + 1);
  return [...counts].map(([kind, count]) => ({kind, count}));
}

export function filterDiagrams(scenes, kind) {
  return kind ? scenes.filter(scene => scene.kind === kind) : scenes;
}
