import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/ResetForm";

export const metadata = { title: "Choose a new password · CartoMapper" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password">
      <ResetForm />
    </AuthShell>
  );
}
