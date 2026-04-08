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
import { NotePanel } from "@/components/note-panel";
import { supabase } from "@/lib/supabase";
import styles from "./page.module.css";

type NoteItem = {
  id: string;
  text: string;
  createdAt: string;
};

type SpaceInventoryItem = {
  id: string;
  quantity: number;
  itemId: string;
  name: string;
  type: string;
  rarity: string;
  description: string;
  imageUrl: string;
};

type PetStatusValue = "0" | "1" | "2" | "3" | "pet";
type EventType = "娱乐" | "办事" | "吃饭" | "随记";

type PetState = {
  status: PetStatusValue;
  nutrition: number;
  xp: number;
};

type PetAction = "visit" | "note" | "calendar" | "feed" | "water";
type PetActionResult = { error: string | null; petState: PetState | null };
type DigRewardResult = { error: string | null; item: SpaceInventoryItem | null };
type SpaceMembershipResult = { error: string | null; spaceId: string | null; spaceName: string | null };
type UserActivityType =
  | "app_open"
  | "visit"
  | "join_space"
  | "note_created"
  | "calendar_updated"
  | "feed"
  | "water"
  | "dig";

type NotesState = {
  hasHydrated: boolean;
  notes: NoteItem[];
};

type CalendarEventItem = {
  id: string;
  text: string;
  eventType: EventType;
  date: string;
  createdAt: string;
};

const EVENT_TYPE_STAMP_ART: Record<EventType, string> = {
  娱乐: "/art/ui/calendar-stamps/entertainment.webp",
  办事: "/art/ui/calendar-stamps/event.webp",
  吃饭: "/art/ui/calendar-stamps/dinner.webp",
  随记: "/art/ui/calendar-stamps/record.webp",
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
  lineClamp: number;
};

