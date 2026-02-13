import type { Child, CreateChildInput } from "../../shared/schema";
import type Database from "better-sqlite3";

export type ChildRow = {
  id: string;
  family_id: string;
  first_name: string;
  age: number;
  sex: string;
  specific_needs: string;
  created_at: string;
};

export function mapChildRow(r: ChildRow): Child {
  return {
    id: r.id,
    familyId: r.family_id,
    firstName: r.first_name,
    age: r.age,
    sex: r.sex as Child["sex"],
    specificNeeds: r.specific_needs ?? "",
    createdAt: r.created_at,
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function now(): string {
  return new Date().toISOString();
}

export class ChildrenRepository {
  constructor(private getDb: () => Database.Database) {}

  private get db(): Database.Database {
    return this.getDb();
  }

  getById(id: string): Child | null {
    const r = this.db.prepare("SELECT * FROM children WHERE id = ?").get(id) as
      | ChildRow
      | undefined;
    return r ? mapChildRow(r) : null;
  }

  getByFamily(familyId: string): Child[] {
    const rows = this.db
      .prepare("SELECT * FROM children WHERE family_id = ? ORDER BY created_at")
      .all(familyId) as ChildRow[];
    return rows.map(mapChildRow);
  }

  getByFamilyIds(familyIds: string[]): Map<string, Child[]> {
    const map = new Map<string, Child[]>();
    if (familyIds.length === 0) return map;
    const placeholders = familyIds.map(() => "?").join(",");
    const rows = this.db
      .prepare(
        `SELECT * FROM children WHERE family_id IN (${placeholders}) ORDER BY family_id, created_at`,
      )
      .all(...familyIds) as ChildRow[];
    for (const r of rows) {
      const list = map.get(r.family_id) ?? [];
      list.push(mapChildRow(r));
      map.set(r.family_id, list);
    }
    return map;
  }

  create(input: CreateChildInput): Child {
    const id = "ch-" + generateId();
    const createdAt = now();
    this.db
      .prepare(
        "INSERT INTO children (id, family_id, first_name, age, sex, specific_needs, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        input.familyId,
        input.firstName,
        input.age,
        input.sex,
        input.specificNeeds ?? "",
        createdAt,
      );
    return mapChildRow({
      id,
      family_id: input.familyId,
      first_name: input.firstName,
      age: input.age,
      sex: input.sex,
      specific_needs: input.specificNeeds ?? "",
      created_at: createdAt,
    });
  }

  update(id: string, input: Partial<CreateChildInput>): Child | null {
    const r = this.db.prepare("SELECT * FROM children WHERE id = ?").get(id) as
      | ChildRow
      | undefined;
    if (!r) return null;
    const firstName = input.firstName ?? r.first_name;
    const age = input.age ?? r.age;
    const sex = input.sex ?? r.sex;
    const specificNeeds =
      input.specificNeeds !== undefined
        ? input.specificNeeds
        : r.specific_needs;
    this.db
      .prepare(
        "UPDATE children SET first_name = ?, age = ?, sex = ?, specific_needs = ? WHERE id = ?",
      )
      .run(firstName, age, sex, specificNeeds ?? "", id);
    return mapChildRow({
      ...r,
      first_name: firstName,
      age,
      sex,
      specific_needs: specificNeeds ?? "",
    });
  }

  delete(id: string): boolean {
    return this.db.prepare("DELETE FROM children WHERE id = ?").run(id).changes > 0;
  }
}
