-- Evacuation center pins from the LIGTAS team's updated "Evacuation centers
-- to confirm" list (Nov 2026). Needs 20261126100000_evacuation_center_locations.sql.
--
-- The list's first two parts (9 pins to check, 6 suggested spots) match the
-- pins already in LIGTAS. Its third part gives coordinates for the 16 centers
-- that still needed a location. Each was checked against map data
-- (OpenStreetMap: barangay borders and what is mapped at the spot) and the
-- official inventory's address:
--
-- * 7 centers get their first pin: Buenavista, Bulac, Camangyanan, Lalakhan,
--   Manggahan Barangay Hall, Poblacion and Silangan.
-- * 4 pins move: Municipal Evacuation Center (by under 2 m), Caypombo
--   (to the covered court beside the barangay hall), Guyong (to the Guyong
--   Barangay Hall complex on Centro Street) and Saint Joseph Elementary School
--   (to beside St. Joseph College of Bulacan). Where the old address was the
--   old pin's plus code, the inventory's address is used again.
-- * 4 coordinates in the list are NOT used, and those pins stay as they are:
--   - Caybanban Covered Court: the same coordinates as Ibayong Tabon Covered
--     Court (copied), at Parada Multipurpose Gym Park.
--   - Multi-Purpose Covered Court, San Gabriel: the same coordinates as the
--     Municipal Evacuation Center (copied).
--   - Covered Court, Mahabang Parang: the list's spot is Mahabang Parang
--     Elementary School, 690 m from Molave II Street (the inventory's address);
--     the current pin is 76 m from Molave II Street.
--   - Hulo Covered Court, San Vicente: the list's spot is in Sitio Gulod
--     (map data: "San Vicente Gulod", Gulod Street), not Sitio Hulo.
--   Their notes say so, with the list's coordinates, for a check on site.
-- * Covered Court, San Jose Patag: no coordinates in the list; still no pin.
--
-- Every pin stays "not yet checked on site" (the list marks every row "To
-- check"). Capacities are unchanged (none were recorded in the list).
--
-- Only centers still as the last migration left them are changed (same
-- coordinates, not confirmed on site), so nothing an admin has changed in the
-- app is overwritten. Running it again changes nothing.

begin;

-- ---------------------------------------------------------------------------
-- First pins
-- ---------------------------------------------------------------------------

-- 4. Buenavista Covered Court (Buenavista)
update public.evacuation_centers set
  latitude = 14.799302795036036,
  longitude = 120.99122565609292,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: updated list of centers to confirm (Nov 2026)',
  verification_notes = 'Pin from the LIGTAS team''s updated list, beside Buenavista Libis Road (Sitio Libis, as in the inventory). Map data''s rough barangay border puts this spot just inside San Vicente. Check on site that it is on the Buenavista covered court.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 4)'
  and location_status <> 'confirmed'
  and latitude is null and longitude is null;

-- 5. Bulac Covered Court (Bulac)
update public.evacuation_centers set
  latitude = 14.824599618272234,
  longitude = 121.00984195215827,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: updated list of centers to confirm (Nov 2026)',
  verification_notes = 'Pin from the LIGTAS team''s updated list, about 20 m from Kaylawig Elementary School in map data. Splashville Subdivision (the inventory''s address) is not in map data. Check on site that it is on the covered court in Splashville.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 5)'
  and location_status <> 'confirmed'
  and latitude is null and longitude is null;

-- 6. Covered Court (Camangyanan)
update public.evacuation_centers set
  latitude = 14.79711,
  longitude = 120.97107,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: updated list of centers to confirm (Nov 2026)',
  verification_notes = 'Pin from the LIGTAS team''s updated list. It is the same spot as Camangyanan Elementary School in map data (on Camangyanan Road). Check on site that the pin is on the covered court (Purok Centro).'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 6)'
  and location_status <> 'confirmed'
  and latitude is null and longitude is null;

-- 12. Covered Court (Lalakhan)
update public.evacuation_centers set
  latitude = 14.816303173104533,
  longitude = 120.94665343743848,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: updated list of centers to confirm (Nov 2026)',
  verification_notes = 'Pin from the LIGTAS team''s updated list (inside Lalakhan in map data; the court itself is not mapped). Check it on site (Sitio Gitna, 295 Lalakhan Rd).'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 12)'
  and location_status <> 'confirmed'
  and latitude is null and longitude is null;

-- 16. Barangay Hall (Manggahan)
update public.evacuation_centers set
  latitude = 14.85278,
  longitude = 120.95757,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: updated list of centers to confirm (Nov 2026)',
  verification_notes = 'Pin from the LIGTAS team''s updated list, in Sitio Hulo as in the inventory. It is the same spot as Manggahan Elementary School in map data (the hall is not mapped), about 25 m from the school''s own pin. Check on site that the pin is on the barangay hall. Capacity: no figure for barangay halls in the MDRRMO guidance; record it.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 16)'
  and location_status <> 'confirmed'
  and latitude is null and longitude is null;

-- 19. Multi-Purpose Covered Court (Poblacion)
update public.evacuation_centers set
  latitude = 14.819462392781727,
  longitude = 120.96027807942941,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: updated list of centers to confirm (Nov 2026)',
  verification_notes = 'Pin from the LIGTAS team''s updated list, at the Santa Maria Gymnasium beside the Municipal Hall in map data. 21st Centuryville (the inventory''s address) is not in map data. Check on site that this is the listed covered court.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 19)'
  and location_status <> 'confirmed'
  and latitude is null and longitude is null;

