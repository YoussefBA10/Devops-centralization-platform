CREATE TABLE deployment_event (
  id           VARCHAR(36) PRIMARY KEY,
  app_id       BIGINT NOT NULL,
  env          VARCHAR(20) NOT NULL,
  version      VARCHAR(100) NOT NULL,
  build_number VARCHAR(20),
  status       VARCHAR(20) NOT NULL,
  started_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (app_id) REFERENCES applications(id)
);
