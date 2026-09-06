export interface MaintenanceCriteria {
  number: number;
  code: string;
  title: string;
  section: string;
  category: 'CAT 1' | 'CAT 2' | 'CAT 3';
  priorityLevel: 'CAT 1' | 'CAT 2 - Interim' | 'CAT 2' | 'CAT 3';
  timescale: string;
  interimRequirement?: string;
  priorityTimeDays: number; // 0 for CAT 1 (4 hrs), 1 for CAT 2 - Interim, 5 for CAT 2, 21 for CAT 3
}

export const MAINTENANCE_CRITERIA_LIST: MaintenanceCriteria[] = [
  // B.2 SAFE ACCOMMODATION (CAT-1, 4 Hours)
  {
    number: 1,
    code: 'B.2.1.1',
    title: 'Gas leak;',
    section: 'B.2 Safe Accommodation (Unsafe - Immediate Vacation)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 2,
    code: 'B.2.1.2',
    title: 'Structural instability;',
    section: 'B.2 Safe Accommodation (Unsafe - Immediate Vacation)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 3,
    code: 'B.2.1.3',
    title: 'Flooding or free standing water within the accommodation;',
    section: 'B.2 Safe Accommodation (Unsafe - Immediate Vacation)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 4,
    code: 'B.2.1.4',
    title: 'Water penetration through the structure of the accommodation resulting in pooling;',
    section: 'B.2 Safe Accommodation (Unsafe - Immediate Vacation)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 5,
    code: 'B.2.1.5',
    title: 'Damaged or friable asbestos linings or insulation products;',
    section: 'B.2 Safe Accommodation (Unsafe - Immediate Vacation)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 6,
    code: 'B.2.1.6',
    title: 'Fire damage;',
    section: 'B.2 Safe Accommodation (Unsafe - Immediate Vacation)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 7,
    code: 'B.2.1.7',
    title: 'A health and safety assessment of Category A, B or C as applicable under Relevant Law.',
    section: 'B.2 Safe Accommodation (Unsafe - Immediate Vacation)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 8,
    code: 'B.2.1.8',
    title: 'Electrical damage that could lead to fire or other injury',
    section: 'B.2 Safe Accommodation (Unsafe - Immediate Vacation)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },

  // B.3 HABITABLE ACCOMMODATION (CAT-1, 4 Hours)
  {
    number: 9,
    code: 'B.3.1.1',
    title: 'No mains water supplied;',
    section: 'B.3 Habitable Accommodation (Severe Defects - Emergency Action)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 10,
    code: 'B.3.1.2',
    title: 'No gas supplied where gas is normally supplied;',
    section: 'B.3 Habitable Accommodation (Severe Defects - Emergency Action)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 11,
    code: 'B.3.1.3',
    title: 'No electrical power supplied;',
    section: 'B.3 Habitable Accommodation (Severe Defects - Emergency Action)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 12,
    code: 'B.3.1.4',
    title: 'Falling or unstable ceiling fabric;',
    section: 'B.3 Habitable Accommodation (Severe Defects - Emergency Action)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 13,
    code: 'B.3.1.5',
    title: 'Hole in or weakened floor;',
    section: 'B.3 Habitable Accommodation (Severe Defects - Emergency Action)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 14,
    code: 'B.3.1.6',
    title: 'Bare or exposed electrical wiring;',
    section: 'B.3 Habitable Accommodation (Severe Defects - Emergency Action)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 15,
    code: 'B.3.1.7',
    title: 'No operational smoke or fire alarms;',
    section: 'B.3 Habitable Accommodation (Severe Defects - Emergency Action)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 16,
    code: 'B.3.1.8',
    title: 'No operational hot water supply;',
    section: 'B.3 Habitable Accommodation (Severe Defects - Emergency Action)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 17,
    code: 'B.3.1.9',
    title: 'No operational space heating system;',
    section: 'B.3 Habitable Accommodation (Severe Defects - Emergency Action)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 18,
    code: 'B.3.1.10',
    title: 'Blocked drainage either inside or outside the accommodation that affects the accommodation;',
    section: 'B.3 Habitable Accommodation (Severe Defects - Emergency Action)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 19,
    code: 'B.3.1.11',
    title: 'Plumbing leaks that give rise to potential flooding within the accommodation or in other accommodation or property;',
    section: 'B.3 Habitable Accommodation (Severe Defects - Emergency Action)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 20,
    code: 'B.3.1.12',
    title: 'No valid gas and/or electrical certification',
    section: 'B.3 Habitable Accommodation (Severe Defects - Emergency Action)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 21,
    code: 'B.3.1.13',
    title: 'Broken glazing; and',
    section: 'B.3 Habitable Accommodation (Severe Defects - Emergency Action)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },
  {
    number: 22,
    code: 'B.3.1.14',
    title: 'Ground floor windows and other accessible windows and any entrance doors that are not capable of being closed and locked.',
    section: 'B.3 Habitable Accommodation (Severe Defects - Emergency Action)',
    category: 'CAT 1',
    priorityLevel: 'CAT 1',
    timescale: '4 Hours',
    priorityTimeDays: 0
  },

  // B.4 FIT FOR PURPOSE - ACCOMMODATION GENERALLY (CAT-2, 5 Working Days, Interim 24hrs)
  {
    number: 23,
    code: 'B.4.1.1',
    title: 'The accommodation is of the type appropriate to be allocated to the Service User;',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 24,
    code: 'B.4.1.2',
    title: 'The interior structure of accommodation and all fixtures and fittings safe and free from defects or artefacts that may pose a hazard to Service Users;',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 25,
    code: 'B.4.1.3',
    title: 'Windows and balconies provide protection against falling for vulnerable occupants (as defined in Paragraph 1.2.1);',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 26,
    code: 'B.4.1.4',
    title: 'Roofs, walls, and external widows and doors are weatherproof;',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 27,
    code: 'B.4.1.5',
    title: 'Internal ventilation sufficient to prevent dampness and condensation and be adequate for energy consumption and waste air, smoke, fumes and gas extraction;',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 28,
    code: 'B.4.1.6',
    title: 'Smoke and/or heat detectors fitted on each floor and in compliance with the relevant British Standards, Building Regulations and Local Authority requirements.',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 29,
    code: 'B.4.1.7',
    title: 'CO detectors',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 30,
    code: 'B.4.1.8',
    title: 'Doors and windows capable of being secured to the minimum standards recommended by the Police and the Association of British Insurers;',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 31,
    code: 'B.4.1.9',
    title: 'All windows above ground floor level have restrictors where vulnerable occupants may be present;',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 32,
    code: 'B.4.1.10',
    title: 'Drinking and other cold water supplies available at all times on demand and of sufficient pressure to operate heating installations;',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 33,
    code: 'B.4.1.11',
    title: 'If a full space heating system is not installed then appropriate fixed heating appliances are fitted in the living areas. Paraffin or bottled gas heating systems shall not be used;',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 34,
    code: 'B.4.1.12',
    title: 'Plumbing operational and leak free;',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 35,
    code: 'B.4.1.13',
    title: 'In houses of multiple occupation adequate notice explaining action to be taken in the event of fire or other emergency and identifying fire emergency exits.',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 36,
    code: 'B.4.1.14',
    title: 'In houses of multiple occupation all bathrooms, shower rooms, toilets, and bedrooms have locks capable of being locked from the inside;',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 37,
    code: 'B.4.1.15',
    title: 'Kitchen fit out to include cupboard space within the constraints of the existing structure;',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 38,
    code: 'B.4.1.16',
    title: 'Kitchen units easy to clean and maintain;',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 39,
    code: 'B.4.1.17',
    title: 'Bathrooms equipped with a bath or shower, toilet, wash hand basin, all in working order and a towel rail;',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 40,
    code: 'B.4.1.18',
    title: 'Floor covering in kitchens and bathrooms easy to clean and moisture resistant;',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 41,
    code: 'B.4.1.19',
    title: 'The accommodation is free from pest infestation;',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },
  {
    number: 42,
    code: 'B.4.1.20',
    title: 'The accommodation has a telephone line installed or is capable of having such a line installed.',
    section: 'B.4 Fit for Purpose - Accommodation Generally',
    category: 'CAT 2',
    priorityLevel: 'CAT 2',
    timescale: '5 Working Days',
    interimRequirement: 'Interim Solution Needs to be provided within 24hrs',
    priorityTimeDays: 5
  },

  // B.4.2 DECORATIVE & CLEANING (CAT-3, 21 Working Days)
  {
    number: 43,
    code: 'B.4.2.1.1',
    title: 'Significant holes and cracks in walls, ceilings, floors, doors and any plastered surface;',
    section: 'B.4.2 Decorative Condition (Paint/Emulsion Surfaces)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 44,
    code: 'B.4.2.1.2',
    title: 'Extensive peeling, flaking or blistering;',
    section: 'B.4.2 Decorative Condition (Paint/Emulsion Surfaces)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 45,
    code: 'B.4.2.1.3',
    title: 'Ingrained dirt which is not possible for the Service User to remove;',
    section: 'B.4.2 Decorative Condition (Paint/Emulsion Surfaces)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 46,
    code: 'B.4.2.1.4',
    title: 'Discoloration or variation of colour due to partial redecoration, cleaning materials etc.',
    section: 'B.4.2 Decorative Condition (Paint/Emulsion Surfaces)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 47,
    code: 'B.4.2.1.5',
    title: 'Signs of dampness and mould growth.',
    section: 'B.4.2 Decorative Condition (Paint/Emulsion Surfaces)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 48,
    code: 'B.4.2.2.1',
    title: 'Holes and cracks in walls, ceilings and any plastered surface;',
    section: 'B.4.2 Decorative Condition (Wallpapered Surfaces)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 49,
    code: 'B.4.2.2.2',
    title: 'Ingrained dirt which is not possible for the Service User to remove;',
    section: 'B.4.2 Decorative Condition (Wallpapered Surfaces)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 50,
    code: 'B.4.2.2.3',
    title: 'Discoloration or variation of colour on wallpaper surfaces;',
    section: 'B.4.2 Decorative Condition (Wallpapered Surfaces)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 51,
    code: 'B.4.2.2.4',
    title: 'Signs of dampness and mould growth on wallpaper;',
    section: 'B.4.2 Decorative Condition (Wallpapered Surfaces)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 52,
    code: 'B.4.3',
    title: 'Wood surface to be cleaned.',
    section: 'B.4.2 Decorative Condition',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 53,
    code: 'B.4.4',
    title: 'Wall tiles and floor tiles to be free of significant damage.',
    section: 'B.4.2 Decorative Condition',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 54,
    code: 'B.4.5.1',
    title: 'Loose dust, debris and all refuse removed;',
    section: 'B.4.5 Cleanliness Prior to Occupancy',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 55,
    code: 'B.4.5.2',
    title: 'All surfaces including walls, tiling, sills, cupboards and drawers to be washed down and cleaned of grease/deposits;',
    section: 'B.4.5 Cleanliness Prior to Occupancy',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 56,
    code: 'B.4.5.3',
    title: 'Floors and floor coverings to be washed down or cleaned of grease and disinfected;',
    section: 'B.4.5 Cleanliness Prior to Occupancy',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 57,
    code: 'B.4.5.4',
    title: 'Sinks, baths, shower units and other sanitary-ware to be cleaned and free of stains;',
    section: 'B.4.5 Cleanliness Prior to Occupancy',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 58,
    code: 'B.4.5.5',
    title: 'Windows and frames to be washed down and disinfected and cleaned of deposits.',
    section: 'B.4.5 Cleanliness Prior to Occupancy',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },

  // B.5 FIT FOR PURPOSE - DISABLED PERSONS (CAT-3, 21 Working Days)
  {
    number: 59,
    code: 'B.5.1',
    title: 'Accommodation for disabled persons fit for purpose and compliant with Relevant Law.',
    section: 'B.5 Disabled Persons Standards',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 60,
    code: 'B.5.2',
    title: 'Accommodation provided for vulnerable persons is compliant with Relevant Law.',
    section: 'B.5 Disabled Persons Standards',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },

  // B.6 FIT FOR PURPOSE - PUBLIC AREAS (CAT-3, 21 Working Days)
  {
    number: 61,
    code: 'B.6.1.1.1',
    title: 'Floors, doors, stairs, walls, ceilings, parapets, balustrades, hand rails free from defects or artefacts that may pose a hazard to people;',
    section: 'B.6 Fit for Purpose - Public Areas (Building Boundaries)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 62,
    code: 'B.6.1.1.2',
    title: 'Floors, doors, stairs, walls, ceilings, balustrades free from litter, fly-posters, accumulated debris, graffiti;',
    section: 'B.6 Fit for Purpose - Public Areas (Building Boundaries)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 63,
    code: 'B.6.1.1.3',
    title: 'Lifts maintained in accordance with manufacturers’ specifications and in working order;',
    section: 'B.6 Fit for Purpose - Public Areas (Building Boundaries)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 64,
    code: 'B.6.1.1.4',
    title: 'Lighting in all public areas in working order;',
    section: 'B.6 Fit for Purpose - Public Areas (Building Boundaries)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 65,
    code: 'B.6.1.1.5',
    title: 'Porch canopies and flat roof areas free of debris and organic matter;',
    section: 'B.6 Fit for Purpose - Public Areas (Building Boundaries)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 66,
    code: 'B.6.1.1.6',
    title: 'All drainage, guttering and other water channels in working order with no ponding, leaks or overflows;',
    section: 'B.6 Fit for Purpose - Public Areas (Building Boundaries)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 67,
    code: 'B.6.1.1.7',
    title: 'All public areas free from pest infestation;',
    section: 'B.6 Fit for Purpose - Public Areas (Building Boundaries)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 68,
    code: 'B.6.1.1.8',
    title: 'Walls, stairway structures, ceilings and floors free from holes, cracks, loose plaster, spalling concrete;',
    section: 'B.6 Fit for Purpose - Public Areas (Building Boundaries)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 69,
    code: 'B.6.1.1.9',
    title: 'Doors, hatches and other coverings free from holes, securable where appropriate, and in proper operating order.',
    section: 'B.6 Fit for Purpose - Public Areas (Building Boundaries)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 70,
    code: 'B.6.1.2.1',
    title: 'Walkways and pavements, stairways and steps, walls, balustrades, hand rails free from defects or hazards to people;',
    section: 'B.6 Fit for Purpose - Public Areas (Other External Areas)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  },
  {
    number: 71,
    code: 'B.6.1.2.2',
    title: 'Walkways and pavements, stairways, walls, balustrades free from litter, fly-posters, debris, graffiti and marks.',
    section: 'B.6 Fit for Purpose - Public Areas (Other External Areas)',
    category: 'CAT 3',
    priorityLevel: 'CAT 3',
    timescale: '21 Working Days',
    priorityTimeDays: 21
  }
];
