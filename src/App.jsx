import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Home, Search as SearchIcon,
  PlusSquare, Film, User, X, Smile, LogOut, Camera, Volume2, VolumeX,
  ArrowLeft, Loader2, Grid3x3, ImagePlus,
} from "lucide-react";
import { supabase, emailForUsername } from "./supabaseClient";

/* ---------------- helpers ---------------- */

const convId = (a, b) => [a, b].sort().join("__");

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

function fileToCompressedDataURL(file, maxDim = 900, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image decode failed"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='#27272a'/><text x='50' y='58' font-size='40' text-anchor='middle' fill='#a1a1aa' font-family='sans-serif'>?</text></svg>`
  );

const SAMPLE_REEL_VIDEOS = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/coffee.mp4",
];

/* ---------------- smoothness helpers ---------------- */

// Image that fades in once loaded instead of popping in abruptly, and shows
// a soft pulse placeholder while waiting so layout never jumps.
function SmartImage({ src, alt, className }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [src]);
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && <div className="absolute inset-0 bg-white/5 animate-pulse" />}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        draggable={false}
      />
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="bg-neutral-950 border-b border-white/10 sm:border sm:rounded-xl mb-4 max-w-[470px] w-full mx-auto animate-pulse">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="w-8 h-8 rounded-full bg-white/10" />
        <div className="h-3 w-24 rounded bg-white/10" />
      </div>
      <div className="w-full aspect-square bg-white/5" />
      <div className="px-3 pt-3 space-y-2">
        <div className="h-4 w-4/5 rounded bg-white/10" />
        <div className="h-3 w-2/5 rounded bg-white/10" />
      </div>
      <div className="h-3 pb-3" />
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="pt-4">
      <PostSkeleton />
      <PostSkeleton />
      <PostSkeleton />
    </div>
  );
}

// Fades content in on mount so tab switches feel like a transition instead
// of an instant, jarring swap.
function FadeIn({ children, tKey }) {
  return (
    <div key={tKey} className="animate-fadein">
      {children}
    </div>
  );
}

/* ---------------- Auth screen ---------------- */

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const u = username.trim().toLowerCase();
    if (!u || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (!/^[a-z0-9_.]{3,20}$/.test(u)) {
      setError("Username: 3-20 characters, letters/numbers/underscore/dot only.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          setBusy(false);
          return;
        }
        if (password !== confirm) {
          setError("Passwords don't match.");
          setBusy(false);
          return;
        }
        const { data, error: signErr } = await supabase.auth.signUp({
          email: emailForUsername(u),
          password,
        });
        if (signErr) {
          setError(
            signErr.message.includes("already registered")
              ? "That username is already taken."
              : signErr.message
          );
          setBusy(false);
          return;
        }
        const { error: profileErr } = await supabase.from("profiles").insert({
          user_id: data.user.id,
          username: u,
          name: name.trim() || u,
          avatar: DEFAULT_AVATAR,
        });
        if (profileErr) {
          setError(
            profileErr.message.includes("duplicate")
              ? "That username is already taken."
              : profileErr.message
          );
          setBusy(false);
          return;
        }
        onAuthed();
      } else {
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email: emailForUsername(u),
          password,
        });
        if (loginErr) {
          setError("Incorrect username or password.");
          setBusy(false);
          return;
        }
        onAuthed();
      }
    } catch (err) {
      console.error("Zgram auth error:", err);
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-neutral-950 to-fuchsia-950 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-3xl p-8">
          <h1 className="text-center text-4xl font-black tracking-tight mb-1 bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
            Zgram
          </h1>
          <p className="text-center text-white/40 text-sm mb-7">
            {mode === "login" ? "Welcome back." : "Create your account."}
          </p>

          <div
            className="space-y-3"
            onKeyDown={(e) => {
              if (e.key === "Enter") submit(e);
            }}
          >
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoCapitalize="none"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 outline-none focus:border-violet-400/60"
            />
            {mode === "signup" && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 outline-none focus:border-violet-400/60"
              />
            )}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 outline-none focus:border-violet-400/60"
            />
            {mode === "signup" && (
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm password"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 outline-none focus:border-violet-400/60"
              />
            )}

            {error && <p className="text-rose-400 text-xs">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="w-full mt-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold text-sm rounded-xl py-3 flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {mode === "login" ? "Log in" : "Sign up"}
            </button>
          </div>

          <p className="text-center text-white/40 text-xs mt-6">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
              }}
              className="text-violet-300 font-semibold"
            >
              {mode === "login" ? "Sign up" : "Log in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Comments modal ---------------- */

function CommentsModal({ item, currentUser, users, onClose, onAddComment }) {
  const [text, setText] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onAddComment(item.id, t);
    setText("");
  };
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center animate-backdrop">
      <div className="animate-sheet bg-neutral-950 text-white w-full sm:max-w-md sm:rounded-xl max-h-[85vh] flex flex-col overflow-hidden border border-white/10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="font-semibold text-sm">Comments</span>
          <button onClick={onClose} aria-label="Close comments"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {item.comments.length === 0 && (
            <p className="text-white/30 text-sm text-center py-8">No comments yet. Start the conversation.</p>
          )}
          {item.comments.map((c, i) => (
            <div key={i} className="flex gap-3">
              <img
                src={users[c.user]?.avatar || DEFAULT_AVATAR}
                alt=""
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
              <div className="text-sm">
                <span className="font-semibold mr-1">{c.user}</span>
                <span className="text-white/80">{c.text}</span>
              </div>
            </div>
          ))}
        </div>
        <div
          className="flex items-center gap-2 border-t border-white/10 px-4 py-3"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit(e);
          }}
        >
          <img src={currentUser.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 bg-transparent text-sm outline-none placeholder-white/30"
          />
          <button type="button" onClick={submit} disabled={!text.trim()} className="text-violet-400 font-semibold text-sm disabled:text-white/20">
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Post card ---------------- */

function DoubleTapHeart({ show }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
      <Heart className="text-white drop-shadow-lg animate-heart-pop" fill="white" size={90} />
    </div>
  );
}

