"use client";

import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import {
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { supabase } from "@/lib/supabase";
import styles from "./page.module.css";

type NoteItem = {
  id: string;
  text: string;
  createdAt: string;
};

type PetStatusValue = "0" | "1" | "2" | "3" | "pet";

type PetState = {
  status: PetStatusValue;
  nutrition: number;
};

type NotesState = {
  hasHydrated: boolean;
  notes: NoteItem[];
};

type NotesAction =
  | { type: "hydrate"; notes: NoteItem[] }
  | { type: "add"; note: NoteItem }
  | { type: "reset" };

type CardLayout = {
  art: string;
  rotate: string;
  left: string;
  top: string;
  width: string;
  padding: string;
};

type UiDockSlot = {
  id: string;
  label: string;
  icon: string | null;
  action: "settings" | "note" | "calendar" | "pending" | "empty";
};

type PetStageId = "stage0" | "stage1" | "stage2" | "stage3" | "pet";
type PetAnimation = "idle" | "note" | "petreact" | "eat";
type AuthStatus = "setup-required" | "idle" | "sending-link" | "syncing-space" | "ready" | "error";
type NotesStatus = "idle" | "loading" | "saving" | "ready" | "error";

const petStageOptions: Array<{ id: PetStageId; label: string }> = [
  { id: "stage0", label: "0" },
  { id: "stage1", label: "1" },
  { id: "stage2", label: "2" },
  { id: "stage3", label: "3" },
  { id: "pet", label: "Pet" },
];

const petFrames = Array.from({ length: 60 }, (_, index) => {
  const frameNumber = String(index + 1).padStart(4, "0");
  return `/art/pets/idle/frame_${frameNumber}.webp`;
});

const petNoteFrames = [
  ...Array.from({ length: 30 }, (_, index) => index + 15),
  ...Array.from({ length: 16 }, (_, index) => index + 46),
].map((frameNumber) => `/art/pets/note/frame_${String(frameNumber).padStart(4, "0")}.webp`);

const petReactFrames = Array.from({ length: 32 }, (_, index) => {
  const frameNumber = String(index + 1).padStart(4, "0");
  return `/art/pets/petreact/frame_${frameNumber}.webp`;
});

const petEatFrames = Array.from({ length: 50 }, (_, index) => {
  const frameNumber = String(index + 1).padStart(4, "0");
  return `/art/pets/eat/frame_${frameNumber}.webp`;
});

const stage3PetReactFrames = Array.from({ length: 60 }, (_, index) => {
  const frameNumber = String(index + 1).padStart(4, "0");
  return `/art/pets/stage3-petreact/frame_${frameNumber}.webp`;
});

const petStageFrames: Record<PetStageId, string[]> = {
  stage0: ["/art/pets/stage0/stage0.webp"],
  stage1: Array.from({ length: 28 }, (_, index) => {
    const frameNumber = String(index + 1).padStart(4, "0");
    return `/art/pets/stage1/frame_${frameNumber}.webp`;
  }),
  stage2: Array.from({ length: 32 }, (_, index) => {
    const frameNumber = String(index + 1).padStart(4, "0");
    return `/art/pets/stage2/frame_${frameNumber}.webp`;
  }),
  stage3: Array.from({ length: 52 }, (_, index) => {
    const frameNumber = String(index + 1).padStart(4, "0");
    return `/art/pets/stage3/frame_${frameNumber}.webp`;
  }),
  pet: petFrames,
};

const cardLayouts: CardLayout[] = [
  {
    art: "/art/ui/note%20card1.webp",
    rotate: "-4deg",
    left: "13%",
    top: "-13%",
    width: "38%",
    padding: "34% 16% 28% 13%",
  },
  {
    art: "/art/ui/note%20card2.webp",
    rotate: "3deg",
    left: "54%",
    top: "5%",
    width: "33%",
    padding: "29% 18% 26% 16%",
  },
  {
    art: "/art/ui/note%20card3.webp",
    rotate: "-3deg",
    left: "10%",
    top: "28%",
    width: "34%",
    padding: "27% 18% 24% 15%",
  },
  {
    art: "/art/ui/note%20card4.webp",
    rotate: "4deg",
    left: "49%",
    top: "32%",
    width: "37%",
    padding: "31% 14% 28% 13%",
  },
];

const topUiSlots: UiDockSlot[] = [
  { id: "empty-left-1", label: "Empty slot", icon: null, action: "empty" },
  { id: "empty-left-2", label: "Empty slot", icon: null, action: "empty" },
  { id: "note", label: "Notes", icon: "/art/ui/Note.webp", action: "note" },
  { id: "calender", label: "Calendar", icon: "/art/ui/Calender.webp", action: "calendar" },
  { id: "backpack", label: "Backpack", icon: "/art/ui/Backpack.webp", action: "pending" },
  { id: "setting", label: "Settings", icon: "/art/ui/Setting.webp", action: "settings" },
];

function notesReducer(state: NotesState, action: NotesAction): NotesState {
  switch (action.type) {
    case "hydrate":
      return {
        hasHydrated: true,
        notes: action.notes,
      };
    case "add":
      return {
        ...state,
        notes: [action.note, ...state.notes],
      };
    case "reset":
      return {
        hasHydrated: false,
        notes: [],
      };
    default:
      return state;
  }
}

export default function Home() {
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedPetStage, setSelectedPetStage] = useState<PetStageId>("stage0");
  const [isFoodDragging, setIsFoodDragging] = useState(false);
  const [foodOffset, setFoodOffset] = useState({ x: 0, y: 0 });
  const [draft, setDraft] = useState("");
  const [email, setEmail] = useState("");
  const [currentFrame, setCurrentFrame] = useState(0);
  const [petAnimation, setPetAnimation] = useState<PetAnimation>("idle");
  const [petState, setPetState] = useState<PetState>({
    status: "0",
    nutrition: 0,
  });
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    supabase ? "idle" : "setup-required",
  );
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [notesStatus, setNotesStatus] = useState<NotesStatus>("idle");
  const [notesMessage, setNotesMessage] = useState<string | null>(null);
  const [notesState, dispatch] = useReducer(notesReducer, {
    hasHydrated: false,
    notes: [],
  });

  const noteButtonRef = useRef<HTMLButtonElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const authMenuRef = useRef<HTMLDivElement>(null);
  const foodButtonRef = useRef<HTMLButtonElement>(null);
  const petButtonRef = useRef<HTMLButtonElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hadNoteOpenRef = useRef(false);
  const pendingNoteReactionRef = useRef(false);
  const foodDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const resetWindowViewport = () => {
    window.setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 60);
  };

  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;

    const updateViewportMetrics = () => {
      const viewportHeight = Math.round(viewport?.height ?? window.innerHeight);
      const keyboardInset = Math.max(
        0,
        Math.round(window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0)),
      );

      root.style.setProperty("--app-height", `${viewportHeight}px`);
      root.style.setProperty("--keyboard-inset", `${keyboardInset}px`);

      if (keyboardInset === 0 && document.activeElement !== noteInputRef.current) {
        resetWindowViewport();
      }
    };

    updateViewportMetrics();
    window.addEventListener("resize", updateViewportMetrics);
    viewport?.addEventListener("resize", updateViewportMetrics);
    viewport?.addEventListener("scroll", updateViewportMetrics);

    return () => {
      window.removeEventListener("resize", updateViewportMetrics);
      viewport?.removeEventListener("resize", updateViewportMetrics);
      viewport?.removeEventListener("scroll", updateViewportMetrics);
      root.style.removeProperty("--app-height");
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    const hydrateAuth = async (user: User | null) => {
      if (!isMounted) {
        return;
      }

      setCurrentUser(user);

      if (!user) {
        setActiveSpaceId(null);
        dispatch({ type: "reset" });
        setNotesStatus("idle");
        setNotesMessage(null);
        setAuthStatus("idle");
        setAuthMessage(null);
        return;
      }

      setAuthStatus("syncing-space");

      const result = await ensureDefaultSpaceMembership(user.id);
      if (!isMounted) {
        return;
      }

      if (result.error) {
        setActiveSpaceId(null);
        setAuthStatus("error");
        setAuthMessage(result.error);
        return;
      }

      setActiveSpaceId(result.spaceId);
      setAuthStatus("ready");
      setAuthMessage(`Signed in to ${result.spaceName}.`);
    };

    void supabase.auth.getUser().then(({ data, error }) => {
      if (error) {
        if (!isMounted) {
          return;
        }

        setAuthStatus("error");
        setAuthMessage(error.message);
        return;
      }

      void hydrateAuth(data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateAuth(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let statusTimeout: number | null = null;

    if (!supabase) {
      dispatch({ type: "reset" });
      statusTimeout = window.setTimeout(() => {
        setNotesStatus("error");
        setNotesMessage("Supabase is not configured.");
      }, 0);
      return () => {
        if (statusTimeout !== null) {
          window.clearTimeout(statusTimeout);
        }
      };
    }

    if (!activeSpaceId) {
      dispatch({ type: "reset" });
      statusTimeout = window.setTimeout(() => {
        setNotesStatus(currentUser ? "loading" : "idle");
        setNotesMessage(currentUser ? "Preparing your shared notes." : "Sign in to see shared notes.");
      }, 0);
      return () => {
        if (statusTimeout !== null) {
          window.clearTimeout(statusTimeout);
        }
      };
    }

    let isMounted = true;
    const supabaseClient = supabase;

    const loadNotes = async () => {
      setNotesStatus("loading");
      setNotesMessage(null);

      const result = await fetchNotesForSpace(activeSpaceId);
      if (!isMounted) {
        return;
      }

      if (result.error) {
        dispatch({ type: "hydrate", notes: [] });
        setNotesStatus("error");
        setNotesMessage(result.error);
        return;
      }

      dispatch({ type: "hydrate", notes: result.notes });
      setNotesStatus("ready");
      setNotesMessage(null);
    };

    void loadNotes();

    const channel = supabaseClient
      .channel(`notes:${activeSpaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notes",
          filter: `space_id=eq.${activeSpaceId}`,
        },
        () => {
          void loadNotes();
        },
      )
      .subscribe();

    return () => {
      if (statusTimeout !== null) {
        window.clearTimeout(statusTimeout);
      }
      isMounted = false;
      void supabaseClient.removeChannel(channel);
    };
  }, [activeSpaceId, currentUser]);

  useEffect(() => {
    if (!supabase) {
      setPetState({ status: "0", nutrition: 0 });
      setSelectedPetStage("stage0");
      return;
    }

    if (!activeSpaceId) {
      setPetState({ status: "0", nutrition: 0 });
      setSelectedPetStage("stage0");
      return;
    }

    let isMounted = true;

    const loadPetState = async () => {
      const result = await ensurePetStateForSpace(activeSpaceId);
      if (!isMounted || result.error || !result.petState) {
        return;
      }

      setPetState(result.petState);
      setSelectedPetStage(getStageFromStatus(result.petState.status));
      setPetAnimation("idle");
      setCurrentFrame(0);
    };

    void loadPetState();

    return () => {
      isMounted = false;
    };
  }, [activeSpaceId]);

  useEffect(() => {
    const framesToPreload = new Set([
      ...petFrames,
      ...petNoteFrames,
      ...petReactFrames,
      ...petEatFrames,
      ...(selectedPetStage === "stage3" ? stage3PetReactFrames : []),
      ...petStageFrames[selectedPetStage],
    ]);

    framesToPreload.forEach((src) => {
      const image = new window.Image();
      image.decoding = "async";
      image.src = src;
    });
  }, [selectedPetStage]);

  useLayoutEffect(() => {
    const isPreviewStage = selectedPetStage !== "pet";
    const shouldPlayOnce =
      petAnimation !== "idle" && (!isPreviewStage || selectedPetStage === "stage3");
    const activeFrames =
      !isPreviewStage
        ? petAnimation === "note"
          ? petNoteFrames
          : petAnimation === "eat"
            ? petEatFrames
          : petAnimation === "petreact"
            ? petReactFrames
            : petFrames
        : selectedPetStage === "stage3" && petAnimation === "petreact"
          ? stage3PetReactFrames
        : petStageFrames[selectedPetStage];
    const frameDuration = isPreviewStage ? 70 : 100;
    let lastFrameTime = performance.now();

    const tick = (timestamp: number) => {
      if (timestamp - lastFrameTime >= frameDuration) {
        lastFrameTime = timestamp;

        setCurrentFrame((frame) => {
          if (shouldPlayOnce && frame >= activeFrames.length - 1) {
            window.setTimeout(() => {
              setPetAnimation("idle");
              setCurrentFrame(0);
            }, 0);
            return frame;
          }

          return (frame + 1) % activeFrames.length;
        });
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [petAnimation, selectedPetStage]);

  const handlePetTap = () => {
    if (selectedPetStage !== "pet" && selectedPetStage !== "stage3") {
      return;
    }

    setCurrentFrame(0);
    setPetAnimation("petreact");
  };

  const triggerPetEat = () => {
    if (selectedPetStage !== "pet") {
      return;
    }

    setCurrentFrame(0);
    setPetAnimation("eat");
  };

  useEffect(() => {
    if (!isAuthMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!authMenuRef.current?.contains(event.target as Node)) {
        setIsAuthMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAuthMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAuthMenuOpen]);

  useEffect(() => {
    if (isNoteOpen) {
      const focusTimeout = window.setTimeout(() => {
        noteInputRef.current?.focus({ preventScroll: true });
      }, 120);

      return () => window.clearTimeout(focusTimeout);
    }

    if (document.activeElement === noteInputRef.current) {
      noteInputRef.current?.blur();
    }
    resetWindowViewport();

    return undefined;
  }, [isNoteOpen]);

  useEffect(() => {
    let reactionTimeout: number | null = null;

    if (hadNoteOpenRef.current && !isNoteOpen) {
      noteButtonRef.current?.focus();

      if (pendingNoteReactionRef.current) {
        pendingNoteReactionRef.current = false;
        reactionTimeout = window.setTimeout(() => {
          if (selectedPetStage === "pet") {
            setPetAnimation("note");
            setCurrentFrame(0);
          }
        }, 0);
      }
    }

    hadNoteOpenRef.current = isNoteOpen;

    return () => {
      if (reactionTimeout !== null) {
        window.clearTimeout(reactionTimeout);
      }
    };
  }, [isNoteOpen, selectedPetStage]);

  useEffect(() => {
    if (!isNoteOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNoteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isNoteOpen]);

  useEffect(() => {
    if (!isCalendarOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCalendarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCalendarOpen]);

  const previewNotes = useMemo(() => notesState.notes.slice(0, 4), [notesState.notes]);
  const isSaveDisabled =
    draft.trim().length === 0 ||
    !currentUser ||
    !activeSpaceId ||
    notesStatus === "saving" ||
    notesStatus === "loading";

  const handleEmailSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      setAuthStatus("setup-required");
      setAuthMessage("Add your Supabase URL and anon key to connect sign-in.");
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setAuthStatus("error");
      setAuthMessage("Enter an email address first.");
      return;
    }

    setAuthStatus("sending-link");
    setAuthMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setAuthStatus("error");
      setAuthMessage(error.message);
      return;
    }

    setAuthStatus("idle");
    setAuthMessage("Check your email for the magic link, then come back here.");
  };

  const handleSignOut = async () => {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthStatus("error");
      setAuthMessage(error.message);
      return;
    }

    setActiveSpaceId(null);
    setCurrentUser(null);
    dispatch({ type: "reset" });
    setNotesStatus("idle");
    setNotesMessage(null);
    setAuthStatus("idle");
    setAuthMessage(null);
    setIsAuthMenuOpen(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = draft.trim();
    if (!trimmed || !supabase || !currentUser || !activeSpaceId) {
      if (!currentUser || !activeSpaceId) {
        setNotesStatus("error");
        setNotesMessage("Sign in first to post a note to the shared space.");
      }
      return;
    }

    setNotesStatus("saving");
    setNotesMessage(null);

    const optimisticNote = {
      id: crypto.randomUUID(),
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "add", note: optimisticNote });

    const { error } = await supabase.from("notes").insert({
      space_id: activeSpaceId,
      author_user_id: currentUser.id,
      content: trimmed,
    });

    if (error) {
      const result = await fetchNotesForSpace(activeSpaceId);
      dispatch({ type: "hydrate", notes: result.notes ?? [] });
      setNotesStatus("error");
      setNotesMessage(error.message);
      return;
    }

    setNotesStatus("ready");
    pendingNoteReactionRef.current = true;
    setDraft("");
    setIsNoteOpen(true);
  };

  const handleFoodPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    setIsFoodDragging(true);
    foodDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: foodOffset.x,
      originY: foodOffset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleFoodPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = foodDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    setFoodOffset({
      x: dragState.originX + (event.clientX - dragState.startX),
      y: dragState.originY + (event.clientY - dragState.startY),
    });
  };

  const finishFoodDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const foodRect = foodButtonRef.current?.getBoundingClientRect();
    const petRect = petButtonRef.current?.getBoundingClientRect();
    const isDroppedOnPet =
      selectedPetStage === "pet" &&
      foodRect &&
      petRect &&
      rectanglesOverlap(foodRect, petRect);

    if (foodDragRef.current?.pointerId === event.pointerId) {
      foodDragRef.current = null;
    }

    setIsFoodDragging(false);
    setFoodOffset({ x: 0, y: 0 });

    if (isDroppedOnPet) {
      triggerPetEat();
      void feedPet();
    }

    if (foodButtonRef.current?.hasPointerCapture(event.pointerId)) {
      foodButtonRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const activePetFrames =
    selectedPetStage === "pet"
      ? petAnimation === "note"
        ? petNoteFrames
        : petAnimation === "eat"
          ? petEatFrames
        : petAnimation === "petreact"
          ? petReactFrames
          : petFrames
      : selectedPetStage === "stage3" && petAnimation === "petreact"
        ? stage3PetReactFrames
      : petStageFrames[selectedPetStage];

  const feedPet = async () => {
    if (!supabase || !activeSpaceId) {
      return;
    }

    const nextNutrition = petState.nutrition + 1;
    const nextStatus = getStatusFromNutrition(nextNutrition);
    const { error } = await supabase
      .from("pet_state")
      .update({
        Nutrition: nextNutrition,
        Status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("space_id", activeSpaceId);

    if (error) {
      return;
    }

    setPetState({
      nutrition: nextNutrition,
      status: nextStatus,
    });
    setSelectedPetStage(getStageFromStatus(nextStatus));
  };

  return (
    <main className={styles.page}>
      <section className={styles.phoneShell}>
        <div className={styles.scene}>
          <Image
            src="/art/backgrounds/background.png"
            alt="Warm cottage background for the pet room."
            fill
            priority
            unoptimized
            className={styles.background}
            sizes="(max-width: 768px) 100vw, 520px"
          />

          <section className={styles.topDock} aria-label="Top user interface">
            {topUiSlots.map((slot) => (
              <div key={slot.id} className={styles.topDockSlot}>
                <Image
                  src="/art/ui/UI%20frame.webp"
                  alt=""
                  fill
                  unoptimized
                  className={styles.uiFrameArt}
                />

                {slot.action === "settings" ? (
                  <div ref={authMenuRef} className={styles.authMenuWrap}>
                    <button
                      type="button"
                      className={styles.frameAction}
                      onClick={() => setIsAuthMenuOpen((open) => !open)}
                      aria-expanded={isAuthMenuOpen}
                      aria-haspopup="menu"
                      aria-controls="auth-menu"
                      aria-label="Open settings"
                    >
                      <Image
                        src={slot.icon ?? "/art/ui/Setting.webp"}
                        alt=""
                        width={46}
                        height={46}
                        unoptimized
                        className={styles.frameIcon}
                      />
                    </button>

                    {isAuthMenuOpen ? (
                      <section id="auth-menu" className={styles.authPanel} aria-label="Settings panel">
                        <p className={styles.authEyebrow}>Shared space</p>
                        {currentUser ? (
                          <>
                            <p className={styles.authTitle}>{currentUser.email}</p>
                            <p className={styles.authMeta}>
                              {activeSpaceId
                                ? `Connected to space ${shortId(activeSpaceId)}`
                                : "Syncing space..."}
                            </p>
                            <button
                              type="button"
                              className={styles.authButton}
                              onClick={handleSignOut}
                            >
                              Sign out
                            </button>
                          </>
                        ) : (
                          <form className={styles.authForm} onSubmit={handleEmailSignIn}>
                            <label className={styles.authLabel} htmlFor="email-input">
                              Enter your email to join the default space.
                            </label>
                            <input
                              id="email-input"
                              type="email"
                              value={email}
                              onChange={(event) => setEmail(event.target.value)}
                              className={styles.authInput}
                              placeholder="you@example.com"
                              autoComplete="email"
                            />
                            <button
                              type="submit"
                              className={styles.authButton}
                              disabled={
                                authStatus === "sending-link" || authStatus === "syncing-space"
                              }
                            >
                              {authStatus === "sending-link" ? "Sending..." : "Email me a link"}
                            </button>
                          </form>
                        )}

                        {authMessage ? (
                          <p
                            className={`${styles.authMessage} ${
                              authStatus === "error" ? styles.authMessageError : ""
                            }`}
                          >
                            {authMessage}
                          </p>
                        ) : null}

                        {authStatus === "setup-required" ? (
                          <p className={`${styles.authMessage} ${styles.authMessageError}`}>
                            Supabase is not configured yet. Add `NEXT_PUBLIC_SUPABASE_URL` and
                            `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
                          </p>
                        ) : null}

                        <div className={styles.settingsDivider} />

                        <div className={styles.stagePanel}>
                          <p className={styles.authEyebrow}>Pet stage</p>
                          <section className={styles.stageToggle} aria-label="Pet stage selector">
                            {petStageOptions.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className={`${styles.stageButton} ${
                                  selectedPetStage === option.id ? styles.stageButtonActive : ""
                                }`}
                                onClick={() => {
                                  setSelectedPetStage(option.id);
                                  setPetAnimation("idle");
                                  setCurrentFrame(0);
                                }}
                                aria-pressed={selectedPetStage === option.id}
                              >
                                {option.label}
                              </button>
                            ))}
                          </section>
                          <p className={styles.authMeta}>
                            Status {petState.status} · Nutrition {petState.nutrition}
                          </p>
                        </div>
                      </section>
                    ) : null}
                  </div>
                ) : slot.action === "note" ? (
                  <button
                    ref={noteButtonRef}
                    type="button"
                    className={styles.frameAction}
                    onClick={() => setIsNoteOpen((open) => !open)}
                    aria-expanded={isNoteOpen}
                    aria-controls="notes-panel"
                    aria-label={isNoteOpen ? "Close notes" : "Open notes"}
                  >
                    <Image
                      src={slot.icon ?? "/art/ui/Note.webp"}
                      alt=""
                      width={46}
                      height={46}
                      unoptimized
                      className={styles.frameIcon}
                    />
                  </button>
                ) : slot.action === "calendar" ? (
                  <button
                    type="button"
                    className={styles.frameAction}
                    onClick={() => {
                      setIsCalendarOpen((open) => !open);
                      setIsNoteOpen(false);
                      setIsAuthMenuOpen(false);
                    }}
                    aria-expanded={isCalendarOpen}
                    aria-controls="calendar-panel"
                    aria-label={isCalendarOpen ? "Close calendar" : "Open calendar"}
                  >
                    <Image
                      src={slot.icon ?? "/art/ui/Calender.webp"}
                      alt=""
                      width={46}
                      height={46}
                      unoptimized
                      className={styles.frameIcon}
                    />
                  </button>
                ) : slot.action === "pending" ? (
                  <button
                    type="button"
                    className={`${styles.frameAction} ${styles.frameActionPending}`}
                    aria-label={`${slot.label} coming soon`}
                    title={`${slot.label} is not built yet`}
                  >
                    <Image
                      src={slot.icon ?? "/art/ui/Note.webp"}
                      alt=""
                      width={46}
                      height={46}
                      unoptimized
                      className={styles.frameIcon}
                    />
                  </button>
                ) : (
                  <div className={styles.framePlaceholder} aria-hidden="true" />
                )}
              </div>
            ))}
          </section>

          <aside className={styles.bottomRightFrames} aria-hidden="true">
            <div className={styles.largeFrame}>
              <Image
                src="/art/ui/UI%20frame.webp"
                alt=""
                fill
                unoptimized
                className={styles.uiFrameArt}
              />
            </div>
            <div className={styles.largeFrame}>
              <Image
                src="/art/ui/UI%20frame.webp"
                alt=""
                fill
                unoptimized
                className={styles.uiFrameArt}
              />
            </div>
          </aside>

          <button
            ref={foodButtonRef}
            type="button"
            className={styles.foodButton}
            data-dragging={isFoodDragging ? "true" : "false"}
            onPointerDown={handleFoodPointerDown}
            onPointerMove={handleFoodPointerMove}
            onPointerUp={finishFoodDrag}
            onPointerCancel={finishFoodDrag}
            style={
              {
                "--food-x": `${foodOffset.x}px`,
                "--food-y": `${foodOffset.y}px`,
              } as CSSProperties
            }
            aria-label="Drag food"
          >
            <Image
              src="/art/ui/Food.webp"
              alt=""
              fill
              unoptimized
              className={styles.foodIcon}
            />
          </button>

          <div
            className={`${styles.petStage} ${
              selectedPetStage !== "pet" ? styles.petStagePreview : ""
            }`}
          >
            <div className={styles.petGlow} />
            <button
              ref={petButtonRef}
              type="button"
              className={`${styles.petButton} ${
                selectedPetStage !== "pet" ? styles.petButtonStagePreview : ""
              }`}
              onClick={handlePetTap}
              aria-label="Pet Mooshroom"
            >
              <img
                src={activePetFrames[currentFrame]}
                alt="Mooshroom pet character."
                className={styles.pet}
                width={220}
                height={220}
                loading="eager"
                fetchPriority="high"
                decoding="sync"
                draggable={false}
              />
            </button>
          </div>

          <section
            id="calendar-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Calendar"
            aria-hidden={!isCalendarOpen}
            className={`${styles.calendarPanel} ${isCalendarOpen ? styles.calendarPanelOpen : ""}`}
          >
            <MonthCalendar
              year={calendarViewDate.getFullYear()}
              month={calendarViewDate.getMonth() + 1}
              onClose={() => setIsCalendarOpen(false)}
              onPreviousMonth={() => setCalendarViewDate((current) => shiftMonth(current, -1))}
              onNextMonth={() => setCalendarViewDate((current) => shiftMonth(current, 1))}
            />
          </section>

          <section
            id="notes-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Notes"
            aria-hidden={!isNoteOpen}
              className={`${styles.notesPanel} ${isNoteOpen ? styles.notesPanelOpen : ""}`}
          >
            <Image
              src="/art/ui/note%20panel.webp"
              alt=""
              fill
              priority={isNoteOpen}
              unoptimized
              className={styles.notesPanelBase}
            />

            <div className={styles.notesPanelInner}>
              <header className={styles.panelHeader}>
                <button
                  type="button"
                  className={styles.panelClose}
                  onClick={() => setIsNoteOpen(false)}
                  aria-label="Close notes"
                >
                  <span aria-hidden="true">x</span>
                </button>
              </header>

              <div className={styles.noteBoard}>
                {notesStatus === "loading" && !notesState.hasHydrated ? (
                  <div className={styles.emptyBoard}>
                    <p>Loading shared notes...</p>
                    <span>Notes from everyone in this space will appear here.</span>
                  </div>
                ) : notesState.hasHydrated && previewNotes.length === 0 ? (
                  <div className={styles.emptyBoard}>
                    <p>No notes yet.</p>
                    <span>The first note in this space will show up here.</span>
                  </div>
                ) : (
                  previewNotes.map((note, index) => (
                    <article
                      key={note.id}
                      className={styles.boardCard}
                      style={getCardStyle(cardLayouts[index] ?? cardLayouts[0])}
                    >
                      <Image
                        src={(cardLayouts[index] ?? cardLayouts[0]).art}
                        alt=""
                        fill
                        unoptimized
                        className={styles.boardCardArt}
                      />
                      <div className={styles.boardCardContent}>
                        <p className={styles.boardCardText}>{note.text}</p>
                        <time className={styles.boardCardDate} dateTime={note.createdAt}>
                          {formatShortDate(note.createdAt)}
                        </time>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <form className={styles.noteComposer} onSubmit={handleSubmit}>
                <div className={styles.composerSurface}>
                  <textarea
                    ref={noteInputRef}
                    id="note-input"
                    className={styles.noteInput}
                    rows={5}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={resetWindowViewport}
                    placeholder="Write a little note..."
                  />
                  <button type="submit" className={styles.saveButton} disabled={isSaveDisabled}>
                    {notesStatus === "saving" ? "Saving..." : "Save"}
                  </button>
                </div>
                {notesMessage ? (
                  <p
                    className={`${styles.noteStatus} ${
                      notesStatus === "error" ? styles.noteStatusError : ""
                    }`}
                  >
                    {notesMessage}
                  </p>
                ) : null}
              </form>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function getCardStyle(layout: CardLayout): CSSProperties {
  return {
    "--card-rotate": layout.rotate,
    "--card-left": layout.left,
    "--card-top": layout.top,
    "--card-width": layout.width,
    "--card-padding": layout.padding,
  } as CSSProperties;
}

async function ensureDefaultSpaceMembership(userId: string) {
  if (!supabase) {
    return { error: "Supabase is not configured.", spaceId: null, spaceName: null };
  }

  const { data: spaces, error: spaceError } = await supabase
    .from("spaces")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(1);

  if (spaceError) {
    return { error: spaceError.message, spaceId: null, spaceName: null };
  }

  const defaultSpace = spaces?.[0];
  if (!defaultSpace) {
    return { error: "No default space exists in Supabase yet.", spaceId: null, spaceName: null };
  }

  const { data: existingMembership, error: membershipLookupError } = await supabase
    .from("space_members")
    .select("id")
    .eq("space_id", defaultSpace.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipLookupError) {
    return { error: membershipLookupError.message, spaceId: null, spaceName: null };
  }

  if (!existingMembership) {
    const { error: insertError } = await supabase.from("space_members").insert({
      space_id: defaultSpace.id,
      user_id: userId,
      role: "member",
    });

    if (insertError) {
      return { error: insertError.message, spaceId: null, spaceName: null };
    }
  }

  return { error: null, spaceId: defaultSpace.id, spaceName: defaultSpace.name };
}

async function fetchNotesForSpace(spaceId: string) {
  if (!supabase) {
    return { error: "Supabase is not configured.", notes: [] as NoteItem[] };
  }

  const { data, error } = await supabase
    .from("notes")
    .select("id, content, created_at")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return { error: error.message, notes: [] as NoteItem[] };
  }

  return {
    error: null,
    notes: (data ?? []).map((item) => ({
      id: item.id,
      text: item.content,
      createdAt: item.created_at,
    })),
  };
}

async function ensurePetStateForSpace(spaceId: string) {
  if (!supabase) {
    return { error: "Supabase is not configured.", petState: null as PetState | null };
  }

  const { data: existingPetState, error: lookupError } = await supabase
    .from("pet_state")
    .select('space_id, "Status", "Nutrition"')
    .eq("space_id", spaceId)
    .maybeSingle();

  if (lookupError) {
    return { error: lookupError.message, petState: null as PetState | null };
  }

  if (!existingPetState) {
    const initialPetState = { status: "0" as PetStatusValue, nutrition: 0 };
    const { error: insertError } = await supabase.from("pet_state").insert({
      space_id: spaceId,
      Status: initialPetState.status,
      Nutrition: initialPetState.nutrition,
    });

    if (insertError) {
      return { error: insertError.message, petState: null as PetState | null };
    }

    return { error: null, petState: initialPetState };
  }

  const nutrition = Number(existingPetState.Nutrition ?? 0);
  const derivedStatus = getStatusFromNutrition(nutrition);

  if (existingPetState.Status !== derivedStatus) {
    const { error: updateError } = await supabase
      .from("pet_state")
      .update({
        Status: derivedStatus,
        Nutrition: nutrition,
        updated_at: new Date().toISOString(),
      })
      .eq("space_id", spaceId);

    if (updateError) {
      return { error: updateError.message, petState: null as PetState | null };
    }
  }

  return {
    error: null,
    petState: {
      status: derivedStatus,
      nutrition,
    },
  };
}

function getStatusFromNutrition(nutrition: number): PetStatusValue {
  if (nutrition > 15) {
    return "pet";
  }

  if (nutrition > 10) {
    return "3";
  }

  if (nutrition > 5) {
    return "1";
  }

  return "0";
}

function getStageFromStatus(status: PetStatusValue): PetStageId {
  switch (status) {
    case "1":
      return "stage1";
    case "2":
      return "stage2";
    case "3":
      return "stage3";
    case "pet":
      return "pet";
    default:
      return "stage0";
  }
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function formatShortDate(date: string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function shiftMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function rectanglesOverlap(a: DOMRect, b: DOMRect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
