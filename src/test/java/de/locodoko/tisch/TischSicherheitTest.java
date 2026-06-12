package de.locodoko.tisch;

import de.locodoko.karten.Spielregeln;
import de.locodoko.partie.PartieId;
import de.locodoko.spieler.LocodokoBenutzerdienst;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerId;
import de.locodoko.spieler.SpielerRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pure-JUnit-Test fuer {@link TischSicherheit}.
 *
 * <p>Warum diese Tests wichtig sind:
 * <ul>
 *   <li>Die Guard-Logik schuetzt Tischkonfiguration und private Spielstaende vor unbefugtem Zugriff.
 *       Ein Fehler hier wuerde einem beliebigen eingeloggten Spieler erlauben, fremde Tische zu
 *       konfigurieren oder private Spielstaende auszulesen.</li>
 *   <li>Drei unterschiedliche Auth-Pfade (Passwort-Login, OAuth2, Session-Fallback) mussen
 *       alle korrekt eine Spieler-ID liefern — ein fehlerhafter Pfad wuerde Nutzer einer
 *       Auth-Methode still aussperren oder Zugriff gewaehren.</li>
 *   <li>KI-Spieler muessen ueber den Session-Fallback gefiltert werden, damit sie sich nicht
 *       als menschliche Gastgeber ausgeben koennen.</li>
 * </ul>
 */
class TischSicherheitTest {

    private TischSicherheit tischSicherheit;
    private FakeTischRepository tischRepository;
    private FakeSpielerRepository spielerRepository;

