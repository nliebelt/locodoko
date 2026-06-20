package de.locodoko.spieler;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Registriert Weiterleitungen von den Clean-URLs (/impressum, /datenschutz, /agb)
 * auf die entsprechenden statischen HTML-Seiten in src/main/resources/static/.
 */
@Configuration
public class RechtWebMvcKonfiguration implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addRedirectViewController("/impressum", "/impressum.html");
        registry.addRedirectViewController("/datenschutz", "/datenschutz.html");
        registry.addRedirectViewController("/agb", "/agb.html");
    }
}
