-- ============================================================
-- DROP TABLAS (ORDEN CORRECTO)
-- ============================================================
DROP TABLE IF EXISTS task_supplies;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS stock;
DROP TABLE IF EXISTS supplies;
DROP TABLE IF EXISTS crop_supplies;
DROP TABLE IF EXISTS crop_tasks;
DROP TABLE IF EXISTS crops;
DROP TABLE IF EXISTS crop_name;
DROP TABLE IF EXISTS lots;
DROP TABLE IF EXISTS campaigns;
DROP TABLE IF EXISTS supply_category;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS lot_master;
DROP TABLE IF EXISTS task_types;

-- ============================================================
-- TABLAS DE USUARIOS
-- ============================================================
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

-- ============================================================
-- CAMPOS BASE
-- ============================================================
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

-- ============================================================
-- NOMBRES DE CULTIVOS
-- ============================================================
CREATE TABLE crop_name (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- CROPS
-- ============================================================
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

-- ============================================================
-- CATEGORÍAS DE SUMINISTROS
-- ============================================================
CREATE TABLE supply_category (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- SUMINISTROS ASOCIADOS A CULTIVO
-- ============================================================
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

-- ============================================================
-- STOCK GENERAL
-- ============================================================
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

-- ============================================================
-- TABLA DE TIPOS DE TAREAS
-- ============================================================
CREATE TABLE task_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE `tasks` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `crop_id` INT NOT NULL,
  `task_type_id` INT NOT NULL,
  `description` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
  `provider` VARCHAR(150) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
  `total_price` DECIMAL(10,2) NULL DEFAULT NULL,
  `laborCost` DECIMAL(10,2) NOT NULL DEFAULT 0,  -- nueva columna
  `date` DATE NOT NULL,
  `note` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
  `status` ENUM('active','inactive') NOT NULL DEFAULT 'active' COLLATE 'utf8mb4_0900_ai_ci',
  `created_at` TIMESTAMP NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` TIMESTAMP NULL DEFAULT (CURRENT_TIMESTAMP) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `fk_task_crop` (`crop_id`) USING BTREE,
  INDEX `fk_task_type` (`task_type_id`) USING BTREE,
  CONSTRAINT `fk_task_crop` FOREIGN KEY (`crop_id`) REFERENCES `crops` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_task_type` FOREIGN KEY (`task_type_id`) REFERENCES `task_types` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=1;


-- ============================================================
-- TASK SUPPLIES
-- ============================================================
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

-- ============================================================
-- TABLAS INTERMEDIAS
-- ============================================================
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

-- ============================================================
-- LOT MASTER
-- ============================================================
CREATE TABLE lot_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  default_surface DECIMAL(10,2)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_campaign_start ON campaigns(start_date);
CREATE INDEX idx_crop_dates ON crops(start_date, end_date);
