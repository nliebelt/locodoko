package de.locodoko.session;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

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
