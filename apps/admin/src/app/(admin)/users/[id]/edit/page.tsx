import { notFound } from "next/navigation";
import { UserForm } from "@/components/users/user-form";
import { services } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId < 1) notFound();

  let user;
  try {
    user = await services.users.getUserById(userId);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <UserForm
        mode="edit"
        user={{
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        }}
      />
    </div>
  );
}
