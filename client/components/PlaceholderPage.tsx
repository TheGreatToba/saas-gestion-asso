import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface PlaceholderPageProps {
  icon: LucideIcon;
  title: string;
  description: string;
  backLink?: string;
}

export default function PlaceholderPage({
  icon: Icon,
  title,
  description,
  backLink,
}: PlaceholderPageProps) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Icon className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-muted-foreground mb-8">{description}</p>
        {backLink && (
          <Link to={backLink}>
            <Button variant="outline">Retour</Button>
          </Link>
        )}
        <p className="text-xs text-muted-foreground mt-4 italic">
          Cette page sera bientôt disponible. Continuez à prompts pour la remplir.
        </p>
      </div>
    </div>
  );
}
