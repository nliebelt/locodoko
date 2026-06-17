import type Phaser from 'phaser';

/**
 * Klippt den Inhalt eines Containers auf ein achsenparalleles Rechteck (Weltkoordinaten).
 *
 * Hintergrund Phaser 4: Geometry-Masken (`createGeometryMask` + `setMask`) werden im
 * WebGL-Renderer nicht mehr unterstützt — `setMask` ist dort ein No-op und gibt nur noch
 * eine Konsolenwarnung aus. Ersatz ist ein **externer Mask-Filter** mit einer weißen
 * Rechteck-Shape, betrachtet durch die Haupt-Kamera. Das ist verhaltensgleich zur alten
 * Geometry-Mask: Die Maske liegt fix im Weltraum, der Inhalt scrollt darunter und wird
 * auf das Rechteck beschnitten.
 *
 * `enableFilters()` ist WebGL-only und liefert in Canvas-/Headless-Umgebungen (z. B. den
 * jsdom-Unit-Tests) keine `filters`-Struktur — in dem Fall wird sauber ohne Maske
 * zurückgekehrt.
 *
 * @param zentrumX Welt-X des Rechteck-Mittelpunkts
 * @param zentrumY Welt-Y des Rechteck-Mittelpunkts
 * @returns Die als Maskenquelle erzeugte Shape (zum Aufräumen beim Destroy) oder `null`,
 *          falls keine Filter verfügbar sind (Canvas/Headless).
 */
export function setzeRechteckMaske(
  scene: Phaser.Scene,
  ziel: Phaser.GameObjects.Container,
  zentrumX: number,
  zentrumY: number,
  breite: number,
  hoehe: number
): Phaser.GameObjects.Rectangle | null {
  ziel.enableFilters();
  if (!ziel.filters) {
    return null;
  }

  const shape = scene.add.rectangle(zentrumX, zentrumY, breite, hoehe, 0xffffff);
  // Shape dient nur als Maskenquelle und soll nicht selbst gezeichnet werden.
  scene.children.remove(shape);
  ziel.filters.external.addMask(shape, false, scene.cameras.main);

  return shape;
}
