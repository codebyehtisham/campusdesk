export const faculty = [
  {
    name: 'MD Musarrat Khannum',
    designation: 'Managing Director (MD)',
    department: 'leadership',
    bio: 'MD Musarrat Khannum leads Explore College of Nursing and Allied Health Sciences with a vision to build a center of excellence for nursing and allied health education, focused on producing compassionate, highly skilled healthcare professionals.',
    qualifications: 'Managing Director',
    image: '/images/leadership/md-musarrat-khannum.svg',
    order: 1,
  },
  {
    name: 'Mohammad Saim Jalil',
    designation: 'Chief Executive Officer (CEO)',
    department: 'leadership',
    bio: 'Mohammad Saim Jalil oversees the strategic direction and operations of the college, driving quality education, industry partnerships, and student-centered growth initiatives.',
    qualifications: 'Chief Executive Officer',
    image: '/images/leadership/ceo-mohammad-saim-jalil.svg',
    order: 2,
  },
  {
    name: 'Nazia Shaukat',
    designation: 'Principal',
    department: 'leadership',
    bio: 'Nazia Shaukat heads the academic administration of the college, ensuring rigorous curriculum standards, faculty excellence, and a supportive learning environment for all students.',
    qualifications: 'Principal',
    image: '/images/leadership/principal-nazia-shaukat.svg',
    order: 3,
  },
];

export const courses = [
  {
    title: 'Generic Nursing (BSN)',
    level: 'Undergraduate',
    duration: '4 Years',
    category: 'nursing',
    description:
      'A comprehensive four-year program preparing students to become registered nurses with strong clinical, theoretical, and leadership skills.',
    highlights: ['Clinical rotations at partner hospitals', 'Skills & simulation lab training', 'PNC/PNMC aligned curriculum'],
    eligibility: 'Intermediate (Pre-Medical) with minimum required aggregate',
    order: 1,
  },
  {
    title: 'Post RN BSN',
    level: 'Undergraduate (Bridging)',
    duration: '2 Years',
    category: 'nursing',
    description:
      'A bridging program for Registered Nurses / diploma holders to advance into a Bachelor of Science in Nursing degree.',
    highlights: ['Advanced nursing practice', 'Leadership & management modules', 'Evening & weekend batches available'],
    eligibility: 'Diploma in General Nursing with valid registration',
    order: 2,
  },
  {
    title: 'Certified Nurse Assistant',
    level: 'Certificate',
    duration: '1 Year',
    category: 'nursing',
    description:
      'A one-year certificate preparing students to assist registered nurses with patient care, vitals, hygiene, and ward support.',
    highlights: ['Bedside care & vital signs', 'Skills lab practice', 'Hospital-based clinical exposure'],
    eligibility: 'Matric / SSC or equivalent',
    order: 3,
  },
  {
    title: 'Diploma in Clinical Midwifery',
    level: 'Diploma',
    duration: '2 Years',
    category: 'nursing',
    description:
      'Diploma training in antenatal, labour, postnatal, and newborn care so graduates can support safe deliveries in clinical settings.',
    highlights: ['Labour room training', 'Maternal & newborn care', 'Community and hospital placements'],
    eligibility: 'Matric / SSC (Science) or equivalent',
    order: 4,
  },
  {
    title: 'Lady Health Visitor',
    level: 'Diploma',
    duration: '2 Years',
    category: 'nursing',
    description:
      'A community health diploma focused on maternal, child, and family health — home visits, immunization support, and health education.',
    highlights: ['Community outreach practice', 'Maternal & child health', 'Primary care and health education'],
    eligibility: 'Matric / SSC (Science) or FSc',
    order: 5,
  },
  {
    title: 'Doctor of Physical Therapy (DPT)',
    level: 'Undergraduate',
    duration: '5 Years',
    category: 'allied-health',
    description:
      'A professional doctorate preparing students to assess, diagnose, and treat movement and musculoskeletal disorders.',
    highlights: ['Modern physiotherapy lab', 'Clinical internships', 'Sports & orthopedic rehab tracks'],
    eligibility: 'Intermediate (Pre-Medical) with minimum required aggregate',
    order: 6,
  },
  {
    title: 'BS Medical Laboratory Technology (MLT)',
    level: 'Undergraduate',
    duration: '4 Years',
    category: 'allied-health',
    description:
      'Trains students in clinical laboratory diagnostics including hematology, microbiology, biochemistry, and pathology.',
    highlights: ['Fully equipped diagnostic labs', 'Lab placements at partner hospitals', 'Research-oriented final year project'],
    eligibility: 'Intermediate (Pre-Medical) with minimum required aggregate',
    order: 7,
  },
  {
    title: 'BS Operation Theatre Technology (OTT)',
    level: 'Undergraduate',
    duration: '4 Years',
    category: 'allied-health',
    description:
      'Prepares skilled operation theatre technologists proficient in surgical assistance, sterilization, and OT management.',
    highlights: ['Surgical simulation training', 'Hospital-based practicums', 'Infection control certification'],
    eligibility: 'Intermediate (Pre-Medical) with minimum required aggregate',
    order: 8,
  },
  {
    title: 'BS Anesthesia Technology',
    level: 'Undergraduate',
    duration: '4 Years',
    category: 'allied-health',
    description:
      'Focused program on anesthesia administration support, patient monitoring, and critical care technology.',
    highlights: ['ICU & OT rotations', 'Simulation-based patient monitoring', 'Certified equipment training'],
    eligibility: 'Intermediate (Pre-Medical) with minimum required aggregate',
    order: 9,
  },
  {
    title: 'BS Radiology & Imaging Technology',
    level: 'Undergraduate',
    duration: '4 Years',
    category: 'allied-health',
    description:
      'Covers diagnostic imaging techniques including X-ray, ultrasound, CT, and MRI technology operations.',
    highlights: ['On-campus imaging lab', 'Radiation safety training', 'Hospital diagnostic placements'],
    eligibility: 'Intermediate (Pre-Medical) with minimum required aggregate',
    order: 10,
  },
];

export const careers = [
  {
    title: 'Nursing Faculty',
    type: 'Full-Time',
    desc: 'Teach theory and clinical courses. Mentor students on hospital rotations.',
    order: 1,
  },
  {
    title: 'Allied Health Lab Instructor',
    type: 'Full-Time',
    desc: 'Run hands-on labs for Physical Therapy, MLT, OTT, and Radiology.',
    order: 2,
  },
  {
    title: 'Admissions Coordinator',
    type: 'Full-Time',
    desc: 'Guide applicants through the process and support outreach.',
    order: 3,
  },
  {
    title: 'Front Desk / Admin Officer',
    type: 'Full-Time',
    desc: 'Front office, student records, day-to-day ops.',
    order: 4,
  },
];

export const news = [
  {
    title: 'Admissions Open for Fall 2026',
    summary: 'Explore College of Nursing and Allied Health Sciences invites applications for its Nursing and Allied Health programs.',
    date: new Date(),
    image: '/images/campus/photos/campus-main-building.jpg',
  },
  {
    title: 'New Skills & Simulation Lab Inaugurated',
    summary: 'A state-of-the-art nursing skills and simulation lab has been inaugurated to enhance hands-on clinical training.',
    date: new Date(),
    image: '/images/campus/photos/nursing-skills-lab.jpg',
  },
];

