import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { Storage } from "./storage";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const now = new Date().toISOString();
  db.exec(`
    CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, created_at TEXT NOT NULL);
    INSERT INTO organizations (id, name, slug, created_at) VALUES ('org-default', 'Default', 'default', '${now}');
    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      organization_id TEXT DEFAULT 'org-default'
    );
    CREATE TABLE families (
      id TEXT PRIMARY KEY,
      organization_id TEXT DEFAULT 'org-default',
      number INTEGER,
      responsible_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      member_count INTEGER NOT NULL,
      children_count INTEGER NOT NULL,
      housing TEXT NOT NULL,
      housing_name TEXT NOT NULL DEFAULT '',
      health_notes TEXT NOT NULL DEFAULT '',
      has_medical_needs INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_visit_at TEXT,
      archived INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE needs (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      urgency TEXT NOT NULL,
      status TEXT NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      organization_id TEXT DEFAULT 'org-default'
    );
    CREATE TABLE aids (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      article_id TEXT NOT NULL DEFAULT '',
      quantity REAL NOT NULL,
      date TEXT NOT NULL,
      volunteer_id TEXT NOT NULL,
      volunteer_name TEXT NOT NULL,
      source TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      proof_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      organization_id TEXT DEFAULT 'org-default'
    );
  `);

  return db;
}

