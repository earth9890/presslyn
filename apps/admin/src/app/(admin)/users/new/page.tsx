import { UserForm } from "@/components/users/user-form";

export const dynamic = "force-dynamic";

export default function NewUserPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <UserForm mode="create" />
    </div>
  );
}
