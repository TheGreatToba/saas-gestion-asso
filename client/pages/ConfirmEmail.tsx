import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Heart, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

export default function ConfirmEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Lien de confirmation invalide ou manquant.");
      return;
    }
    fetch(`/api/auth/confirm-email?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
          setMessage(data.message ?? "Votre compte est activé.");
        } else {
          setStatus("error");
          setMessage(data.error ?? "Lien invalide ou expiré.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Erreur lors de la confirmation. Réessayez plus tard.");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-primary p-4 rounded-2xl mb-4">
            <Heart className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">SocialAid</h1>
          <p className="text-muted-foreground mt-2">Confirmation d&apos;email</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
              <p className="text-muted-foreground">Vérification en cours...</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle className="w-16 h-16 text-green-600" />
              <p className="text-center text-foreground font-medium">{message}</p>
              <Button asChild className="mt-4">
                <Link to={ROUTES.login}>Se connecter</Link>
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4">
              <XCircle className="w-16 h-16 text-destructive" />
              <p className="text-center text-foreground">{message}</p>
              <p className="text-sm text-muted-foreground text-center">
                Vous pouvez demander un nouvel email de confirmation depuis la page d&apos;inscription, ou contacter l&apos;administrateur.
              </p>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" asChild>
                  <Link to={ROUTES.register}>Réinscription</Link>
                </Button>
                <Button asChild>
                  <Link to={ROUTES.login}>Connexion</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
