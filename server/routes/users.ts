import { RequestHandler } from "express";
import { CreateUserSchema, UpdateUserSchema, InviteUserSchema } from "../../shared/schema";
import { storage } from "../storage";
import { getAcceptInviteUrl, sendInvitationEmail } from "../email";

export const handleInviteUser: RequestHandler = async (req, res) => {
  const parsed = InviteUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const actor = (res as any).locals?.user as
    | { id: string; name: string; organizationId?: string }
    | undefined;
  const orgId = actor?.organizationId ?? "org-default";
  try {
    const name = parsed.data.name ?? parsed.data.email.split("@")[0] ?? "Invité";
    const user = storage.createUserForInvite(
      { name, email: parsed.data.email, role: parsed.data.role },
      orgId,
    );
    const token = storage.createInvitationToken(user.id);
    const inviteUrl = getAcceptInviteUrl(token);
    await sendInvitationEmail(user.email, inviteUrl);
    if (actor) {
      storage.appendAuditLog(actor.organizationId ?? "org-default", {
        userId: actor.id,
        userName: actor.name,
        action: "invited",
        entityType: "user",
        entityId: user.id,
        details: user.email,
      });
    }
    res.status(201).json({ user, message: "Invitation envoyée par email." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    res.status(400).json({ error: message });
  }
};

export const handleCreateUser: RequestHandler = (req, res) => {
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const actor = (res as any).locals?.user as
    | { id: string; name: string; organizationId?: string }
    | undefined;
  const orgId = actor?.organizationId ?? "org-default";
  try {
    const user = storage.createUser(parsed.data, orgId);
    if (actor) {
      storage.appendAuditLog(actor.organizationId ?? "org-default", {
        userId: actor.id,
        userName: actor.name,
        action: "created",
        entityType: "user",
        entityId: user.id,
        details: user.email,
      });
    }
    res.status(201).json(user);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    res.status(400).json({ error: message });
  }
};

export const handleUpdateUser: RequestHandler = (req, res) => {
  const parsed = UpdateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }

  const actor = (res as any).locals?.user as
    | { id: string; name: string; organizationId?: string }
    | undefined;
  const targetId = req.params.id as string;
  const current = storage.getUser(targetId);
  if (!current) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }

  // Prevent self-deactivation or self-demotion.
  if (actor?.id === targetId) {
    if (parsed.data.active === false || parsed.data.role === "volunteer") {
      res.status(400).json({ error: "Impossible de modifier votre propre accès" });
      return;
    }
  }

  // Ensure at least one active admin remains.
  const willDeactivateAdmin =
    current.role === "admin" &&
    current.active &&
    (parsed.data.active === false || parsed.data.role === "volunteer");
  if (willDeactivateAdmin && storage.countActiveAdmins(current.organizationId) <= 1) {
    res
      .status(400)
      .json({ error: "Au moins un administrateur actif est requis" });
    return;
  }

  try {
    const updated = storage.updateUser(targetId, parsed.data);
    if (!updated) {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }
    if (actor) {
      storage.appendAuditLog(actor.organizationId ?? "org-default", {
        userId: actor.id,
        userName: actor.name,
        action: "updated",
        entityType: "user",
        entityId: updated.id,
        details: updated.email,
      });
    }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    res.status(400).json({ error: message });
  }
};

export const handleDeleteUser: RequestHandler = (req, res) => {
  const actor = (res as any).locals?.user as
    | { id: string; name: string; organizationId?: string }
    | undefined;
  const targetId = req.params.id as string;
  const target = storage.getUser(targetId);
  
  if (!target) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }

  // Empêcher la suppression de son propre compte
  if (actor?.id === targetId) {
    res.status(400).json({ error: "Impossible de supprimer votre propre compte" });
    return;
  }

  // Empêcher la suppression des administrateurs (seulement les bénévoles peuvent être supprimés)
  if (target.role === "admin") {
    res.status(403).json({ error: "Impossible de supprimer un compte administrateur" });
    return;
  }

  const success = storage.deleteUser(targetId);
  if (!success) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }

  if (actor) {
    storage.appendAuditLog(actor.organizationId ?? "org-default", {
      userId: actor.id,
      userName: actor.name,
      action: "deleted",
      entityType: "user",
      entityId: targetId,
      details: target.email,
    });
  }

  res.json({ success: true });
};
