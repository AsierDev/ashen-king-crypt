export function markScene(key: string): void {
  const d = document.body.dataset;
  d.scene = key;
  d.sceneSeq = String(Number(d.sceneSeq ?? '0') + 1);
}
