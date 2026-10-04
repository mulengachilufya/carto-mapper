import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotForm } from "@/components/auth/ForgotForm";

export const metadata = { title: "Reset your password · CartoMapper" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      sub="Enter your account's email and we'll send you a 6-digit code to choose a new password."
      footer={
        <Link href="/login" className="font-medium text-atlas-moss hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
