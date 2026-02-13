import type { User, CreateUserInput, UpdateUserInput } from "../../shared/schema";
import type Database from "better-sqlite3";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: number;
  organization_id: string | null;
};

export function mapUserRow(r: UserRow): User {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role as User["role"],
    active: !!r.active,
    organizationId: r.organization_id ?? "org-default",
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export class UsersRepository {
  constructor(private getDb: () => Database.Database) {}

  private get db(): Database.Database {
    return this.getDb();
  }

  getById(id: string): User | null {
    const r = this.db
      .prepare(
        "SELECT id, name, email, role, active, organization_id FROM users WHERE id = ?",
      )
      .get(id) as UserRow | undefined;
    return r ? mapUserRow(r) : null;
  }

  getByEmail(email: string): User | null {
    const r = this.db
      .prepare(
        "SELECT id, name, email, role, active, organization_id FROM users WHERE email = ?",
      )
      .get(email) as UserRow | undefined;
    return r ? mapUserRow(r) : null;
  }

  getAllByOrg(organizationId: string): User[] {
    const rows = this.db
      .prepare(
        "SELECT id, name, email, role, active, organization_id FROM users WHERE organization_id = ? ORDER BY role DESC, name",
      )
      .all(organizationId) as UserRow[];
    return rows.map(mapUserRow);
  }

  countActiveAdmins(organizationId: string): number {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) as c FROM users WHERE organization_id = ? AND role = 'admin' AND active = 1",
      )
      .get(organizationId) as { c: number };
    return row.c;
  }

  /**
   * Create user and password record. Caller must provide already-hashed password.
   */
  create(
    organizationId: string,
    input: CreateUserInput,
    hashedPassword: string,
  ): User {
    const existing = this.db
      .prepare("SELECT 1 FROM users WHERE email = ?")
      .get(input.email);
    if (existing) {
      throw new Error("Email déjà utilisé");
    }
    const id = "usr-" + generateId();

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          "INSERT INTO users (id, name, email, role, active, organization_id) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          id,
          input.name,
          input.email,
          input.role,
          input.active ? 1 : 0,
          organizationId,
        );
      this.db
        .prepare("INSERT INTO passwords (user_id, password) VALUES (?, ?)")
        .run(id, hashedPassword);
    });

    tx();
    return this.getById(id)!;
  }

  update(id: string, input: UpdateUserInput, hashedPassword?: string): User | null {
    const current = this.db
      .prepare(
        "SELECT id, name, email, role, active, organization_id FROM users WHERE id = ?",
      )
      .get(id) as UserRow | undefined;
    if (!current) return null;

    if (input.email && input.email !== current.email) {
      const existing = this.db
        .prepare("SELECT 1 FROM users WHERE email = ?")
        .get(input.email);
      if (existing) {
        throw new Error("Email déjà utilisé");
      }
    }

    const name = input.name ?? current.name;
    const email = input.email ?? current.email;
    const role = input.role ?? (current.role as User["role"]);
    const active =
      input.active !== undefined ? (input.active ? 1 : 0) : current.active;

    this.db
      .prepare(
        "UPDATE users SET name = ?, email = ?, role = ?, active = ? WHERE id = ?",
      )
      .run(name, email, role, active, id);

    if (hashedPassword) {
      this.db
        .prepare("UPDATE passwords SET password = ? WHERE user_id = ?")
        .run(hashedPassword, id);
    }

    return this.getById(id);
  }

  delete(id: string): boolean {
    const user = this.getById(id);
    if (!user) return false;

    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM passwords WHERE user_id = ?").run(id);
      this.db.prepare("DELETE FROM users WHERE id = ?").run(id);
    });

    tx();
    return true;
  }

  /**
   * Create user without active flag (for invite). Caller must provide hashed password.
   */
  createForInvite(
    organizationId: string,
    input: { name: string; email: string; role: User["role"] },
    hashedPassword: string,
  ): User {
    const existing = this.db
      .prepare("SELECT 1 FROM users WHERE email = ?")
      .get(input.email);
    if (existing) {
      throw new Error("Email déjà utilisé");
    }
    const id = "usr-" + generateId();

    this.db
      .prepare(
        "INSERT INTO users (id, name, email, role, active, organization_id) VALUES (?, ?, ?, ?, 0, ?)",
      )
      .run(id, input.name, input.email, input.role, organizationId);
    this.db
      .prepare("INSERT INTO passwords (user_id, password) VALUES (?, ?)")
      .run(id, hashedPassword);

    return this.getById(id)!;
  }
}