type UiDockSlot = {
  id: string;
  label: string;
  icon: string | null;
  action: "settings" | "note" | "calendar" | "backpack" | "pending" | "empty";
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type PetStageId = "stage0" | "stage1" | "stage2" | "stage3" | "pet";
type PetAnimation = "idle" | "note" | "petreact" | "eat" | "water" | "dig";
type AuthStatus = "setup-required" | "idle" | "sending-link" | "syncing-space" | "ready" | "error";
type NotesStatus = "idle" | "loading" | "saving" | "ready" | "error";
type CalendarEventsStatus = "idle" | "loading" | "saving" | "ready" | "error";
type InventoryStatus = "idle" | "loading" | "ready" | "error";

const EVENT_TYPES: EventType[] = ["娱乐", "办事", "吃饭", "随记"];

const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const APP_OPEN_ACTIVITY_PREFIX = "user-activity:app-open";
let hasLogUserActivityRpc: boolean | null = null;
let hasAwardRandomSpaceItemRpc: boolean | null = null;
let hasApplyPetActionRpc: boolean | null = null;

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

const petWaterFrames = Array.from({ length: 51 }, (_, index) => {
  const frameNumber = String(index + 1).padStart(4, "0");
  return `/art/pets/water/frame_${frameNumber}.webp`;
});

const waterEffectFrames = Array.from({ length: 60 }, (_, index) => {
  const frameNumber = String(index + 1).padStart(4, "0");
  return `/art/effects/water-effect/frame_${frameNumber}.webp`;
});

const petDigFrames = Array.from({ length: 60 }, (_, index) => {
  const frameNumber = String(index + 1).padStart(4, "0");
  return `/art/pets/dig/frame_${frameNumber}.webp`;
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

function getActivePetFrames(
  selectedPetStage: PetStageId,
  petAnimation: PetAnimation,
) {
  if (selectedPetStage === "pet") {
    switch (petAnimation) {
      case "note":
        return petNoteFrames;
      case "eat":
        return petEatFrames;
      case "petreact":
        return petReactFrames;
      case "water":
        return petWaterFrames;
      case "dig":
        return petDigFrames;
      default:
        return petFrames;
    }
  }

  if (selectedPetStage === "stage3" && petAnimation === "petreact") {
    return stage3PetReactFrames;
  }

  return petStageFrames[selectedPetStage];
}

const cardLayouts: CardLayout[] = [
  {
    art: "/art/ui/note%20card1.webp",
    rotate: "-6deg",
    left: "8%",
    top: "1%",
    width: "42%",
    padding: "27% 15% 26% 13%",
    lineClamp: 3,
  },
  {
    art: "/art/ui/note%20card2.webp",
    rotate: "5deg",
    left: "59%",
    top: "0%",
    width: "39%",
    padding: "25% 17% 25% 15%",
    lineClamp: 3,
  },
  {
    art: "/art/ui/note%20card3.webp",
    rotate: "4deg",
    left: "13%",
    top: "45%",
    width: "42%",
    padding: "30% 17% 19% 14%",
    lineClamp: 2,
  },
  {
    art: "/art/ui/note%20card4.webp",
    rotate: "-5deg",
    left: "50%",
    top: "39%",
    width: "41%",
    padding: "32% 14% 20% 13%",
    lineClamp: 2,
  },
];

const topUiSlots: UiDockSlot[] = [
  { id: "note", label: "Notes", icon: "/art/ui/Note.webp", action: "note" },
  { id: "calender", label: "Calendar", icon: "/art/ui/Calender.webp", action: "calendar" },
  { id: "backpack", label: "Backpack", icon: "/art/ui/Backpack.webp", action: "backpack" },
  { id: "setting", label: "Settings", icon: "/art/ui/Setting.webp", action: "settings" },
];

const LOADING_FRAME_ICONS = [
  "/art/ui/Food.webp",
  "/art/ui/Kettle.webp",
  "/art/ui/Backpack.webp",
  "/art/ui/shovel.webp",
  "/art/ui/Note.webp",
  "/art/ui/Calender.webp",
  "/art/ui/Setting.webp",
] as const;

const BASE_SCENE_ASSET_URLS = Array.from(
  new Set([
    "/art/backgrounds/background.png",
    "/art/ui/UI%20frame.webp",
    "/art/ui/Note.webp",
    "/art/ui/Calender.webp",
    "/art/ui/Backpack.webp",
    "/art/ui/Setting.webp",
    "/art/ui/Kettle.webp",
    "/art/ui/Food.webp",
    "/art/ui/note%20panel.webp",
    ...cardLayouts.map((layout) => layout.art),
    ...Object.values(EVENT_TYPE_STAMP_ART),
  ]),
);

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
  const [isInitialSceneReady, setIsInitialSceneReady] = useState(false);
  const [preloadedAssetCount, setPreloadedAssetCount] = useState(0);
  const [displayedPreloadPercent, setDisplayedPreloadPercent] = useState(0);
  const [hasResolvedAuthSession, setHasResolvedAuthSession] = useState(!supabase);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isBackpackOpen, setIsBackpackOpen] = useState(false);
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false);
  const [isNoteEditing, setIsNoteEditing] = useState(false);
  const [isCalendarEditing, setIsCalendarEditing] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedPetStage, setSelectedPetStage] = useState<PetStageId>("stage0");
  const [isFoodDragging, setIsFoodDragging] = useState(false);
  const [isKettleDragging, setIsKettleDragging] = useState(false);
  const [foodOffset, setFoodOffset] = useState({ x: 0, y: 0 });
  const [kettleOffset, setKettleOffset] = useState({ x: 0, y: 0 });
  const [draft, setDraft] = useState("");
  const [calendarEventDraft, setCalendarEventDraft] = useState("");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => getTodayDateValue());
  const [selectedEventType, setSelectedEventType] = useState<EventType>("娱乐");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [currentFrame, setCurrentFrame] = useState(0);
  const [currentWaterEffectFrame, setCurrentWaterEffectFrame] = useState(0);
  const [petAnimation, setPetAnimation] = useState<PetAnimation>("idle");
  const [isWaterEffectPlaying, setIsWaterEffectPlaying] = useState(false);
  const loadedSceneAssetsRef = useRef<Set<string>>(new Set());
  const [petState, setPetState] = useState<PetState>({
    status: "0",
    nutrition: 0,
    xp: 0,
  });
  const [hasResolvedPetStage, setHasResolvedPetStage] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    supabase ? "idle" : "setup-required",
  );
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [currentSpaceName, setCurrentSpaceName] = useState<string | null>(null);
  const [notesStatus, setNotesStatus] = useState<NotesStatus>("idle");
  const [calendarEventsStatus, setCalendarEventsStatus] = useState<CalendarEventsStatus>("idle");
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [hasHydratedCalendarEvents, setHasHydratedCalendarEvents] = useState(false);
  const [inventoryStatus, setInventoryStatus] = useState<InventoryStatus>("idle");
  const [inventoryItems, setInventoryItems] = useState<SpaceInventoryItem[]>([]);
  const [digRewardItem, setDigRewardItem] = useState<SpaceInventoryItem | null>(null);
  const [isDiggingForReward, setIsDiggingForReward] = useState(false);
  const [notesState, dispatch] = useReducer(notesReducer, {
    hasHydrated: false,
    notes: [],
  });

  const noteButtonRef = useRef<HTMLButtonElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const calendarEventInputRef = useRef<HTMLTextAreaElement>(null);
  const authMenuRef = useRef<HTMLDivElement>(null);
  const foodButtonRef = useRef<HTMLButtonElement>(null);
  const kettleButtonRef = useRef<HTMLButtonElement>(null);

  const openNotesPanel = () => {
    setIsNoteOpen(true);
    setIsCalendarOpen(false);
    setIsBackpackOpen(false);
    setIsAuthMenuOpen(false);
  };

  const closeNotesPanel = () => {
    setIsNoteOpen(false);
  };

  const openCalendarPanel = () => {
    const today = new Date();
    setCalendarViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedCalendarDate(getTodayDateValue());
    setIsCalendarOpen(true);
    setIsNoteOpen(false);
    setIsBackpackOpen(false);
    setIsAuthMenuOpen(false);
  };

  const openBackpackPanel = () => {
    setIsBackpackOpen(true);
    setIsCalendarOpen(false);
    setIsNoteOpen(false);
    setIsAuthMenuOpen(false);
  };
  const petButtonRef = useRef<HTMLButtonElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const waterEffectFrameRef = useRef<number | null>(null);
  const hadNoteOpenRef = useRef(false);
  const pendingNoteReactionRef = useRef(false);
  const foodDragRef = useRef<DragState | null>(null);
  const kettleDragRef = useRef<DragState | null>(null);
  const digRewardTimeoutRef = useRef<number | null>(null);

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

      if (
        keyboardInset === 0 &&
        document.activeElement !== noteInputRef.current &&
        document.activeElement !== calendarEventInputRef.current
      ) {
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
    return () => {
      if (digRewardTimeoutRef.current !== null) {
        window.clearTimeout(digRewardTimeoutRef.current);
      }
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
        setCurrentSpaceName(null);
        dispatch({ type: "reset" });
        setNotesStatus("idle");
        setCalendarEvents([]);
        setHasHydratedCalendarEvents(false);
        setCalendarEventsStatus("idle");
        setInventoryItems([]);
        setInventoryStatus("idle");
        setDigRewardItem(null);
        setIsDiggingForReward(false);
        setAuthStatus("idle");
        setAuthMessage(null);
        setHasResolvedAuthSession(true);
        return;
      }

      setAuthStatus("syncing-space");

      const result = await ensureInitialSpaceMembership(user.id);
      if (!isMounted) {
        return;
      }

      if (result.error) {
        setActiveSpaceId(null);
        setCurrentSpaceName(null);
        setAuthStatus("error");
        setAuthMessage(result.error);
        setHasResolvedAuthSession(true);
        return;
      }

      setActiveSpaceId(result.spaceId);
      setCurrentSpaceName(result.spaceName);
      setAuthStatus("ready");
      setAuthMessage(
        result.spaceName ? `Space: ${result.spaceName}.` : "Enter an invite code to join a shared space.",
      );
      setHasResolvedAuthSession(true);
      void logAppOpenActivity(user.id, result.spaceId);
    };

    void supabase.auth.getUser().then(({ data, error }) => {
      if (error) {
        if (!isMounted) {
          return;
        }

        setAuthStatus("error");
        setAuthMessage(error.message);
        setHasResolvedAuthSession(true);
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
      }, 0);
      return () => {
        if (statusTimeout !== null) {
          window.clearTimeout(statusTimeout);
        }
      };
    }

    if (!activeSpaceId) {
      dispatch({ type: "hydrate", notes: [] });
      statusTimeout = window.setTimeout(() => {
        setNotesStatus(currentUser ? "ready" : "idle");
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
      const result = await fetchNotesForSpace(activeSpaceId);
      if (!isMounted) {
        return;
      }

      if (result.error) {
        dispatch({ type: "hydrate", notes: [] });
        setNotesStatus("error");
        return;
      }

      dispatch({ type: "hydrate", notes: result.notes });
      setNotesStatus("ready");
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
    let statusTimeout: number | null = null;

    if (!supabase) {
      statusTimeout = window.setTimeout(() => {
        setCalendarEvents([]);
        setHasHydratedCalendarEvents(false);
        setCalendarEventsStatus("error");
      }, 0);
      return () => {
        if (statusTimeout !== null) {
          window.clearTimeout(statusTimeout);
        }
      };
    }

    if (!activeSpaceId) {
      statusTimeout = window.setTimeout(() => {
        setCalendarEvents([]);
        setHasHydratedCalendarEvents(true);
        setCalendarEventsStatus(currentUser ? "ready" : "idle");
      }, 0);
      return () => {
        if (statusTimeout !== null) {
          window.clearTimeout(statusTimeout);
        }
      };
    }

    let isMounted = true;
    const supabaseClient = supabase;

    const loadCalendarEvents = async () => {
      setCalendarEventsStatus("loading");
      const result = await fetchCalendarEventsForSpace(activeSpaceId);
      if (!isMounted) {
        return;
      }

      if (result.error) {
        setCalendarEvents([]);
        setHasHydratedCalendarEvents(true);
        setCalendarEventsStatus("error");
        return;
      }

      setCalendarEvents(result.events);
      setHasHydratedCalendarEvents(true);
      setCalendarEventsStatus("ready");
    };

    void loadCalendarEvents();

    const channel = supabaseClient
      .channel(`calender:${activeSpaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calender",
          filter: `space_id=eq.${activeSpaceId}`,
        },
        () => {
          void loadCalendarEvents();
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
      const resetTimeout = window.setTimeout(() => {
        setPetState({ status: "0", nutrition: 0, xp: 0 });
        setSelectedPetStage("stage0");
        setHasResolvedPetStage(true);
        setDigRewardItem(null);
        setIsDiggingForReward(false);
      }, 0);
      return () => window.clearTimeout(resetTimeout);
    }

    if (!activeSpaceId) {
      const resetTimeout = window.setTimeout(() => {
        setPetState({ status: "0", nutrition: 0, xp: 0 });
        setSelectedPetStage("stage0");
        setHasResolvedPetStage(true);
        setDigRewardItem(null);
        setIsDiggingForReward(false);
      }, 0);
      return () => window.clearTimeout(resetTimeout);
    }

    let isMounted = true;
    const supabaseClient = supabase;
    setHasResolvedPetStage(false);

    const loadPetState = async () => {
      const result = await ensurePetStateForSpace(activeSpaceId);
      if (!isMounted || result.error || !result.petState) {
        return;
      }

      setPetState(result.petState);
      setSelectedPetStage(getStageFromStatus(result.petState.status));
      setPetAnimation("idle");
      setCurrentFrame(0);
      setHasResolvedPetStage(true);
    };

    void loadPetState();

    const channel = supabaseClient
      .channel(`pet_state:${activeSpaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pet_state",
          filter: `space_id=eq.${activeSpaceId}`,
        },
        () => {
          void loadPetState();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabaseClient.removeChannel(channel);
    };
  }, [activeSpaceId]);

  useEffect(() => {
    if (!activeSpaceId) {
      const resetTimeout = window.setTimeout(() => {
        setInventoryItems([]);
        setInventoryStatus("idle");
      }, 0);
      return () => window.clearTimeout(resetTimeout);
    }

    let isMounted = true;

    const loadInventory = async () => {
      setInventoryStatus("loading");
      const result = await fetchInventoryForSpace(activeSpaceId);
      if (!isMounted) {
        return;
      }

      if (result.error) {
        setInventoryItems([]);
        setInventoryStatus("error");
        return;
      }

      setInventoryItems(result.items);
      setInventoryStatus("ready");
    };

    void loadInventory();

    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

    const supabaseClient = supabase;
    const channel = supabaseClient
      .channel(`space_items:${activeSpaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "space_items",
          filter: `space_id=eq.${activeSpaceId}`,
        },
        () => {
          void loadInventory();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "space_item",
          filter: `space_id=eq.${activeSpaceId}`,
        },
        () => {
          void loadInventory();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabaseClient.removeChannel(channel);
    };
  }, [activeSpaceId]);

  useEffect(() => {
    if (!activeSpaceId || !currentUser) {
      return;
    }

    let isMounted = true;

    const awardVisitXp = async () => {
      const result = await applyPetAction(activeSpaceId, "visit", currentUser.id);
      if (!isMounted || result.error || !result.petState) {
        return;
      }

      setPetState(result.petState);
      setSelectedPetStage(getStageFromStatus(result.petState.status));
      void logUserActivity(currentUser.id, "visit", activeSpaceId);
    };

    void awardVisitXp();

    return () => {
      isMounted = false;
    };
  }, [activeSpaceId, currentUser]);

  const sceneAssetUrls = useMemo(() => {
    const stageFramesToPreload =
      activeSpaceId && !hasResolvedPetStage ? [] : getActivePetFrames(selectedPetStage, "idle");

    return Array.from(new Set([...BASE_SCENE_ASSET_URLS, ...stageFramesToPreload]));
  }, [activeSpaceId, hasResolvedPetStage, selectedPetStage]);

  useEffect(() => {
    setIsInitialSceneReady(false);
    setPreloadedAssetCount(0);
    setDisplayedPreloadPercent(0);
  }, [activeSpaceId]);

  useEffect(() => {
    if (activeSpaceId && !hasResolvedPetStage) {
      return;
    }

    let isCancelled = false;
    let loadedCount = sceneAssetUrls.reduce(
      (count, src) => count + (loadedSceneAssetsRef.current.has(src) ? 1 : 0),
      0,
    );

    const updatePreloadProgress = (count: number) => {
      if (!isInitialSceneReady) {
        setPreloadedAssetCount(count);
      }

      setDisplayedPreloadPercent((current) => {
        const nextPercent =
          sceneAssetUrls.length === 0 ? 100 : Math.round((count / sceneAssetUrls.length) * 100);

        return Math.max(current, nextPercent);
      });
    };

    const markAssetComplete = (src: string) => {
      loadedSceneAssetsRef.current.add(src);
      loadedCount += 1;

      if (isCancelled) {
        return;
      }

      updatePreloadProgress(loadedCount);

      if (!isInitialSceneReady && loadedCount >= sceneAssetUrls.length) {
        setIsInitialSceneReady(true);
      }
    };

    updatePreloadProgress(loadedCount);

    if (loadedCount >= sceneAssetUrls.length) {
      if (!isInitialSceneReady) {
        setIsInitialSceneReady(true);
      }
      return;
    }

    sceneAssetUrls.forEach((src) => {
      if (loadedSceneAssetsRef.current.has(src)) {
        return;
      }

      const image = new window.Image();
      let hasSettled = false;

      const settle = () => {
        if (hasSettled) {
          return;
        }

        hasSettled = true;
        image.onload = null;
        image.onerror = null;
        markAssetComplete(src);
      };

      image.decoding = "async";
      image.onload = settle;
      image.onerror = settle;
      image.src = src;

      if (image.complete) {
        settle();
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [activeSpaceId, hasResolvedPetStage, isInitialSceneReady, sceneAssetUrls]);

  useLayoutEffect(() => {
    const isPreviewStage = selectedPetStage !== "pet";
    const shouldPlayOnce =
      petAnimation !== "idle" && (!isPreviewStage || selectedPetStage === "stage3");
    const activeFrames = getActivePetFrames(selectedPetStage, petAnimation);
    const frameDuration = isPreviewStage ? 70 : 100;
    let lastFrameTime = performance.now();

    const tick = (timestamp: number) => {
      if (timestamp - lastFrameTime >= frameDuration) {
        lastFrameTime = timestamp;

        setCurrentFrame((frame) => {
          if (shouldPlayOnce && frame >= activeFrames.length - 1) {
            window.setTimeout(() => {
              if (petAnimation === "dig") {
                setIsDiggingForReward(false);
              }
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

  useLayoutEffect(() => {
    if (!isWaterEffectPlaying) {
      return;
    }

    const frameDuration = 1000 / 12;
    let lastFrameTime = performance.now();

    const tick = (timestamp: number) => {
      if (timestamp - lastFrameTime >= frameDuration) {
        lastFrameTime = timestamp;

        setCurrentWaterEffectFrame((frame) => {
          if (frame >= waterEffectFrames.length - 1) {
            window.setTimeout(() => {
              setIsWaterEffectPlaying(false);
              setCurrentWaterEffectFrame(0);
            }, 0);
            return frame;
          }

          return frame + 1;
        });
      }

      waterEffectFrameRef.current = window.requestAnimationFrame(tick);
    };

    waterEffectFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (waterEffectFrameRef.current !== null) {
        window.cancelAnimationFrame(waterEffectFrameRef.current);
      }
    };
  }, [isWaterEffectPlaying]);

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

  const triggerPetWater = () => {
    if (selectedPetStage !== "pet") {
      return;
    }

    setCurrentFrame(0);
    setPetAnimation("water");
  };

  const triggerWaterEffect = () => {
    setCurrentWaterEffectFrame(0);
    setIsWaterEffectPlaying(true);
  };

  const showDigReward = (item: SpaceInventoryItem) => {
    if (digRewardTimeoutRef.current !== null) {
      window.clearTimeout(digRewardTimeoutRef.current);
    }

    setDigRewardItem(item);
    digRewardTimeoutRef.current = window.setTimeout(() => {
      setDigRewardItem(null);
      digRewardTimeoutRef.current = null;
    }, 2800);
  };

  const handleDigForTreasure = async () => {
    if (!activeSpaceId || !currentUser || selectedPetStage !== "pet" || petState.xp <= 10 || isDiggingForReward) {
      return;
    }

    setIsDiggingForReward(true);
    setCurrentFrame(0);
    setPetAnimation("dig");

    const rewardResult = await awardRandomSpaceItem(activeSpaceId, currentUser.id);
    if (rewardResult.error || !rewardResult.item) {
      setIsDiggingForReward(false);
      return;
    }

    const rewardedItem = rewardResult.item;
    setInventoryItems((currentItems) => mergeInventoryItems(currentItems, rewardedItem));
    setInventoryStatus("ready");
    showDigReward(rewardedItem);
    void logUserActivity(currentUser.id, "dig", activeSpaceId);
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
      return undefined;
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
      if (document.activeElement === calendarEventInputRef.current) {
        calendarEventInputRef.current?.blur();
      }
      setIsCalendarEditing(false);
      resetWindowViewport();
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

  useEffect(() => {
    if (!isBackpackOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsBackpackOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBackpackOpen]);

  useEffect(() => {
    if (!isCalendarOpen) {
      return;
    }

    const focusTimeout = window.setTimeout(() => {
      calendarEventInputRef.current?.focus({ preventScroll: true });
    }, 120);

    return () => window.clearTimeout(focusTimeout);
  }, [isCalendarOpen, selectedCalendarDate]);

  useEffect(() => {
    if (!activeSpaceId) {
      setDraft("");
      setIsNoteEditing(false);
      return;
    }

    const savedDraftSession = readNoteDraftSession(activeSpaceId);
    setDraft(savedDraftSession?.draft ?? "");
    setIsNoteEditing(savedDraftSession?.isEditing ?? false);
  }, [activeSpaceId]);

  useEffect(() => {
    if (!activeSpaceId) {
      return;
    }

    if (!draft && !isNoteEditing) {
      clearNoteDraftSession(activeSpaceId);
      return;
    }

    writeNoteDraftSession(activeSpaceId, {
      draft,
      isEditing: isNoteEditing,
    });
  }, [activeSpaceId, draft, isNoteEditing]);

  const previewNotes = useMemo(() => notesState.notes.slice(0, 4), [notesState.notes]);
  const loadingFrameIcon = useMemo(
    () => LOADING_FRAME_ICONS[Math.floor(Math.random() * LOADING_FRAME_ICONS.length)],
    [],
  );
  const selectedDateEvents = useMemo(
    () => calendarEvents.filter((item) => item.date === selectedCalendarDate),
    [calendarEvents, selectedCalendarDate],
  );
  const selectedDateEventDraft = useMemo(
    () => formatCalendarEditorText(selectedDateEvents),
    [selectedDateEvents],
  );

  useEffect(() => {
    if (previewNotes.length === 0) {
      if (selectedNoteId !== null) {
        setSelectedNoteId(null);
      }
      return;
    }

    if (!previewNotes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(previewNotes[0].id);
    }
  }, [previewNotes, selectedNoteId]);

  useEffect(() => {
    setCalendarEventDraft(selectedDateEventDraft);

    if (selectedDateEvents[0]) {
      setSelectedEventType(selectedDateEvents[0].eventType);
    }
  }, [selectedDateEventDraft, selectedDateEvents]);

  const calendarEventStampByDate = useMemo(() => {
    return calendarEvents.reduce<Record<string, string>>((accumulator, item) => {
      if (!accumulator[item.date]) {
        accumulator[item.date] = EVENT_TYPE_STAMP_ART[item.eventType];
      }
      return accumulator;
    }, {});
  }, [calendarEvents]);
  const normalizedCalendarEventDraft = normalizeCalendarEditorText(calendarEventDraft);
  const normalizedSelectedDateEventDraft = normalizeCalendarEditorText(selectedDateEventDraft);
  const isSaveDisabled =
    draft.trim().length === 0 ||
    !currentUser ||
    !activeSpaceId ||
    notesStatus === "saving" ||
    notesStatus === "loading";
  const isCalendarEventSaveDisabled =
    !currentUser ||
    !activeSpaceId ||
    calendarEventsStatus === "saving" ||
    calendarEventsStatus === "loading" ||
    !selectedCalendarDate ||
    normalizedCalendarEventDraft === normalizedSelectedDateEventDraft;

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

    const authRedirectUrl = getAuthRedirectUrl();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: authRedirectUrl
        ? {
            emailRedirectTo: authRedirectUrl,
          }
        : undefined,
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

    clearPreferredSpaceId();
    setActiveSpaceId(null);
    setCurrentSpaceName(null);
    setCurrentUser(null);
    dispatch({ type: "reset" });
    setNotesStatus("idle");
    setCalendarEvents([]);
    setHasHydratedCalendarEvents(false);
    setCalendarEventsStatus("idle");
    setInventoryItems([]);
    setInventoryStatus("idle");
    setAuthStatus("idle");
    setAuthMessage(null);
    setIsAuthMenuOpen(false);
  };

  const handleJoinSpace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentUser) {
      setAuthStatus("error");
      setAuthMessage("Sign in before entering an invite code.");
      return;
    }

    const trimmedInviteCode = inviteCode.trim();
    if (!trimmedInviteCode) {
      setAuthStatus("error");
      setAuthMessage("Enter an invite code first.");
      return;
    }

    setAuthStatus("syncing-space");
    setAuthMessage(null);

    const result = await ensureSpaceMembershipByInviteCode(currentUser.id, trimmedInviteCode);
    if (result.error) {
      setAuthStatus("error");
      setAuthMessage(result.error);
      return;
    }

    if (result.spaceId) {
      writePreferredSpaceId(currentUser.id, result.spaceId);
      setActiveSpaceId(result.spaceId);
    }

    void logUserActivity(currentUser.id, "join_space", result.spaceId);
    setCurrentSpaceName(result.spaceName);
    setInviteCode("");
    setAuthStatus("ready");
    setAuthMessage(`Space: ${result.spaceName}.`);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isNoteEditing) {
      return;
    }

    const trimmed = draft.trim();
    if (!trimmed || !supabase || !currentUser || !activeSpaceId) {
      return;
    }

    setNotesStatus("saving");

    const optimisticNote = {
      id: crypto.randomUUID(),
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "add", note: optimisticNote });
    setSelectedNoteId(optimisticNote.id);

    const { error } = await supabase.from("notes").insert({
      space_id: activeSpaceId,
      author_user_id: currentUser.id,
      content: trimmed,
    });

    if (error) {
      const result = await fetchNotesForSpace(activeSpaceId);
      dispatch({ type: "hydrate", notes: result.notes ?? [] });
      setNotesStatus("error");
      return;
    }

    const rewardResult = await applyPetAction(activeSpaceId, "note", currentUser.id);
    if (rewardResult.petState) {
      setPetState(rewardResult.petState);
      setSelectedPetStage(getStageFromStatus(rewardResult.petState.status));
    }

    void logUserActivity(currentUser.id, "note_created", activeSpaceId);
    setNotesStatus("ready");
    pendingNoteReactionRef.current = true;
    setDraft("");
    setIsNoteEditing(false);
    openNotesPanel();
  };

  const handleCalendarEventSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase || !currentUser || !activeSpaceId || !selectedCalendarDate) {
      return;
    }

    const parsedEvents = parseCalendarEditorText(calendarEventDraft, selectedEventType).map((item, index) => ({
      id: crypto.randomUUID(),
      text: item.text,
      eventType: item.eventType,
      date: selectedCalendarDate,
      createdAt: new Date(Date.now() + index).toISOString(),
    }));

    setCalendarEventsStatus("saving");

    const previousEvents = calendarEvents;
    setCalendarEvents((current) =>
      sortCalendarEvents([
        ...current.filter((item) => item.date !== selectedCalendarDate),
        ...parsedEvents,
      ]),
    );
    setHasHydratedCalendarEvents(true);

    const { error: deleteError } = await supabase
      .from("calender")
      .delete()
      .eq("space_id", activeSpaceId)
      .eq("Date", selectedCalendarDate);

    if (deleteError) {
      setCalendarEvents(previousEvents);
      const result = await fetchCalendarEventsForSpace(activeSpaceId);
      setCalendarEvents(result.events ?? []);
      setHasHydratedCalendarEvents(true);
      setCalendarEventsStatus("error");
      return;
    }

    if (parsedEvents.length > 0) {
      const { error: insertError } = await supabase.from("calender").insert(
        parsedEvents.map((item) => ({
          space_id: activeSpaceId,
          Event: item.text,
          EventType: item.eventType,
          Date: item.date,
        })),
      );

      if (insertError) {
        const result = await fetchCalendarEventsForSpace(activeSpaceId);
        setCalendarEvents(result.events ?? []);
        setHasHydratedCalendarEvents(true);
        setCalendarEventsStatus("error");
        return;
      }
    }

    const rewardResult =
      parsedEvents.length > 0
        ? await applyPetAction(activeSpaceId, "calendar", currentUser.id)
        : { error: null, petState: null };
    if (rewardResult.petState) {
      setPetState(rewardResult.petState);
      setSelectedPetStage(getStageFromStatus(rewardResult.petState.status));
    }

    if (parsedEvents.length > 0) {
      void logUserActivity(currentUser.id, "calendar_updated", activeSpaceId);
    }
    setCalendarEventsStatus("ready");
    setSelectedEventType("娱乐");
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

  const handleKettlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    setIsKettleDragging(true);
    kettleDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: kettleOffset.x,
      originY: kettleOffset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleKettlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = kettleDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    setKettleOffset({
      x: dragState.originX + (event.clientX - dragState.startX),
      y: dragState.originY + (event.clientY - dragState.startY),
    });
  };

  const finishFoodDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const foodRect = foodButtonRef.current?.getBoundingClientRect();
    const petRect = petButtonRef.current?.getBoundingClientRect();
    const isDroppedOnPet = foodRect && petRect && rectanglesOverlap(foodRect, petRect);

    if (foodDragRef.current?.pointerId === event.pointerId) {
      foodDragRef.current = null;
    }

    setIsFoodDragging(false);
    setFoodOffset({ x: 0, y: 0 });

    if (isDroppedOnPet && selectedPetStage === "pet") {
      triggerPetEat();
      void feedPet();
    }

    if (foodButtonRef.current?.hasPointerCapture(event.pointerId)) {
      foodButtonRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const finishKettleDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const kettleRect = kettleButtonRef.current?.getBoundingClientRect();
    const petRect = petButtonRef.current?.getBoundingClientRect();
    const isDroppedOnPet =
      kettleRect &&
      petRect &&
      rectanglesOverlap(kettleRect, petRect);

    if (kettleDragRef.current?.pointerId === event.pointerId) {
      kettleDragRef.current = null;
    }

    setIsKettleDragging(false);
    setKettleOffset({ x: 0, y: 0 });

    if (kettleButtonRef.current?.hasPointerCapture(event.pointerId)) {
      kettleButtonRef.current.releasePointerCapture(event.pointerId);
    }

    if (isDroppedOnPet) {
      triggerWaterEffect();

      if (selectedPetStage === "pet") {
        triggerPetWater();
        void waterPet();
      }
    }
  };

  const activePetFrames = getActivePetFrames(selectedPetStage, petAnimation);
  const activeWaterEffectFrame = isWaterEffectPlaying
    ? waterEffectFrames[currentWaterEffectFrame] ?? null
    : null;
  const canShowDigPrompt =
    selectedPetStage === "pet" &&
    petState.xp > 10 &&
    Boolean(activeSpaceId) &&
    Boolean(currentUser);
  const preloadPercent = displayedPreloadPercent;
  const shouldShowLoadingScreen =
    !hasResolvedAuthSession ||
    authStatus === "syncing-space" ||
    (activeSpaceId !== null && !hasResolvedPetStage) ||
    !isInitialSceneReady;

  const feedPet = async () => {
    if (!activeSpaceId) {
      return;
    }

    const result = await applyPetAction(activeSpaceId, "feed", currentUser?.id ?? null);
    if (result.error || !result.petState) {
      return;
    }

    setPetState(result.petState);
    setSelectedPetStage(getStageFromStatus(result.petState.status));
    if (currentUser) {
      void logUserActivity(currentUser.id, "feed", activeSpaceId);
    }
  };

  const waterPet = async () => {
    if (!activeSpaceId) {
      return;
    }

    const result = await applyPetAction(activeSpaceId, "water", currentUser?.id ?? null);
    if (result.error || !result.petState) {
      return;
    }

    setPetState(result.petState);
    setSelectedPetStage(getStageFromStatus(result.petState.status));
    if (currentUser) {
      void logUserActivity(currentUser.id, "water", activeSpaceId);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.phoneShell}>
        <div className={styles.scene}>
            {shouldShowLoadingScreen ? (
              <div className={styles.loadingScreen} role="status" aria-live="polite">
                <div className={styles.loadingPanel}>
                  <div className={styles.loadingIconWrap}>
                    <Image
                      src="/art/ui/UI%20frame.webp"
                      alt=""
                      width={116}
                      height={114}
                      unoptimized
                      className={styles.loadingIconFrame}
                    />
                    <img
                      src={loadingFrameIcon}
                      alt=""
                      aria-hidden="true"
                      className={styles.loadingFrameIcon}
                      draggable={false}
                    />
                  </div>
                  <div className={styles.loadingMeter} aria-hidden="true">
                    <span
                      className={styles.loadingMeterFill}
                    style={{ width: `${preloadPercent}%` }}
                  />
                </div>
              </div>
            </div>
          ) : null}

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
                        {currentUser ? (
                          <>
                            <div className={styles.authHeader}>
                              <p className={styles.authEyebrow}>Settings</p>
                              <p className={styles.authTitle}>{currentUser.email}</p>
                            </div>
                            <div className={styles.authSpaceCard}>
                              <p className={styles.authSpaceLabel}>Current space</p>
                              <p className={styles.authSpaceValue}>
                                {authStatus === "syncing-space"
                                  ? "Space: syncing..."
                                  : currentSpaceName
                                    ? `Space: ${currentSpaceName}`
                                    : "No space joined yet"}
                              </p>
                            </div>
                          </>
                        ) : (
                          <form className={styles.authForm} onSubmit={handleEmailSignIn}>
                            <label className={styles.authLabel} htmlFor="email-input">
                              Enter your email to sign in with a magic link.
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

                        {authMessage && (!currentUser || authStatus === "error") ? (
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

                        {currentUser ? (
                          <div className={styles.authSection}>
                            <p className={styles.authSectionTitle}>Join with invite code</p>
                            <form className={styles.authForm} onSubmit={handleJoinSpace}>
                              <label className={styles.authLabel} htmlFor="invite-code-input">
                                Enter an invite code to join a shared space.
                              </label>
                              <input
                                id="invite-code-input"
                                type="text"
                                value={inviteCode}
                                onChange={(event) => setInviteCode(event.target.value)}
                                className={styles.authInput}
                                placeholder="Enter invite code"
                                autoComplete="off"
                                autoCapitalize="off"
                                spellCheck={false}
                              />
                              <button
                                type="submit"
                                className={styles.authButton}
                                disabled={authStatus === "syncing-space"}
                              >
                                {authStatus === "syncing-space" ? "Joining..." : "Join space"}
                              </button>
                            </form>
                            <button
                              type="button"
                              className={styles.authSecondaryButton}
                              onClick={handleSignOut}
                            >
                              Sign out
                            </button>
                          </div>
                        ) : null}
                      </section>
                    ) : null}
                  </div>
                ) : slot.action === "note" ? (
                  <button
                    ref={noteButtonRef}
                      type="button"
                      className={styles.frameAction}
                      onClick={() => {
                        if (isNoteOpen) {
                          closeNotesPanel();
                          return;
                        }
                        openNotesPanel();
                    }}
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
                      if (isCalendarOpen) {
                        setIsCalendarOpen(false);
                        return;
                      }
                      openCalendarPanel();
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
                ) : slot.action === "backpack" ? (
                  <button
                    type="button"
                    className={styles.frameAction}
                    onClick={() => {
                      if (isBackpackOpen) {
                        setIsBackpackOpen(false);
                        return;
                      }
                      openBackpackPanel();
                    }}
                    aria-expanded={isBackpackOpen}
                    aria-controls="backpack-panel"
                    aria-label={isBackpackOpen ? "Close backpack" : "Open backpack"}
                  >
                    <Image
                      src={slot.icon ?? "/art/ui/Backpack.webp"}
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

          <aside className={styles.bottomRightFrames} aria-label="Pet tools">
            <div className={styles.resourceFrame}>
              <Image
                src="/art/ui/UI%20frame.webp"
                alt=""
                fill
                unoptimized
                className={styles.uiFrameArt}
              />
              <button
                ref={kettleButtonRef}
                type="button"
                className={styles.resourceButton}
                data-dragging={isKettleDragging ? "true" : "false"}
                onPointerDown={handleKettlePointerDown}
                onPointerMove={handleKettlePointerMove}
                onPointerUp={finishKettleDrag}
                onPointerCancel={finishKettleDrag}
                style={
                  {
                    "--drag-x": `${kettleOffset.x}px`,
                    "--drag-y": `${kettleOffset.y}px`,
                  } as CSSProperties
                }
                aria-label="Drag kettle"
              >
                <Image
                  src="/art/ui/Kettle.webp"
                  alt=""
                  fill
                  unoptimized
                  className={styles.resourceIcon}
                />
              </button>
            </div>
            {selectedPetStage === "pet" ? (
              <div className={styles.resourceFrame}>
                <Image
                  src="/art/ui/UI%20frame.webp"
                  alt=""
                  fill
                  unoptimized
                  className={styles.uiFrameArt}
                />
                <button
                  ref={foodButtonRef}
                  type="button"
                  className={styles.resourceButton}
                  data-dragging={isFoodDragging ? "true" : "false"}
                  onPointerDown={handleFoodPointerDown}
                  onPointerMove={handleFoodPointerMove}
                  onPointerUp={finishFoodDrag}
                  onPointerCancel={finishFoodDrag}
                  style={
                    {
                      "--drag-x": `${foodOffset.x}px`,
                      "--drag-y": `${foodOffset.y}px`,
                    } as CSSProperties
                  }
                  aria-label="Drag food"
                >
                  <Image
                    src="/art/ui/Food.webp"
                    alt=""
                    fill
                    unoptimized
                    className={styles.resourceIcon}
                  />
                </button>
              </div>
            ) : null}
          </aside>

          <div
            className={`${styles.petStage} ${
              selectedPetStage !== "pet" ? styles.petStagePreview : ""
            }`}
          >
            {canShowDigPrompt ? (
              <button
                type="button"
                className={styles.petThoughtBubble}
                onClick={handleDigForTreasure}
                disabled={isDiggingForReward}
                aria-label={isDiggingForReward ? "Digging for treasure" : "Ask Mooshroom to dig for treasure"}
              >
                <span className={styles.petThoughtBubbleMain}>
                  <Image
                    src="/art/ui/shovel.webp"
                    alt=""
                    width={40}
                    height={40}
                    unoptimized
                    className={styles.petThoughtBubbleIcon}
                  />
                </span>
                <span className={styles.petThoughtBubbleDotLarge} aria-hidden="true" />
                <span className={styles.petThoughtBubbleDotSmall} aria-hidden="true" />
              </button>
            ) : null}

            {digRewardItem ? (
              <div className={styles.digRewardPopup} role="status" aria-live="polite">
                <div className={styles.digRewardInner}>
                  <p className={styles.digRewardEyebrow}>Treasure found</p>
                  <div className={styles.digRewardBody}>
                    <div className={styles.digRewardArtwork}>
                      {digRewardItem.imageUrl ? (
                        <img
                          src={digRewardItem.imageUrl}
                          alt={digRewardItem.name}
                          className={styles.digRewardImage}
                          loading="eager"
                          draggable={false}
                        />
                      ) : (
                        <div className={styles.digRewardFallback} aria-hidden="true">
                          {digRewardItem.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className={styles.digRewardMeta}>
                      <p className={styles.digRewardName}>{digRewardItem.name}</p>
                      <p className={styles.digRewardDetails}>
                        {[digRewardItem.type, digRewardItem.rarity].filter(Boolean).join(" · ")}
                      </p>
                      <p className={styles.digRewardQuantity}>Now in backpack: x{digRewardItem.quantity}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

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
              {activeWaterEffectFrame ? (
                <img
                  src={activeWaterEffectFrame}
                  alt=""
                  aria-hidden="true"
                  className={styles.petWaterEffect}
                  width={220}
                  height={220}
                  loading="eager"
                  fetchPriority="high"
                  decoding="sync"
                  draggable={false}
                />
              ) : null}
            </button>
          </div>

          <section
            id="calendar-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Calendar"
            aria-hidden={!isCalendarOpen}
            className={`${styles.calendarPanel} ${isCalendarOpen ? styles.calendarPanelOpen : ""} ${
              isCalendarEditing ? styles.calendarPanelEditing : ""
            }`}
          >
            <MonthCalendar
              year={calendarViewDate.getFullYear()}
              month={calendarViewDate.getMonth() + 1}
              selectedDate={selectedCalendarDate}
              eventStampByDate={calendarEventStampByDate}
              onSelectDate={(isoDate) => setSelectedCalendarDate(isoDate)}
              onClose={() => setIsCalendarOpen(false)}
              onPreviousMonth={() => setCalendarViewDate((current) => shiftMonth(current, -1))}
                onNextMonth={() => setCalendarViewDate((current) => shiftMonth(current, 1))}
                footerContent={
                  <div className={styles.calendarFooterContent}>
                    <form
                      className={styles.calendarFooterForm}
                      onSubmit={handleCalendarEventSubmit}
                      onClick={(event) => {
                        const target = event.target as HTMLElement;

                        if (!target.closest("button, select, option")) {
                          calendarEventInputRef.current?.focus({ preventScroll: true });
                        }
                      }}
                    >
                      <div className={styles.calendarFooterControls}>
                        <select
                          value={selectedEventType}
                          onChange={(event) => setSelectedEventType(event.target.value as EventType)}
                        className={styles.calendarFooterSelect}
                        aria-label="Event type"
                      >
                        {EVENT_TYPES.map((eventType) => (
                          <option key={eventType} value={eventType}>
                            {eventType}
                          </option>
                        ))}
                      </select>

                      <button
                        type="submit"
                        className={styles.calendarFooterSaveButton}
                        disabled={isCalendarEventSaveDisabled}
                      >
                        {calendarEventsStatus === "saving" ? "Saving..." : "Save"}
                      </button>
                    </div>

                      <textarea
                        ref={calendarEventInputRef}
                        value={calendarEventDraft}
                        onChange={(event) => setCalendarEventDraft(event.target.value)}
                        onFocus={() => setIsCalendarEditing(true)}
                        onBlur={() => {
                          setIsCalendarEditing(false);
                          resetWindowViewport();
                        }}
                        className={styles.calendarFooterTextarea}
                        rows={7}
                        placeholder="One event per line..."
                      />
                    </form>

                </div>
              }
            />
          </section>

          <section
            id="backpack-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Backpack"
            aria-hidden={!isBackpackOpen}
            className={`${styles.backpackPanel} ${isBackpackOpen ? styles.backpackPanelOpen : ""}`}
          >
            <div className={styles.backpackShell}>
              <header className={styles.backpackHeader}>
                <button
                  type="button"
                  className={styles.panelClose}
                  onClick={() => setIsBackpackOpen(false)}
                  aria-label="Close backpack"
                >
                  <span aria-hidden="true">x</span>
                </button>
              </header>

              {inventoryStatus === "loading" ? (
                <div className={styles.backpackEmpty} aria-hidden="true" />
              ) : inventoryItems.length === 0 ? (
                <div className={styles.backpackEmpty} aria-hidden="true" />
              ) : (
                <div className={styles.backpackShelfGrid}>
                  {inventoryItems.map((item) => (
                    <article key={item.id} className={styles.backpackItemCard}>
                      <div className={styles.backpackItemFrame}>
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className={styles.backpackItemImage}
                            loading="lazy"
                            draggable={false}
                          />
                        ) : (
                          <div className={styles.backpackItemFallback} aria-hidden="true">
                            {item.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className={styles.backpackQuantity}>x{item.quantity}</span>
                      </div>
                      <div className={styles.backpackItemMeta}>
                        <p className={styles.backpackItemName}>{item.name}</p>
                        <p className={styles.backpackItemTags}>
                          {[item.type, item.rarity].filter(Boolean).join(" · ")}
                        </p>
                        {item.description ? (
                          <p className={styles.backpackItemDescription}>{item.description}</p>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {inventoryStatus === "error" ? (
                <p className={`${styles.backpackStatus} ${styles.backpackStatusError}`}>
                  Couldn&apos;t load space items from Supabase.
                </p>
              ) : (
                <p className={styles.backpackStatus}>
                  Showing {inventoryItems.length} item{inventoryItems.length === 1 ? "" : "s"} in this space.
                </p>
              )}
            </div>
          </section>

            <NotePanel
              isOpen={isNoteOpen}
            isEditing={isNoteEditing}
            notesStatus={notesStatus}
            hasHydrated={notesState.hasHydrated}
            previewNotes={previewNotes}
            selectedNoteId={selectedNoteId}
            cardLayouts={cardLayouts}
            draft={draft}
            isSaveDisabled={isSaveDisabled}
            noteInputRef={noteInputRef}
              onClose={closeNotesPanel}
              onSelectNote={(noteId) => {
                setSelectedNoteId(noteId);
                setIsNoteEditing(false);
                setDraft("");
              }}
              onStartEditing={() => {
                setIsNoteEditing(true);
                window.setTimeout(() => {
                  noteInputRef.current?.focus({ preventScroll: true });
              }, 0);
            }}
              onSubmit={handleSubmit}
              onDraftChange={setDraft}
              onInputFocus={() => setIsNoteEditing(true)}
              onInputBlur={() => {
                resetWindowViewport();
              }}
              formatShortDate={formatShortDate}
            />
        </div>
      </section>
    </main>
  );
}

async function logUserActivity(userId: string, activityType: UserActivityType, spaceId?: string | null) {
  if (!supabase) {
    return;
  }

  let rpcErrorMessage: string | null = null;

  if (hasLogUserActivityRpc !== false) {
    const rpcResult = await supabase.rpc("log_user_activity", {
      p_activity_type: activityType,
      p_space_id: spaceId ?? null,
      p_user_id: userId,
    });

    if (!rpcResult.error) {
      hasLogUserActivityRpc = true;
      return;
    }

    rpcErrorMessage = rpcResult.error.message;
    if (isMissingRpcError(rpcResult.error.message)) {
      hasLogUserActivityRpc = false;
    }
  }

  const insertResult = await supabase.from("user_activity").insert({
    user_id: userId,
    space_id: spaceId ?? null,
    activity_type: activityType,
  });

  if (insertResult.error) {
    console.error(
      `Could not log user activity (${activityType}).`,
      "RPC error:",
      rpcErrorMessage,
      "Insert error:",
      insertResult.error.message,
      { insertError: insertResult.error },
    );
  }
}

async function logAppOpenActivity(userId: string, spaceId?: string | null) {
  const activityKey = getAppOpenActivityStorageKey(userId);
  if (typeof window !== "undefined" && window.sessionStorage.getItem(activityKey) === "1") {
    return;
  }

  await logUserActivity(userId, "app_open", spaceId);

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(activityKey, "1");
  }
}

async function ensureInitialSpaceMembership(userId: string): Promise<SpaceMembershipResult> {
  const preferredSpaceId = readPreferredSpaceId(userId);
  if (preferredSpaceId) {
    const preferredResult = await ensureSpaceMembershipById(userId, preferredSpaceId);
    if (!preferredResult.error && preferredResult.spaceId) {
      return preferredResult;
    }

    clearPreferredSpaceId(userId);
  }

  return { error: null, spaceId: null, spaceName: null };
}

async function ensureSpaceMembershipByInviteCode(
  userId: string,
  inviteCode: string,
): Promise<SpaceMembershipResult> {
  if (!supabase) {
    return { error: "Supabase is not configured.", spaceId: null, spaceName: null };
  }

  const normalizedInviteCode = inviteCode.trim();
  if (!normalizedInviteCode) {
    return { error: "Enter an invite code first.", spaceId: null, spaceName: null };
  }

  const { data: space, error: spaceError } = await supabase
    .from("spaces")
    .select("id, name")
    .eq("invite_code", normalizedInviteCode)
    .maybeSingle();

  if (spaceError) {
    return { error: spaceError.message, spaceId: null, spaceName: null };
  }

  if (!space) {
    return { error: "Could not find a space with that invite code.", spaceId: null, spaceName: null };
  }

  return ensureSpaceMembershipById(userId, space.id, space.name);
}

async function ensureSpaceMembershipById(
  userId: string,
  spaceId: string,
  knownSpaceName?: string | null,
): Promise<SpaceMembershipResult> {
  if (!supabase) {
    return { error: "Supabase is not configured.", spaceId: null, spaceName: null };
  }

  const spaceName =
    knownSpaceName ??
    (await fetchSpaceName(spaceId));

  if (!spaceName) {
    return { error: "Could not find that shared space.", spaceId: null, spaceName: null };
  }

  const { data: existingMembership, error: membershipLookupError } = await supabase
    .from("space_members")
    .select("id")
    .eq("space_id", spaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipLookupError) {
    return { error: membershipLookupError.message, spaceId: null, spaceName: null };
  }

  if (!existingMembership) {
    const { error: insertError } = await supabase.from("space_members").insert({
      space_id: spaceId,
      user_id: userId,
      role: "member",
    });

    if (insertError) {
      return { error: insertError.message, spaceId: null, spaceName: null };
    }
  }

  return { error: null, spaceId, spaceName };
}

async function fetchSpaceName(spaceId: string) {
  if (!supabase) {
    return null;
  }

  const { data: space, error } = await supabase
    .from("spaces")
    .select("name")
    .eq("id", spaceId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return space?.name ?? null;
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

async function fetchCalendarEventsForSpace(spaceId: string) {
  if (!supabase) {
    return { error: "Supabase is not configured.", events: [] as CalendarEventItem[] };
  }

  const { data, error } = await supabase
    .from("calender")
    .select("id, Event, EventType, Date, created_at")
    .eq("space_id", spaceId)
    .order("Date", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return { error: error.message, events: [] as CalendarEventItem[] };
  }

  return {
    error: null,
    events: sortCalendarEvents(
      (data ?? []).map((item) => ({
        id: String(item.id),
        text: item.Event ?? "",
        eventType: normalizeEventType(item.EventType),
        date: item.Date ?? "",
        createdAt: item.created_at,
      })),
    ),
  };
}

async function fetchInventoryForSpace(spaceId: string) {
  if (!supabase) {
    return { error: "Supabase is not configured.", items: [] as SpaceInventoryItem[] };
  }

  const inventoryResult = await fetchSpaceItemsRows(spaceId, "space_items");
  const fallbackInventoryResult =
    inventoryResult.error && inventoryResult.error.includes("relation")
      ? await fetchSpaceItemsRows(spaceId, "space_item")
      : inventoryResult;

  if (fallbackInventoryResult.error) {
    return { error: fallbackInventoryResult.error, items: [] as SpaceInventoryItem[] };
  }

  const inventoryRows = fallbackInventoryResult.rows;
  const itemIds = Array.from(new Set(inventoryRows.map((row) => row.item_id).filter(Boolean)));

  if (itemIds.length === 0) {
    return { error: null, items: [] as SpaceInventoryItem[] };
  }

  const { data: itemsData, error: itemsError } = await supabase
    .from("items")
    .select("id, name, type, rarity, description, image_url")
    .in("id", itemIds);

  if (itemsError) {
    return { error: itemsError.message, items: [] as SpaceInventoryItem[] };
  }

  const itemsById = new Map(
    (itemsData ?? []).map((item) => [
      item.id,
      {
        name: item.name ?? "Unknown item",
        type: item.type ?? "",
        rarity: item.rarity ?? "",
        description: item.description ?? "",
        imageUrl: item.image_url ?? "",
      },
    ]),
  );

  return {
    error: null,
    items: inventoryRows
      .map((row) => {
        const item = itemsById.get(row.item_id);
        if (!item) {
          return null;
        }

        return {
          id: row.id,
          itemId: row.item_id,
          quantity: Number(row.quantity ?? 0),
          name: item.name,
          type: item.type,
          rarity: item.rarity,
          description: item.description,
          imageUrl: item.imageUrl,
        } satisfies SpaceInventoryItem;
      })
      .filter((item): item is SpaceInventoryItem => item !== null)
      .sort(sortInventoryItems),
  };
}

async function awardRandomSpaceItem(spaceId: string, userId: string): Promise<DigRewardResult> {
  if (!supabase) {
    return { error: "Supabase is not configured.", item: null };
  }

  let rpcErrorMessage: string | null = null;

  if (hasAwardRandomSpaceItemRpc !== false) {
    const rpcResult = await supabase.rpc("award_random_space_item", {
      p_space_id: spaceId,
      p_user_id: userId,
    });

    if (!rpcResult.error) {
      hasAwardRandomSpaceItemRpc = true;
      const rewardRow = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
      if (!rewardRow) {
        return { error: "Dig completed without a reward item.", item: null };
      }

      return {
        error: null,
        item: {
          id: String(rewardRow.inventory_id),
          itemId: String(rewardRow.item_id),
          quantity: Number(rewardRow.quantity ?? 1),
          name: rewardRow.name ?? "Unknown item",
          type: rewardRow.type ?? "",
          rarity: rewardRow.rarity ?? "",
          description: rewardRow.description ?? "",
          imageUrl: rewardRow.image_url ?? "",
        },
      };
    }

    rpcErrorMessage = rpcResult.error.message;
    if (isMissingRpcError(rpcResult.error.message)) {
      hasAwardRandomSpaceItemRpc = false;
    }
  }

  const fallbackResult = await awardRandomSpaceItemFallback(spaceId, userId);
  if (fallbackResult.error) {
    console.error(
      "Could not award dig reward.",
      "RPC error:",
      rpcErrorMessage,
      "Fallback error:",
      fallbackResult.error,
    );
  }

  return fallbackResult;
}

function mergeInventoryItems(items: SpaceInventoryItem[], rewardedItem: SpaceInventoryItem) {
  const nextItems = [...items];
  const existingIndex = nextItems.findIndex(
    (item) => item.id === rewardedItem.id || item.itemId === rewardedItem.itemId,
  );

  if (existingIndex >= 0) {
    nextItems[existingIndex] = {
      ...nextItems[existingIndex],
      ...rewardedItem,
    };
  } else {
    nextItems.unshift(rewardedItem);
  }

  return nextItems.sort(sortInventoryItems);
}

function sortInventoryItems(left: SpaceInventoryItem, right: SpaceInventoryItem) {
  if (right.quantity !== left.quantity) {
    return right.quantity - left.quantity;
  }

  return left.name.localeCompare(right.name);
}

function isMissingRpcError(message: string | null | undefined) {
  if (!message) {
    return false;
  }

  return message.includes("Could not find the function") || message.includes("404");
}

async function awardRandomSpaceItemFallback(spaceId: string, _userId: string): Promise<DigRewardResult> {
  if (!supabase) {
    return { error: "Supabase is not configured.", item: null };
  }

  const { data: itemsData, error: itemsError } = await supabase
    .from("items")
    .select("id, name, type, rarity, description, image_url");

  if (itemsError) {
    return { error: itemsError.message, item: null };
  }

  const availableItems = (itemsData ?? []).filter((item) => item.id);
  if (availableItems.length === 0) {
    return { error: "No items are available for dig rewards.", item: null };
  }

  const selectedItem = availableItems[Math.floor(Math.random() * availableItems.length)];
  const primaryResult = await upsertSpaceInventoryReward("space_items", spaceId, selectedItem.id);
  const inventoryResult =
    primaryResult.error && primaryResult.error.includes("relation")
      ? await upsertSpaceInventoryReward("space_item", spaceId, selectedItem.id)
      : primaryResult;

  if (inventoryResult.error || !inventoryResult.row) {
    return { error: inventoryResult.error ?? "Could not write dig reward to inventory.", item: null };
  }

  return {
    error: null,
    item: {
      id: inventoryResult.row.id,
      itemId: String(selectedItem.id),
      quantity: inventoryResult.row.quantity,
      name: selectedItem.name ?? "Unknown item",
      type: selectedItem.type ?? "",
      rarity: selectedItem.rarity ?? "",
      description: selectedItem.description ?? "",
      imageUrl: selectedItem.image_url ?? "",
    },
  };
}

async function upsertSpaceInventoryReward(
  tableName: "space_items" | "space_item",
  spaceId: string,
  itemId: string,
) {
  if (!supabase) {
    return { error: "Supabase is not configured.", row: null as { id: string; quantity: number } | null };
  }

  const { data: existingRow, error: existingError } = await supabase
    .from(tableName)
    .select("id, quantity")
    .eq("space_id", spaceId)
    .eq("item_id", itemId)
    .maybeSingle();

  if (existingError) {
    return { error: existingError.message, row: null as { id: string; quantity: number } | null };
  }

  if (!existingRow) {
    const { data: insertedRow, error: insertError } = await supabase
      .from(tableName)
      .insert({
        space_id: spaceId,
        item_id: itemId,
        quantity: 1,
      })
      .select("id, quantity")
      .single();

    if (insertError) {
      return { error: insertError.message, row: null as { id: string; quantity: number } | null };
    }

    return {
      error: null,
      row: {
        id: String(insertedRow.id),
        quantity: Number(insertedRow.quantity ?? 1),
      },
    };
  }

  const nextQuantity = Number(existingRow.quantity ?? 0) + 1;
  const { data: updatedRow, error: updateError } = await supabase
    .from(tableName)
    .update({ quantity: nextQuantity })
    .eq("id", existingRow.id)
    .select("id, quantity")
    .single();

  if (updateError) {
    return { error: updateError.message, row: null as { id: string; quantity: number } | null };
  }

  return {
    error: null,
    row: {
      id: String(updatedRow.id),
      quantity: Number(updatedRow.quantity ?? nextQuantity),
    },
  };
}

async function fetchSpaceItemsRows(spaceId: string, tableName: "space_items" | "space_item") {
  if (!supabase) {
    return {
      error: "Supabase is not configured.",
      rows: [] as Array<{ id: string; item_id: string; quantity: number }>,
    };
  }

  const { data, error } = await supabase
    .from(tableName)
    .select("id, item_id, quantity")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: true });

  if (error) {
    return {
      error: error.message,
      rows: [] as Array<{ id: string; item_id: string; quantity: number }>,
    };
  }

  return {
    error: null,
    rows: (data ?? []).map((row) => ({
      id: String(row.id),
      item_id: String(row.item_id),
      quantity: Number(row.quantity ?? 0),
    })),
  };
}

async function ensurePetStateForSpace(spaceId: string) {
  if (!supabase) {
    return { error: "Supabase is not configured.", petState: null as PetState | null };
  }

  const { data: existingPetState, error: lookupError } = await supabase
    .from("pet_state")
    .select('space_id, "Status", "Nutrition", xp')
    .eq("space_id", spaceId)
    .maybeSingle();

  if (lookupError) {
    return { error: lookupError.message, petState: null as PetState | null };
  }

  if (!existingPetState) {
    const initialPetState = { status: "0" as PetStatusValue, nutrition: 0, xp: 0 };
    const { error: insertError } = await supabase.from("pet_state").insert({
      space_id: spaceId,
      Status: initialPetState.status,
      Nutrition: initialPetState.nutrition,
      xp: initialPetState.xp,
    });

    if (insertError) {
      return { error: insertError.message, petState: null as PetState | null };
    }

    return { error: null, petState: initialPetState };
  }

  const nutrition = Number(existingPetState.Nutrition ?? 0);
  const xp = Number(existingPetState.xp ?? 0);
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
      xp,
    },
  };
}

async function applyPetAction(spaceId: string, action: PetAction, userId?: string | null): Promise<PetActionResult> {
  if (!supabase) {
    return { error: "Supabase is not configured.", petState: null as PetState | null };
  }

  if (hasApplyPetActionRpc !== false) {
    const { data, error } = await supabase.rpc("apply_pet_action", {
      p_space_id: spaceId,
      p_action: action,
      p_user_id: userId ?? null,
    });

    if (!error) {
      hasApplyPetActionRpc = true;
      const petSnapshot = Array.isArray(data) ? data[0] : data;
      if (!petSnapshot) {
        return { error: "Pet action completed without a state update.", petState: null as PetState | null };
      }

      return {
        error: null,
        petState: {
          status: normalizePetStatusValue(petSnapshot.status),
          nutrition: Number(petSnapshot.nutrition ?? 0),
          xp: Number(petSnapshot.total_xp ?? 0),
        },
      };
    }

    if (isMissingRpcError(error.message)) {
      hasApplyPetActionRpc = false;
    }
  }

  return applyPetActionFallback(spaceId, action, userId ?? null);
}

async function applyPetActionFallback(
  spaceId: string,
  action: PetAction,
  userId?: string | null,
): Promise<PetActionResult> {
  if (!supabase) {
    return { error: "Supabase is not configured.", petState: null };
  }

  const currentStateResult = await ensurePetStateForSpace(spaceId);
  if (currentStateResult.error || !currentStateResult.petState) {
    return currentStateResult;
  }

  const currentState = currentStateResult.petState;
  const isDailyLimitedAction = action === "visit" || action === "feed" || action === "water";
  const actionAlreadyClaimed = isDailyLimitedAction && hasClaimedDailyPetAction(spaceId, action, userId ?? null);
  const xpDelta = actionAlreadyClaimed ? 0 : 1;
  const nutritionDelta = action === "water" && !actionAlreadyClaimed ? 1 : 0;

  if (xpDelta === 0 && nutritionDelta === 0) {
    return { error: null, petState: currentState };
  }

  const nextNutrition = currentState.nutrition + nutritionDelta;
  const nextStatus = getStatusFromNutrition(nextNutrition);
  const nextXp = currentState.xp + xpDelta;

  const { error } = await supabase
    .from("pet_state")
    .update({
      xp: nextXp,
      Nutrition: nextNutrition,
      Status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("space_id", spaceId);

  if (error) {
    return { error: error.message, petState: currentState };
  }

  if (isDailyLimitedAction) {
    markDailyPetActionClaimed(spaceId, action, userId ?? null);
  }

  return {
    error: null,
    petState: {
      xp: nextXp,
      nutrition: nextNutrition,
      status: nextStatus,
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

function normalizePetStatusValue(value: string | null | undefined): PetStatusValue {
  if (value === "1" || value === "2" || value === "3" || value === "pet") {
    return value;
  }

  return "0";
}

function formatPetXp(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function hasClaimedDailyPetAction(spaceId: string, action: PetAction, userId?: string | null) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(getDailyPetActionStorageKey(spaceId, action, userId)) === "1";
}

function markDailyPetActionClaimed(spaceId: string, action: PetAction, userId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getDailyPetActionStorageKey(spaceId, action, userId), "1");
}

function getDailyPetActionStorageKey(spaceId: string, action: PetAction, userId?: string | null) {
  return ["pet-action", spaceId, userId ?? "guest", getTodayDateValue(), action].join(":");
}

function getAppOpenActivityStorageKey(userId: string) {
  return [APP_OPEN_ACTIVITY_PREFIX, userId, getTodayDateValue()].join(":");
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

function getPreferredSpaceStorageKey(_userId?: string) {
  return "preferred-space-id";
}

function getNoteDraftStorageKey(spaceId: string) {
  return `note-draft:${spaceId}`;
}

function readNoteDraftSession(spaceId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(getNoteDraftStorageKey(spaceId));
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as { draft?: string; isEditing?: boolean };
    return {
      draft: typeof parsedValue.draft === "string" ? parsedValue.draft : "",
      isEditing: parsedValue.isEditing === true,
    };
  } catch {
    return null;
  }
}

function writeNoteDraftSession(spaceId: string, value: { draft: string; isEditing: boolean }) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(getNoteDraftStorageKey(spaceId), JSON.stringify(value));
}

function clearNoteDraftSession(spaceId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(getNoteDraftStorageKey(spaceId));
}

function readPreferredSpaceId(userId?: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(getPreferredSpaceStorageKey(userId));
}

function writePreferredSpaceId(userId: string, spaceId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getPreferredSpaceStorageKey(userId), spaceId);
}

function clearPreferredSpaceId(userId?: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getPreferredSpaceStorageKey(userId));
}

function formatShortDate(date: string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function getTodayDateValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function formatCalendarEditorText(items: CalendarEventItem[]) {
  return items.map((item) => `[${item.eventType}] ${item.text}`.trim()).join("\n");
}

function parseCalendarEditorText(value: string, defaultEventType: EventType) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const prefixedMatch = line.match(/^\[(.+?)\]\s*(.+)$/);

      if (prefixedMatch) {
        const [, maybeType, text] = prefixedMatch;

        if (EVENT_TYPES.includes(maybeType as EventType)) {
          return {
            eventType: maybeType as EventType,
            text: text.trim(),
          };
        }
      }

      return {
        eventType: defaultEventType,
        text: line,
      };
    })
    .filter((item) => item.text.length > 0);
}

function normalizeCalendarEditorText(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function sortCalendarEvents(items: CalendarEventItem[]) {
  return [...items].sort((left, right) => {
    const dateCompare = left.date.localeCompare(right.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

function normalizeEventType(value: string | null): EventType {
  if (value && EVENT_TYPES.includes(value as EventType)) {
    return value as EventType;
  }

  return "随记";
}

function shiftMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function rectanglesOverlap(a: DOMRect, b: DOMRect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function getAuthRedirectUrl() {
  if (configuredAppUrl) {
    return configuredAppUrl;
  }

  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return origin;
    }
  }

  return null;
}
