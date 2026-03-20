import { describe, expect, it } from 'vitest';
import { erstelleStandardTischAnsicht } from './TischAnsichtModell';

describe('erstelleStandardTischAnsicht', () => {
  it('positioniert den Menschen im Sueden und drei KI-Spieler an den anderen Plaetzen', () => {
    const modell = erstelleStandardTischAnsicht('Spieler Süd');

    expect(modell.debugModus).toBe(false);
    expect(modell.spieler).toHaveLength(4);
    expect(modell.spieler[0]).toMatchObject({ position: 'SUED', name: 'Spieler Süd', istMensch: true });
    expect(modell.spieler.slice(1).map((spieler) => spieler.position)).toEqual(['WEST', 'NORD', 'OST']);
    expect(modell.spieler.slice(1).every((spieler) => !spieler.istMensch)).toBe(true);
  });

  it('legt fuer alle Spieler die Kartenanzahl des Normalspiels an', () => {
    const modell = erstelleStandardTischAnsicht('Spieler Süd');

    expect(modell.spieler.map((spieler) => spieler.verbleibendeKarten)).toEqual([12, 12, 12, 12]);
  });
});
