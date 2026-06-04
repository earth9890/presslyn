"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Add01Icon, Delete01Icon, PencilEdit02Icon } from "hugeicons-react";
import { apiFetch, ApiError } from "@/lib/api-client";

export interface TermRow {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parentId: number | null;
  count: number;
}

interface TaxonomyManagerProps {
  taxonomySlug: string;
  /** Singular human label, e.g. "Category" or "Tag". */
  label: string;
  hierarchical: boolean;
  terms: TermRow[];
}

interface DisplayTerm extends TermRow {
  depth: number;
}

/**
 * Orders terms for display. For hierarchical taxonomies, children are nested
 * under their parents with an increasing depth; flat taxonomies keep their
 * incoming (alphabetical) order with depth 0.
 */
function orderTerms(terms: TermRow[], hierarchical: boolean): DisplayTerm[] {
  if (!hierarchical) {
    return terms.map((t) => ({ ...t, depth: 0 }));
  }
  const byParent = new Map<number | null, TermRow[]>();
  for (const t of terms) {
    const key = t.parentId ?? null;
    const bucket = byParent.get(key);
    if (bucket) bucket.push(t);
    else byParent.set(key, [t]);
  }
  const out: DisplayTerm[] = [];
  const ids = new Set(terms.map((t) => t.id));
  const walk = (parentId: number | null, depth: number) => {
    for (const t of byParent.get(parentId) ?? []) {
      out.push({ ...t, depth });
      walk(t.id, depth + 1);
    }
  };
  walk(null, 0);
  // Surface any orphans whose parent no longer exists so nothing is hidden.
  for (const t of terms) {
    if (t.parentId !== null && !ids.has(t.parentId) && !out.some((o) => o.id === t.id)) {
      out.push({ ...t, depth: 0 });
    }
  }
  return out;
}

