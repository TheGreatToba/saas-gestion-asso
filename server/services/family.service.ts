import type { Family, CreateFamilyInput } from "../../shared/schema";
import type { FamiliesRepository } from "../repositories/families.repository";

/**
 * Service layer for family operations. Applies organization scoping;
 * repositories handle data access only.
 */
export class FamilyService {
  constructor(private repo: FamiliesRepository) {}

  getFamily(organizationId: string, id: string): Family | null {
    return this.repo.getById(organizationId, id);
  }

  getFamiliesPage(
    organizationId: string,
    opts: { limit: number; offset: number; search?: string },
  ): { items: Family[]; total: number } {
    return this.repo.getPage(organizationId, opts);
  }

  getFamiliesByIds(organizationId: string, ids: string[]): Family[] {
    return this.repo.getByIds(organizationId, ids);
  }

  getAllFamilies(organizationId: string): Family[] {
    return this.repo.getAll(organizationId);
  }

  searchFamilies(organizationId: string, query: string, limit?: number): Family[] {
    return this.repo.search(organizationId, query, limit);
  }

  createFamily(organizationId: string, input: CreateFamilyInput): Family {
    return this.repo.create(organizationId, input);
  }

  updateFamily(
    organizationId: string,
    id: string,
    input: Partial<CreateFamilyInput>,
  ): Family | null {
    return this.repo.update(organizationId, id, input);
  }

  deleteFamily(organizationId: string, id: string): boolean {
    return this.repo.delete(organizationId, id);
  }

  purgeArchivedFamilies(organizationId: string): number {
    return this.repo.purgeArchived(organizationId);
  }

  resetAllFamilies(organizationId: string): number {
    return this.repo.resetAll(organizationId);
  }
}
