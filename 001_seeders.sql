-- =========================
-- CAMPAÑAS
-- =========================
INSERT INTO campaigns (name, start_date, end_date, notes, status)
VALUES
('Campaña 25/26', '2024-06-01', NULL, 'Campaña principal gruesa', 'active'),
('Campaña Fina 2025', '2025-04-01', NULL, 'Campaña de trigo / cebada', 'active');

-- =========================
-- LOTES
-- =========================
INSERT INTO lots (name, hectares, location, campaign_id, status)
VALUES
('Lote Norte', 45.50, 'Campo El Triunfo', 1, 'active'),
('Lote Sur', 32.80, 'Campo La Esperanza', 1, 'active'),
('Lote Este', 28.00, 'Campo San Miguel', 2, 'active');

-- =========================
-- NOMBRES DE CULTIVOS
-- =========================
INSERT INTO crop_name (name)
VALUES
('Trigo'),
('Maíz'),
('Sorgo'),
('Soja'),
('Girasol');

-- =========================
-- CROPS
-- =========================
INSERT INTO crops (crop_name_id, start_date, end_date, campaign_id, lot_id, seed_type, expected_yield, total_estimated, real_yield, status)
VALUES
(2, '2024-09-15', NULL, 1, 1, 'DK72-10', 95.00, 4300.00, NULL, 'active'),
(4, '2024-10-01', NULL, 1, 2, 'DM3312', 80.00, 2600.00, NULL, 'active'),
(1, '2025-05-15', NULL, 2, 3, 'Baguette 620', 45.00, 1500.00, NULL, 'active');

-- =========================
-- CATEGORÍAS DE SUMINISTROS
-- =========================
INSERT INTO supply_category (name)
VALUES
('Herbicida'),
('Fertilizante'),
('Insecticida'),
('Funguicida');

-- =========================
-- SUMINISTROS POR CROP
-- =========================
INSERT INTO supplies (crop_id, name, category_id, unit, dose_per_ha, hectares, price_per_unit, status)
VALUES
(1, 'Glifosato', 1, 'lt', 2.0, 12, 12.50, 'active'),
(1, 'Urea', 2, 'kg', 10.0, 14, 0.95, 'active'),
(2, 'Insecticida Lorsban', 3, 'lt', 1.5, 16, 18.00, 'active'),
(3, 'Funguicida Tebuconazole', 4, 'lt', 1.0, 20, 22.00, 'active');


-- =========================
-- STOCK GENERAL DE SUMINISTROS
-- =========================
INSERT INTO stock (name, category_id, unit, quantity_available, price_per_unit, expiration_date, status)
VALUES
('Glifosato Stock', 1, 'lt', 100.0, 12.50, '2025-12-31', 'active'),
('Urea Stock', 2, 'kg', 500.0, 0.95, '2025-12-31', 'active'),
('Insecticida Lorsban Stock', 3, 'lt', 50.0, 18.00, '2025-06-30', 'active'),
('Funguicida Tebuconazole Stock', 4, 'lt', 30.0, 22.00, '2025-11-30', 'active');

INSERT INTO task_types (name)
VALUES
('Siembra'),
('Fertilización'),
('Fumigación'),
('Fungicida');

-- =========================
-- TAREAS POR CROP
-- =========================
INSERT INTO `tasks` 
(crop_id, task_type_id, description, provider, total_price, laborCost, date, note, status)
VALUES
(1, 2, 'Aplicación de fertilizante NPK en lote 1', 'Proveedor A', 250.50, 50.00, '2025-11-25', 'Aplicar temprano en la mañana', 'active'),
(2, 1, 'Riego por goteo en lote 3', 'Proveedor B', 100.00, 30.00, '2025-11-24', 'Riego completo', 'active'),
(1, 3, 'Control de plagas con insecticida', 'Proveedor C', 180.75, 40.00, '2025-11-23', 'Aplicar según dosis recomendada', 'active'),
(3, 2, 'Fertilización foliar', 'Proveedor D', 300.00, 60.00, '2025-11-22', 'Mezclar bien antes de aplicar', 'active'),
(2, 1, 'Limpieza de canal de riego', 'Proveedor E', 50.00, 20.00, '2025-11-21', 'Solo limpieza superficial', 'active');

-- =========================
-- RELACIONES TASKS ↔ SUPPLIES / STOCK
-- =========================
-- task_id, supply_id, stock_id, dose_per_ha, hectares, total_used, price_per_unit
INSERT INTO task_supplies (task_id, supply_id, stock_id, dose_per_ha, hectares, total_used, price_per_unit)
VALUES
(1, 2, 2, 10.0, 45.5, 455.0, 0.95),
(1, 1, 1, 2.0, 45.5, 91.0, 12.50),
(2, 1, 1, 2.0, 45.5, 91.0, 12.50),
(3, 3, 3, 1.5, 32.8, 49.2, 18.00),
(4, 4, 4, 1.0, 28.0, 28.0, 22.00);

-- =========================
-- RELACIONES CROPS ↔ TASKS
-- =========================
INSERT INTO crop_tasks (crop_id, task_id, performed_at, note)
VALUES
(1, 1, '2024-09-20', 'Siembra realizada en buenas condiciones'),
(1, 2, '2024-10-05', 'Fertilización inicial'),
(2, 3, '2024-10-15', 'Fumigación correcta'),
(3, 4, '2025-05-25', 'Fungicida preventivo aplicado');

-- =========================
-- RELACIONES CROPS ↔ SUPPLIES
-- =========================
INSERT INTO crop_supplies (crop_id, supply_id, quantity, note)
VALUES
(1, 1, 91.0, 'Glifosato pre-siembra'),
(1, 2, 455.0, 'Urea aplicada'),
(2, 3, 49.2, 'Insecticida control'),
(3, 4, 28.0, 'Fungicida preventivo');

-- =========================
-- LOT MASTER
-- =========================
INSERT INTO lot_master (name, default_surface)
VALUES
('Pasturas', 3.0469),
('Pasturas (1)', 3.7582),
('A 1', 13.3095),
('A 3', 25.2064),
('A 4', 13.1868),
('A 2', 27.2958);

-- =========================
-- USUARIOS
-- =========================
INSERT INTO users (name, email, password, roles, status)
VALUES
('Test User', 'testuser@mail.com', '$2b$10$FSdBHx5uV.NTUJeIjyCcGee4LcXwjmwA8ltJfegLl84qPNbBa7qEy', JSON_ARRAY('admin'), 'active');
