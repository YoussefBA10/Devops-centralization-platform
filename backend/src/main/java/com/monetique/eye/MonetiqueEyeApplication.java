package com.monetique.eye;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.EnableAsync;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Properties;

@SpringBootApplication
@EntityScan({"com.monetique.eye.entity", "com.monetique.eye.security.entity"})
@EnableJpaRepositories({"com.monetique.eye.repository", "com.monetique.eye.security.repository"})
@EnableScheduling
@EnableAsync
public class MonetiqueEyeApplication {

	public static void main(String[] args) {
		loadEnv();
		SpringApplication.run(MonetiqueEyeApplication.class, args);
	}

	private static void loadEnv() {
		String[] searchPaths = {".env", "backend/.env", System.getProperty("user.home") + "/.env"};
		Path foundPath = null;

		for (String pathStr : searchPaths) {
			Path p = Paths.get(pathStr);
			if (Files.exists(p)) {
				foundPath = p;
				break;
			}
		}

		if (foundPath != null) {
			try (FileInputStream fis = new FileInputStream(foundPath.toFile())) {
				Properties props = new Properties();
				props.load(fis);
				props.forEach((key, value) -> System.setProperty(key.toString(), value.toString()));
				System.out.println("Loaded environment variables from " + foundPath.toAbsolutePath());
			} catch (IOException e) {
				System.err.println("Failed to load .env file: " + e.getMessage());
			}
		} else {
			System.out.println(".env file not found in searched locations: " + String.join(", ", searchPaths));
		}
	}
}
