export type SpielerPosition = 'SUED' | 'WEST' | 'NORD' | 'OST';

export interface SpielerAnsicht {
  position: SpielerPosition;
  name: string;
  istMensch: boolean;
  verbleibendeKarten: number;
  stiche: number;
}

export interface TischAnsichtModell {
  titel: string;
  debugModus: boolean;
  spieler: SpielerAnsicht[];
}

export function erstelleStandardTischAnsicht(spielerName: string): TischAnsichtModell {
  return {
    titel: 'Loco Doko',
    debugModus: false,
    spieler: [
      { position: 'SUED', name: spielerName, istMensch: true, verbleibendeKarten: 12, stiche: 0 },
      { position: 'WEST', name: 'KI West', istMensch: false, verbleibendeKarten: 12, stiche: 0 },
      { position: 'NORD', name: 'KI Nord', istMensch: false, verbleibendeKarten: 12, stiche: 0 },
      { position: 'OST', name: 'KI Ost', istMensch: false, verbleibendeKarten: 12, stiche: 0 }
    ]
  };
}
