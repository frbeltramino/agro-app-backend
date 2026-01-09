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

INSERT INTO supply_category (name) VALUES
  ('Herbicida'), 
  ('Fertilizante'),       
  ('Insecticida'),   
  ('Fungicida'),        
  ('Semilla'),         
  ('Coadyuvante'),     
  ('Bioinsumo');    

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
-- HERBICIDAS (1)
('Glifosato 62%', 1, 'kg'),
('2,4-D Ester', 1, 'lt'),
('Atrazina', 1, 'kg'),
('Dicamba', 1, 'lt'),
('Metsulfuron Metil', 1, 'gr'),
('Clorimurón Etil', 1, 'gr'),
('Imazapir', 1, 'lt'),
('Imazetapir', 1, 'lt'),
('Haloxifop', 1, 'lt'),
('Cletodim', 1, 'lt'),
('Paraquat', 1, 'lt'),
('Diquat', 1, 'lt'),
('Flumioxazin', 1, 'kg'),
('Sulfentrazone', 1, 'kg'),
('Pendimetalin', 1, 'lt'),
('Acetoclor', 1, 'lt'),
('S-Metolacloro', 1, 'lt'),
('Trifluralina', 1, 'lt'),

-- INSECTICIDAS (2)
('Cipermetrina', 3, 'lt'),
('Deltametrina', 3, 'lt'),
('Imidacloprid', 3, 'lt'),
('Thiametoxam', 3, 'kg'),
('Acetamiprid', 3, 'kg'),
('Spinosad', 3, 'lt'),
('Abamectina', 3, 'lt'),
('Emamectina', 3, 'kg'),
('Fipronil', 3, 'lt'),
('Bifentrin', 3, 'lt'),
('Metomil', 3, 'kg'),
('Acefato', 3, 'kg'),
('Carbofuran', 3, 'kg'),

-- FUNGICIDAS (3)
('Tebuconazole', 4, 'lt'),
('Propiconazole', 4, 'lt'),
('Azoxystrobin', 4, 'lt'),
('Mancozeb', 4, 'kg'),
('Metalaxil', 4, 'kg'),
('Clorotalonil', 4, 'kg'),
('Ciproconazole', 4, 'lt'),
('Trifloxistrobin', 4, 'kg'),
('Flutriafol', 4, 'lt'),
('Boscalid', 4, 'kg'),
('Fluxapyroxad', 4, 'lt'),
('Prothioconazole', 4, 'lt'),
('Difenoconazole', 4, 'lt'),
('Folpet', 4, 'kg'),

-- FERTILIZANTES (4)
('Urea granulada', 2, 'kg'),
('Urea perlada', 2, 'kg'),
('Fosfato Monoamónico (MAP)', 2, 'kg'),
('Sulfato de Amonio', 2, 'kg'),
('Nitrato de Amonio', 2, 'kg'),
('Cloruro de Potasio', 2, 'kg'),
('Yeso agrícola', 2, 'kg'),
('NPK 15-15-15', 2, 'kg'),
('NPK 20-10-10', 2, 'kg'),
('Nitrato de Calcio', 2, 'kg'),
('Fosfato Simple', 2, 'kg'),
('Fosfato Triple', 2, 'kg'),
('Quelato de Zinc', 2, 'kg'),
('Quelato de Hierro', 2, 'kg'),
('Boro granulado', 2, 'kg'),
('Azufre agrícola', 2, 'kg'),
('Magnesio agrícola', 2, 'kg'),
('Cal dolomítica', 2, 'kg'),
('Cal agrícola', 2, 'kg'),

-- SEMILLAS (5)
('Semilla de Soja RR', 5, 'kg'),
('Semilla de Soja Intacta', 5, 'kg'),
('Semilla de Maíz híbrido', 5, 'un'),
('Semilla de Trigo', 5, 'kg'),
('Semilla de Cebada', 5, 'kg'),
('Semilla de Girasol', 5, 'kg'),
('Semilla de Sorgo', 5, 'kg'),
('Semilla de Alfalfa', 5, 'kg'),
('Semilla de Avena', 5, 'kg'),
('Semilla de Centeno', 5, 'kg'),
('Semilla de Maíz temprano', 5, 'un'),
('Semilla de Maíz tardío', 5, 'un'),
('Semilla de Trigo pan', 5, 'kg'),
('Semilla de Trigo candeal', 5, 'kg'),
('Semilla de Colza', 5, 'kg'),

-- COADYUVANTES / ADYUVANTES (6)
('Aceite metilado de soja', 6, 'lt'),
('Aceite vegetal agrícola', 6, 'lt'),
('Surfactante no iónico', 6, 'lt'),
('Coadyuvante siliconado', 6, 'lt'),
('Antievaporante', 6, 'lt'),
('Corrector de pH', 6, 'lt'),
('Secuestrante de cationes', 6, 'lt'),
('Antideriva', 6, 'lt'),
('Humectante agrícola', 6, 'lt'),
('Emulsionante agrícola', 6, 'lt'),

-- BIOINSUMOS / OTROS (14)
('Inoculante para soja', 14, 'lt'),
('Inoculante para leguminosas', 14, 'lt'),
('Trichoderma spp.', 14, 'kg'),
('Bacillus thuringiensis', 14, 'kg'),
('Micorrizas', 14, 'kg'),
('Biofertilizante líquido', 14, 'lt'),
('Extracto de algas', 14, 'lt'),
('Ácidos húmicos', 14, 'lt'),
('Ácidos fúlvicos', 14, 'lt'),
('Enraizante biológico', 14, 'lt');

INSERT INTO providers (userId, name) VALUES
  (1, 'Boscarol Adrian'),
  (1, 'BOSAGRO SRL'),
  (1, 'Ruatta Sergio'),
  (1, 'Raspo Marianela'),
  (1, 'Feraudo y Cortesini');


INSERT INTO users (name, email, password, roles, status)
VALUES
('Federico Beltramino', 'fedeuser@mail.com', '$2b$10$FSdBHx5uV.NTUJeIjyCcGee4LcXwjmwA8ltJfegLl84qPNbBa7qEy', JSON_ARRAY('admin'), 'active'),
('Francisco Beltramino', 'franuser@mail.com', '$2b$10$FSdBHx5uV.NTUJeIjyCcGee4LcXwjmwA8ltJfegLl84qPNbBa7qEy', JSON_ARRAY('admin'), 'active'),
('Martín Beltramino', 'martinuser@mail.com', '$2b$10$FSdBHx5uV.NTUJeIjyCcGee4LcXwjmwA8ltJfegLl84qPNbBa7qEy', JSON_ARRAY('admin'), 'active');