-- 25. Covered Court (Silangan)
update public.evacuation_centers set
  latitude = 14.88831,
  longitude = 120.98781,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: updated list of centers to confirm (Nov 2026)',
  verification_notes = 'Pin from the LIGTAS team''s updated list (inside Silangan in map data; nothing is mapped at the spot). Check it on site (119 Silangan).'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 25)'
  and location_status <> 'confirmed'
  and latitude is null and longitude is null;

-- ---------------------------------------------------------------------------
-- Pins that move
-- ---------------------------------------------------------------------------

-- 1. Municipal Evacuation Center (San Gabriel): the same place, more precisely.
update public.evacuation_centers set
  latitude = 14.809876361232376,
  longitude = 120.95979420026985,
  location_source = 'LIGTAS team: updated list of centers to confirm (Nov 2026)',
  verification_notes = 'Pin from the LIGTAS team''s updated list (under 2 m from the earlier plus code RX55+WWV). Check it on site. Capacity: record the registered capacity.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 1)'
  and location_status <> 'confirmed'
  and latitude = 14.8098625 and longitude = 120.9597969;

-- 8. Multi-Purpose Covered Court (Caypombo)
update public.evacuation_centers set
  latitude = 14.851294817192262,
  longitude = 120.97817807851168,
  location_source = 'LIGTAS team: updated list of centers to confirm (Nov 2026)',
  location = 'Las Palmas Subd., Caypombo, Santa Maria, Bulacan',
  remarks = null,
  verification_notes = 'Pin from the LIGTAS team''s updated list: the covered multi-purpose court beside Caypombo Barangay Hall in map data. The earlier pin (plus code VX2G+53M) was the open court inside Las Palmas Subdivision, about 330 m west. Check on site which one is the listed covered court.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 8)'
  and location_status <> 'confirmed'
  and latitude = 14.8504625 and longitude = 120.9751719;

-- 11. Barangay Guyong Multi-Purpose Covered Court (Guyong)
update public.evacuation_centers set
  latitude = 14.83577375337853,
  longitude = 120.97636155315305,
  location_source = 'LIGTAS team: updated list of centers to confirm (Nov 2026)',
  location = 'Centro, Guyong Complex, Guyong, Santa Maria, Bulacan',
  remarks = null,
  verification_notes = 'Pin from the LIGTAS team''s updated list, on Centro Street about 40 m from Guyong Barangay Hall in map data (the Guyong Complex in the inventory). The earlier pin (plus code RXQG+VRH) was about 440 m north. Check it on site.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 11)'
  and location_status <> 'confirmed'
  and latitude = 14.8396875 and longitude = 120.9771094;

-- 23. Saint Joseph Elementary School (San Jose Patag)
update public.evacuation_centers set
  latitude = 14.82612,
  longitude = 120.98099,
  location_source = 'LIGTAS team: updated list of centers to confirm (Nov 2026)',
  location = 'Centro, San Jose Patag, Santa Maria, Bulacan',
  remarks = null,
  verification_notes = 'Pin from the LIGTAS team''s updated list, on the main road about 75 m from St. Joseph College of Bulacan in map data. The earlier pin (plus code RXFJ+R2V) was San Jose Patag Elementary School (DepEd ID 105162), about 200 m south-west. Confirm which school the inventory calls Saint Joseph Elementary School, and move the pin onto it. Capacity: record how many people it can shelter.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 23)'
  and location_status <> 'confirmed'
  and latitude = 14.8246125 and longitude = 120.9800469;

-- ---------------------------------------------------------------------------
-- Coordinates in the list that are not used (the pin stays; the note says why)
-- ---------------------------------------------------------------------------

-- 14. Covered Court (Mahabang Parang)
update public.evacuation_centers set
  verification_notes = 'Pin from the Google Maps plus code QXW6+MVM, 76 m from Molave II Street (the inventory''s address). The updated list gave 14.79020, 120.96213 instead, which is Mahabang Parang Elementary School, about 690 m south and not on Molave II Street, so it was not used. Check on site.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 14)'
  and location_status <> 'confirmed'
  and latitude = 14.7967125 and longitude = 120.9621719;

-- 18. Caybanban Covered Court (Parada)
update public.evacuation_centers set
  verification_notes = 'Pin from the Google Maps plus code RX8R+PGJ. Map data puts this spot just inside San Vicente (its barangay borders are rough). The updated list gave the same coordinates as Ibayong Tabon Covered Court (14.80712, 120.98653, Parada Multipurpose Gym Park), most likely copied, so they were not used. Check on site that the pin is on the Caybanban court.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 18)'
  and location_status <> 'confirmed'
  and latitude = 14.8168375 and longitude = 120.9912656;

-- 21. Multi-Purpose Covered Court (San Gabriel)
update public.evacuation_centers set
  verification_notes = 'Pin from the Google Maps plus code RX27+R2Q, near Saint Gabriel the Archangel Parish; map data puts it just inside Mahabang Parang (rough borders). The updated list gave the same coordinates as the Municipal Evacuation Center (14.80988, 120.95979), most likely copied, so they were not used. Check on site that it is the San Gabriel court on New Site St.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 21)'
  and location_status <> 'confirmed'
  and latitude = 14.8020875 and longitude = 120.9626094;

-- 24. Hulo Covered Court (San Vicente)
update public.evacuation_centers set
  verification_notes = 'Pin from the Google Maps plus code R266+32 (accurate to about 14 m), 75 m from a covered court in map data. The updated list gave 14.80216, 120.99993 instead, which is in Sitio Gulod (map data: San Vicente Gulod, Gulod Street), about 1.4 km away and not Sitio Hulo, so it was not used. Check on site.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 24)'
  and location_status <> 'confirmed'
  and latitude = 14.8101875 and longitude = 121.0100625;

commit;
