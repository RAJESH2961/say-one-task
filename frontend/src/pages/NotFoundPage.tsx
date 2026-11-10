import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/common/States";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="The page you're looking for doesn't exist."
      className="py-24"
      action={
        <Button asChild>
          <Link to="/">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
