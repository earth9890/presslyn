import { ProfileForm } from "@/components/users/profile-form";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <ProfileForm />
    </div>
  );
}
