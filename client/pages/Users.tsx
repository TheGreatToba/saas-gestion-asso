import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UserPlus, Shield, User, Search, Pencil, Power, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "@/components/ui/use-toast";
import type { CreateUserInput, UpdateUserInput, User as UserType } from "@shared/schema";

const emptyForm: CreateUserInput = {
  name: "",
  email: "",
  role: "volunteer",
  password: "",
  active: true,
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [form, setForm] = useState<CreateUserInput>(emptyForm);
  const [password, setPassword] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: api.getUsers,
  });

  const filtered = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [users, search]);

  const createMutation = useMutation({
    mutationFn: api.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowForm(false);
      setForm(emptyForm);
      setPassword("");
      toast({ title: "Compte créé" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
      api.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowForm(false);
      setEditingUser(null);
      setForm(emptyForm);
      setPassword("");
      toast({ title: "Compte mis à jour" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Compte supprimé" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setPassword("");
    setShowForm(true);
  };

  const openEdit = (u: UserType) => {
    setEditingUser(u);
    setForm({
      name: u.name,
      email: u.email,
      role: u.role,
      password: "",
      active: u.active,
    });
    setPassword("");
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const payload: UpdateUserInput = {
        name: form.name,
        email: form.email,
        role: form.role,
        active: form.active,
        ...(password ? { password } : {}),
      };
      updateMutation.mutate({ id: editingUser.id, data: payload });
    } else {
      createMutation.mutate({ ...form, password });
    }
  };

  const handleToggleActive = (u: UserType) => {
    updateMutation.mutate({
      id: u.id,
      data: { active: !u.active },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Utilisateurs</h1>
            <p className="text-muted-foreground mt-1">
              {users.length} compte{users.length !== 1 ? "s" : ""} au total
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Nouveau compte
          </Button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, email, rôle..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
            Impossible de charger les utilisateurs.
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
            <User className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((u) => (
              <div
                key={u.id}
                className="bg-white rounded-lg border border-gray-200 shadow-sm p-5"
              >
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{u.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {u.role === "admin" ? "Admin" : "Bénévole"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          u.active
                            ? "bg-green-100 text-green-800 border-green-300"
                            : "bg-gray-100 text-gray-600 border-gray-200"
                        }`}
                      >
                        {u.active ? "Actif" : "Désactivé"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {u.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => openEdit(u)}
                    >
                      <Pencil className="w-4 h-4" />
                      Modifier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`gap-2 ${
                        u.active
                          ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                          : "text-green-700 hover:bg-green-50"
                      }`}
                      onClick={() => handleToggleActive(u)}
                      disabled={currentUser?.id === u.id}
                      title={
                        currentUser?.id === u.id
                          ? "Impossible de désactiver votre propre compte"
                          : undefined
                      }
                    >
                      <Power className="w-4 h-4" />
                      {u.active ? "Désactiver" : "Activer"}
                    </Button>
                    {u.role === "volunteer" && currentUser?.id !== u.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (
                            confirm(
                              `Supprimer définitivement le compte de ${u.name} ? Cette action est irréversible.`
                            )
                          ) {
                            deleteMutation.mutate(u.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        title="Supprimer le compte bénévole"
                      >
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                      </Button>
                    )}
                    <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      {u.role === "admin" ? (
                        <Shield className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Modifier un compte" : "Nouveau compte"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nom complet"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="prenom@association.org"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Rôle *</Label>
                <Select
                  value={form.role}
                  onValueChange={(v: "admin" | "volunteer") =>
                    setForm({ ...form, role: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="volunteer">Bénévole</SelectItem>
                    <SelectItem value="admin">Administrateur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {editingUser ? "Nouveau mot de passe" : "Mot de passe *"}
                </Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUser ? "Laisser vide pour ne pas changer" : "Mot de passe"}
                  required={!editingUser}
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <div>
                  <Label>Compte actif</Label>
                  <p className="text-xs text-muted-foreground">
                    Désactiver empêche la connexion
                  </p>
                </div>
                <Switch
                  checked={!!form.active}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, active: checked })
                  }
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Enregistrement..."
                    : editingUser
                    ? "Mettre à jour"
                    : "Créer le compte"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
