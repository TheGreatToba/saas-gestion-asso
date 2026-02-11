import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { hashPassword } from "./passwords";

// Use cwd so the DB lives outside dist/ and persists across builds
const dataDir = join(process.cwd(), "data");
const dbPath = join(dataDir, "aide-famille.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  seedIfEmpty(db);
  return db;
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('admin', 'volunteer')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS passwords (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      password TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      unit TEXT NOT NULL DEFAULT 'unités',
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      stock_min INTEGER NOT NULL DEFAULT 0 CHECK (stock_min >= 0),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      responsible_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      member_count INTEGER NOT NULL CHECK (member_count >= 1),
      children_count INTEGER NOT NULL CHECK (children_count >= 0),
      housing TEXT NOT NULL CHECK (housing IN ('housed', 'pending_placement', 'not_housed')),
      housing_name TEXT NOT NULL DEFAULT '',
      health_notes TEXT NOT NULL DEFAULT '',
      has_medical_needs INTEGER NOT NULL DEFAULT 0 CHECK (has_medical_needs IN (0, 1)),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_visit_at TEXT,
      archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS children (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      first_name TEXT NOT NULL,
      age INTEGER NOT NULL CHECK (age >= 0),
      sex TEXT NOT NULL CHECK (sex IN ('male', 'female')),
      specific_needs TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS needs (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'partial', 'covered')),
      comment TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS aids (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      article_id TEXT NOT NULL DEFAULT '',
      quantity REAL NOT NULL CHECK (quantity > 0),
      date TEXT NOT NULL,
      volunteer_id TEXT NOT NULL,
      volunteer_name TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('donation', 'purchase', 'partner')),
      notes TEXT NOT NULL DEFAULT '',
      proof_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS visit_notes (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      volunteer_id TEXT NOT NULL,
      volunteer_name TEXT NOT NULL,
      content TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS family_documents (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      document_type TEXT NOT NULL,
      -- Données brutes (base64) historique, non utilisées pour les nouveaux uploads.
      file_data TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_by_name TEXT NOT NULL,
      -- Clé d'objet dans le stockage (S3 / MinIO / Azure Blob...)
      file_key TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_children_family ON children(family_id);
    CREATE INDEX IF NOT EXISTS idx_needs_family ON needs(family_id);
    CREATE INDEX IF NOT EXISTS idx_aids_family ON aids(family_id);
    CREATE INDEX IF NOT EXISTS idx_visit_notes_family ON visit_notes(family_id);
    CREATE INDEX IF NOT EXISTS idx_family_documents_family ON family_documents(family_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_families_phone ON families(phone);
    CREATE INDEX IF NOT EXISTS idx_families_responsible ON families(responsible_name);
    CREATE INDEX IF NOT EXISTS idx_families_neighborhood ON families(neighborhood);
  `);

  // Backfill new columns for existing installations.
  const userColumns = database
    .prepare("PRAGMA table_info(users)")
    .all() as { name: string }[];
  const hasActive = userColumns.some((col) => col.name === "active");
  if (!hasActive) {
    database.exec("ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1;");
  }

  // Ajout rétro-compatible de la colonne archived sur families pour le soft-delete.
  const familyColumns = database
    .prepare("PRAGMA table_info(families)")
    .all() as { name: string }[];
  const hasArchived = familyColumns.some((col) => col.name === "archived");
  if (!hasArchived) {
    database.exec(
      "ALTER TABLE families ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;",
    );
  }

  // Ajout rétro-compatible de la colonne file_key pour les installations existantes.
  const familyDocumentColumns = database
    .prepare("PRAGMA table_info(family_documents)")
    .all() as { name: string }[];
  const hasFileKey = familyDocumentColumns.some((col) => col.name === "file_key");
  if (!hasFileKey) {
    database.exec("ALTER TABLE family_documents ADD COLUMN file_key TEXT;");
  }
}

function now(): string {
  return new Date().toISOString();
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function seedIfEmpty(database: Database.Database): void {
  // In production, avoid creating demo users / sample data automatically.
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const userCount = database
    .prepare("SELECT COUNT(*) as c FROM users")
    .get() as { c: number };
  if (userCount.c > 0) return;

  const insUser = database.prepare(
    "INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)",
  );
  const insPass = database.prepare(
    "INSERT INTO passwords (user_id, password) VALUES (?, ?)",
  );
  insUser.run("usr-admin", "Administrateur", "admin@socialaid.org", "admin");
  insPass.run("usr-admin", hashPassword("admin123"));
  insUser.run(
    "usr-vol1",
    "Fatima Mansouri",
    "fatima@socialaid.org",
    "volunteer",
  );
  insPass.run("usr-vol1", hashPassword("volunteer123"));
  insUser.run(
    "usr-vol2",
    "Mohamed Kaddouri",
    "mohamed@socialaid.org",
    "volunteer",
  );
  insPass.run("usr-vol2", hashPassword("volunteer123"));

  const insCat = database.prepare(
    "INSERT INTO categories (id, name, description, created_at) VALUES (?, ?, ?, ?)",
  );
  const categories = [
    ["food", "Nourriture", "Colis alimentaires, denrées", daysAgo(365)],
    ["diapers", "Couches", "Couches bébé toutes tailles", daysAgo(365)],
    ["clothes", "Vêtements", "Vêtements enfants et adultes", daysAgo(365)],
    ["blankets", "Couvertures", "Couvertures et draps", daysAgo(365)],
    ["mattress", "Matelas", "Matelas simple et double", daysAgo(365)],
    [
      "medical",
      "Consultation médicale",
      "Consultations et soins",
      daysAgo(365),
    ],
  ];
  for (const row of categories) insCat.run(...row);

  const insArt = database.prepare(
    "INSERT INTO articles (id, category_id, name, description, unit, stock_quantity, stock_min, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const articles = [
    [
      "art-food-colis",
      "food",
      "Colis alimentaire standard",
      "Riz, huile, sucre, farine, conserves",
      "colis",
      18,
      5,
      daysAgo(365),
    ],
    [
      "art-food-farine1",
      "food",
      "Farine 1kg",
      "Pack de farine de 1kg",
      "paquets",
      30,
      10,
      daysAgo(60),
    ],
    [
      "art-food-farine2",
      "food",
      "Farine 2kg",
      "Pack de farine de 2kg",
      "paquets",
      12,
      5,
      daysAgo(30),
    ],
    [
      "art-diaper-t1",
      "diapers",
      "Couches taille 1",
      "Nouveau-né",
      "paquets",
      4,
      3,
      daysAgo(365),
    ],
    [
      "art-diaper-t3",
      "diapers",
      "Couches taille 3",
      "4-9 kg",
      "paquets",
      8,
      3,
      daysAgo(365),
    ],
    [
      "art-diaper-t5",
      "diapers",
      "Couches taille 5",
      "11-25 kg",
      "paquets",
      3,
      3,
      daysAgo(365),
    ],
    [
      "art-clothes-child",
      "clothes",
      "Vêtements enfant",
      "Toutes tailles enfant",
      "pièces",
      30,
      10,
      daysAgo(365),
    ],
    [
      "art-clothes-adult",
      "clothes",
      "Vêtements adulte",
      "Toutes tailles adulte",
      "pièces",
      12,
      5,
      daysAgo(365),
    ],
    [
      "art-blanket",
      "blankets",
      "Couverture standard",
      "Couverture polaire",
      "pièces",
      8,
      3,
      daysAgo(365),
    ],
    [
      "art-mattress-s",
      "mattress",
      "Matelas 1 place",
      "",
      "pièces",
      2,
      2,
      daysAgo(365),
    ],
    [
      "art-mattress-d",
      "mattress",
      "Matelas 2 places",
      "",
      "pièces",
      1,
      1,
      daysAgo(365),
    ],
  ];
  for (const row of articles) insArt.run(...row);

  const insFam = database.prepare(
    `INSERT INTO families (id, responsible_name, phone, address, neighborhood, member_count, children_count,
      housing, housing_name, health_notes, has_medical_needs, notes, created_at, updated_at, last_visit_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const families = [
    [
      "fam-001",
      "Ahmed Ben Ali",
      "06 12 34 56 78",
      "12 Rue de la Paix",
      "Médina",
      6,
      4,
      "not_housed",
      "",
      "",
      0,
      "Famille nombreuse, père au chômage depuis 6 mois",
      daysAgo(90),
      daysAgo(2),
      daysAgo(2),
    ],
    [
      "fam-002",
      "Samir El Idrissi",
      "06 23 45 67 89",
      "45 Avenue Hassan II",
      "Hay Mohammadi",
      4,
      2,
      "housed",
      "Berchifa",
      "Mère malade, besoin de suivi régulier",
      1,
      "",
      daysAgo(60),
      daysAgo(5),
      daysAgo(5),
    ],
    [
      "fam-003",
      "Zahra Ouahbi",
      "06 34 56 78 90",
      "8 Derb Sidi Bousmara",
      "Ancienne Médina",
      3,
      1,
      "pending_placement",
      "",
      "",
      0,
      "Mère célibataire, très isolée — en attente de placement en foyer",
      daysAgo(45),
      daysAgo(1),
      daysAgo(1),
    ],
    [
      "fam-004",
      "Hassan Tazi",
      "06 45 67 89 01",
      "22 Rue Ibnou Sina",
      "Sidi Bernoussi",
      8,
      5,
      "not_housed",
      "",
      "",
      0,
      "Grand-parents à charge, logement insalubre",
      daysAgo(120),
      daysAgo(35),
      daysAgo(35),
    ],
    [
      "fam-005",
      "Karim Bennis",
      "06 56 78 90 12",
      "3 Impasse des Oliviers",
      "Hay Hassani",
      5,
      3,
      "housed",
      "Ahlan",
      "",
      0,
      "",
      daysAgo(30),
      daysAgo(10),
      daysAgo(10),
    ],
    [
      "fam-006",
      "Leila Amrani",
      "06 67 89 01 23",
      "17 Boulevard Zerktouni",
      "Maarif",
      3,
      1,
      "not_housed",
      "",
      "Bébé prématuré, suivi médical nécessaire",
      1,
      "",
      daysAgo(15),
      daysAgo(3),
      daysAgo(3),
    ],
  ];
  for (const row of families) insFam.run(...row);

  const insCh = database.prepare(
    "INSERT INTO children (id, family_id, first_name, age, sex, specific_needs, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const children = [
    ["ch-001", "fam-001", "Youssef", 12, "male", "", daysAgo(90)],
    ["ch-002", "fam-001", "Amina", 8, "female", "Suivi scolaire", daysAgo(90)],
    ["ch-003", "fam-001", "Hamza", 4, "male", "Couches taille 5", daysAgo(90)],
    [
      "ch-004",
      "fam-001",
      "Sara",
      1,
      "female",
      "Couches taille 3, lait infantile",
      daysAgo(90),
    ],
    ["ch-005", "fam-002", "Nadia", 6, "female", "", daysAgo(60)],
    [
      "ch-006",
      "fam-002",
      "Omar",
      3,
      "male",
      "Allergie alimentaire",
      daysAgo(60),
    ],
    [
      "ch-007",
      "fam-003",
      "Yasmina",
      2,
      "female",
      "Couches taille 4",
      daysAgo(45),
    ],
    ["ch-008", "fam-004", "Rachid", 14, "male", "", daysAgo(120)],
    [
      "ch-009",
      "fam-004",
      "Fatima-Zahra",
      10,
      "female",
      "Lunettes",
      daysAgo(120),
    ],
    ["ch-010", "fam-004", "Anas", 7, "male", "", daysAgo(120)],
    [
      "ch-011",
      "fam-004",
      "Khadija",
      3,
      "female",
      "Couches taille 5",
      daysAgo(120),
    ],
    ["ch-012", "fam-004", "Ilyas", 1, "male", "Couches taille 3", daysAgo(120)],
    ["ch-013", "fam-005", "Soufiane", 9, "male", "", daysAgo(30)],
    ["ch-014", "fam-005", "Imane", 5, "female", "", daysAgo(30)],
    ["ch-015", "fam-005", "Adam", 2, "male", "Couches taille 4", daysAgo(30)],
    [
      "ch-016",
      "fam-006",
      "Rayan",
      0,
      "male",
      "Prématuré, suivi médical, couches taille 1",
      daysAgo(15),
    ],
  ];
  for (const row of children) insCh.run(...row);

  const insNeed = database.prepare(
    "INSERT INTO needs (id, family_id, type, urgency, status, comment, details, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const needs = [
    [
      "nd-001",
      "fam-001",
      "food",
      "high",
      "pending",
      "Colis alimentaire mensuel",
      "",
      daysAgo(5),
      daysAgo(5),
    ],
    [
      "nd-002",
      "fam-001",
      "diapers",
      "high",
      "pending",
      "",
      "Taille 3 et Taille 5",
      daysAgo(3),
      daysAgo(3),
    ],
    [
      "nd-003",
      "fam-002",
      "medical",
      "high",
      "pending",
      "Consultation spécialiste pour la mère",
      "",
      daysAgo(7),
      daysAgo(7),
    ],
    [
      "nd-004",
      "fam-003",
      "clothes",
      "medium",
      "partial",
      "Vêtements d'hiver pour l'enfant",
      "Taille 2 ans",
      daysAgo(10),
      daysAgo(4),
    ],
    [
      "nd-005",
      "fam-004",
      "mattress",
      "high",
      "pending",
      "2 matelas nécessaires",
      "",
      daysAgo(20),
      daysAgo(20),
    ],
    [
      "nd-006",
      "fam-004",
      "blankets",
      "medium",
      "pending",
      "5 couvertures pour l'hiver",
      "",
      daysAgo(15),
      daysAgo(15),
    ],
    [
      "nd-007",
      "fam-004",
      "food",
      "high",
      "pending",
      "Famille non visitée depuis plus d'un mois",
      "",
      daysAgo(35),
      daysAgo(35),
    ],
    [
      "nd-008",
      "fam-005",
      "diapers",
      "low",
      "covered",
      "",
      "Taille 4",
      daysAgo(12),
      daysAgo(8),
    ],
    [
      "nd-009",
      "fam-006",
      "medical",
      "high",
      "partial",
      "Suivi pédiatrique bébé prématuré",
      "",
      daysAgo(10),
      daysAgo(3),
    ],
    [
      "nd-010",
      "fam-006",
      "diapers",
      "medium",
      "pending",
      "",
      "Taille 1 nouveau-né",
      daysAgo(8),
      daysAgo(8),
    ],
    [
      "nd-011",
      "fam-005",
      "clothes",
      "low",
      "pending",
      "Vêtements scolaires",
      "Tailles 9 ans et 5 ans",
      daysAgo(6),
      daysAgo(6),
    ],
  ];
  for (const row of needs) insNeed.run(...row);

  const insAid = database.prepare(
    "INSERT INTO aids (id, family_id, type, article_id, quantity, date, volunteer_id, volunteer_name, source, notes, proof_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const aids = [
    [
      "aid-001",
      "fam-001",
      "food",
      "",
      1,
      daysAgo(2),
      "usr-vol1",
      "Fatima Mansouri",
      "donation",
      "Colis alimentaire complet",
      "",
      daysAgo(2),
    ],
    [
      "aid-002",
      "fam-002",
      "food",
      "",
      1,
      daysAgo(5),
      "usr-vol2",
      "Mohamed Kaddouri",
      "donation",
      "",
      "",
      daysAgo(5),
    ],
    [
      "aid-003",
      "fam-003",
      "diapers",
      "",
      3,
      daysAgo(4),
      "usr-vol1",
      "Fatima Mansouri",
      "purchase",
      "3 paquets taille 4",
      "https://example.com/photo-couches.jpg",
      daysAgo(4),
    ],
    [
      "aid-004",
      "fam-003",
      "clothes",
      "",
      5,
      daysAgo(4),
      "usr-vol1",
      "Fatima Mansouri",
      "donation",
      "Vêtements 2 ans",
      "",
      daysAgo(4),
    ],
    [
      "aid-005",
      "fam-005",
      "diapers",
      "",
      2,
      daysAgo(8),
      "usr-vol2",
      "Mohamed Kaddouri",
      "partner",
      "Partenariat pharmacie locale",
      "https://example.com/facture-pharmacie.jpg",
      daysAgo(8),
    ],
    [
      "aid-006",
      "fam-006",
      "medical",
      "",
      1,
      daysAgo(3),
      "usr-vol1",
      "Fatima Mansouri",
      "partner",
      "Consultation pédiatrique via partenaire",
      "",
      daysAgo(3),
    ],
    [
      "aid-007",
      "fam-001",
      "clothes",
      "",
      8,
      daysAgo(15),
      "usr-vol2",
      "Mohamed Kaddouri",
      "donation",
      "Vêtements enfants divers",
      "",
      daysAgo(15),
    ],
    [
      "aid-008",
      "fam-002",
      "blankets",
      "",
      2,
      daysAgo(20),
      "usr-vol1",
      "Fatima Mansouri",
      "donation",
      "",
      "",
      daysAgo(20),
    ],
  ];
  for (const row of aids) insAid.run(...row);

  const insNote = database.prepare(
    "INSERT INTO visit_notes (id, family_id, volunteer_id, volunteer_name, content, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const notes = [
    [
      "vn-001",
      "fam-001",
      "usr-vol1",
      "Fatima Mansouri",
      "Visite de routine. Le père cherche activement du travail. Les enfants sont scolarisés. Besoin urgent de couches et nourriture.",
      daysAgo(2),
      daysAgo(2),
    ],
    [
      "vn-002",
      "fam-002",
      "usr-vol2",
      "Mohamed Kaddouri",
      "La mère doit voir un spécialiste. Rendez-vous à prendre. Les enfants vont bien.",
      daysAgo(5),
      daysAgo(5),
    ],
    [
      "vn-003",
      "fam-003",
      "usr-vol1",
      "Fatima Mansouri",
      "Zahra est très reconnaissante. L'enfant grandit bien. Besoin de vêtements d'hiver bientôt.",
      daysAgo(1),
      daysAgo(1),
    ],
    [
      "vn-004",
      "fam-006",
      "usr-vol1",
      "Fatima Mansouri",
      "Le bébé prend du poids. Prochain rendez-vous médical dans 2 semaines. Besoin de couches taille 1.",
      daysAgo(3),
      daysAgo(3),
    ],
  ];
  for (const row of notes) insNote.run(...row);
}

export { getDb };
