import { z } from "zod";

// ============ USERS & AUTH ============

export const UserRole = z.enum(["admin", "volunteer"]);
export type UserRole = z.infer<typeof UserRole>;

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: UserRole,
});
export type User = z.infer<typeof UserSchema>;

export const LoginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

// ============ CATEGORY (grouping for aid/need types) ============

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nom requis"),
  description: z.string().optional().default(""),
  createdAt: z.string(),
});
export type Category = z.infer<typeof CategorySchema>;

export const CreateCategorySchema = z.object({
  name: z.string().min(1, "Nom requis"),
  description: z.string().optional().default(""),
});
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

// ============ ARTICLE (stock variant within a category) ============

export const ArticleSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  name: z.string().min(1, "Nom requis"),
  description: z.string().optional().default(""),
  unit: z.string().optional().default("unités"),
  stockQuantity: z.number().int().min(0).default(0),
  stockMin: z.number().int().min(0).default(0),
  createdAt: z.string(),
});
export type Article = z.infer<typeof ArticleSchema>;

export const CreateArticleSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1, "Nom requis"),
  description: z.string().optional().default(""),
  unit: z.string().optional().default("unités"),
  stockQuantity: z.number().int().min(0).optional().default(0),
  stockMin: z.number().int().min(0).optional().default(0),
});
export type CreateArticleInput = z.infer<typeof CreateArticleSchema>;

// ============ FAMILY ============

export const FamilyHousing = z.enum(["housed", "pending_placement", "not_housed"]);
export type FamilyHousing = z.infer<typeof FamilyHousing>;

/** @deprecated Use FamilyHousing instead */
export type FamilySituation = FamilyHousing;

export const FamilySchema = z.object({
  id: z.string(),
  responsibleName: z.string().min(1, "Nom requis"),
  phone: z.string(),
  address: z.string(),
  neighborhood: z.string(),
  memberCount: z.number().int().min(1, "Min 1 membre"),
  childrenCount: z.number().int().min(0),
  housing: FamilyHousing,
  healthNotes: z.string().optional().default(""),
  hasMedicalNeeds: z.boolean().optional().default(false),
  notes: z.string().optional().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastVisitAt: z.string().nullable().optional(),
});
export type Family = z.infer<typeof FamilySchema>;

export const CreateFamilySchema = z.object({
  responsibleName: z.string().min(1, "Nom requis"),
  phone: z.string().min(1, "Téléphone requis"),
  address: z.string().min(1, "Adresse requise"),
  neighborhood: z.string().min(1, "Quartier requis"),
  memberCount: z.number().int().min(1, "Min 1 membre"),
  childrenCount: z.number().int().min(0),
  housing: FamilyHousing,
  healthNotes: z.string().optional().default(""),
  hasMedicalNeeds: z.boolean().optional().default(false),
  notes: z.string().optional().default(""),
});
export type CreateFamilyInput = z.infer<typeof CreateFamilySchema>;

// ============ CHILD ============

export const ChildSex = z.enum(["male", "female"]);
export type ChildSex = z.infer<typeof ChildSex>;

export const ChildSchema = z.object({
  id: z.string(),
  familyId: z.string(),
  firstName: z.string().min(1, "Prénom requis"),
  age: z.number().int().min(0),
  sex: ChildSex,
  specificNeeds: z.string().optional().default(""),
  createdAt: z.string(),
});
export type Child = z.infer<typeof ChildSchema>;

export const CreateChildSchema = z.object({
  familyId: z.string(),
  firstName: z.string().min(1, "Prénom requis"),
  age: z.number().int().min(0),
  sex: ChildSex,
  specificNeeds: z.string().optional().default(""),
});
export type CreateChildInput = z.infer<typeof CreateChildSchema>;

// ============ NEED ============

export const NeedUrgency = z.enum(["low", "medium", "high"]);
export type NeedUrgency = z.infer<typeof NeedUrgency>;

export const NeedStatus = z.enum(["pending", "partial", "covered"]);
export type NeedStatus = z.infer<typeof NeedStatus>;

