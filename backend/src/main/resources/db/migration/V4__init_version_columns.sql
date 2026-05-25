-- Idempotent column addition for MySQL
DELIMITER //

CREATE PROCEDURE AddVersionColumn(IN tableName VARCHAR(255))
BEGIN
    IF NOT EXISTS (
        SELECT * FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = tableName 
        AND COLUMN_NAME = 'version'
    ) THEN
        SET @s = CONCAT('ALTER TABLE ', tableName, ' ADD COLUMN version BIGINT DEFAULT 0');
        PREPARE stmt FROM @s;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

DELIMITER ;

-- Apply to tables
CALL AddVersionColumn('applications');
UPDATE applications SET version = 0 WHERE version IS NULL;

CALL AddVersionColumn('environments');
UPDATE environments SET version = 0 WHERE version IS NULL;

CALL AddVersionColumn('managed_nodes');
UPDATE managed_nodes SET version = 0 WHERE version IS NULL;

-- Clean up
DROP PROCEDURE AddVersionColumn;
