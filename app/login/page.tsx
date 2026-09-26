import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in — CartoMapper" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      sub="Sign in to make maps and open the ones you've saved."
      footer={
        <>
          New to CartoMapper?{" "}
          <Link href="/signup" className="font-medium text-atlas-ocean hover:underline">
            Create a free account
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