export const NeedSchema = z.object({
  id: z.string(),
  familyId: z.string(),
  type: z.string().min(1),
  urgency: NeedUrgency,
  status: NeedStatus,
  comment: z.string().optional().default(""),
  details: z.string().optional().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Need = z.infer<typeof NeedSchema>;

/** Need enriched with computed priority (returned by API) */
export type EnrichedNeed = Need & {
  priorityScore: number;
  priorityLevel: PriorityLevel;
};

export const CreateNeedSchema = z.object({
  familyId: z.string(),
  type: z.string().min(1),
  urgency: NeedUrgency,
  status: NeedStatus.optional().default("pending"),
  comment: z.string().optional().default(""),
  details: z.string().optional().default(""),
});
export type CreateNeedInput = z.infer<typeof CreateNeedSchema>;

// ============ AID ============

export const AidSource = z.enum(["donation", "purchase", "partner"]);
export type AidSource = z.infer<typeof AidSource>;

export const AidSchema = z.object({
  id: z.string(),
  familyId: z.string(),
  type: z.string().min(1),
  articleId: z.string().optional().default(""),
  quantity: z.number().min(1, "Quantité min 1"),
  date: z.string(),
  volunteerId: z.string(),
  volunteerName: z.string(),
  source: AidSource,
  notes: z.string().optional().default(""),
  proofUrl: z.string().optional().default(""),
  createdAt: z.string(),
});
export type Aid = z.infer<typeof AidSchema>;

export const CreateAidSchema = z.object({
  familyId: z.string(),
  type: z.string().min(1),
  articleId: z.string().optional().default(""),
  quantity: z.number().min(1, "Quantité min 1"),
  date: z.string(),
  volunteerId: z.string(),
  volunteerName: z.string(),
  source: AidSource,
  notes: z.string().optional().default(""),
  proofUrl: z.string().optional().default(""),
});
export type CreateAidInput = z.infer<typeof CreateAidSchema>;

// ============ VISIT NOTE ============

export const VisitNoteSchema = z.object({
  id: z.string(),
  familyId: z.string(),
  volunteerId: z.string(),
  volunteerName: z.string(),
  content: z.string().min(1, "Contenu requis"),
  date: z.string(),
  createdAt: z.string(),
});
export type VisitNote = z.infer<typeof VisitNoteSchema>;

export const CreateVisitNoteSchema = z.object({
  familyId: z.string(),
  volunteerId: z.string(),
  volunteerName: z.string(),
  content: z.string().min(1, "Contenu requis"),
  date: z.string(),
});
export type CreateVisitNoteInput = z.infer<typeof CreateVisitNoteSchema>;

// ============ DASHBOARD ============

export interface DashboardStats {
  totalFamilies: number;
  urgentNeeds: number;
  aidsThisMonth: number;
  familiesNotVisited: number;
  medicalFamilies: number;
  recentAids: (Aid & { familyName: string })[];
  urgentNeedsList: (Need & { familyName: string })[];
}

// ============ LABELS / TRANSLATIONS ============

export const NEED_URGENCY_LABELS: Record<NeedUrgency, string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Élevée",
};

export const NEED_STATUS_LABELS: Record<NeedStatus, string> = {
  pending: "En attente",
  partial: "Partiellement couvert",
  covered: "Couvert",
};

// ============ PRIORITY SCORING ============

/**
 * Compute a dynamic priority score for a need.
 * Higher score = more urgent to address.
 *
 * Factors:
 * - Base urgency: high=30, medium=20, low=10
 * - Status penalty: covered=-50, partial=-15, pending=0
 * - Need age bonus: +1 per day since creation (uncovered needs grow)
 * - Last visit penalty: +2 per day since last family visit (neglected families)
 *
 * Returns a number; higher = more urgent.
 */
export function computeNeedPriority(
  urgency: NeedUrgency,
  status: NeedStatus,
  needCreatedAt: string,
  familyLastVisitAt: string | null | undefined,
): number {
  const baseScores: Record<NeedUrgency, number> = { high: 30, medium: 20, low: 10 };
  const statusPenalties: Record<NeedStatus, number> = { pending: 0, partial: -15, covered: -50 };

  let score = baseScores[urgency] + statusPenalties[status];

  const now = Date.now();
  const daysSinceCreation = Math.max(0, (now - new Date(needCreatedAt).getTime()) / (1000 * 60 * 60 * 24));

  // Uncovered needs grow in urgency over time
  if (status !== "covered") {
    score += Math.min(daysSinceCreation, 30); // cap at +30
  }

  // Neglected families increase urgency
  if (familyLastVisitAt) {
    const daysSinceVisit = Math.max(0, (now - new Date(familyLastVisitAt).getTime()) / (1000 * 60 * 60 * 24));
    if (status !== "covered") {
      score += Math.min(daysSinceVisit * 0.5, 15); // cap at +15
    }
  } else if (status !== "covered") {
    score += 15; // never visited = max visit bonus
  }

  return Math.round(score);
}

/**
 * Map a priority score to a display level.
 */
export type PriorityLevel = "critical" | "high" | "medium" | "low" | "none";

export function getPriorityLevel(score: number): PriorityLevel {
  if (score <= 0) return "none";
  if (score >= 45) return "critical";
  if (score >= 30) return "high";
  if (score >= 15) return "medium";
  return "low";
}

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  critical: "Critique",
  high: "Haute",
  medium: "Moyenne",
  low: "Basse",
  none: "Résolue",
};

export const AID_SOURCE_LABELS: Record<AidSource, string> = {
  donation: "Don",
  purchase: "Achat",
  partner: "Partenaire",
};

export const FAMILY_HOUSING_LABELS: Record<FamilyHousing, string> = {
  housed: "Hébergé en foyer",
  pending_placement: "En attente de placement",
  not_housed: "Sans hébergement",
};

/** @deprecated Use FAMILY_HOUSING_LABELS */
export const FAMILY_SITUATION_LABELS = FAMILY_HOUSING_LABELS;

export const CHILD_SEX_LABELS: Record<ChildSex, string> = {
  male: "Garçon",
  female: "Fille",
};