function PostCard({ post, currentUser, users, onToggleLike, onToggleSave, onOpenComments, onOpenProfile }) {
  const [showHeart, setShowHeart] = useState(false);
  const lastTap = useRef(0);
  const liked = post.likes.includes(currentUser.username);
  const saved = (post.saved_by || []).includes(currentUser.username);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) onToggleLike(post.id);
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 700);
    }
    lastTap.current = now;
  };

  return (
    <article className="bg-neutral-950 border-b border-white/10 sm:border sm:rounded-xl mb-4 max-w-[470px] w-full mx-auto text-white">
      <div className="flex items-center justify-between px-3 py-2.5">
        <button onClick={() => onOpenProfile(post.username)} className="flex items-center gap-2.5">
          <img src={users[post.username]?.avatar || DEFAULT_AVATAR} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-white/20" />
          <span className="text-sm font-semibold">{post.username}</span>
        </button>
        <MoreHorizontal size={20} className="text-white/60" />
      </div>

      <div className="relative select-none" onClick={handleTap}>
        <SmartImage src={post.image} alt="" className="w-full aspect-square" />
        <DoubleTapHeart show={showHeart} />
      </div>

      <div className="flex items-center justify-between px-3 pt-2.5">
        <div className="flex items-center gap-4">
          <button onClick={() => onToggleLike(post.id)} aria-label="Like">
            <Heart size={24} className={liked ? "text-red-500" : "text-white"} fill={liked ? "currentColor" : "none"} />
          </button>
          <button onClick={() => onOpenComments(post)} aria-label="Comment">
            <MessageCircle size={24} />
          </button>
          <Send size={24} />
        </div>
        <button onClick={() => onToggleSave(post.id)} aria-label="Save">
          <Bookmark size={24} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="px-3 pt-2 text-sm font-semibold">{post.likes.length} likes</div>
      <div className="px-3 pt-1 text-sm">
        <span className="font-semibold mr-1">{post.username}</span>
        <span className="text-white/85">{post.caption}</span>
      </div>
      {post.comments.length > 0 && (
        <button onClick={() => onOpenComments(post)} className="px-3 pt-1 text-sm text-white/40 block">
          View all {post.comments.length} comment{post.comments.length > 1 ? "s" : ""}
        </button>
      )}
      <div className="px-3 pt-1 pb-3 text-[11px] uppercase tracking-wide text-white/30">{timeAgo(post.created_at)} ago</div>
    </article>
  );
}

/* ---------------- Create post modal ---------------- */

