package com.monetique.eye.service;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;
import java.util.Date;
import java.util.Map;

@Service
public class GitHubService {
    private static final Logger log = LoggerFactory.getLogger(GitHubService.class);

    @Value("${github.app.id:3444190}")
    private String appId;

    @Value("${github.private.key.path:/home/vmpipe/monetique-github-key.pem}")
    private String privateKeyPath;

    private final RestTemplate restTemplate = new RestTemplate();

    public String generateAppJwt() throws Exception {
        byte[] keyBytes = Files.readAllBytes(Paths.get(privateKeyPath));
        String keyContent = new String(keyBytes)
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");

        byte[] decodedKey = Base64.getDecoder().decode(keyContent);
        PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(decodedKey);
        KeyFactory kf = KeyFactory.getInstance("RSA");
        PrivateKey privateKey = kf.generatePrivate(spec);

        long nowMillis = System.currentTimeMillis();
        Date now = new Date(nowMillis);
        Date exp = new Date(nowMillis + 600000); // 10 minutes

        return Jwts.builder()
                .setIssuedAt(now)
                .setExpiration(exp)
                .setIssuer(appId)
                .signWith(privateKey, SignatureAlgorithm.RS256)
                .compact();
    }

    public String getInstallationToken(String installationId) throws Exception {
        String jwt = generateAppJwt();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt);
        headers.set("Accept", "application/vnd.github+json");
        headers.set("X-GitHub-Api-Version", "2022-11-28");

        HttpEntity<String> entity = new HttpEntity<>(headers);
        String url = "https://api.github.com/app/installations/" + installationId + "/access_tokens";

        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);
        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            return (String) response.getBody().get("token");
        }

        throw new RuntimeException("Failed to get GitHub installation token: " + response.getStatusCode());
    }
}