describe("Storage.searchGlobal", () => {
  let db: Database.Database;
  let storage: Storage;

  beforeEach(() => {
    db = createTestDb();
    storage = new Storage(db);

    // Créer des catégories de test
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO categories (id, name, description, created_at) VALUES (?, ?, ?, ?)",
    ).run("cat-food", "Nourriture", "Colis alimentaires", now);
    db.prepare(
      "INSERT INTO categories (id, name, description, created_at) VALUES (?, ?, ?, ?)",
    ).run("cat-clothes", "Vêtements", "Vêtements enfants", now);
    db.prepare(
      "INSERT INTO categories (id, name, description, created_at) VALUES (?, ?, ?, ?)",
    ).run("cat-medical", "Consultation médicale", "Soins médicaux", now);
  });

  it("devrait retourner des résultats vides pour une requête vide", () => {
    const result = storage.searchGlobal("org-default", "");
    expect(result.families).toEqual([]);
    expect(result.needs).toEqual([]);
    expect(result.aids).toEqual([]);
  });

  it("devrait trouver des besoins par commentaire même sans famille trouvée", () => {
    // Créer une famille
    const familyId = "fam-1";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO families (id, responsible_name, phone, address, neighborhood, 
       member_count, children_count, housing, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      familyId,
      "Dupont",
      "0123456789",
      "123 rue Test",
      "Quartier A",
      4,
      2,
      "housed",
      now,
      now,
    );

    // Créer un besoin avec un commentaire contenant "urgent"
    db.prepare(
      `INSERT INTO needs (id, family_id, type, urgency, status, comment, details, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "need-1",
      familyId,
      "cat-food",
      "high",
      "pending",
      "Besoin urgent de nourriture",
      "",
      now,
      now,
    );

    const result = storage.searchGlobal("org-default", "urgent");
    expect(result.needs).toHaveLength(1);
    expect(result.needs[0].id).toBe("need-1");
    expect(result.needs[0].comment).toContain("urgent");
  });

  it("devrait trouver des besoins par détails même sans famille trouvée", () => {
    const familyId = "fam-2";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO families (id, responsible_name, phone, address, neighborhood, 
       member_count, children_count, housing, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      familyId,
      "Martin",
      "0987654321",
      "456 rue Test",
      "Quartier B",
      3,
      1,
      "housed",
      now,
      now,
    );

    db.prepare(
      `INSERT INTO needs (id, family_id, type, urgency, status, comment, details, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "need-2",
      familyId,
      "cat-clothes",
      "medium",
      "pending",
      "",
      "Besoin de vêtements pour enfants",
      now,
      now,
    );

    const result = storage.searchGlobal("org-default", "vêtements");
    expect(result.needs).toHaveLength(1);
    expect(result.needs[0].details).toContain("vêtements");
  });

  it("devrait trouver des besoins par label de catégorie", () => {
    const familyId = "fam-3";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO families (id, responsible_name, phone, address, neighborhood, 
       member_count, children_count, housing, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      familyId,
      "Bernard",
      "0111111111",
      "789 rue Test",
      "Quartier C",
      5,
      3,
      "housed",
      now,
      now,
    );

    // Créer un besoin avec le type "cat-food" (catégorie "Nourriture")
    db.prepare(
      `INSERT INTO needs (id, family_id, type, urgency, status, comment, details, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "need-3",
      familyId,
      "cat-food",
      "low",
      "pending",
      "",
      "",
      now,
      now,
    );

    // Rechercher par le label de catégorie
    const result = storage.searchGlobal("org-default", "Nourriture");
    expect(result.needs).toHaveLength(1);
    expect(result.needs[0].type).toBe("cat-food");
  });

  it("devrait trouver des aides par nom de bénévole même sans famille trouvée", () => {
    const familyId = "fam-4";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO families (id, responsible_name, phone, address, neighborhood, 
       member_count, children_count, housing, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      familyId,
      "Lefebvre",
      "0222222222",
      "321 rue Test",
      "Quartier D",
      2,
      0,
      "housed",
      now,
      now,
    );

    db.prepare(
      `INSERT INTO aids (id, family_id, type, article_id, quantity, date, volunteer_id, 
       volunteer_name, source, notes, proof_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "aid-1",
      familyId,
      "cat-food",
      "",
      5,
      now,
      "vol-1",
      "Jean Dupont",
      "donation",
      "",
      "",
      now,
    );

    const result = storage.searchGlobal("org-default", "Jean");
    expect(result.aids).toHaveLength(1);
    expect(result.aids[0].volunteerName).toContain("Jean");
  });

  it("devrait trouver des aides par notes même sans famille trouvée", () => {
    const familyId = "fam-5";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO families (id, responsible_name, phone, address, neighborhood, 
       member_count, children_count, housing, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      familyId,
      "Moreau",
      "0333333333",
      "654 rue Test",
      "Quartier E",
      6,
      4,
      "housed",
      now,
      now,
    );

    db.prepare(
      `INSERT INTO aids (id, family_id, type, article_id, quantity, date, volunteer_id, 
       volunteer_name, source, notes, proof_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "aid-2",
      familyId,
      "cat-clothes",
      "",
      10,
      now,
      "vol-2",
      "Marie Martin",
      "donation",
      "Livraison effectuée avec succès",
      "",
      now,
    );

    const result = storage.searchGlobal("org-default", "Livraison");
    expect(result.aids).toHaveLength(1);
    expect(result.aids[0].notes).toContain("Livraison");
  });

  it("devrait trouver des aides par label de catégorie", () => {
    const familyId = "fam-6";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO families (id, responsible_name, phone, address, neighborhood, 
       member_count, children_count, housing, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      familyId,
      "Petit",
      "0444444444",
      "987 rue Test",
      "Quartier F",
      4,
      2,
      "housed",
      now,
      now,
    );

    // Créer une aide avec le type "cat-medical" (catégorie "Consultation médicale")
    db.prepare(
      `INSERT INTO aids (id, family_id, type, article_id, quantity, date, volunteer_id, 
       volunteer_name, source, notes, proof_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "aid-3",
      familyId,
      "cat-medical",
      "",
      1,
      now,
      "vol-3",
      "Dr. Smith",
      "donation",
      "",
      "",
      now,
    );

    // Rechercher par le label de catégorie
    const result = storage.searchGlobal("org-default", "médicale");
    expect(result.aids).toHaveLength(1);
    expect(result.aids[0].type).toBe("cat-medical");
  });

  it("devrait trouver des besoins et aides d'une famille trouvée par nom", () => {
    const familyId = "fam-7";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO families (id, responsible_name, phone, address, neighborhood, 
       member_count, children_count, housing, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      familyId,
      "Garcia",
      "0555555555",
      "111 rue Test",
      "Quartier G",
      3,
      1,
      "housed",
      now,
      now,
    );

    // Créer un besoin et une aide pour cette famille
    db.prepare(
      `INSERT INTO needs (id, family_id, type, urgency, status, comment, details, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "need-4",
      familyId,
      "cat-food",
      "high",
      "pending",
      "",
      "",
      now,
      now,
    );

    db.prepare(
      `INSERT INTO aids (id, family_id, type, article_id, quantity, date, volunteer_id, 
       volunteer_name, source, notes, proof_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "aid-4",
      familyId,
      "cat-clothes",
      "",
      3,
      now,
      "vol-4",
      "Alice",
      "donation",
      "",
      "",
      now,
    );

    // Rechercher par le nom de la famille
    const result = storage.searchGlobal("org-default", "Garcia");
    expect(result.families).toHaveLength(1);
    expect(result.families[0].responsibleName).toBe("Garcia");
    // Les besoins et aides de cette famille devraient être trouvés
    expect(result.needs.some((n) => n.familyId === familyId)).toBe(true);
    expect(result.aids.some((a) => a.familyId === familyId)).toBe(true);
  });

  it("devrait combiner recherche par famille, catégorie et texte", () => {
    const familyId1 = "fam-8";
    const familyId2 = "fam-9";
    const now = new Date().toISOString();

    // Créer deux familles
    db.prepare(
      `INSERT INTO families (id, responsible_name, phone, address, neighborhood, 
       member_count, children_count, housing, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      familyId1,
      "Dubois",
      "0666666666",
      "222 rue Test",
      "Quartier H",
      4,
      2,
      "housed",
      now,
      now,
    );

    db.prepare(
      `INSERT INTO families (id, responsible_name, phone, address, neighborhood, 
       member_count, children_count, housing, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      familyId2,
      "Rousseau",
      "0777777777",
      "333 rue Test",
      "Quartier I",
      5,
      3,
      "housed",
      now,
      now,
    );

    // Besoin de la famille 1 avec type "cat-food" (Nourriture)
    db.prepare(
      `INSERT INTO needs (id, family_id, type, urgency, status, comment, details, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "need-5",
      familyId1,
      "cat-food",
      "medium",
      "pending",
      "",
      "",
      now,
      now,
    );

    // Besoin de la famille 2 avec commentaire contenant "Nourriture"
    db.prepare(
      `INSERT INTO needs (id, family_id, type, urgency, status, comment, details, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "need-6",
      familyId2,
      "cat-clothes",
      "low",
      "pending",
      "Besoin de Nourriture",
      "",
      now,
      now,
    );

    // Rechercher "Nourriture" devrait trouver les deux besoins
    const result = storage.searchGlobal("org-default", "Nourriture");
    expect(result.needs.length).toBeGreaterThanOrEqual(2);
    // Au moins un devrait être trouvé par catégorie, l'autre par commentaire
    const foundByCategory = result.needs.some((n) => n.type === "cat-food");
    const foundByComment = result.needs.some((n) =>
      n.comment.toLowerCase().includes("nourriture"),
    );
    expect(foundByCategory || foundByComment).toBe(true);
  });
});
