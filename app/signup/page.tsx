import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata = { title: "Create your free account · CartoMapper" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your free account"
      sub="Thirty seconds, then straight to your map. No card, ever."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-atlas-moss hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
