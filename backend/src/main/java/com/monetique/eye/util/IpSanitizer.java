package com.monetique.eye.util;

public class IpSanitizer {
    public static String sanitizeIp(String ip) {
        if (ip == null || ip.isBlank()) {
            return ip;
        }
        return ip.replaceAll("^https?://", "").replaceAll("/$", "").replaceAll("http", "");
    }
}
