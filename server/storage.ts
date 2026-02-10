import type {
  User,
  Family,
  Child,
  Need,
  Aid,
  VisitNote,
  Category,
  Article,
  CreateFamilyInput,
  CreateChildInput,
  CreateNeedInput,
  CreateAidInput,
  CreateVisitNoteInput,
  CreateCategoryInput,
  CreateArticleInput,
  DashboardStats,
} from "../shared/schema";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function now(): string {
  return new Date().toISOString();
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

class Storage {
  private users: User[] = [];
  private passwords: Map<string, string> = new Map(); // userId -> password
  private families: Family[] = [];
  private children: Child[] = [];
  private needs: Need[] = [];
  private aids: Aid[] = [];
  private visitNotes: VisitNote[] = [];
  private categories: Category[] = [];
  private articles: Article[] = [];

  constructor() {
    this.seed();
  }

  private seed() {
    // ---- Categories (groupings) ----
    this.categories = [
      { id: "food", name: "Nourriture", description: "Colis alimentaires, denrées", createdAt: daysAgo(365) },
      { id: "diapers", name: "Couches", description: "Couches bébé toutes tailles", createdAt: daysAgo(365) },
      { id: "clothes", name: "Vêtements", description: "Vêtements enfants et adultes", createdAt: daysAgo(365) },
      { id: "blankets", name: "Couvertures", description: "Couvertures et draps", createdAt: daysAgo(365) },
      { id: "mattress", name: "Matelas", description: "Matelas simple et double", createdAt: daysAgo(365) },
      { id: "medical", name: "Consultation médicale", description: "Consultations et soins", createdAt: daysAgo(365) },
    ];

    // ---- Articles (stock variants within categories) ----
    this.articles = [
      { id: "art-food-colis", categoryId: "food", name: "Colis alimentaire standard", description: "Riz, huile, sucre, farine, conserves", unit: "colis", stockQuantity: 18, stockMin: 5, createdAt: daysAgo(365) },
      { id: "art-food-farine1", categoryId: "food", name: "Farine 1kg", description: "Pack de farine de 1kg", unit: "paquets", stockQuantity: 30, stockMin: 10, createdAt: daysAgo(60) },
      { id: "art-food-farine2", categoryId: "food", name: "Farine 2kg", description: "Pack de farine de 2kg", unit: "paquets", stockQuantity: 12, stockMin: 5, createdAt: daysAgo(30) },
      { id: "art-diaper-t1", categoryId: "diapers", name: "Couches taille 1", description: "Nouveau-né", unit: "paquets", stockQuantity: 4, stockMin: 3, createdAt: daysAgo(365) },
      { id: "art-diaper-t3", categoryId: "diapers", name: "Couches taille 3", description: "4-9 kg", unit: "paquets", stockQuantity: 8, stockMin: 3, createdAt: daysAgo(365) },
      { id: "art-diaper-t5", categoryId: "diapers", name: "Couches taille 5", description: "11-25 kg", unit: "paquets", stockQuantity: 3, stockMin: 3, createdAt: daysAgo(365) },
      { id: "art-clothes-child", categoryId: "clothes", name: "Vêtements enfant", description: "Toutes tailles enfant", unit: "pièces", stockQuantity: 30, stockMin: 10, createdAt: daysAgo(365) },
      { id: "art-clothes-adult", categoryId: "clothes", name: "Vêtements adulte", description: "Toutes tailles adulte", unit: "pièces", stockQuantity: 12, stockMin: 5, createdAt: daysAgo(365) },
      { id: "art-blanket", categoryId: "blankets", name: "Couverture standard", description: "Couverture polaire", unit: "pièces", stockQuantity: 8, stockMin: 3, createdAt: daysAgo(365) },
      { id: "art-mattress-s", categoryId: "mattress", name: "Matelas 1 place", description: "", unit: "pièces", stockQuantity: 2, stockMin: 2, createdAt: daysAgo(365) },
      { id: "art-mattress-d", categoryId: "mattress", name: "Matelas 2 places", description: "", unit: "pièces", stockQuantity: 1, stockMin: 1, createdAt: daysAgo(365) },
    ];

    // ---- Users ----
    const admin: User = {
      id: "usr-admin",
      name: "Administrateur",
      email: "admin@socialaid.org",
      role: "admin",
    };
    const volunteer1: User = {
      id: "usr-vol1",
      name: "Fatima Mansouri",
      email: "fatima@socialaid.org",
      role: "volunteer",
    };
    const volunteer2: User = {
      id: "usr-vol2",
      name: "Mohamed Kaddouri",
      email: "mohamed@socialaid.org",
      role: "volunteer",
    };
    this.users = [admin, volunteer1, volunteer2];
    this.passwords.set("usr-admin", "admin123");
    this.passwords.set("usr-vol1", "volunteer123");
    this.passwords.set("usr-vol2", "volunteer123");

    // ---- Families ----
    this.families = [
      {
        id: "fam-001",
        responsibleName: "Ahmed Ben Ali",
        phone: "06 12 34 56 78",
        address: "12 Rue de la Paix",
        neighborhood: "Médina",
        memberCount: 6,
        childrenCount: 4,
        housing: "not_housed",
        housingName: "",
        healthNotes: "",
        hasMedicalNeeds: false,
        notes: "Famille nombreuse, père au chômage depuis 6 mois",
        createdAt: daysAgo(90),
        updatedAt: daysAgo(2),
        lastVisitAt: daysAgo(2),
      },
      {
        id: "fam-002",
        responsibleName: "Samir El Idrissi",
        phone: "06 23 45 67 89",
        address: "45 Avenue Hassan II",
        neighborhood: "Hay Mohammadi",
        memberCount: 4,
        childrenCount: 2,
        housing: "housed",
        housingName: "Berchifa",
        healthNotes: "Mère malade, besoin de suivi régulier",
        hasMedicalNeeds: true,
        notes: "",
        createdAt: daysAgo(60),
        updatedAt: daysAgo(5),
        lastVisitAt: daysAgo(5),
      },
      {
        id: "fam-003",
        responsibleName: "Zahra Ouahbi",
        phone: "06 34 56 78 90",
        address: "8 Derb Sidi Bousmara",
        neighborhood: "Ancienne Médina",
        memberCount: 3,
        childrenCount: 1,
        housing: "pending_placement",
        housingName: "",
        healthNotes: "",
        hasMedicalNeeds: false,
        notes: "Mère célibataire, très isolée — en attente de placement en foyer",
        createdAt: daysAgo(45),
        updatedAt: daysAgo(1),
        lastVisitAt: daysAgo(1),
      },
      {
        id: "fam-004",
        responsibleName: "Hassan Tazi",
        phone: "06 45 67 89 01",
        address: "22 Rue Ibnou Sina",
        neighborhood: "Sidi Bernoussi",
        memberCount: 8,
        childrenCount: 5,
        housing: "not_housed",
        housingName: "",
        healthNotes: "",
        hasMedicalNeeds: false,
        notes: "Grand-parents à charge, logement insalubre",
        createdAt: daysAgo(120),
        updatedAt: daysAgo(35),
        lastVisitAt: daysAgo(35),
      },
      {
        id: "fam-005",
        responsibleName: "Karim Bennis",
        phone: "06 56 78 90 12",
        address: "3 Impasse des Oliviers",
        neighborhood: "Hay Hassani",
        memberCount: 5,
        childrenCount: 3,
        housing: "housed",
        housingName: "Ahlan",
        healthNotes: "",
        hasMedicalNeeds: false,
        notes: "",
        createdAt: daysAgo(30),
        updatedAt: daysAgo(10),
        lastVisitAt: daysAgo(10),
      },
      {
        id: "fam-006",
        responsibleName: "Leila Amrani",
        phone: "06 67 89 01 23",
        address: "17 Boulevard Zerktouni",
        neighborhood: "Maarif",
        memberCount: 3,
        childrenCount: 1,
        housing: "not_housed",
        housingName: "",
        healthNotes: "Bébé prématuré, suivi médical nécessaire",
        hasMedicalNeeds: true,
        notes: "",
        createdAt: daysAgo(15),
        updatedAt: daysAgo(3),
        lastVisitAt: daysAgo(3),
      },
    ];

    // ---- Children ----
    this.children = [
      { id: "ch-001", familyId: "fam-001", firstName: "Youssef", age: 12, sex: "male", specificNeeds: "", createdAt: daysAgo(90) },
      { id: "ch-002", familyId: "fam-001", firstName: "Amina", age: 8, sex: "female", specificNeeds: "Suivi scolaire", createdAt: daysAgo(90) },
      { id: "ch-003", familyId: "fam-001", firstName: "Hamza", age: 4, sex: "male", specificNeeds: "Couches taille 5", createdAt: daysAgo(90) },
      { id: "ch-004", familyId: "fam-001", firstName: "Sara", age: 1, sex: "female", specificNeeds: "Couches taille 3, lait infantile", createdAt: daysAgo(90) },
      { id: "ch-005", familyId: "fam-002", firstName: "Nadia", age: 6, sex: "female", specificNeeds: "", createdAt: daysAgo(60) },
      { id: "ch-006", familyId: "fam-002", firstName: "Omar", age: 3, sex: "male", specificNeeds: "Allergie alimentaire", createdAt: daysAgo(60) },
      { id: "ch-007", familyId: "fam-003", firstName: "Yasmina", age: 2, sex: "female", specificNeeds: "Couches taille 4", createdAt: daysAgo(45) },
      { id: "ch-008", familyId: "fam-004", firstName: "Rachid", age: 14, sex: "male", specificNeeds: "", createdAt: daysAgo(120) },
      { id: "ch-009", familyId: "fam-004", firstName: "Fatima-Zahra", age: 10, sex: "female", specificNeeds: "Lunettes", createdAt: daysAgo(120) },
      { id: "ch-010", familyId: "fam-004", firstName: "Anas", age: 7, sex: "male", specificNeeds: "", createdAt: daysAgo(120) },
      { id: "ch-011", familyId: "fam-004", firstName: "Khadija", age: 3, sex: "female", specificNeeds: "Couches taille 5", createdAt: daysAgo(120) },
      { id: "ch-012", familyId: "fam-004", firstName: "Ilyas", age: 1, sex: "male", specificNeeds: "Couches taille 3", createdAt: daysAgo(120) },
      { id: "ch-013", familyId: "fam-005", firstName: "Soufiane", age: 9, sex: "male", specificNeeds: "", createdAt: daysAgo(30) },
      { id: "ch-014", familyId: "fam-005", firstName: "Imane", age: 5, sex: "female", specificNeeds: "", createdAt: daysAgo(30) },
      { id: "ch-015", familyId: "fam-005", firstName: "Adam", age: 2, sex: "male", specificNeeds: "Couches taille 4", createdAt: daysAgo(30) },
      { id: "ch-016", familyId: "fam-006", firstName: "Rayan", age: 0, sex: "male", specificNeeds: "Prématuré, suivi médical, couches taille 1", createdAt: daysAgo(15) },
    ];

    // ---- Needs ----
    this.needs = [
      { id: "nd-001", familyId: "fam-001", type: "food", urgency: "high", status: "pending", comment: "Colis alimentaire mensuel", details: "", createdAt: daysAgo(5), updatedAt: daysAgo(5) },
      { id: "nd-002", familyId: "fam-001", type: "diapers", urgency: "high", status: "pending", comment: "", details: "Taille 3 et Taille 5", createdAt: daysAgo(3), updatedAt: daysAgo(3) },
      { id: "nd-003", familyId: "fam-002", type: "medical", urgency: "high", status: "pending", comment: "Consultation spécialiste pour la mère", details: "", createdAt: daysAgo(7), updatedAt: daysAgo(7) },
      { id: "nd-004", familyId: "fam-003", type: "clothes", urgency: "medium", status: "partial", comment: "Vêtements d'hiver pour l'enfant", details: "Taille 2 ans", createdAt: daysAgo(10), updatedAt: daysAgo(4) },
      { id: "nd-005", familyId: "fam-004", type: "mattress", urgency: "high", status: "pending", comment: "2 matelas nécessaires", details: "", createdAt: daysAgo(20), updatedAt: daysAgo(20) },
      { id: "nd-006", familyId: "fam-004", type: "blankets", urgency: "medium", status: "pending", comment: "5 couvertures pour l'hiver", details: "", createdAt: daysAgo(15), updatedAt: daysAgo(15) },
      { id: "nd-007", familyId: "fam-004", type: "food", urgency: "high", status: "pending", comment: "Famille non visitée depuis plus d'un mois", details: "", createdAt: daysAgo(35), updatedAt: daysAgo(35) },
      { id: "nd-008", familyId: "fam-005", type: "diapers", urgency: "low", status: "covered", comment: "", details: "Taille 4", createdAt: daysAgo(12), updatedAt: daysAgo(8) },
      { id: "nd-009", familyId: "fam-006", type: "medical", urgency: "high", status: "partial", comment: "Suivi pédiatrique bébé prématuré", details: "", createdAt: daysAgo(10), updatedAt: daysAgo(3) },
      { id: "nd-010", familyId: "fam-006", type: "diapers", urgency: "medium", status: "pending", comment: "", details: "Taille 1 nouveau-né", createdAt: daysAgo(8), updatedAt: daysAgo(8) },
      { id: "nd-011", familyId: "fam-005", type: "clothes", urgency: "low", status: "pending", comment: "Vêtements scolaires", details: "Tailles 9 ans et 5 ans", createdAt: daysAgo(6), updatedAt: daysAgo(6) },
    ];

    // ---- Aids ----
    this.aids = [
      { id: "aid-001", familyId: "fam-001", type: "food", quantity: 1, date: daysAgo(2), volunteerId: "usr-vol1", volunteerName: "Fatima Mansouri", source: "donation", notes: "Colis alimentaire complet", proofUrl: "", createdAt: daysAgo(2) },
      { id: "aid-002", familyId: "fam-002", type: "food", quantity: 1, date: daysAgo(5), volunteerId: "usr-vol2", volunteerName: "Mohamed Kaddouri", source: "donation", notes: "", proofUrl: "", createdAt: daysAgo(5) },
      { id: "aid-003", familyId: "fam-003", type: "diapers", quantity: 3, date: daysAgo(4), volunteerId: "usr-vol1", volunteerName: "Fatima Mansouri", source: "purchase", notes: "3 paquets taille 4", proofUrl: "https://example.com/photo-couches.jpg", createdAt: daysAgo(4) },
      { id: "aid-004", familyId: "fam-003", type: "clothes", quantity: 5, date: daysAgo(4), volunteerId: "usr-vol1", volunteerName: "Fatima Mansouri", source: "donation", notes: "Vêtements 2 ans", proofUrl: "", createdAt: daysAgo(4) },
      { id: "aid-005", familyId: "fam-005", type: "diapers", quantity: 2, date: daysAgo(8), volunteerId: "usr-vol2", volunteerName: "Mohamed Kaddouri", source: "partner", notes: "Partenariat pharmacie locale", proofUrl: "https://example.com/facture-pharmacie.jpg", createdAt: daysAgo(8) },
      { id: "aid-006", familyId: "fam-006", type: "medical", quantity: 1, date: daysAgo(3), volunteerId: "usr-vol1", volunteerName: "Fatima Mansouri", source: "partner", notes: "Consultation pédiatrique via partenaire", proofUrl: "", createdAt: daysAgo(3) },
      { id: "aid-007", familyId: "fam-001", type: "clothes", quantity: 8, date: daysAgo(15), volunteerId: "usr-vol2", volunteerName: "Mohamed Kaddouri", source: "donation", notes: "Vêtements enfants divers", proofUrl: "", createdAt: daysAgo(15) },
      { id: "aid-008", familyId: "fam-002", type: "blankets", quantity: 2, date: daysAgo(20), volunteerId: "usr-vol1", volunteerName: "Fatima Mansouri", source: "donation", notes: "", proofUrl: "", createdAt: daysAgo(20) },
    ];

    // ---- Visit Notes ----
    this.visitNotes = [
      { id: "vn-001", familyId: "fam-001", volunteerId: "usr-vol1", volunteerName: "Fatima Mansouri", content: "Visite de routine. Le père cherche activement du travail. Les enfants sont scolarisés. Besoin urgent de couches et nourriture.", date: daysAgo(2), createdAt: daysAgo(2) },
      { id: "vn-002", familyId: "fam-002", volunteerId: "usr-vol2", volunteerName: "Mohamed Kaddouri", content: "La mère doit voir un spécialiste. Rendez-vous à prendre. Les enfants vont bien.", date: daysAgo(5), createdAt: daysAgo(5) },
      { id: "vn-003", familyId: "fam-003", volunteerId: "usr-vol1", volunteerName: "Fatima Mansouri", content: "Zahra est très reconnaissante. L'enfant grandit bien. Besoin de vêtements d'hiver bientôt.", date: daysAgo(1), createdAt: daysAgo(1) },
      { id: "vn-004", familyId: "fam-006", volunteerId: "usr-vol1", volunteerName: "Fatima Mansouri", content: "Le bébé prend du poids. Prochain rendez-vous médical dans 2 semaines. Besoin de couches taille 1.", date: daysAgo(3), createdAt: daysAgo(3) },
    ];
  }

  // ==================== AUTH ====================

  authenticate(email: string, password: string): User | null {
    const user = this.users.find((u) => u.email === email);
    if (!user) return null;
    const storedPassword = this.passwords.get(user.id);
    if (storedPassword !== password) return null;
    return user;
  }

  getUser(id: string): User | null {
    return this.users.find((u) => u.id === id) ?? null;
  }

  getAllUsers(): User[] {
    return [...this.users];
  }

  // ==================== CATEGORIES ====================

  getAllCategories(): Category[] {
    return [...this.categories].sort(
      (a, b) => a.name.localeCompare(b.name)
    );
  }

  getCategory(id: string): Category | null {
    return this.categories.find((c) => c.id === id) ?? null;
  }

  createCategory(input: CreateCategoryInput): Category {
    const slug = input.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const id = slug || "cat-" + generateId();
    const finalId = this.categories.find((c) => c.id === id)
      ? id + "-" + generateId()
      : id;
    const category: Category = {
      id: finalId,
      name: input.name,
      description: input.description ?? "",
      createdAt: now(),
    };
    this.categories.push(category);
    return category;
  }

  updateCategory(id: string, input: Partial<CreateCategoryInput>): Category | null {
    const idx = this.categories.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.categories[idx] = { ...this.categories[idx], ...input };
    return this.categories[idx];
  }

  deleteCategory(id: string): boolean {
    const idx = this.categories.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.categories.splice(idx, 1);
    // cascade delete articles of this category
    this.articles = this.articles.filter((a) => a.categoryId !== id);
    return true;
  }

  getCategoryLabels(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const cat of this.categories) {
      map[cat.id] = cat.name;
    }
    return map;
  }

  // ==================== ARTICLES (stock variants) ====================

  getAllArticles(): Article[] {
    return [...this.articles].sort((a, b) => a.name.localeCompare(b.name));
  }

  getArticlesByCategory(categoryId: string): Article[] {
    return this.articles
      .filter((a) => a.categoryId === categoryId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getArticle(id: string): Article | null {
    return this.articles.find((a) => a.id === id) ?? null;
  }

  createArticle(input: CreateArticleInput): Article {
    const article: Article = {
      id: "art-" + generateId(),
      categoryId: input.categoryId,
      name: input.name,
      description: input.description ?? "",
      unit: input.unit ?? "unités",
      stockQuantity: input.stockQuantity ?? 0,
      stockMin: input.stockMin ?? 0,
      createdAt: now(),
    };
    this.articles.push(article);
    return article;
  }

  updateArticle(id: string, input: Partial<Omit<CreateArticleInput, "categoryId">>): Article | null {
    const idx = this.articles.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    this.articles[idx] = { ...this.articles[idx], ...input };
    return this.articles[idx];
  }

  deleteArticle(id: string): boolean {
    const idx = this.articles.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    this.articles.splice(idx, 1);
    return true;
  }

  adjustArticleStock(articleId: string, delta: number): Article | null {
    const art = this.articles.find((a) => a.id === articleId);
    if (!art) return null;
    art.stockQuantity = Math.max(0, art.stockQuantity + delta);
    return art;
  }

  // ==================== FAMILIES ====================

  getAllFamilies(): Family[] {
    return [...this.families].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  getFamily(id: string): Family | null {
    return this.families.find((f) => f.id === id) ?? null;
  }

  createFamily(input: CreateFamilyInput): Family {
    const family: Family = {
      ...input,
      id: "fam-" + generateId(),
      createdAt: now(),
      updatedAt: now(),
      lastVisitAt: null,
    };
    this.families.push(family);
    return family;
  }

  updateFamily(id: string, input: Partial<CreateFamilyInput>): Family | null {
    const idx = this.families.findIndex((f) => f.id === id);
    if (idx === -1) return null;
    this.families[idx] = {
      ...this.families[idx],
      ...input,
      updatedAt: now(),
    };
    return this.families[idx];
  }

  deleteFamily(id: string): boolean {
    const idx = this.families.findIndex((f) => f.id === id);
    if (idx === -1) return false;
    this.families.splice(idx, 1);
    // cascade delete children, needs, aids, notes
    this.children = this.children.filter((c) => c.familyId !== id);
    this.needs = this.needs.filter((n) => n.familyId !== id);
    this.aids = this.aids.filter((a) => a.familyId !== id);
    this.visitNotes = this.visitNotes.filter((v) => v.familyId !== id);
    return true;
  }

  searchFamilies(query: string): Family[] {
    const q = query.toLowerCase();
    return this.families.filter(
      (f) =>
        f.responsibleName.toLowerCase().includes(q) ||
        f.neighborhood.toLowerCase().includes(q) ||
        (f.housingName || "").toLowerCase().includes(q) ||
        f.address.toLowerCase().includes(q) ||
        f.phone.includes(q)
    );
  }

  // ==================== CHILDREN ====================

  getChildrenByFamily(familyId: string): Child[] {
    return this.children.filter((c) => c.familyId === familyId);
  }

  createChild(input: CreateChildInput): Child {
    const child: Child = {
      ...input,
      id: "ch-" + generateId(),
      createdAt: now(),
    };
    this.children.push(child);
    return child;
  }

  updateChild(id: string, input: Partial<CreateChildInput>): Child | null {
    const idx = this.children.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.children[idx] = { ...this.children[idx], ...input };
    return this.children[idx];
  }

  deleteChild(id: string): boolean {
    const idx = this.children.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.children.splice(idx, 1);
    return true;
  }

  // ==================== NEEDS ====================

  getAllNeeds(): Need[] {
    return [...this.needs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getNeedsByFamily(familyId: string): Need[] {
    return this.needs
      .filter((n) => n.familyId === familyId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  createNeed(input: CreateNeedInput): Need {
    const need: Need = {
      ...input,
      id: "nd-" + generateId(),
      status: input.status ?? "pending",
      createdAt: now(),
      updatedAt: now(),
    };
    this.needs.push(need);
    return need;
  }

  updateNeed(id: string, input: Partial<CreateNeedInput & { status: string }>): Need | null {
    const idx = this.needs.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    this.needs[idx] = {
      ...this.needs[idx],
      ...input,
      updatedAt: now(),
    };
    return this.needs[idx];
  }

  deleteNeed(id: string): boolean {
    const idx = this.needs.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    this.needs.splice(idx, 1);
    return true;
  }

  // ==================== AIDS ====================

  getAllAids(): Aid[] {
    return [...this.aids].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  getAidsByFamily(familyId: string): Aid[] {
    return this.aids
      .filter((a) => a.familyId === familyId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  createAid(input: CreateAidInput): Aid {
    const aid: Aid = {
      ...input,
      id: "aid-" + generateId(),
      createdAt: now(),
    };
    this.aids.push(aid);
    // Aide apportée = famille visitée
    const family = this.families.find((f) => f.id === input.familyId);
    if (family) {
      family.lastVisitAt = input.date || now();
      family.updatedAt = now();
    }
    // Decrement stock for the article (if specified)
    if (input.articleId) {
      const art = this.articles.find((a) => a.id === input.articleId);
      if (art) {
        art.stockQuantity = Math.max(0, art.stockQuantity - (input.quantity || 1));
      }
    }

    // Auto-update matching pending/partial needs for this family
    // When an aid of a certain type is given, mark matching needs as partially covered or covered
    const matchingNeeds = this.needs.filter(
      (n) => n.familyId === input.familyId && n.type === input.type && n.status !== "covered"
    );
    for (const need of matchingNeeds) {
      // If need was pending → partial, if partial → covered
      if (need.status === "pending") {
        need.status = "partial";
      } else if (need.status === "partial") {
        need.status = "covered";
      }
      need.updatedAt = now();
    }

    return aid;
  }

  // ==================== VISIT NOTES ====================

  getNotesByFamily(familyId: string): VisitNote[] {
    return this.visitNotes
      .filter((v) => v.familyId === familyId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  createVisitNote(input: CreateVisitNoteInput): VisitNote {
    const note: VisitNote = {
      ...input,
      id: "vn-" + generateId(),
      createdAt: now(),
    };
    this.visitNotes.push(note);
    // Update family last visit
    const family = this.families.find((f) => f.id === input.familyId);
    if (family) {
      family.lastVisitAt = input.date;
      family.updatedAt = now();
    }
    return note;
  }

  // ==================== DASHBOARD ====================

  getDashboardStats(): DashboardStats {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const totalFamilies = this.families.length;

    const urgentNeeds = this.needs.filter(
      (n) => n.urgency === "high" && n.status !== "covered"
    ).length;

    const aidsThisMonth = this.aids.filter(
      (a) => new Date(a.date) >= startOfMonth
    ).length;

    const familiesNotVisited = this.families.filter((f) => {
      if (!f.lastVisitAt) return true;
      return new Date(f.lastVisitAt) < thirtyDaysAgo;
    }).length;

    const medicalFamilies = this.families.filter((f) => f.hasMedicalNeeds).length;

    const recentAids = this.aids
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map((aid) => ({
        ...aid,
        familyName: this.families.find((f) => f.id === aid.familyId)?.responsibleName ?? "Inconnu",
      }));

    const urgentNeedsList = this.needs
      .filter((n) => n.urgency === "high" && n.status !== "covered")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((need) => ({
        ...need,
        familyName: this.families.find((f) => f.id === need.familyId)?.responsibleName ?? "Inconnu",
      }));

    return {
      totalFamilies,
      urgentNeeds,
      aidsThisMonth,
      familiesNotVisited,
      medicalFamilies,
      recentAids,
      urgentNeedsList,
    };
  }

  // ==================== EXPORT ====================

  getExportData() {
    return {
      families: this.getAllFamilies().map((f) => ({
        ...f,
        children: this.getChildrenByFamily(f.id),
        needs: this.getNeedsByFamily(f.id),
        aids: this.getAidsByFamily(f.id),
      })),
      stats: this.getDashboardStats(),
    };
  }
}

export const storage = new Storage();
