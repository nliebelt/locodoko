package de.locodoko;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class LocodokoAnwendung {

    public static void main(String[] args) {
        SpringApplication.run(LocodokoAnwendung.class, args);
    }
}
