-- ============================================================
-- INSERT DATOS BASE
-- ============================================================

INSERT INTO crop_name (name)
VALUES
('Trigo'),
('Maíz'),
('Sorgo'),
('Soja'),
('Girasol');

INSERT INTO supply_category (name)
VALUES
  ('Herbicida'),
  ('Insecticida'),
  ('Funguicida');

INSERT INTO task_types (name)
VALUES
('Siembra'),
('Fumigación'),
('Fungicida');

INSERT INTO lot_master (name, default_surface)
VALUES
('Pasturas', 3.0469),
('Pasturas (1)', 3.7582),
('A 1', 13.3095),
('A 3', 25.2064),
('A 4', 13.1868),
('A 2', 27.2958);

INSERT INTO master_supplies (name, category_id, unit) VALUES
  ('Glifosato 48%', 1, 'lt'),
  ('2,4-D Amina', 1, 'lt'),
  ('Clorpirifos', 2, 'lt'),
  ('Carbendazim', 3, 'lt');

INSERT INTO users (name, email, password, roles, status)
VALUES
('Federico Beltramino', 'fedeuser@mail.com', '$2b$10$FSdBHx5uV.NTUJeIjyCcGee4LcXwjmwA8ltJfegLl84qPNbBa7qEy', JSON_ARRAY('admin'), 'active'),
('Francisco Beltramino', 'franuser@mail.com', '$2b$10$FSdBHx5uV.NTUJeIjyCcGee4LcXwjmwA8ltJfegLl84qPNbBa7qEy', JSON_ARRAY('admin'), 'active'),
('Martín Beltramino', 'martinuser@mail.com', '$2b$10$FSdBHx5uV.NTUJeIjyCcGee4LcXwjmwA8ltJfegLl84qPNbBa7qEy', JSON_ARRAY('admin'), 'active');