    @BeforeEach
    void setUp() {
        tischRepository = new FakeTischRepository();
        spielerRepository = new FakeSpielerRepository();
        tischSicherheit = new TischSicherheit(tischRepository, spielerRepository);
    }

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
    }

    // === istGastgeber() — Null / Anonymous ===

    @Test
    void nullAuthentication_istGastgeber_gibtFalseZurueck() {
        // Unauthentifizierte Anfragen erhalten keinen Gastgeber-Status
        assertFalse(tischSicherheit.istGastgeber(UUID.randomUUID(), null));
    }

    @Test
    void anonymousAuthentication_keinSession_istGastgeber_gibtFalseZurueck() {
        // AnonymousAuthenticationToken wird ignoriert; kein Session-Kontext im Test → false
        Authentication anonym = new AnonymousAuthenticationToken(
                "test-key", "anonymousUser",
                List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));
        assertFalse(tischSicherheit.istGastgeber(UUID.randomUUID(), anonym));
    }

    // === istGastgeber() — Passwort-Login (SpielerUserDetails) ===

    @Test
    void passwortLogin_korrekterId_istGastgeber_gibtTrueZurueck() {
        // Nur der Tisch-Ersteller darf Konfigurationen aendern
        SpielerEntity gastgeber = SpielerEntity.menschlich("Alice", "session-alice");
        tischRepository.tischToReturn = tischMitGastgeber(gastgeber);

        assertTrue(tischSicherheit.istGastgeber(UUID.randomUUID(), mitUserDetails(gastgeber)));
    }

    @Test
    void passwortLogin_andereId_istGastgeber_gibtFalseZurueck() {
        // Fremde Spieler duerfen den Tisch nicht uebernehmen
        SpielerEntity gastgeber = SpielerEntity.menschlich("Alice", "session-alice");
        SpielerEntity fremder = SpielerEntity.menschlich("Bob", "session-bob");
        tischRepository.tischToReturn = tischMitGastgeber(gastgeber);

        assertFalse(tischSicherheit.istGastgeber(UUID.randomUUID(), mitUserDetails(fremder)));
    }

    @Test
    void passwortLogin_tischNichtGefunden_istGastgeber_gibtFalseZurueck() {
        // Ungueltige TischId fuehrt nicht zu NPE, sondern zu sauberem false
        SpielerEntity gastgeber = SpielerEntity.menschlich("Alice", "session-alice");
        tischRepository.tischToReturn = null;

        assertFalse(tischSicherheit.istGastgeber(UUID.randomUUID(), mitUserDetails(gastgeber)));
    }

    // === istGastgeber() — OAuth2-Login ===

    @Test
    void oauth2Login_korrekteSub_istGastgeber_gibtTrueZurueck() {
        // Google-Login-Spieler muessen ebenfalls als Gastgeber erkannt werden
        SpielerEntity gastgeber = SpielerEntity.menschlich("Alice", "session-alice");
        tischRepository.tischToReturn = tischMitGastgeber(gastgeber);
        spielerRepository.spielerNachExternalId = gastgeber;

        assertTrue(tischSicherheit.istGastgeber(UUID.randomUUID(), mitOauth2("google-sub-alice")));
    }

    @Test
    void oauth2Login_falscheSub_istGastgeber_gibtFalseZurueck() {
        // OAuth2-Spieler mit fremder Sub-ID darf nicht als Gastgeber gelten
        SpielerEntity gastgeber = SpielerEntity.menschlich("Alice", "session-alice");
        SpielerEntity fremder = SpielerEntity.menschlich("Bob", "session-bob");
        tischRepository.tischToReturn = tischMitGastgeber(gastgeber);
        spielerRepository.spielerNachExternalId = fremder;

        assertFalse(tischSicherheit.istGastgeber(UUID.randomUUID(), mitOauth2("google-sub-bob")));
    }

    @Test
    void oauth2LoginOhneSub_istGastgeber_gibtFalseZurueck() {
        // OAuth2-Token ohne sub-Claim ist unvollstaendig → kein Zugriff
        assertFalse(tischSicherheit.istGastgeber(UUID.randomUUID(), mitOauth2(null)));
    }

    // === istGastgeber() — Session-Fallback (Gast-Spieler) ===

    @Test
    void sessionFallback_menschlicherSpieler_istGastgeber_gibtTrueZurueck() {
        // Gast-Spieler ohne Spring-Security-Kontext greifen ueber HTTP-Session zu
        SpielerEntity gastgeber = SpielerEntity.menschlich("Alice", "session-alice");
        tischRepository.tischToReturn = tischMitGastgeber(gastgeber);
        spielerRepository.spielerNachSessionId = gastgeber;
        setzeSessionKontext("session-alice");

        assertTrue(tischSicherheit.istGastgeber(UUID.randomUUID(), null));
    }

    @Test
    void sessionFallback_kiSpielerGefiltert_istGastgeber_gibtFalseZurueck() {
        // KI-Spieler duerfen sich nicht per Session als Gastgeber ausgeben
        SpielerEntity ki = SpielerEntity.ki("KI-Spieler");
        spielerRepository.spielerNachSessionId = ki;
        setzeSessionKontext("session-ki");

        assertFalse(tischSicherheit.istGastgeber(UUID.randomUUID(), null));
    }

    @Test
    void keineSession_istGastgeber_gibtFalseZurueck() {
        // Ohne HTTP-Session kein Session-Fallback moeglich
        MockHttpServletRequest request = new MockHttpServletRequest();
        // Keine Session erstellen → getSession(false) liefert null
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        assertFalse(tischSicherheit.istGastgeber(UUID.randomUUID(), null));
    }

    // === hatZugang() ===

    @Test
    void spielerIstMitglied_hatZugang_gibtTrueZurueck() {
        // Eingeladene Spieler duerfen den Spielstand eines privaten Tisches lesen
        SpielerEntity gastgeber = SpielerEntity.menschlich("Alice", "session-alice");
        SpielerEntity mitglied = SpielerEntity.menschlich("Bob", "session-bob");
        TischEntity tisch = tischMitGastgeber(gastgeber);
        tisch.fuegeSpielerHinzu(mitglied);
        tischRepository.tischToReturn = tisch;

        assertTrue(tischSicherheit.hatZugang(UUID.randomUUID(), mitUserDetails(mitglied)));
    }

    @Test
    void spielerIstNichtMitglied_hatZugang_gibtFalseZurueck() {
        // Fremde Spieler duerfen den privaten Spielstand nicht auslesen
        SpielerEntity gastgeber = SpielerEntity.menschlich("Alice", "session-alice");
        SpielerEntity fremder = SpielerEntity.menschlich("Eve", "session-eve");
        TischEntity tisch = tischMitGastgeber(gastgeber);
        tisch.fuegeSpielerHinzu(gastgeber);
        tischRepository.tischToReturn = tisch;

        assertFalse(tischSicherheit.hatZugang(UUID.randomUUID(), mitUserDetails(fremder)));
    }

    @Test
    void tischNichtGefunden_hatZugang_gibtFalseZurueck() {
        // Ungueltige TischId fuehrt zu sauberem false, kein Absturz
        SpielerEntity spieler = SpielerEntity.menschlich("Alice", "session-alice");
        tischRepository.tischToReturn = null;

        assertFalse(tischSicherheit.hatZugang(UUID.randomUUID(), mitUserDetails(spieler)));
    }

    @Test
    void nullAuthentication_hatZugang_gibtFalseZurueck() {
        // Unauthentifizierte Anfragen erhalten keinen Zugang
        assertFalse(tischSicherheit.hatZugang(UUID.randomUUID(), null));
    }

    // === Hilfsmethoden ===

    private TischEntity tischMitGastgeber(SpielerEntity gastgeber) {
        return TischEntity.neu("Spieltisch", gastgeber, TischkonfigurationEmbeddable.standard());
    }

    private Authentication mitUserDetails(SpielerEntity spieler) {
        var userDetails = new LocodokoBenutzerdienst.SpielerUserDetails(spieler);
        return UsernamePasswordAuthenticationToken.authenticated(
                userDetails, null, userDetails.getAuthorities());
    }

    private Authentication mitOauth2(String sub) {
        OAuth2User oauth2User = new FakeOAuth2User(sub);
        return UsernamePasswordAuthenticationToken.authenticated(
                oauth2User, null, List.of(new SimpleGrantedAuthority("ROLE_SPIELER")));
    }

    private void setzeSessionKontext(String sessionId) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSession(new MockHttpSession(null, sessionId));
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    // === Fake-Implementierungen ===

    private static class FakeTischRepository implements TischRepository {
        TischEntity tischToReturn;

        @Override public Optional<TischEntity> findById(TischId id) { return Optional.ofNullable(tischToReturn); }
        @Override public TischEntity save(TischEntity t) { return t; }
        @Override public TischEntity saveAndFlush(TischEntity t) { return t; }
        @Override public void delete(TischEntity t) {}
        @Override public void deleteById(TischId id) {}
        @Override public void flush() {}
        @Override public Optional<TischEntity> findByIdWithLock(TischId id) { return Optional.empty(); }
        @Override public List<TischEntity> findAllByStatusOrderByErstelltAmAsc(TischStatus s) { return List.of(); }
        @Override public Optional<TischEntity> findBySpieler_Id(SpielerId id) { return Optional.empty(); }
        @Override public Optional<TischEntity> findByPartieId(PartieId id) { return Optional.empty(); }
        @Override public boolean existsBySpieler_SessionId(String sid) { return false; }
        @Override public long count() { return 0; }
        @Override public boolean existsById(TischId id) { return false; }
        @Override public Optional<TischEntity> findByEinladungsCode(String code) { return Optional.empty(); }
    }

    private static class FakeSpielerRepository implements SpielerRepository {
        SpielerEntity spielerNachExternalId;
        SpielerEntity spielerNachSessionId;

        @Override public Optional<SpielerEntity> findByExternalId(String externalId) { return Optional.ofNullable(spielerNachExternalId); }
        @Override public Optional<SpielerEntity> findBySessionId(String sessionId) { return Optional.ofNullable(spielerNachSessionId); }
        @Override public Optional<SpielerEntity> findByBenutzername(String benutzername) { return Optional.empty(); }
        @Override public Optional<SpielerEntity> findByEmail(String email) { return Optional.empty(); }
        @Override public Optional<SpielerEntity> findByEmailVerificationToken(String token) { return Optional.empty(); }
        @Override public Optional<SpielerEntity> findByPasswordResetToken(String token) { return Optional.empty(); }
        @Override public List<SpielerEntity> findAllByKiTrueOrderByErstelltAmAsc() { return List.of(); }
        @Override public <S extends SpielerEntity> S save(S s) { return s; }
        @Override public <S extends SpielerEntity> Iterable<S> saveAll(Iterable<S> es) { return es; }
        @Override public Optional<SpielerEntity> findById(UUID id) { return Optional.empty(); }
        @Override public boolean existsById(UUID id) { return false; }
        @Override public Iterable<SpielerEntity> findAll() { return List.of(); }
        @Override public Iterable<SpielerEntity> findAllById(Iterable<UUID> ids) { return List.of(); }
        @Override public long count() { return 0; }
        @Override public void delete(SpielerEntity e) {}
        @Override public void deleteAll() {}
        @Override public void deleteAll(Iterable<? extends SpielerEntity> es) {}
        @Override public void deleteAllById(Iterable<? extends UUID> ids) {}
        @Override public void deleteById(UUID id) {}
    }

    private static class FakeOAuth2User implements OAuth2User {
        private final String sub;

        FakeOAuth2User(String sub) { this.sub = sub; }

        @Override
        public Map<String, Object> getAttributes() {
            return sub != null ? Map.of("sub", sub) : Map.of();
        }

        @Override
        public Collection<? extends GrantedAuthority> getAuthorities() {
            return List.of();
        }

        @Override
        public String getName() {
            return sub != null ? sub : "unknown";
        }

        @Override
        @SuppressWarnings("unchecked")
        public <A> A getAttribute(String name) {
            return "sub".equals(name) ? (A) sub : null;
        }
    }
}
