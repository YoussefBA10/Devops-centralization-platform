CREATE TABLE vm_registry (
    id                  VARCHAR(36)  PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    ip_address          VARCHAR(45)  NOT NULL,
    role                VARCHAR(50)  NOT NULL,
    cluster_id          BIGINT       NOT NULL,
    env                 VARCHAR(20)  NOT NULL,
    node_exporter_port  INT          NOT NULL DEFAULT 9100,
    cadvisor_port       INT          NOT NULL DEFAULT 8080,
    app_metrics_port    INT,
    app_metrics_path    VARCHAR(200)          DEFAULT '/metrics',
    app_name            VARCHAR(100),
    netstat_collector_confirmed  BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP             DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cluster_id) REFERENCES cluster(id)
);

CREATE TABLE service_link (
    id              VARCHAR(36)  PRIMARY KEY,
    name            VARCHAR(200),
    source_vm_id    VARCHAR(36)  NOT NULL,
    target_vm_id    VARCHAR(36)  NOT NULL,
    target_port     INT          NOT NULL,
    target_path     VARCHAR(200)          DEFAULT '/health',
    protocol        VARCHAR(10)           DEFAULT 'http',
    probe_module    VARCHAR(50)           DEFAULT 'http_2xx',
    enabled         BOOLEAN               DEFAULT TRUE,
    created_at      TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_vm_id) REFERENCES vm_registry(id),
    FOREIGN KEY (target_vm_id) REFERENCES vm_registry(id)
);

CREATE TABLE network_alert_rule (
    id              VARCHAR(36)  PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    rule_type       VARCHAR(50)  NOT NULL,
    link_id         VARCHAR(36),
    vm_id           VARCHAR(36),
    threshold_value DOUBLE       NOT NULL,
    threshold_unit  VARCHAR(20),
    severity        VARCHAR(20)           DEFAULT 'WARNING',
    enabled         BOOLEAN               DEFAULT TRUE,
    created_at      TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES service_link(id),
    FOREIGN KEY (vm_id)   REFERENCES vm_registry(id)
);

-- Seed default alert rules
INSERT INTO network_alert_rule (id, name, rule_type, threshold_value, threshold_unit, severity) VALUES
(UUID(), 'Service Link Down', 'LINK_DOWN', 1, 'count', 'CRITICAL'),
(UUID(), 'High Service Latency', 'HIGH_LATENCY', 500, 'ms', 'WARNING'),
(UUID(), 'Critical Service Latency', 'CRITICAL_LATENCY', 2000, 'ms', 'CRITICAL'),
(UUID(), 'High TCP Retransmissions', 'TCP_RETRANSMIT', 10, 'per_second', 'WARNING'),
(UUID(), 'Network Packet Drops', 'PACKET_DROP', 5, 'per_second', 'WARNING'),
(UUID(), 'Network Bandwidth Saturation', 'BANDWIDTH_SAT', 800, 'Mbps', 'WARNING'),
(UUID(), 'High HTTP Error Rate', 'HIGH_ERROR_RATE', 1, 'percent', 'WARNING'),
(UUID(), 'App P99 Latency High', 'HIGH_P99', 500, 'ms', 'WARNING');
