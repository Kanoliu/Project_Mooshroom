"use client";

import Image from "next/image";
import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import styles from "./page.module.css";

type NoteItem = {
  id: string;
  text: string;
  createdAt: string;
};

type NotesState = {
  hasHydrated: boolean;
  notes: NoteItem[];
};

type NotesAction = { type: "hydrate"; notes: NoteItem[] } | { type: "add"; note: NoteItem };

type CardLayout = {
  art: string;
  rotate: string;
  left: string;
  top: string;
  width: string;
  padding: string;
};

type PetAnimation = "idle" | "note";

const STORAGE_KEY = "mooshroom-notes";

const petFrames = Array.from({ length: 60 }, (_, index) => {
  const frameNumber = String(index + 1).padStart(4, "0");
  return `/art/pets/idle/frame_${frameNumber}.webp`;
});

const petNoteFrames = [
  ...Array.from({ length: 30 }, (_, index) => index + 15),
  ...Array.from({ length: 16 }, (_, index) => index + 46),
].map((frameNumber) => `/art/pets/note/frame_${String(frameNumber).padStart(4, "0")}.webp`);

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
    default:
      return state;
  }
}

export default function Home() {
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [currentFrame, setCurrentFrame] = useState(0);
  const [petAnimation, setPetAnimation] = useState<PetAnimation>("idle");
  const [notesState, dispatch] = useReducer(notesReducer, {
    hasHydrated: false,
    notes: [],
  });

  const noteButtonRef = useRef<HTMLButtonElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const hadNoteOpenRef = useRef(false);
  const pendingNoteReactionRef = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    let parsedNotes: NoteItem[] = [];

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as NoteItem[];
        if (Array.isArray(parsed)) {
          parsedNotes = parsed.filter(
            (item): item is NoteItem =>
              typeof item?.id === "string" &&
              typeof item?.text === "string" &&
              typeof item?.createdAt === "string",
          );
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    dispatch({ type: "hydrate", notes: parsedNotes });
  }, []);

  useEffect(() => {
    if (!notesState.hasHydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notesState.notes));
  }, [notesState]);

  useEffect(() => {
    const activeFrames = petAnimation === "note" ? petNoteFrames : petFrames;
    const interval = window.setInterval(() => {
      setCurrentFrame((frame) => {
        if (petAnimation === "note") {
          if (frame >= activeFrames.length - 1) {
            window.setTimeout(() => {
              setPetAnimation("idle");
              setCurrentFrame(0);
            }, 0);
            return frame;
          }
        }

        return (frame + 1) % activeFrames.length;
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, [petAnimation]);

  useEffect(() => {
    if (isNoteOpen) {
      const focusTimeout = window.setTimeout(() => {
        noteInputRef.current?.focus();
      }, 120);

      return () => window.clearTimeout(focusTimeout);
    }

    return undefined;
  }, [isNoteOpen]);

  useEffect(() => {
    if (hadNoteOpenRef.current && !isNoteOpen) {
      noteButtonRef.current?.focus();

      if (pendingNoteReactionRef.current) {
        pendingNoteReactionRef.current = false;
        setPetAnimation("note");
        setCurrentFrame(0);
      }
    }

    hadNoteOpenRef.current = isNoteOpen;
  }, [isNoteOpen]);

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

  const previewNotes = useMemo(() => notesState.notes.slice(0, 4), [notesState.notes]);
  const isSaveDisabled = draft.trim().length === 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }

    dispatch({
      type: "add",
      note: {
        id: crypto.randomUUID(),
        text: trimmed,
        createdAt: new Date().toISOString(),
      },
    });
    pendingNoteReactionRef.current = true;
    setDraft("");
    setIsNoteOpen(true);
  };

  const activePetFrames = petAnimation === "note" ? petNoteFrames : petFrames;

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

          <header className={styles.topBar}>
            <button
              ref={noteButtonRef}
              type="button"
              className={styles.noteFab}
              onClick={() => setIsNoteOpen((open) => !open)}
              aria-expanded={isNoteOpen}
              aria-controls="notes-panel"
              aria-label={isNoteOpen ? "Close notes" : "Open notes"}
            >
              <div className={styles.noteFabMask}>
                <Image
                  src="/art/ui/Note%20icon.webp"
                  alt=""
                  width={24}
                  height={24}
                  unoptimized
                  className={styles.noteIcon}
                />
              </div>
            </button>
          </header>

          <div className={styles.petStage}>
            <div className={styles.petGlow} />
            <div className={styles.petWrap}>
              <Image
                src={activePetFrames[currentFrame]}
                alt="Mooshroom pet character."
                width={220}
                height={220}
                unoptimized
                className={styles.pet}
              />
            </div>
          </div>

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
                {notesState.hasHydrated && previewNotes.length === 0 ? (
                  <div className={styles.emptyBoard}>
                    <p>No notes yet.</p>
                    <span>Your newest notes will gather here.</span>
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
                    placeholder="Write a little note..."
                  />
                  <button type="submit" className={styles.saveButton} disabled={isSaveDisabled}>
                    Save
                  </button>
                </div>
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

function formatShortDate(date: string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
