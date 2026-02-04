-- ============================================================
-- LIMPIAR BASE DE DATOS (DROP TABLAS EN ORDEN CORRECTO)
-- ============================================================
-- Hijas primero
DROP TABLE IF EXISTS seed_sale_deliveries;
DROP TABLE IF EXISTS crop_stock;
DROP TABLE IF EXISTS crop_supplies;
DROP TABLE IF EXISTS crop_tasks;
DROP TABLE IF EXISTS task_supplies;
DROP TABLE IF EXISTS master_supplies;

DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS supplies;
DROP TABLE IF EXISTS stock;
DROP TABLE IF EXISTS seed_sales;

-- Ahora tablas base
DROP TABLE IF EXISTS crops;
DROP TABLE IF EXISTS crop_name;
DROP TABLE IF EXISTS lots;
DROP TABLE IF EXISTS campaigns;

DROP TABLE IF EXISTS supply_category;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS task_types;
DROP TABLE IF EXISTS lot_master;
DROP TABLE IF EXISTS providers;

DROP TABLE IF EXISTS expense_types;
-- ============================================================
-- TABLAS BASE
-- ============================================================

-- USERS
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  roles JSON NOT NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- CAMPAIGNS
CREATE TABLE campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  notes TEXT,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- LOTS
CREATE TABLE lots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  hectares DECIMAL(10,2) NOT NULL,
  location VARCHAR(150),
  campaign_id INT NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_lot_name (name),
  INDEX idx_lot_campaign (campaign_id),
  CONSTRAINT fk_lot_campaign FOREIGN KEY (campaign_id)
    REFERENCES campaigns(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- CROP NAMES
CREATE TABLE crop_name (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CROPS
CREATE TABLE crops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  crop_name_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  campaign_id INT NOT NULL,
  lot_id INT NOT NULL,
  seed_type VARCHAR(150),
  expected_yield DECIMAL(10,2),
  total_estimated DECIMAL(12,2),
  real_yield DECIMAL(12,2),
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_crop_campaign FOREIGN KEY (campaign_id)
    REFERENCES campaigns(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_crop_lot FOREIGN KEY (lot_id)
    REFERENCES lots(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_crop_name FOREIGN KEY (crop_name_id)
    REFERENCES crop_name(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- SUPPLY CATEGORY
CREATE TABLE supply_category (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- SUPPLIES
CREATE TABLE supplies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  crop_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  category_id INT,
  unit VARCHAR(50) NOT NULL,
  price_per_unit DECIMAL(10,2),
  dose_per_ha DECIMAL(10,2),
  hectares DECIMAL(10,2),
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_supply_crop FOREIGN KEY (crop_id)
    REFERENCES crops(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_supply_category FOREIGN KEY (category_id)
    REFERENCES supply_category(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- STOCK
CREATE TABLE stock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category_id INT,
  unit VARCHAR(50) NOT NULL,
  quantity_available DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0,
  expiration_date DATE,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_category FOREIGN KEY (category_id)
    REFERENCES supply_category(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- TASK TYPES
CREATE TABLE task_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- TASKS
CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  crop_id INT NOT NULL,
  task_type_id INT NOT NULL,
  description TEXT NULL,
  provider VARCHAR(150) NULL,
  total_price DECIMAL(10,2) NULL,
  laborCost DECIMAL(10,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  note TEXT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_crop FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_task_type FOREIGN KEY (task_type_id) REFERENCES task_types(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- TASK SUPPLIES
CREATE TABLE task_supplies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  supply_id INT NULL,
  stock_id INT NULL,
  dose_per_ha DECIMAL(10,2),
  hectares DECIMAL(10,2),
  total_used DECIMAL(10,2),
  price_per_unit DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ts_task FOREIGN KEY (task_id)
    REFERENCES tasks(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ts_supply FOREIGN KEY (supply_id)
    REFERENCES supplies(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ts_stock FOREIGN KEY (stock_id)
    REFERENCES stock(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- INTERMEDIAS
CREATE TABLE crop_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  crop_id INT NOT NULL,
  task_id INT NOT NULL,
  performed_at DATE,
  note VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ct_crop FOREIGN KEY (crop_id)
    REFERENCES crops(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ct_task FOREIGN KEY (task_id)
    REFERENCES tasks(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE crop_supplies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  crop_id INT NOT NULL,
  supply_id INT NOT NULL,
  quantity DECIMAL(12,4) NOT NULL,
  note VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cs_crop FOREIGN KEY (crop_id)
    REFERENCES crops(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cs_supply FOREIGN KEY (supply_id)
    REFERENCES supplies(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- LOT MASTER
CREATE TABLE lot_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  default_surface DECIMAL(10,2)
);

CREATE TABLE seed_sales (
  id INT AUTO_INCREMENT PRIMARY KEY,

  crop_id INT NOT NULL,

  waybill_number VARCHAR(50) NOT NULL,
  sale_date DATE NOT NULL,
  destination VARCHAR(150) NOT NULL,

  kg_delivered DECIMAL(10,2) NOT NULL DEFAULT 0,
  kg_sold DECIMAL(10,2) NOT NULL DEFAULT 0,

  status ENUM('pending','partial','completed','canceled')
    NOT NULL DEFAULT 'pending',

  deleted_at DATETIME NULL DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_crop (crop_id),
  INDEX idx_waybill_number (waybill_number),
  INDEX idx_destination (destination),
  INDEX idx_sale_date (sale_date),
  INDEX idx_status (status),

  CONSTRAINT fk_seed_sales_crop
    FOREIGN KEY (crop_id)
    REFERENCES crops(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
)
ENGINE=InnoDB
COLLATE='utf8mb4_0900_ai_ci';

CREATE TABLE crop_stock (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- RELACIONES PRINCIPALES
  crop_id INT NOT NULL,
  stock_id INT NOT NULL,

  -- CAMPOS PARA REGISTRO DEL USO
  used_quantity DECIMAL(10,2) DEFAULT 0,
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  note VARCHAR(255),

  -- CAMPOS SIMILARES A "supplies"
  category_id INT,
  unit VARCHAR(50) NOT NULL,
  price_per_unit DECIMAL(10,2),
  dose_per_ha DECIMAL(10,2),
  hectares DECIMAL(10,2),
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',

  -- TIMESTAMPS
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- FOREIGN KEYS
  CONSTRAINT fk_cropstock_crop FOREIGN KEY (crop_id)
    REFERENCES crops(id) ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_cropstock_stock FOREIGN KEY (stock_id)
    REFERENCES stock(id) ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_cropstock_category FOREIGN KEY (category_id)
    REFERENCES supply_category(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE seed_sale_deliveries (
  id INT NOT NULL AUTO_INCREMENT,

  -- RELACIONES PRINCIPALES
  seed_sale_id INT NOT NULL,
  crop_id INT NOT NULL,

  -- DETALLES DE LA ENTREGA
  delivery_date DATE NOT NULL,
  destination VARCHAR(150) NOT NULL,
  kg_delivered DECIMAL(10,2) NOT NULL,
  price_per_kg DECIMAL(10,2) NOT NULL,

  -- TIMESTAMPS
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL DEFAULT NULL,

  -- PRIMARY KEY
  PRIMARY KEY (id),

  -- INDICES
  INDEX idx_seed_sale (seed_sale_id),
  INDEX idx_crop (crop_id),
  INDEX idx_delivery_date (delivery_date),

  -- FOREIGN KEYS
  CONSTRAINT fk_ssd_crop FOREIGN KEY (crop_id)
    REFERENCES crops(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_ssd_seed_sale FOREIGN KEY (seed_sale_id)
    REFERENCES seed_sales(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

/*Nueva tabla maestra para almacenar los suministros*/
  CREATE TABLE master_supplies (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    category_id INT NOT NULL, -- referencia al tipo de suministro
    unit VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_master_supply_category
        FOREIGN KEY (category_id) REFERENCES supply_category(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/*Ejecutado el dia 17/12/2025*/
ALTER TABLE seed_sales
ADD COLUMN crop_id INT NOT NULL AFTER id;

ALTER TABLE seed_sales
ADD INDEX idx_crop (crop_id);

ALTER TABLE seed_sales
ADD CONSTRAINT fk_seed_sales_crop
  FOREIGN KEY (crop_id)
  REFERENCES crops(id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

/*Cambios para la tabla supplies*/
ALTER TABLE supplies
ADD COLUMN master_supply_id INT NOT NULL AFTER crop_id;


/*Actualizar tabla master_supplies con los nombres de las suministros*/
INSERT INTO master_supplies (name, category_id, unit)
SELECT DISTINCT
    s.name,
    s.category_id,
    s.unit
FROM supplies s
LEFT JOIN master_supplies ms ON ms.name = s.name
WHERE ms.id IS NULL;

/*Actualizar tabla supplies con el ID de la suministro maestro*/
UPDATE supplies s
JOIN master_supplies ms ON ms.name = s.name
SET s.master_supply_id = ms.id;

/*hacer el campo master_supply_id obligatorio*/
ALTER TABLE supplies
MODIFY master_supply_id INT NOT NULL;

/*Restringir el campo master_supply_id a valores que existen en master_supplies */
ALTER TABLE supplies
ADD CONSTRAINT fk_supply_master
FOREIGN KEY (master_supply_id)
REFERENCES master_supplies(id)
ON UPDATE CASCADE
ON DELETE RESTRICT;

/*Ejecutado el dia 28/12/2025*/
/*Agrego campo de tipo de cultivo a la tabla de ventas de cultivos*/
ALTER TABLE seed_sales
ADD COLUMN crop_name_id INT NOT NULL;

UPDATE seed_sales ss
JOIN crops cr ON cr.id = ss.crop_id
SET ss.crop_name_id = cr.crop_name_id;

ALTER TABLE seed_sales
ADD CONSTRAINT fk_seed_sales_crop_name
FOREIGN KEY (crop_name_id)
REFERENCES crop_name(id)
ON UPDATE CASCADE
ON DELETE RESTRICT;

/*Modifico la tabla de deliveries por entrega*/
ALTER TABLE seed_sale_deliveries
ADD COLUMN crop_name_id INT NOT NULL AFTER seed_sale_id;

UPDATE seed_sale_deliveries ssd
JOIN crops c ON c.id = ssd.crop_id
SET ssd.crop_name_id = c.crop_name_id;

ALTER TABLE seed_sale_deliveries
DROP FOREIGN KEY fk_ssd_crop;

ALTER TABLE seed_sale_deliveries
DROP COLUMN crop_id;

ALTER TABLE seed_sale_deliveries
ADD CONSTRAINT fk_ssd_crop_name
FOREIGN KEY (crop_name_id) REFERENCES crop_name(id)
ON UPDATE CASCADE
ON DELETE RESTRICT;


/*Quitar columna crop_id de seed_sales*/
ALTER TABLE seed_sales
DROP FOREIGN KEY fk_seed_sales_crop;

ALTER TABLE seed_sales
DROP INDEX idx_crop;

ALTER TABLE seed_sales
DROP COLUMN crop_id;

/*Agrego campo de waybill_number a la tabla de entregas*/

ALTER TABLE seed_sale_deliveries
ADD COLUMN waybill_number VARCHAR(50) NOT NULL
AFTER id;

/*Ejecutado el dia 28/12/2025*/

/*Alter para agregar columna userId a la tabla de campaigns*/
ALTER TABLE `campaigns`
ADD COLUMN `userId` INT NULL AFTER `id`;

UPDATE `campaigns` SET `userId` = 1 WHERE `userId` IS NULL;

ALTER TABLE `campaigns`
MODIFY COLUMN `userId` INT NOT NULL,
ADD CONSTRAINT `fk_campaigns_user`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

/*Alter para agregar columna userId a la tabla de stock*/
ALTER TABLE stock
ADD COLUMN userId INT NULL AFTER id;

ALTER TABLE stock
ADD CONSTRAINT fk_stock_user
FOREIGN KEY (userId)
REFERENCES users(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

UPDATE stock
SET userId = 1;


/*Alter para agregar columna userId a la tabla de ventas*/
ALTER TABLE `seed_sales`
ADD COLUMN `userId` INT NULL AFTER `crop_name_id`,
ADD INDEX `fk_seed_sales_user` (`userId`),
ADD CONSTRAINT `fk_seed_sales_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE `seed_sales`
MODIFY COLUMN `userId` INT NULL AFTER `id`

UPDATE `seed_sales`
SET `userId` = 1;



/*Alter para agregar columna userId a la tabla de entregas*/
ALTER TABLE seed_sale_deliveries
ADD COLUMN userId INT AFTER seed_sale_id,
ADD CONSTRAINT fk_deliveries_user FOREIGN KEY (userId) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
UPDATE `seed_sale_deliveries`
SET `userId` = 1;
ALTER TABLE `seed_sale_deliveries`
MODIFY COLUMN `userId` INT NOT NULL;


/*Alter para agregar columna userId a la tabla de Cultivos*/
ALTER TABLE `crops`
ADD COLUMN `userId` INT NULL AFTER `id`,
ADD INDEX `fk_crop_user` (`userId`),
ADD CONSTRAINT `fk_crop_user`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE;


UPDATE `crops`
SET `userId` = 1;

ALTER TABLE `crops`
MODIFY COLUMN `userId` INT NOT NULL,


/*modificar columnas de kg por tn en ventas*/
ALTER TABLE `seed_sales`
  CHANGE COLUMN `kg_sold` `tn_sold` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  CHANGE COLUMN `kg_delivered` `tn_delivered` DECIMAL(10,2) NOT NULL DEFAULT '0.00';

ALTER TABLE `seed_sale_deliveries`
  CHANGE COLUMN `kg_delivered` `tn_delivered` DECIMAL(10,2) NOT NULL,
  CHANGE COLUMN `price_per_kg` `price_per_tn` DECIMAL(10,2) NOT NULL;

/*agregar columna master_supply_id a la tabla de stock*/
ALTER TABLE stock
ADD COLUMN master_supply_id INT NULL DEFAULT NULL;

ALTER TABLE stock
ADD INDEX fk_stock_master_supply (master_supply_id),
ADD CONSTRAINT fk_stock_master_supply
  FOREIGN KEY (master_supply_id)
  REFERENCES master_supplies (id)
  ON UPDATE CASCADE
  ON DELETE SET NULL;


CREATE TABLE providers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  UNIQUE (userId, name),
  CONSTRAINT fk_providers_user
    FOREIGN KEY (userId)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

ALTER TABLE tasks
ADD COLUMN provider_id INT NULL AFTER task_type_id;

ALTER TABLE tasks
ADD CONSTRAINT fk_tasks_provider
FOREIGN KEY (provider_id)
REFERENCES providers(id)
ON UPDATE CASCADE
ON DELETE SET NULL;

ALTER TABLE tasks
ADD COLUMN provider_backup VARCHAR(150);

UPDATE tasks SET provider_backup = provider;

ALTER TABLE tasks
DROP COLUMN provider;

ALTER TABLE seed_sale_deliveries
CHANGE waybill_number primary_liquidation_number VARCHAR(50) NOT NULL;

ALTER TABLE seed_sales
ADD COLUMN campaign_id INT NULL AFTER crop_name_id;


UPDATE seed_sales
SET campaign_id = 1
WHERE campaign_id IS NULL;

-- 2️⃣ Cambiar la columna a NOT NULL
ALTER TABLE seed_sales
MODIFY COLUMN campaign_id INT NOT NULL;

-- 3️⃣ Crear la clave foránea
ALTER TABLE seed_sales
ADD CONSTRAINT fk_seed_sales_campaign
FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
ON UPDATE CASCADE
ON DELETE RESTRICT;

ALTER TABLE task_supplies
MODIFY dose_per_ha DECIMAL(10,3) NULL DEFAULT NULL,
MODIFY hectares DECIMAL(10,3) NULL DEFAULT NULL,
MODIFY total_used DECIMAL(10,3) NULL DEFAULT NULL,
MODIFY price_per_unit DECIMAL(10,3) NULL DEFAULT NULL;

/*24/01 */

ALTER TABLE seed_sale_deliveries
DROP FOREIGN KEY fk_ssd_seed_sale;

RENAME TABLE seed_sales TO seed_deliveries;

RENAME TABLE seed_sale_deliveries TO seed_sales;

ALTER TABLE seed_sales
ADD CONSTRAINT fk_seed_sales_delivery
FOREIGN KEY (seed_sale_id)
REFERENCES seed_deliveries (id)
ON UPDATE CASCADE
ON DELETE CASCADE;

ALTER TABLE seed_sales
DROP FOREIGN KEY fk_seed_sales_delivery;

ALTER TABLE seed_sales
DROP INDEX idx_seed_sale;

ALTER TABLE seed_sales
RENAME COLUMN seed_sale_id TO seed_delivery_id;

ALTER TABLE seed_sales
ADD INDEX idx_seed_delivery (seed_delivery_id);

ALTER TABLE seed_sales
ADD CONSTRAINT fk_seed_sales_delivery
FOREIGN KEY (seed_delivery_id)
REFERENCES seed_deliveries (id)
ON UPDATE CASCADE
ON DELETE CASCADE;

ALTER TABLE seed_deliveries
DROP INDEX idx_sale_date;

ALTER TABLE seed_deliveries
RENAME COLUMN sale_date TO delivery_date;

ALTER TABLE seed_deliveries
ADD INDEX idx_delivery_date (delivery_date);

ALTER TABLE seed_sales
DROP INDEX idx_delivery_date;

ALTER TABLE seed_sales
RENAME COLUMN delivery_date TO sale_date;

ALTER TABLE seed_sales
ADD INDEX idx_sale_date (sale_date);

ALTER TABLE seed_sales
RENAME COLUMN tn_delivered TO tn_sold;

ALTER TABLE seed_sales
DROP FOREIGN KEY fk_seed_sales_delivery;

ALTER TABLE seed_sales
DROP INDEX idx_seed_delivery;

ALTER TABLE seed_sales
DROP COLUMN seed_delivery_id;

ALTER TABLE seed_sales
ADD COLUMN campaign_id INT NULL AFTER userId;

ALTER TABLE seed_sales
ADD INDEX idx_campaign (campaign_id);

ALTER TABLE seed_sales
ADD CONSTRAINT fk_seed_sales_campaign_id
FOREIGN KEY (campaign_id)
REFERENCES campaigns(id)
ON UPDATE CASCADE
ON DELETE SET NULL;

ALTER TABLE seed_sales
MODIFY COLUMN tn_sold DECIMAL(10,3) NOT NULL;

ALTER TABLE seed_deliveries
MODIFY COLUMN tn_delivered DECIMAL(10,3) NOT NULL DEFAULT '0.000';

ALTER TABLE seed_deliveries
MODIFY COLUMN tn_sold DECIMAL(10,3) NOT NULL DEFAULT '0.000';

ALTER TABLE stock
MODIFY quantity_available DECIMAL(10,3) NOT NULL DEFAULT 0.000;

ALTER TABLE crop_stock
  MODIFY used_quantity DECIMAL(10,3) NULL DEFAULT 0.000,
  MODIFY dose_per_ha DECIMAL(10,3) NULL DEFAULT 0.000;


/*https://excalidraw.com/#json=0HLgoHOiC_RIcO0wCQ9t-,Rm9ZEE3JuSP4bNUUDSMhtg*/

CREATE TABLE `expense_types` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`name` VARCHAR(100) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`user_id` INT NULL DEFAULT NULL,
	`created_at` TIMESTAMP NULL DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY (`id`) USING BTREE,
	INDEX `fk_expense_types_user` (`user_id`) USING BTREE,
	CONSTRAINT `fk_expense_types_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE NO ACTION ON DELETE CASCADE
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
;

CREATE TABLE variable_expenses (
    id INT NOT NULL AUTO_INCREMENT,

    user_id INT NOT NULL,
    campaign_id INT NOT NULL,
    lot_id INT NOT NULL,

    hectares DECIMAL(10,2) NOT NULL,
    tons_harvested DECIMAL(10,2) NULL COMMENT 'tnCosechadas / real_yield',

    expense_type_id INT NOT NULL,

    provider VARCHAR(150) NULL COMMENT 'Prestador',

    expense_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,

    deleted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_variable_expenses_user (user_id),
    INDEX idx_variable_expenses_campaign (campaign_id),
    INDEX idx_variable_expenses_lot (lot_id),
    INDEX idx_variable_expenses_type (expense_type_id),

    CONSTRAINT fk_variable_expenses_user
        FOREIGN KEY (user_id) REFERENCES users(id),

    CONSTRAINT fk_variable_expenses_campaign
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id),

    CONSTRAINT fk_variable_expenses_lot
        FOREIGN KEY (lot_id) REFERENCES lots(id),

    CONSTRAINT fk_variable_expenses_type
        FOREIGN KEY (expense_type_id) REFERENCES expense_types(id)
)
ENGINE=InnoDB;