export function TaxonomyManager({
  taxonomySlug,
  label,
  hierarchical,
  terms,
}: TaxonomyManagerProps) {
  const router = useRouter();
  const display = useMemo(
    () => orderTerms(terms, hierarchical),
    [terms, hierarchical]
  );

  // Add-form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Row edit/delete state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editParentId, setEditParentId] = useState<string>("");
  const [editDescription, setEditDescription] = useState("");
  const [rowBusy, setRowBusy] = useState(false);
  const [rowError, setRowError] = useState("");

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setAddError("Name is required.");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      const body: Record<string, unknown> = { name: name.trim() };
      if (slug.trim()) body.slug = slug.trim();
      if (description.trim()) body.description = description.trim();
      if (hierarchical && parentId) body.parentId = Number(parentId);
      await apiFetch(`/api/v1/taxonomies/${taxonomySlug}/terms`, {
        method: "POST",
        body,
      });
      setName("");
      setSlug("");
      setParentId("");
      setDescription("");
      router.refresh();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : "Could not add term.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(term: TermRow) {
    setEditingId(term.id);
    setEditName(term.name);
    setEditSlug(term.slug);
    setEditParentId(term.parentId ? String(term.parentId) : "");
    setEditDescription(term.description ?? "");
    setRowError("");
  }

  async function saveEdit(id: number) {
    if (!editName.trim()) {
      setRowError("Name is required.");
      return;
    }
    setRowBusy(true);
    setRowError("");
    try {
      const body: Record<string, unknown> = {
        name: editName.trim(),
        slug: editSlug.trim() || undefined,
        description: editDescription.trim() || undefined,
      };
      if (hierarchical) {
        body.parentId = editParentId ? Number(editParentId) : null;
      }
      await apiFetch(`/api/v1/terms/${id}`, { method: "PUT", body });
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "Could not save term.");
    } finally {
      setRowBusy(false);
    }
  }

  async function deleteTerm(id: number) {
    if (!confirm(`Delete this ${label.toLowerCase()}? Posts will lose this assignment.`)) {
      return;
    }
    setRowBusy(true);
    setRowError("");
    try {
      await apiFetch(`/api/v1/terms/${id}`, { method: "DELETE" });
      if (editingId === id) setEditingId(null);
      router.refresh();
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "Could not delete term.");
    } finally {
      setRowBusy(false);
    }
  }

  const parentOptions = display.filter((t) => t.id !== editingId);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_1fr]">
      {/* Add new term */}
      <section className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-base font-semibold text-text-primary">
            Add New {label}
          </h2>
          <form onSubmit={handleAdd} className="space-y-3">
            {addError ? (
              <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
                {addError}
              </div>
            ) : null}
            <div className="space-y-1">
              <label htmlFor="tax-name" className="text-xs font-medium text-text-secondary">
                Name
              </label>
              <input
                id="tax-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
              <p className="text-xs text-text-muted">
                The name is how it appears on your site.
              </p>
            </div>
            <div className="space-y-1">
              <label htmlFor="tax-slug" className="text-xs font-medium text-text-secondary">
                Slug
              </label>
              <input
                id="tax-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto-generated from name"
                className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent placeholder:text-text-muted"
              />
            </div>
            {hierarchical ? (
              <div className="space-y-1">
                <label htmlFor="tax-parent" className="text-xs font-medium text-text-secondary">
                  Parent {label}
                </label>
                <select
                  id="tax-parent"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                >
                  <option value="">None</option>
                  {display.map((t) => (
                    <option key={t.id} value={t.id}>
                      {" ".repeat(t.depth * 2)}
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-1">
              <label htmlFor="tax-desc" className="text-xs font-medium text-text-secondary">
                Description
              </label>
              <textarea
                id="tax-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
            >
              <Add01Icon size={16} />
              {adding ? "Adding..." : `Add New ${label}`}
            </button>
          </form>
        </div>
      </section>

      {/* Term list */}
      <section className="space-y-3">
        {rowError ? (
          <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            {rowError}
          </div>
        ) : null}
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {display.length === 0 ? (
            <div className="py-16 text-center text-sm text-text-secondary">
              No {label.toLowerCase()}s yet. Add your first one on the left.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-raised text-left">
                  <th className="px-4 py-3 font-medium text-text-primary">Name</th>
                  <th className="hidden px-4 py-3 font-medium text-text-primary md:table-cell">
                    Description
                  </th>
                  <th className="px-4 py-3 font-medium text-text-primary">Slug</th>
                  <th className="px-4 py-3 text-right font-medium text-text-primary">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {display.map((term) =>
                  editingId === term.id ? (
                    <tr key={term.id} className="bg-surface-raised/60">
                      <td colSpan={4} className="px-4 py-4">
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Name"
                              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                            />
                            <input
                              value={editSlug}
                              onChange={(e) => setEditSlug(e.target.value)}
                              placeholder="Slug"
                              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                            />
                          </div>
                          {hierarchical ? (
                            <select
                              value={editParentId}
                              onChange={(e) => setEditParentId(e.target.value)}
                              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent sm:w-1/2"
                            >
                              <option value="">No parent</option>
                              {parentOptions.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {" ".repeat(t.depth * 2)}
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={2}
                            placeholder="Description"
                            className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveEdit(term.id)}
                              disabled={rowBusy}
                              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-60"
                            >
                              {rowBusy ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              disabled={rowBusy}
                              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-raised"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={term.id} className="group transition-colors hover:bg-surface-raised">
                      <td className="px-4 py-3">
                        <div style={{ paddingLeft: term.depth * 16 }}>
                          <p className="font-medium text-text-primary">
                            {term.depth > 0 ? "— " : ""}
                            {term.name}
                          </p>
                          <div className="mt-1 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => startEdit(term)}
                              className="flex items-center gap-1 text-xs text-accent hover:underline"
                            >
                              <PencilEdit02Icon size={12} />
                              Edit
                            </button>
                            <span className="text-text-muted">·</span>
                            <button
                              onClick={() => deleteTerm(term.id)}
                              disabled={rowBusy}
                              className="flex items-center gap-1 text-xs text-danger hover:underline disabled:opacity-50"
                            >
                              <Delete01Icon size={12} />
                              Delete
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-text-secondary md:table-cell">
                        {term.description || "—"}
                      </td>
                      <td className="px-4 py-3 text-text-muted">{term.slug}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                        {term.count}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