function CreatePostModal({ currentUser, onClose, onCreate }) {
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataURL(file);
      setPreview(dataUrl);
    } catch {
      alert("Couldn't load that image.");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-end sm:items-center justify-center animate-backdrop">
      <div className="animate-sheet bg-neutral-950 text-white w-full sm:max-w-md sm:rounded-xl max-h-[90vh] flex flex-col overflow-hidden border border-white/10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <button onClick={onClose}><X size={20} /></button>
          <span className="font-semibold text-sm">New post</span>
          <button
            onClick={() => onCreate({ image: preview, caption: caption.trim() })}
            disabled={!preview}
            className="text-violet-400 font-semibold text-sm disabled:text-white/20"
          >
            Share
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {preview ? (
            <div className="relative">
              <img src={preview} alt="" className="w-full aspect-square object-cover rounded-lg" />
              <button onClick={() => setPreview(null)} className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full aspect-square rounded-lg border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-2 text-white/40"
            >
              {busy ? <Loader2 className="animate-spin" /> : <ImagePlus size={36} />}
              <span className="text-sm">{busy ? "Loading..." : "Select a photo"}</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} className="hidden" />
          <div className="flex gap-3">
            <img src={currentUser.avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption..."
              rows={3}
              className="flex-1 bg-transparent text-sm outline-none placeholder-white/30 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Create reel modal ---------------- */

function CreateReelModal({ onClose, onCreate }) {
  const [videoUrl, setVideoUrl] = useState("");
  const [caption, setCaption] = useState("");
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-end sm:items-center justify-center animate-backdrop">
      <div className="animate-sheet bg-neutral-950 text-white w-full sm:max-w-md sm:rounded-xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-sm">New reel</span>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <p className="text-xs text-white/40 mb-2">Pick a sample clip:</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {SAMPLE_REEL_VIDEOS.map((v) => (
            <button
              key={v}
              onClick={() => setVideoUrl(v)}
              className={`aspect-[9/16] rounded-lg bg-white/5 border flex items-center justify-center text-[10px] text-white/40 px-1 text-center ${
                videoUrl === v ? "border-violet-400" : "border-white/10"
              }`}
            >
              {v.split("/").pop()}
            </button>
          ))}
        </div>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption..."
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none placeholder-white/30 mb-4"
        />
        <button
          disabled={!videoUrl}
          onClick={() => onCreate({ video: videoUrl, caption: caption.trim() })}
          className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-30"
        >
          Share reel
        </button>
      </div>
    </div>
  );
}

/* ---------------- Reels screen ---------------- */

function ReelCard({ reel, currentUser, users, onToggleLike, onOpenComments }) {
  const [muted, setMuted] = useState(true);
  const liked = reel.likes.includes(currentUser.username);
  return (
    <div className="h-full w-full snap-start relative bg-black flex-shrink-0">
      <video src={reel.video} autoPlay loop muted={muted} playsInline onClick={() => setMuted((m) => !m)} className="w-full h-full object-cover" />
      <button onClick={() => setMuted((m) => !m)} className="absolute top-4 right-4 bg-black/40 rounded-full p-2 text-white">
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <div className="absolute bottom-6 left-3 right-16 text-white">
        <div className="flex items-center gap-2 mb-2">
          <img src={users[reel.username]?.avatar || DEFAULT_AVATAR} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-white/40" />
          <span className="text-sm font-semibold">{reel.username}</span>
        </div>
        <p className="text-sm text-white/90">{reel.caption}</p>
      </div>
      <div className="absolute bottom-8 right-3 flex flex-col items-center gap-5 text-white">
        <button onClick={() => onToggleLike(reel.id)} className="flex flex-col items-center gap-1">
          <Heart size={28} className={liked ? "text-red-500" : "text-white"} fill={liked ? "currentColor" : "none"} />
          <span className="text-xs">{reel.likes.length}</span>
        </button>
        <button onClick={() => onOpenComments(reel)} className="flex flex-col items-center gap-1">
          <MessageCircle size={26} />
          <span className="text-xs">{reel.comments.length}</span>
        </button>
        <Send size={24} />
      </div>
    </div>
  );
}

function ReelsScreen({ reels, currentUser, users, onToggleLike, onOpenComments, onCreate }) {
  return (
    <div className="relative h-[calc(100vh-56px)] lg:h-[calc(100vh-24px)] w-full max-w-[470px] mx-auto bg-black overflow-hidden">
      <button onClick={onCreate} className="absolute top-3 right-3 z-20 bg-white/15 backdrop-blur rounded-full p-2 text-white" aria-label="Create reel">
        <PlusSquare size={20} />
      </button>
      {reels === null ? (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="animate-spin text-white/30" size={26} />
        </div>
      ) : reels.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-white/40 text-sm gap-2 px-6 text-center">
          <Film size={36} />
          No reels yet. Be the first to share one.
        </div>
      ) : (
        <div className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
          {reels.map((r) => (
            <ReelCard key={r.id} reel={r} currentUser={currentUser} users={users} onToggleLike={onToggleLike} onOpenComments={onOpenComments} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Search screen ---------------- */

function SearchScreen({ users, currentUser, onOpenProfile }) {
  const [q, setQ] = useState("");
  const list = Object.values(users)
    .filter((u) => u.username !== currentUser.username)
    .filter((u) => u.username.includes(q.toLowerCase()) || u.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="max-w-[470px] mx-auto text-white px-3 pt-3">
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 mb-4">
        <SearchIcon size={18} className="text-white/40" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="flex-1 bg-transparent text-sm outline-none placeholder-white/30" />
      </div>
      {list.length === 0 && <p className="text-white/30 text-sm text-center py-10">No people found.</p>}
      <div className="space-y-1">
        {list.map((u) => (
          <button key={u.username} onClick={() => onOpenProfile(u.username)} className="w-full flex items-center gap-3 py-2.5">
            <img src={u.avatar} alt="" className="w-11 h-11 rounded-full object-cover" />
            <div className="text-left">
              <div className="text-sm font-semibold">{u.username}</div>
              <div className="text-xs text-white/40">{u.name}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Profile screen ---------------- */

function FollowListModal({ title, usernames, users, onClose, onOpenProfile }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center animate-backdrop">
      <div className="animate-sheet bg-neutral-950 text-white w-full sm:max-w-md sm:rounded-xl max-h-[75vh] flex flex-col overflow-hidden border border-white/10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="font-semibold text-sm">{title}</span>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {usernames.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-10">No one here yet.</p>
          ) : (
            usernames.map((u) => {
              const profile = users[u];
              if (!profile) return null;
              return (
                <button
                  key={u}
                  onClick={() => {
                    onClose();
                    onOpenProfile(u);
                  }}
                  className="w-full flex items-center gap-3 py-2.5"
                >
                  <img src={profile.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  <div className="text-left">
                    <div className="text-sm font-semibold">{profile.username}</div>
                    <div className="text-xs text-white/40">{profile.name}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileScreen({ username, currentUser, users, posts, follows, onFollowToggle, onLogout, onEditProfile, onOpenPost, onMessage, onOpenProfile }) {
  const [listModal, setListModal] = useState(null); // "followers" | "following" | null
  const user = users[username];
  if (!user) return null;
  const isMe = username === currentUser.username;
  const myPosts = (posts || []).filter((p) => p.username === username);

  const followerUsernames = follows.filter((f) => f.following_username === username).map((f) => f.follower_username);
  const followingUsernames = follows.filter((f) => f.follower_username === username).map((f) => f.following_username);
  const isFollowing = follows.some((f) => f.follower_username === currentUser.username && f.following_username === username);

  return (
    <div className="max-w-[470px] mx-auto text-white px-4 pt-5">
      <div className="flex items-center justify-between mb-5">
        <span className="text-lg font-semibold">{user.username}</span>
        {isMe && (
          <button onClick={onLogout} className="text-white/60"><LogOut size={20} /></button>
        )}
      </div>
      <div className="flex items-center gap-6 mb-4">
        <img src={user.avatar} alt="" className="w-20 h-20 rounded-full object-cover ring-2 ring-white/10" />
        <div className="flex-1 grid grid-cols-3 text-center">
          <div><div className="font-semibold">{myPosts.length}</div><div className="text-xs text-white/40">Posts</div></div>
          <button onClick={() => setListModal("followers")} className="text-center">
            <div className="font-semibold">{followerUsernames.length}</div><div className="text-xs text-white/40">Followers</div>
          </button>
          <button onClick={() => setListModal("following")} className="text-center">
            <div className="font-semibold">{followingUsernames.length}</div><div className="text-xs text-white/40">Following</div>
          </button>
        </div>
      </div>
      <div className="mb-4">
        <div className="text-sm font-semibold">{user.name}</div>
        {user.bio && <div className="text-sm text-white/60">{user.bio}</div>}
      </div>

      {isMe ? (
        <button onClick={onEditProfile} className="w-full border border-white/15 rounded-lg py-2 text-sm font-semibold mb-6">
          Edit profile
        </button>
      ) : (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => onFollowToggle(username)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold ${isFollowing ? "border border-white/15" : "bg-gradient-to-r from-violet-500 to-fuchsia-500"}`}
          >
            {isFollowing ? "Following" : "Follow"}
          </button>
          <button onClick={() => onMessage(username)} className="flex-1 border border-white/15 rounded-lg py-2 text-sm font-semibold">
            Message
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-white/10 pt-3 mb-1 text-white/60 text-xs font-semibold">
        <Grid3x3 size={16} /> POSTS
      </div>
      {myPosts.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-10">No posts yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-0.5">
          {myPosts.map((p) => (
            <button key={p.id} onClick={() => onOpenPost(p)} className="aspect-square overflow-hidden">
              <SmartImage src={p.image} alt="" className="w-full h-full" />
            </button>
          ))}
        </div>
      )}

      {listModal && (
        <FollowListModal
          title={listModal === "followers" ? "Followers" : "Following"}
          usernames={listModal === "followers" ? followerUsernames : followingUsernames}
          users={users}
          onClose={() => setListModal(null)}
          onOpenProfile={onOpenProfile}
        />
      )}
    </div>
  );
}

function EditProfileModal({ currentUser, onClose, onSave }) {
  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState(currentUser.bio || "");
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await fileToCompressedDataURL(file, 500, 0.8);
      setAvatar(dataUrl);
    } catch {
      alert("Couldn't load that image. Try a different photo.");
    }
    setUploading(false);
    e.target.value = "";
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-end sm:items-center justify-center animate-backdrop">
      <div className="animate-sheet bg-neutral-950 text-white w-full sm:max-w-md sm:rounded-xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-sm">Edit profile</span>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="flex flex-col items-center mb-5">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative w-20 h-20 rounded-full mb-2 group" aria-label="Change profile picture">
            <img src={avatar} alt="" className="w-20 h-20 rounded-full object-cover" />
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity">
              {uploading ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
            </div>
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="text-violet-400 text-sm font-semibold flex items-center gap-1.5">
            {uploading ? (<><Loader2 size={14} className="animate-spin" /> Uploading...</>) : (<><ImagePlus size={14} /> Choose from gallery</>)}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="hidden" />
        </div>

        <label className="text-xs text-white/40">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm mb-3 outline-none" />
        <label className="text-xs text-white/40">Bio</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm mb-4 outline-none resize-none" />
        <button
          onClick={() => onSave({ name: name.trim() || currentUser.username, bio: bio.trim(), avatar })}
          className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-lg py-2.5 text-sm font-semibold"
        >
          Save
        </button>
      </div>
    </div>
  );
}

/* ---------------- DMs ---------------- */

function DMListScreen({ currentUser, users, partners, onOpenChat, onNewMessage }) {
  const [showNew, setShowNew] = useState(false);
  return (
    <div className="max-w-[470px] mx-auto text-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="font-semibold">{currentUser.username}</span>
        <button onClick={() => setShowNew(true)} aria-label="New message"><PlusSquare size={22} /></button>
      </div>
      {partners.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-14 px-6">No messages yet. Tap + to start a conversation.</p>
      ) : (
        <div className="px-2">
          {partners.map((p) => {
            const u = users[p];
            if (!u) return null;
            return (
              <button key={p} onClick={() => onOpenChat(p)} className="w-full flex items-center gap-3 px-2 py-2.5">
                <img src={u.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                <div className="text-left">
                  <div className="text-sm font-semibold">{u.username}</div>
                  <div className="text-xs text-white/40">{u.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {showNew && (
        <NewMessageModal
          currentUser={currentUser}
          users={users}
          onClose={() => setShowNew(false)}
          onPick={(u) => {
            setShowNew(false);
            onNewMessage(u);
          }}
        />
      )}
    </div>
  );
}

function NewMessageModal({ currentUser, users, onClose, onPick }) {
  const [q, setQ] = useState("");
  const list = Object.values(users).filter((u) => u.username !== currentUser.username && u.username.includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-end sm:items-center justify-center animate-backdrop">
      <div className="animate-sheet bg-neutral-950 text-white w-full sm:max-w-md sm:rounded-xl max-h-[80vh] flex flex-col border border-white/10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="font-semibold text-sm">New message</span>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none placeholder-white/30" />
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          {list.map((u) => (
            <button key={u.username} onClick={() => onPick(u.username)} className="w-full flex items-center gap-3 py-2.5">
              <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
              <span className="text-sm font-semibold">{u.username}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatScreen({ currentUser, otherUsername, users, onBack }) {
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);
  const other = users[otherUsername];
  const cid = convId(currentUser.username, otherUsername);

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", cid)
      .order("created_at", { ascending: true });
    if (!error) setMessages(data);
  }, [cid]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !other) return;
    setText("");
    const { data: sessionData } = await supabase.auth.getSession();
    const myId = sessionData.session.user.id;
    const { error } = await supabase.from("messages").insert({
      conversation_id: cid,
      sender_id: myId,
      sender_username: currentUser.username,
      receiver_id: other.user_id,
      receiver_username: other.username,
      text: t,
    });
    if (error) console.error("send message failed", error);
    fetchMessages();
  };

  if (!other) return null;

  return (
    <div className="max-w-[470px] mx-auto text-white flex flex-col h-[calc(100vh-56px)] lg:h-[calc(100vh-24px)]">
      <div className="flex items-center gap-3 px-3 py-3 border-b border-white/10">
        <button onClick={onBack}><ArrowLeft size={20} /></button>
        <img src={other.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
        <span className="text-sm font-semibold">{other.username}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages === null ? (
          <div className="flex justify-center pt-10"><Loader2 className="animate-spin text-white/40" /></div>
        ) : messages.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-10">Say hi to {other.username} 👋</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_username === currentUser.username ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${m.sender_username === currentUser.username ? "bg-gradient-to-r from-violet-500 to-fuchsia-500" : "bg-white/10"}`}>
                {m.text}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5" onKeyDown={(e) => { if (e.key === "Enter") send(e); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message..." className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm outline-none placeholder-white/30" />
        <button type="button" onClick={send} disabled={!text.trim()} className="text-violet-400 disabled:text-white/20">
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Nav ---------------- */

function BottomNav({ tab, setTab }) {
  const items = [
    { key: "home", icon: Home },
    { key: "search", icon: SearchIcon },
    { key: "create", icon: PlusSquare },
    { key: "reels", icon: Film },
    { key: "profile", icon: User },
  ];
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-neutral-950 border-t border-white/10 flex justify-around py-2.5 z-30">
      {items.map(({ key, icon: Icon }) => (
        <button key={key} onClick={() => setTab(key)} className={tab === key ? "text-white" : "text-white/40"}>
          <Icon size={25} />
        </button>
      ))}
    </nav>
  );
}

function SideNav({ tab, setTab, onLogout }) {
  const items = [
    { key: "home", icon: Home, label: "Home" },
    { key: "search", icon: SearchIcon, label: "Search" },
    { key: "reels", icon: Film, label: "Reels" },
    { key: "create", icon: PlusSquare, label: "Create" },
    { key: "dms", icon: Send, label: "Messages" },
    { key: "profile", icon: User, label: "Profile" },
  ];
  return (
    <nav className="hidden lg:flex flex-col gap-1 w-60 shrink-0 py-6 px-3 text-white">
      <div className="px-3 pb-6 text-2xl font-black bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">Zgram</div>
      {items.map(({ icon: Icon, label, key }) => (
        <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-white/5 text-left ${tab === key ? "font-bold" : "text-white/70"}`}>
          <Icon size={24} />
          <span className="text-[15px]">{label}</span>
        </button>
      ))}
      <button onClick={onLogout} className="flex items-center gap-4 px-3 py-2.5 mt-auto text-white/50 hover:bg-white/5 rounded-lg">
        <LogOut size={22} /> <span className="text-[15px]">Log out</span>
      </button>
    </nav>
  );
}

/* ---------------- Main App ---------------- */

export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState({});
  const [posts, setPosts] = useState(null);
  const [reels, setReels] = useState(null);
  const [tab, setTab] = useState("home");
  const [commentsFor, setCommentsFor] = useState(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateReel, setShowCreateReel] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [viewProfile, setViewProfile] = useState(null);
  const [chatWith, setChatWith] = useState(null);
  const [dmPartners, setDmPartners] = useState([]);
  const [follows, setFollows] = useState([]);

  const loadProfile = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", session.user.id).single();
    setCurrentUser(profile || null);
    setLoading(false);
  }, []);

  const loadAllUsers = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*");
    const map = {};
    (data || []).forEach((u) => { map[u.username] = u; });
    setUsers(map);
  }, []);

  const loadPosts = useCallback(async () => {
    const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
    setPosts(data || []);
  }, []);

  const loadReels = useCallback(async () => {
    const { data } = await supabase.from("reels").select("*").order("created_at", { ascending: false });
    setReels(data || []);
  }, []);

  const loadDmPartners = useCallback(async (myUsername) => {
    const { data } = await supabase
      .from("messages")
      .select("sender_username, receiver_username")
      .or(`sender_username.eq.${myUsername},receiver_username.eq.${myUsername}`);
    const set = new Set();
    (data || []).forEach((m) => {
      set.add(m.sender_username === myUsername ? m.receiver_username : m.sender_username);
    });
    setDmPartners(Array.from(set));
  }, []);

  const loadFollows = useCallback(async () => {
    const { data } = await supabase.from("follows").select("follower_username, following_username");
    setFollows(data || []);
  }, []);

  useEffect(() => {
    loadProfile();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadProfile());
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  useEffect(() => {
    if (!currentUser) return;
    loadAllUsers();
    loadPosts();
    loadReels();
    loadDmPartners(currentUser.username);
    loadFollows();
    const interval = setInterval(() => {
      loadPosts();
      loadReels();
      loadDmPartners(currentUser.username);
      loadFollows();
    }, 6000);
    return () => clearInterval(interval);
  }, [currentUser, loadAllUsers, loadPosts, loadReels, loadDmPartners, loadFollows]);

  const handleAuthed = () => {
    setLoading(true);
    loadProfile();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setTab("home");
  };

  const toggleLikePost = async (id) => {
    const post = (posts || []).find((p) => p.id === id);
    if (!post) return;
    const has = post.likes.includes(currentUser.username);
    const nextLikes = has ? post.likes.filter((u) => u !== currentUser.username) : [...post.likes, currentUser.username];
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, likes: nextLikes } : p)));
    await supabase.from("posts").update({ likes: nextLikes }).eq("id", id);
  };

  const toggleSavePost = async (id) => {
    const post = (posts || []).find((p) => p.id === id);
    if (!post) return;
    const savedBy = post.saved_by || [];
    const has = savedBy.includes(currentUser.username);
    const next = has ? savedBy.filter((u) => u !== currentUser.username) : [...savedBy, currentUser.username];
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, saved_by: next } : p)));
    await supabase.from("posts").update({ saved_by: next }).eq("id", id);
  };

  const addCommentToPost = async (id, text) => {
    const post = (posts || []).find((p) => p.id === id);
    if (!post) return;
    const nextComments = [...post.comments, { user: currentUser.username, text }];
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, comments: nextComments } : p)));
    setCommentsFor((c) => (c ? { ...c, item: { ...c.item, comments: nextComments } } : c));
    await supabase.from("posts").update({ comments: nextComments }).eq("id", id);
  };

  const toggleLikeReel = async (id) => {
    const reel = (reels || []).find((r) => r.id === id);
    if (!reel) return;
    const has = reel.likes.includes(currentUser.username);
    const nextLikes = has ? reel.likes.filter((u) => u !== currentUser.username) : [...reel.likes, currentUser.username];
    setReels((prev) => prev.map((r) => (r.id === id ? { ...r, likes: nextLikes } : r)));
    await supabase.from("reels").update({ likes: nextLikes }).eq("id", id);
  };

  const addCommentToReel = async (id, text) => {
    const reel = (reels || []).find((r) => r.id === id);
    if (!reel) return;
    const nextComments = [...reel.comments, { user: currentUser.username, text }];
    setReels((prev) => prev.map((r) => (r.id === id ? { ...r, comments: nextComments } : r)));
    setCommentsFor((c) => (c ? { ...c, item: { ...c.item, comments: nextComments } } : c));
    await supabase.from("reels").update({ comments: nextComments }).eq("id", id);
  };

  const createPost = async ({ image, caption }) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const { error } = await supabase.from("posts").insert({
      user_id: sessionData.session.user.id,
      username: currentUser.username,
      image,
      caption,
    });
    if (error) {
      alert("Couldn't post: " + error.message);
      return;
    }
    setShowCreatePost(false);
    setTab("home");
    loadPosts();
  };

  const createReel = async ({ video, caption }) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const { error } = await supabase.from("reels").insert({
      user_id: sessionData.session.user.id,
      username: currentUser.username,
      video,
      caption,
    });
    if (error) {
      alert("Couldn't post reel: " + error.message);
      return;
    }
    setShowCreateReel(false);
    loadReels();
  };

  const toggleFollow = async (targetUsername) => {
    const target = users[targetUsername];
    const me = currentUser;
    if (!target) return;
    const isFollowing = follows.some((f) => f.follower_username === me.username && f.following_username === targetUsername);

    if (isFollowing) {
      setFollows((prev) => prev.filter((f) => !(f.follower_username === me.username && f.following_username === targetUsername)));
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", me.user_id)
        .eq("following_id", target.user_id);
      if (error) console.error("unfollow failed", error);
    } else {
      setFollows((prev) => [...prev, { follower_username: me.username, following_username: targetUsername }]);
      const { error } = await supabase.from("follows").insert({
        follower_id: me.user_id,
        follower_username: me.username,
        following_id: target.user_id,
        following_username: targetUsername,
      });
      if (error) console.error("follow failed", error);
    }
    loadFollows();
  };

  const saveProfileEdits = async ({ name, bio, avatar }) => {
    const next = { ...currentUser, name, bio, avatar };
    setCurrentUser(next);
    setUsers((prev) => ({ ...prev, [currentUser.username]: next }));
    await supabase.from("profiles").update({ name, bio, avatar }).eq("user_id", currentUser.user_id);
    setShowEditProfile(false);
  };

  const openPost = (post) => setCommentsFor({ type: "post", item: post });
  const openReelComments = (reel) => setCommentsFor({ type: "reel", item: reel });
  const openProfile = (username) => { setViewProfile(username); setTab("viewProfile"); };
  const openChat = (username) => setChatWith(username);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-4">
        <span className="text-3xl font-black bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent animate-pulse">
          Zgram
        </span>
        <Loader2 className="animate-spin text-white/30" size={22} />
      </div>
    );
  }

  if (!currentUser) return <AuthScreen onAuthed={handleAuthed} />;

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans pb-14 lg:pb-0">
      <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-white/10 bg-neutral-950 sticky top-0 z-20">
        <span className="text-xl font-black bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">Zgram</span>
        <button onClick={() => setTab("dms")} aria-label="Messages"><Send size={22} /></button>
      </header>

      <div className="flex max-w-[935px] mx-auto">
        <SideNav tab={tab} setTab={setTab} onLogout={handleLogout} />

        <main className="flex-1 min-w-0 pt-0 lg:pt-6 px-0 sm:px-4">
          {tab === "home" && (
            posts === null ? (
              <FeedSkeleton />
            ) : (
              <FadeIn tKey="home-feed">
                <div className="pt-4">
                  {posts.length === 0 ? (
                    <p className="text-center text-white/30 text-sm py-16 px-6">
                      No posts yet. Tap <PlusSquare className="inline" size={14} /> to share your first one.
                    </p>
                  ) : (
                    posts.map((post) => (
                      <PostCard key={post.id} post={post} currentUser={currentUser} users={users} onToggleLike={toggleLikePost} onToggleSave={toggleSavePost} onOpenComments={openPost} onOpenProfile={openProfile} />
                    ))
                  )}
                  <p className="text-center text-xs text-white/20 pb-10">You're all caught up</p>
                </div>
              </FadeIn>
            )
          )}

          {tab === "search" && <FadeIn tKey="search"><SearchScreen users={users} currentUser={currentUser} onOpenProfile={openProfile} /></FadeIn>}

          {tab === "reels" && (
            <FadeIn tKey="reels">
              <ReelsScreen reels={reels} currentUser={currentUser} users={users} onToggleLike={toggleLikeReel} onOpenComments={openReelComments} onCreate={() => setShowCreateReel(true)} />
            </FadeIn>
          )}

          {tab === "create" && (
            <FadeIn tKey="create">
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-white/60 px-6 text-center">
                <PlusSquare size={40} />
                <p className="text-sm">What would you like to share?</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowCreatePost(true)} className="bg-white/10 rounded-lg px-4 py-2 text-sm font-semibold">Photo post</button>
                  <button onClick={() => setShowCreateReel(true)} className="bg-white/10 rounded-lg px-4 py-2 text-sm font-semibold">Reel</button>
                </div>
              </div>
            </FadeIn>
          )}

          {tab === "dms" && !chatWith && (
            <FadeIn tKey="dms-list">
              <DMListScreen currentUser={currentUser} users={users} partners={dmPartners} onOpenChat={openChat} onNewMessage={openChat} />
            </FadeIn>
          )}
          {tab === "dms" && chatWith && (
            <FadeIn tKey={"chat-" + chatWith}>
              <ChatScreen currentUser={currentUser} otherUsername={chatWith} users={users} onBack={() => setChatWith(null)} />
            </FadeIn>
          )}

          {tab === "profile" && (
            <FadeIn tKey="my-profile">
              <ProfileScreen username={currentUser.username} currentUser={currentUser} users={users} posts={posts} follows={follows} onFollowToggle={toggleFollow} onLogout={handleLogout} onEditProfile={() => setShowEditProfile(true)} onOpenPost={openPost} onMessage={openChat} onOpenProfile={openProfile} />
            </FadeIn>
          )}

          {tab === "viewProfile" && viewProfile && (
            <FadeIn tKey={"profile-" + viewProfile}>
              <ProfileScreen username={viewProfile} currentUser={currentUser} users={users} posts={posts} follows={follows} onFollowToggle={toggleFollow} onLogout={handleLogout} onEditProfile={() => setShowEditProfile(true)} onOpenPost={openPost} onMessage={(u) => { setTab("dms"); openChat(u); }} onOpenProfile={openProfile} />
            </FadeIn>
          )}
        </main>
      </div>

      <BottomNav tab={tab === "viewProfile" ? "profile" : tab} setTab={(t) => { setTab(t); setChatWith(null); }} />

      {commentsFor && (
        <CommentsModal
          item={commentsFor.item}
          currentUser={currentUser}
          users={users}
          onClose={() => setCommentsFor(null)}
          onAddComment={commentsFor.type === "post" ? addCommentToPost : addCommentToReel}
        />
      )}

      {showCreatePost && <CreatePostModal currentUser={currentUser} onClose={() => setShowCreatePost(false)} onCreate={createPost} />}
      {showCreateReel && <CreateReelModal onClose={() => setShowCreateReel(false)} onCreate={createReel} />}
      {showEditProfile && <EditProfileModal currentUser={currentUser} onClose={() => setShowEditProfile(false)} onSave={saveProfileEdits} />}
    </div>
  );
}
