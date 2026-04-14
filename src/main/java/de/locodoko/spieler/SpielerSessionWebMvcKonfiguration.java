package de.locodoko.spieler;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Spring MVC-Konfiguration fuer den Session-Endpunkt.
 *
 * <p>Registriert den {@link SpielerSessionValidierungsInterceptor} fuer den Pfad
 * {@code /api/spieler/session}, damit alle Nicht-POST-Anfragen eine gueltige Session vorweisen muessen.</p>
 */
@Configuration
public class SpielerSessionWebMvcKonfiguration implements WebMvcConfigurer {

    private final SpielerSessionValidierungsInterceptor spielerSessionValidierungsInterceptor;

    public SpielerSessionWebMvcKonfiguration(SpielerSessionValidierungsInterceptor spielerSessionValidierungsInterceptor) {
        this.spielerSessionValidierungsInterceptor = spielerSessionValidierungsInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(spielerSessionValidierungsInterceptor)
            .addPathPatterns("/api/spieler/session");
    }
}
