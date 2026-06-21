package com.monetique.eye.service;

import java.time.LocalDateTime;

public class PendingAction {
    private String actionType;
    private String targetApp;
    private String targetEnv;
    private LocalDateTime expiresAt;

    public PendingAction(String actionType, String targetApp, String targetEnv) {
        this.actionType = actionType;
        this.targetApp = targetApp;
        this.targetEnv = targetEnv;
        this.expiresAt = LocalDateTime.now().plusMinutes(5);
    }

    public String getActionType() {
        return actionType;
    }

    public String getTargetApp() {
        return targetApp;
    }

    public String getTargetEnv() {
        return targetEnv;
    }

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }
}
