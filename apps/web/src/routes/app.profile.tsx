import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Link as LinkIcon, Camera } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { userApi } from "@/lib/api";

export const Route = createFileRoute("/app/profile")({ component: Profile });

function Profile() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [avatar, setAvatar] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    userApi.getMe().then((data) => {
      setUser(data);
      setAvatar(data?.avatar || data?.avatar_url || "https://api.dicebear.com/9.x/avataaars/svg?seed=User&backgroundColor=7c3aed");
      setEditName(data?.display_name || data?.name || "");
      setEditBio(data?.bio || "");
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setAvatar(url);
    userApi.updateProfile({ avatar_url: url }).catch(() => {});
  };

  const handleSave = async () => {
    try {
      await userApi.updateProfile({ display_name: editName, bio: editBio });
      setUser((prev: any) => ({ ...prev, display_name: editName, name: editName, bio: editBio }));
      setEditing(false);
    } catch {}
  };

  if (loading) {
    return <div className="grid h-64 place-items-center text-sm text-muted-foreground">Loading profile…</div>;
  }

  const displayName = user?.display_name || user?.name || "User";
  const username = user?.username || user?.email?.split("@")[0] || "user";
  const plan = user?.plan || user?.subscription || "Free";
  const bio = user?.bio || "";
  const location = user?.location || "";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="glass overflow-hidden rounded-2xl">
        <div className="relative h-48 bg-gradient-to-br from-[#9A6A3F] via-[#B07A4E] to-[#C28A52]">
          <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.4), transparent 60%)" }} />
        </div>
        <div className="relative px-6 pb-6">
          <div className="relative -mt-12 inline-block group">
            <div className="size-24 rounded-2xl ring-4 ring-background overflow-hidden bg-[#C28A52]">
              <img
                src={avatar}
                alt=""
                className="size-full object-cover"
              />
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Change photo"
              className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-[#2D2119] text-white shadow-lg ring-2 ring-background hover:bg-[#3B2B20] transition"
            >
              <Camera className="size-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif" className="hidden" onChange={onPick} />
          </div>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold">{displayName}</h1>
                <span className="rounded-full bg-gradient-astra px-2 py-0.5 text-[10px] font-semibold text-white">{plan}</span>
              </div>
              <div className="text-sm text-muted-foreground">@{username}</div>
            </div>
            <button onClick={() => setEditing(true)} className="glass rounded-xl px-4 py-2 text-sm">Edit Profile</button>
          </div>
          <div className="mt-6">
            <h2 className="text-sm font-semibold">About Me</h2>
            <p className="mt-1 text-sm text-muted-foreground">{bio || "No bio set"}</p>
          </div>
          {location && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MapPin className="size-4" /> {location}</span>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setEditing(false)}>
          <div className="w-full max-w-md rounded-2xl bg-popover p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 font-display text-lg font-semibold">Edit Profile</h3>
            <label className="block text-xs font-medium text-muted-foreground">Display Name</label>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="mb-3 mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" />
            <label className="block text-xs font-medium text-muted-foreground">Bio</label>
            <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className="mb-4 mt-1 h-24 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleSave} className="bg-gradient-astra glow rounded-lg px-5 py-2 text-sm font-medium text-white">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
