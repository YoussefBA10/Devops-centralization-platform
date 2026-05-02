ALTER TABLE applications 
ADD COLUMN metrics_port INT NULL,
ADD COLUMN metrics_test_status VARCHAR(50) DEFAULT 'PENDING',
ADD COLUMN metrics_tested_at DATETIME(6) NULL;
