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

export const FamilySituation = z.enum(["insured", "uninsured"]);
export type FamilySituation = z.infer<typeof FamilySituation>;

export const FamilySchema = z.object({
  id: z.string(),
  responsibleName: z.string().min(1, "Nom requis"),
  phone: z.string(),
  address: z.string(),
  neighborhood: z.string(),
  memberCount: z.number().int().min(1, "Min 1 membre"),
  childrenCount: z.number().int().min(0),
  situation: FamilySituation,
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
  situation: FamilySituation,
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

export const AID_SOURCE_LABELS: Record<AidSource, string> = {
  donation: "Don",
  purchase: "Achat",
  partner: "Partenaire",
};

export const FAMILY_SITUATION_LABELS: Record<FamilySituation, string> = {
  insured: "Assuré",
  uninsured: "Non assuré",
};

export const CHILD_SEX_LABELS: Record<ChildSex, string> = {
  male: "Garçon",
  female: "Fille",
};
