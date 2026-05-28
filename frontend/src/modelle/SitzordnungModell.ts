import { SPIELER_POSITION } from './SpielverwaltungDto';
import type { SpielerPosition as BackendSpielerPosition } from './SpielverwaltungDto';

/** Relative Sitzposition eines Spielers aus Sicht des eigenen Spielers (SUED = ich). */
export type SpielerPosition = 'SUED' | 'WEST' | 'NORD' | 'OST';

export const POSITIONEN: SpielerPosition[] = [SPIELER_POSITION.SUED, SPIELER_POSITION.WEST, SPIELER_POSITION.NORD, SPIELER_POSITION.OST];
export const ABSOLUTE_POSITIONEN: BackendSpielerPosition[] = [SPIELER_POSITION.SUED, SPIELER_POSITION.WEST, SPIELER_POSITION.NORD, SPIELER_POSITION.OST];

export function mappeRelativePositionOhneNull(
  position: BackendSpielerPosition,
  bezugPosition: BackendSpielerPosition
): SpielerPosition {
  return mappeRelativePosition(position, bezugPosition) ?? SPIELER_POSITION.SUED;
}

export function mappeRelativePosition(
  position: BackendSpielerPosition | null,
  bezugPosition: BackendSpielerPosition
): SpielerPosition | null {
  if (position === null) {
    return null;
  }
  const positionsIndex = ABSOLUTE_POSITIONEN.indexOf(position);
  const bezugsIndex = ABSOLUTE_POSITIONEN.indexOf(bezugPosition);
  if (positionsIndex < 0 || bezugsIndex < 0) {
    return position as SpielerPosition;
  }
  return POSITIONEN[(positionsIndex - bezugsIndex + POSITIONEN.length) % POSITIONEN.length];
}
