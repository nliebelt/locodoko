package de.locodoko.partie;

/** Synchronisiert abgeleitete Persistenzfelder eines {@link Spiel}. */
class SpielPersistenzSync {

    static void sync(Spiel spiel) {
        if (spiel.spielregeln == null) {
            return;
        }
        spiel.synchronisierePersistenzFelder();
    }
}
