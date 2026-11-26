-- Locations for the evacuation center inventory, from the LIGTAS team (Google
-- Maps and community reports, Nov 2026). Needs 20261126090100_evacuation_center_inventory.sql.
--
-- * 23 centers get a pin: the 9 map-data pins are moved to the spots the team
--   found, the 6 suggested spots become pins, and 8 more come from Google Maps plus
--   codes in their new addresses. Every pin stays "unconfirmed" (not yet checked on
--   site) until an admin ticks that it was.
-- * 13 addresses are replaced with the team's Google Maps addresses; the
--   inventory's address is kept in the remarks.
-- * 8 centers still have no pin (5 of them now have a street address).
--
-- Only centers still as imported are changed: a pin an admin has placed or
-- confirmed in the app since is left alone. Running it again changes nothing.

begin;

-- 1. Municipal Evacuation Center (San Gabriel)
update public.evacuation_centers set
  latitude = 14.8098625,
  longitude = 120.9597969,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps plus code RX55+WWV (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  location = 'RX55+WWV, New Bypass Road Extension, Santa Maria, 3022 Bulacan',
  remarks = 'Run by the Municipality of Santa Maria (listed under LGU–Municipality of Santa Maria, Bulacan). Status in the inventory: Permanent. Address in the inventory: New Bypass Road, San Gabriel.',
  verification_notes = 'Pin from the Google Maps plus code RX55+WWV. Check it on site. Capacity: record the registered capacity.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 1)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from the Google Maps plus code RX55+WWV. Check it on site. Capacity: record the registered capacity.';

-- 2. Sta. Maria National High School (Bagbaguin)
update public.evacuation_centers set
  latitude = 14.8139109,
  longitude = 120.9514925,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps and community reports (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  verification_notes = 'Pin from Google Maps and community reports. Check it on site. Capacity: record how many people the school can shelter.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 2)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from Google Maps and community reports. Check it on site. Capacity: record how many people the school can shelter.';

-- 3. Barangay Covered Court (Balasing)
update public.evacuation_centers set
  latitude = 14.8497033,
  longitude = 120.9994532,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps and community reports (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  verification_notes = 'Pin from Google Maps and community reports, on the covered court about 300 m west of Balasing Elementary School. Check on site that it is the Luwasan court.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 3)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from Google Maps and community reports, on the covered court about 300 m west of Balasing Elementary School. Check on site that it is the Luwasan court.';

-- 4. Buenavista Covered Court (Buenavista)
update public.evacuation_centers set
  location = '74 Purok Libis Brgy, Santa Maria, Bulacan',
  remarks = 'Address in the inventory: Sitio Libis, Buenavista.',
  verification_notes = 'Address from Google Maps (74 Purok Libis), but no pin yet. Copy the place’s plus code from Google Maps, or pin it on site.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 4)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Address from Google Maps (74 Purok Libis), but no pin yet. Copy the place’s plus code from Google Maps, or pin it on site.';

-- 6. Covered Court (Camangyanan)
update public.evacuation_centers set
  location = '254 Camangyanan Rd, Santa Maria, Bulacan',
  remarks = 'Address in the inventory: Purok Centro, Camangyanan.',
  verification_notes = 'Address from Google Maps (254 Camangyanan Rd), but no pin yet. Copy the place’s plus code from Google Maps, or pin it on site.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 6)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Address from Google Maps (254 Camangyanan Rd), but no pin yet. Copy the place’s plus code from Google Maps, or pin it on site.';

-- 7. Catmon Multi-Purpose Covered Court (Central) (Catmon)
update public.evacuation_centers set
  latitude = 14.829111,
  longitude = 121.002042,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps and community reports (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  verification_notes = 'Pin from Google Maps and community reports, on the covered court beside Jose Juan Serapio Elementary School. Check it on site.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 7)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from Google Maps and community reports, on the covered court beside Jose Juan Serapio Elementary School. Check it on site.';

-- 8. Multi-Purpose Covered Court (Caypombo)
update public.evacuation_centers set
  latitude = 14.8504625,
  longitude = 120.9751719,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps plus code VX2G+53M (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  location = 'VX2G+53M, San Mateo St, Santa Maria, Bulacan',
  remarks = 'Address in the inventory: Las Palmas Subd., Caypombo.',
  verification_notes = 'Pin from the Google Maps plus code VX2G+53M (San Mateo St., Las Palmas Subdivision). Check it on site.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 8)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from the Google Maps plus code VX2G+53M (San Mateo St., Las Palmas Subdivision). Check it on site.';

-- 9. Caysio Covered Gym (Caysio)
update public.evacuation_centers set
  latitude = 14.8461414,
  longitude = 120.9685019,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps and community reports (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  verification_notes = 'Pin from Google Maps and community reports, beside Caysio Elementary School. Check on site that it is the barangay’s covered gym. Capacity is estimated as for a covered court.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 9)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from Google Maps and community reports, beside Caysio Elementary School. Check on site that it is the barangay’s covered gym. Capacity is estimated as for a covered court.';

-- 10. St. Mary Village Elementary School (Caysio)
update public.evacuation_centers set
  latitude = 14.8504967,
  longitude = 120.965232,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps and community reports (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  verification_notes = 'Pin from Google Maps and community reports. Check it on site. Capacity: record how many people the school can shelter.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 10)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from Google Maps and community reports. Check it on site. Capacity: record how many people the school can shelter.';

-- 11. Barangay Guyong Multi-Purpose Covered Court (Guyong)
update public.evacuation_centers set
  latitude = 14.8396875,
  longitude = 120.9771094,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps plus code RXQG+VRH (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  location = 'RXQG+VRH, Santa Maria, Bulacan',
  remarks = 'Address in the inventory: Centro, Guyong Complex, Guyong.',
  verification_notes = 'Pin from the Google Maps plus code RXQG+VRH. Check it on site.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 11)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from the Google Maps plus code RXQG+VRH. Check it on site.';

-- 12. Covered Court (Lalakhan)
update public.evacuation_centers set
  location = '295 Lalakhan Rd',
  remarks = 'Address in the inventory: Sitio Gitna, Lalakhan.',
  verification_notes = 'Address from Google Maps (295 Lalakhan Rd), but no pin yet. Copy the place’s plus code from Google Maps, or pin it on site.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 12)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Address from Google Maps (295 Lalakhan Rd), but no pin yet. Copy the place’s plus code from Google Maps, or pin it on site.';

-- 13. Covered Court (Mag-asawang Sapa)
update public.evacuation_centers set
  latitude = 14.8743581,
  longitude = 120.9796079,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps and community reports (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  verification_notes = 'Pin from Google Maps and community reports. Check on site that it is the court beside the new barangay hall.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 13)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from Google Maps and community reports. Check on site that it is the court beside the new barangay hall.';

-- 14. Covered Court (Mahabang Parang)
update public.evacuation_centers set
  latitude = 14.7967125,
  longitude = 120.9621719,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps plus code QXW6+MVM (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  location = 'QXW6+MVM, Santa Maria, Bulacan',
  remarks = 'Address in the inventory: Molave II Street, Mahabang Parang.',
  verification_notes = 'Pin from the Google Maps plus code QXW6+MVM, near Molave II Street. Check it on site.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 14)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from the Google Maps plus code QXW6+MVM, near Molave II Street. Check it on site.';

-- 15. Manggahan Elementary School (Manggahan)
update public.evacuation_centers set
  latitude = 14.8529998,
  longitude = 120.9575847,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps and community reports (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  verification_notes = 'Pin from Google Maps and community reports. Check it on site. Capacity: record how many people the school can shelter.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 15)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from Google Maps and community reports. Check it on site. Capacity: record how many people the school can shelter.';

-- 16. Barangay Hall (Manggahan)
update public.evacuation_centers set
  location = '128 Santa Maria Pandi Rd, Santa Maria, Bulacan',
  remarks = 'Address in the inventory: Sitio Hulo, Manggahan.',
  verification_notes = 'Address from Google Maps (128 Santa Maria–Pandi Rd), but no pin yet. Copy the place’s plus code from Google Maps, or pin it on site. Capacity: no figure for barangay halls in the MDRRMO guidance; record it.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 16)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Address from Google Maps (128 Santa Maria–Pandi Rd), but no pin yet. Copy the place’s plus code from Google Maps, or pin it on site. Capacity: no figure for barangay halls in the MDRRMO guidance; record it.';

-- 17. Ibayong Tabon Covered Court (Parada)
update public.evacuation_centers set
  latitude = 14.8071223,
  longitude = 120.9865295,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps and community reports (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  verification_notes = 'Pin from Google Maps and community reports, by Parada Multipurpose Gym Park in Ibayong Tabon. Check it on site.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 17)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from Google Maps and community reports, by Parada Multipurpose Gym Park in Ibayong Tabon. Check it on site.';

-- 18. Caybanban Covered Court (Parada)
update public.evacuation_centers set
  latitude = 14.8168375,
  longitude = 120.9912656,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps plus code RX8R+PGJ (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  location = 'RX8R+PGJ, Santa Maria, Bulacan',
  remarks = 'Address in the inventory: Caybanban, Parada.',
  verification_notes = 'Pin from the Google Maps plus code RX8R+PGJ. Map data puts this spot just inside San Vicente (its barangay borders are rough). Check on site that it is the Parada court.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 18)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from the Google Maps plus code RX8R+PGJ. Map data puts this spot just inside San Vicente (its barangay borders are rough). Check on site that it is the Parada court.';

-- 19. Multi-Purpose Covered Court (Poblacion)
update public.evacuation_centers set
  location = '236 21st, Poblacion, Santa Maria, Bulacan',
  remarks = 'Address in the inventory: 21st Centuryville, Poblacion.',
  verification_notes = 'Address from Google Maps (236 21st, Poblacion), but no pin yet. Copy the place’s plus code from Google Maps, or pin it on site.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 19)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Address from Google Maps (236 21st, Poblacion), but no pin yet. Copy the place’s plus code from Google Maps, or pin it on site.';

-- 20. Covered Court (Pulong Buhangin)
update public.evacuation_centers set
  latitude = 14.871427,
  longitude = 121.0014805,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps and community reports (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  verification_notes = 'Pin from Google Maps and community reports, at Pulong Buhangin Court beside the barangay hall. Check on site that it is the listed Cityland court.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 20)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from Google Maps and community reports, at Pulong Buhangin Court beside the barangay hall. Check on site that it is the listed Cityland court.';

-- 21. Multi-Purpose Covered Court (San Gabriel)
update public.evacuation_centers set
  latitude = 14.8020875,
  longitude = 120.9626094,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps plus code RX27+R2Q (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  location = 'RX27+R2Q, Santa Maria, Bulacan',
  remarks = 'Address in the inventory: New Site St., San Gabriel.',
  verification_notes = 'Pin from the Google Maps plus code RX27+R2Q, near Saint Gabriel the Archangel Parish. Map data puts this spot just inside Mahabang Parang (rough borders). Check on site that it is the San Gabriel court on New Site St.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 21)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from the Google Maps plus code RX27+R2Q, near Saint Gabriel the Archangel Parish. Map data puts this spot just inside Mahabang Parang (rough borders). Check on site that it is the San Gabriel court on New Site St.';

-- 23. Saint Joseph Elementary School (San Jose Patag)
update public.evacuation_centers set
  latitude = 14.8246125,
  longitude = 120.9800469,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps plus code RXFJ+R2V (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  location = 'RXFJ+R2V, Sitio Gulod I, Brgy, Santa Maria, Bulacan',
  remarks = 'Address in the inventory: Centro, San Jose Patag. The pin is at San Jose Patag Elementary School.',
  verification_notes = 'Pin from the Google Maps plus code RXFJ+R2V, which is San Jose Patag Elementary School (DepEd ID 105162). Confirm it is the school the inventory calls Saint Joseph Elementary School. Capacity: record how many people it can shelter.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 23)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from the Google Maps plus code RXFJ+R2V, which is San Jose Patag Elementary School (DepEd ID 105162). Confirm it is the school the inventory calls Saint Joseph Elementary School. Capacity: record how many people it can shelter.';

-- 24. Hulo Covered Court (San Vicente)
update public.evacuation_centers set
  latitude = 14.8101875,
  longitude = 121.0100625,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps plus code R266+32 (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  location = 'R266+32, Santa Maria, Bulacan',
  remarks = 'Address in the inventory: Sitio Hulo, San Vicente.',
  verification_notes = 'Pin from the Google Maps plus code R266+32 (accurate to about 14 m). Check it on site.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 24)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from the Google Maps plus code R266+32 (accurate to about 14 m). Check it on site.';

-- 26. Sta. Clara Covered Court (Santa Clara)
update public.evacuation_centers set
  latitude = 14.8292357,
  longitude = 120.9548957,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps and community reports (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  verification_notes = 'Pin from Google Maps and community reports. Map data puts the court on Tindalo Street; the inventory says Almasiga St. Check the pin and the street on site.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 26)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from Google Maps and community reports. Map data puts the court on Tindalo Street; the inventory says Almasiga St. Check the pin and the street on site.';

-- 27. Sta. Cruz Elementary School (Santa Cruz)
update public.evacuation_centers set
  latitude = 14.8422021,
  longitude = 120.9563336,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps and community reports (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  verification_notes = 'Pin from Google Maps and community reports. Check it on site. Capacity: record how many people the school can shelter.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 27)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from Google Maps and community reports. Check it on site. Capacity: record how many people the school can shelter.';

-- 28. Sta. Cruz Proper Chapel (Santa Cruz)
update public.evacuation_centers set
  latitude = 14.8361769,
  longitude = 120.9552898,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps and community reports (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  verification_notes = 'Pin from Google Maps and community reports, at the Sta. Cruz Proper Sub-Parish. Confirm it is the listed chapel. Capacity: decide whether it is a larger or smaller chapel and set the estimate.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 28)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from Google Maps and community reports, at the Sta. Cruz Proper Sub-Parish. Confirm it is the listed chapel. Capacity: decide whether it is a larger or smaller chapel and set the estimate.';

-- 29. Sta. Cruz High School (Santa Cruz)
update public.evacuation_centers set
  latitude = 14.8385776,
  longitude = 120.9596441,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps and community reports (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  verification_notes = 'Pin from Google Maps and community reports, at the high school in Sitio Bukid (map data: Santa Cruz High School – Annex). Confirm it is the listed school. Capacity: record how many people it can shelter.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 29)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from Google Maps and community reports, at the high school in Sitio Bukid (map data: Santa Cruz High School – Annex). Confirm it is the listed school. Capacity: record how many people it can shelter.';

-- 30. Tabing Bakod Elementary School Covered Court (Santo Tomas)
update public.evacuation_centers set
  latitude = 14.8018995,
  longitude = 120.9541555,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps and community reports (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  verification_notes = 'Pin from Google Maps and community reports. Check on site that it is on the court inside the school.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 30)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from Google Maps and community reports. Check on site that it is on the court inside the school.';

-- 31. Covered Court (Tumana)
update public.evacuation_centers set
  latitude = 14.815005,
  longitude = 120.9764331,
  location_status = 'unconfirmed',
  location_source = 'LIGTAS team: Google Maps and community reports (Nov 2026)',
  suggested_latitude = null,
  suggested_longitude = null,
  verification_notes = 'Pin from Google Maps and community reports. Check it on site.'
where source = 'Inventory of Evacuation Centers, Santa Maria, Bulacan (row 31)'
  and location_status <> 'confirmed'
  and (latitude is null or location_source like 'OpenStreetMap%')
  and verification_notes is distinct from 'Pin from Google Maps and community reports. Check it on site.';

commit;
