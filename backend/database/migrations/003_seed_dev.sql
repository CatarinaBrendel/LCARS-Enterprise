-- backend/migrations/003_seed_dev.sql
-- Dev/demo seed for crew roster
-- Safe to rerun thanks to ON CONFLICT DO NOTHING

-- Basic seed (dev)
INSERT INTO crew (name, role, deck_zone)
VALUES
  ('J. Pike',        'Captain',     'Bridge'),
  ('S. T''Pring',    'Science',     'Bridge'),
  ('M. Torres',      'Engineering', 'Engineering'),
  ('B. Chapel',      'Medical',     'MedBay'),
  ('H. Odo',         'Security',    'Habitat'),
  ('K. Nog',         'Ops',         'Cargo'),
  ('R. La''An',      'Security',    'Bridge'),
  ('A. Rutherford',  'Engineering', 'Engineering'),
  ('T. Paris',       'Ops',         'Cargo'),
  ('K. Bashir',      'Medical',     'MedBay')
ON CONFLICT DO NOTHING;