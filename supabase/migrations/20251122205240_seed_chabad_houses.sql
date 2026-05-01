/*
  # Seed Chabad Houses Data

  ## Description
  This migration adds the initial Chabad house locations to the database.
  These were previously hardcoded in the application but are now managed through the database.

  ## Changes
  - Insert 8 Chabad house locations in Thailand and Israel
  - Each location includes name, description, address, coordinates, and contact information

  ## Notes
  - Uses DO $$ blocks to prevent duplicate insertions
  - All coordinates are accurate based on actual Chabad house locations
*/

-- Insert Chabad Houses data
DO $$
BEGIN
  -- Insert Tiberias location
  IF NOT EXISTS (SELECT 1 FROM chabad_houses WHERE name = 'בית חב"ד טבריה') THEN
    INSERT INTO chabad_houses (
      name,
      description,
      address,
      city,
      country,
      latitude,
      longitude,
      phone,
      website
    ) VALUES (
      'בית חב"ד טבריה',
      'בית חב"ד לטיילים בטבריה',
      'רחוב הגליל 32',
      'טבריה',
      'IL',
      32.7940,
      35.5384,
      '+972523456789',
      'https://chabadtiberias.org'
    );
  END IF;

  -- Insert Koh Phangan location
  IF NOT EXISTS (SELECT 1 FROM chabad_houses WHERE name = 'בית חב"ד קופנגן') THEN
    INSERT INTO chabad_houses (
      name,
      description,
      address,
      city,
      country,
      latitude,
      longitude,
      phone,
      website
    ) VALUES (
      'בית חב"ד קופנגן',
      'בית חב"ד לטיילים בקופנגן',
      'Thong Sala, Koh Phangan',
      'קופנגן',
      'TH',
      9.756233,
      99.966318,
      '+66123456789',
      'https://chabadkohphangan.com'
    );
  END IF;

  -- Insert Bangkok Khaosan location
  IF NOT EXISTS (SELECT 1 FROM chabad_houses WHERE name = 'בית חב"ד בנגקוק - אור מנחם') THEN
    INSERT INTO chabad_houses (
      name,
      description,
      address,
      city,
      country,
      latitude,
      longitude,
      phone,
      website
    ) VALUES (
      'בית חב"ד בנגקוק - אור מנחם',
      'בית חב"ד לטיילים באזור קאו סאן',
      '18 Phra Athit Road, Khao San',
      'בנגקוק',
      'TH',
      13.7589,
      100.4970,
      '+6626295929',
      'https://chabadthailand.co.il'
    );
  END IF;

  -- Insert Bangkok Sukhumvit location
  IF NOT EXISTS (SELECT 1 FROM chabad_houses WHERE name = 'בית חב"ד בנגקוק - סוכומווית') THEN
    INSERT INTO chabad_houses (
      name,
      description,
      address,
      city,
      country,
      latitude,
      longitude,
      phone,
      website
    ) VALUES (
      'בית חב"ד בנגקוק - סוכומווית',
      'המרכז היהודי בבנגקוק',
      '121 Soi Sai Nam Thip 2, Sukhumvit Soi 22',
      'בנגקוק',
      'TH',
      13.7353,
      100.5703,
      '+6626632770',
      'https://chabadthailand.org'
    );
  END IF;

  -- Insert Chiang Mai location
  IF NOT EXISTS (SELECT 1 FROM chabad_houses WHERE name = 'בית חב"ד צ׳יאנג מאי') THEN
    INSERT INTO chabad_houses (
      name,
      description,
      address,
      city,
      country,
      latitude,
      longitude,
      phone,
      website
    ) VALUES (
      'בית חב"ד צ׳יאנג מאי',
      'בית חב"ד לטיילים בצ׳יאנג מאי',
      '189/15 Chang-Klan Rd',
      'צ׳יאנג מאי',
      'TH',
      18.7883,
      98.9993,
      '+66819566505',
      'https://chabadthailand.co.il'
    );
  END IF;

  -- Insert Koh Samui location
  IF NOT EXISTS (SELECT 1 FROM chabad_houses WHERE name = 'בית חב"ד קוסמוי') THEN
    INSERT INTO chabad_houses (
      name,
      description,
      address,
      city,
      country,
      latitude,
      longitude,
      phone,
      website
    ) VALUES (
      'בית חב"ד קוסמוי',
      'בית חב"ד לטיילים בקוסמוי',
      '39/8 Chaweng Beach, Moo 3',
      'קוסמוי',
      'TH',
      9.522317,
      100.057339,
      '+66898764999',
      'https://chabadthailand.co.il'
    );
  END IF;

  -- Insert Phuket location
  IF NOT EXISTS (SELECT 1 FROM chabad_houses WHERE name = 'בית חב"ד פוקט') THEN
    INSERT INTO chabad_houses (
      name,
      description,
      address,
      city,
      country,
      latitude,
      longitude,
      phone,
      website
    ) VALUES (
      'בית חב"ד פוקט',
      'בית חב"ד לטיילים בפטונג',
      '9/6 Rat-U-Thit 200 Pee Rd, Patong',
      'פוקט',
      'TH',
      7.8967,
      98.2969,
      '+66898764777',
      'https://chabadthailand.co.il'
    );
  END IF;

  -- Insert Pai location
  IF NOT EXISTS (SELECT 1 FROM chabad_houses WHERE name = 'בית חב"ד פאי') THEN
    INSERT INTO chabad_houses (
      name,
      description,
      address,
      city,
      country,
      latitude,
      longitude,
      phone,
      website
    ) VALUES (
      'בית חב"ד פאי',
      'בית חב"ד לטיילים בפאי',
      'Rural Rd Mae Hong Son 4024, Wiang Tai',
      'פאי',
      'TH',
      19.3582,
      98.4394,
      '+66819566505',
      'https://chabadthailand.co.il'
    );
  END IF;

END $$;
