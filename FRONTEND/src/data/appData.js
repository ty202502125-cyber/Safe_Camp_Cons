export const LOGO =
  "https://upload.wikimedia.org/wikipedia/en/b/b7/Western_Mindanao_State_University.png";
export const U = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;
export const IMG = {
  campus: U("photo-1523580494863-6f3031224c94"),
  volunteer: U("photo-1559027615-cd4628902d4a"),
  environment: U("photo-1518531933037-91b2f5f229cc"),
  education: U("photo-1509062522246-3755977927d7"),
};
export const PHOTO = {
  "Community Service": IMG.volunteer,
  Environment: IMG.environment,
  Education: IMG.education,
  "Health and Wellness": IMG.campus,
};
export const CATEGORIES = Object.keys(PHOTO);
export const COLLEGES = [
  "College of Agriculture",
  "College of Architecture",
  "College of Asian and Islamic Studies",
  "College of Computing Studies",
  "College of Criminal Justice Education",
  "College of Engineering",
  "College of Forestry and Environmental Studies",
  "College of Home Economics",
  "College of Law",
  "College of Liberal Arts",
  "College of Medicine",
  "College of Nursing",
  "College of Public Administration and Development Studies",
  "College of Science and Mathematics",
  "College of Social Work and Community Development",
  "College of Sports Science and Physical Education",
  "College of Teacher Education",
];
export const seedOrganizations = [];
export const SUPER_ADMIN_START_PASSWORD = "demo1234";

/* ---------- seed data ---------- */
export const seedUsers = [
  {
    id: 1,
    role: "Super Admin",
    last: "Admin",
    first: "System",
    mi: "S",
    idno: "SA-0001",
    email: "superadmin@wmsu.edu.ph",
    college: "University Administration",
    pw: SUPER_ADMIN_START_PASSWORD,
    status: "Active",
  },
];
export const seedActs = [];
export const seedEnr = [];

/* ---------- helpers ---------- */
