import Image from "next/image";
import {
  type CSSProperties,
  type FormEventHandler,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./note-panel.module.css";

const NOTES_PER_PAGE = 4;
const NOTE_CHARACTER_LIMIT = 2000;

type NoteItem = {
  id: string;
  text: string;
  createdAt: string;
};

type CardLayout = {
  art: string;
  rotate: string;
  left: string;
  top: string;
  width: string;
  padding: string;
  lineClamp: number;
};

type NotesStatus = "idle" | "loading" | "saving" | "ready" | "error";

type NotePanelProps = {
  isOpen: boolean;
  isEditing: boolean;
  notesStatus: NotesStatus;
  hasHydrated: boolean;
  notes: NoteItem[];
  selectedNoteId: string | null;
  cardLayouts: CardLayout[];
  draft: string;
  isSaveDisabled: boolean;
  noteInputRef: RefObject<HTMLTextAreaElement | null>;
  onClose: () => void;
  onSelectNote: (noteId: string) => void;
  onEditNote: (noteId: string) => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onDraftChange: (value: string) => void;
  onInputFocus: () => void;
  onInputBlur: () => void;
  formatShortDate: (date: string) => string;
};

export function NotePanel({
  isOpen,
  isEditing,
  notesStatus,
  hasHydrated,
  notes,
  selectedNoteId,
  cardLayouts,
  draft,
  isSaveDisabled,
  noteInputRef,
  onClose,
  onSelectNote,
  onEditNote,
  onStartEditing,
  onCancelEditing,
  onSubmit,
  onDraftChange,
  onInputFocus,
  onInputBlur,
  formatShortDate,
}: NotePanelProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const totalPages = Math.max(1, Math.ceil(notes.length / NOTES_PER_PAGE));
  const visibleNotes = useMemo(
    () => notes.slice(pageIndex * NOTES_PER_PAGE, (pageIndex + 1) * NOTES_PER_PAGE),
    [notes, pageIndex],
  );
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? notes[0] ?? null;
  const viewerTextClassName = selectedNote
    ? `${styles.noteViewerText} ${getViewerTextSizeClass(selectedNote.text)}`
    : styles.noteViewerText;

  useEffect(() => {
    const selectedIndex = notes.findIndex((note) => note.id === selectedNoteId);
    const pageUpdate = window.setTimeout(() => {
      setPageIndex((current) =>
        selectedIndex >= 0
          ? Math.floor(selectedIndex / NOTES_PER_PAGE)
          : Math.min(current, totalPages - 1),
      );
    }, 0);

    return () => window.clearTimeout(pageUpdate);
  }, [notes, selectedNoteId, totalPages]);

  useEffect(() => {
    if (isOpen && !isEditing) {
      window.setTimeout(() => closeButtonRef.current?.focus({ preventScroll: true }), 0);
    }
  }, [isEditing, isOpen]);

  return (
    <section
      id="notes-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Notes"
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={`${styles.notesPanel} ${isOpen ? styles.notesPanelOpen : ""} ${
        isEditing ? styles.notesPanelEditing : ""
      }`}
    >
      <Image
        src="/art/ui/note%20panel.webp"
        alt=""
        fill
        priority={isOpen}
        unoptimized
        className={styles.notesPanelBase}
      />

      <div className={styles.notesPanelInner}>
        <header className={styles.panelHeader}>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.panelClose}
            onClick={onClose}
            aria-label="Close notes"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className={styles.noteBoard}>
          {notesStatus === "loading" && !hasHydrated ? (
            <div className={styles.emptyBoard}>
              <p>Loading shared notes...</p>
            </div>
          ) : hasHydrated && notes.length === 0 ? (
            <div className={styles.emptyBoard}>
              <p>No notes yet.</p>
            </div>
          ) : (
            <>
              {visibleNotes.map((note, index) => (
                <button
                  type="button"
                  key={note.id}
                  className={`${styles.boardCard} ${
                    selectedNote?.id === note.id ? styles.boardCardActive : ""
                  }`}
                  style={getCardStyle(cardLayouts[index] ?? cardLayouts[0])}
                  onClick={() => onSelectNote(note.id)}
                  aria-pressed={selectedNote?.id === note.id}
                  aria-label={`Open note from ${formatShortDate(note.createdAt)}`}
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
                  </div>
                </button>
              ))}
              {totalPages > 1 ? (
                <nav className={styles.notePagination} aria-label="Note pages">
                  <button
                    type="button"
                    onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                    disabled={pageIndex === 0}
                    aria-label="Newer notes"
                  >
                    ‹
                  </button>
                  <span>
                    {pageIndex + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPageIndex((current) => Math.min(totalPages - 1, current + 1))}
                    disabled={pageIndex === totalPages - 1}
                    aria-label="Older notes"
                  >
                    ›
                  </button>
                </nav>
              ) : null}
            </>
          )}
        </div>

        <form className={styles.noteComposer} onSubmit={onSubmit}>
          {isEditing ? (
            <div className={styles.composerSurface}>
              <textarea
                ref={noteInputRef}
                id="note-input"
                className={styles.noteInput}
                rows={3}
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
                placeholder="Write a little note..."
                maxLength={NOTE_CHARACTER_LIMIT}
              />
              <div className={styles.composerActions}>
                <span className={styles.characterCount}>
                  {draft.length} / {NOTE_CHARACTER_LIMIT}
                </span>
                <button type="button" className={styles.secondaryButton} onClick={onCancelEditing}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveButton} disabled={isSaveDisabled}>
                  {notesStatus === "saving" ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.noteViewer}>
              {selectedNote ? (
                <p className={viewerTextClassName}>{selectedNote.text}</p>
              ) : (
                <p className={styles.noteViewerEmpty}>No notes yet.</p>
              )}
              <div className={styles.viewerActions}>
                {selectedNote ? (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => onEditNote(selectedNote.id)}
                  >
                    Edit
                  </button>
                ) : null}
                <button type="button" className={styles.saveButton} onClick={onStartEditing}>
                  New note
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}

function getCardStyle(layout: CardLayout): CSSProperties {
  return {
    "--card-rotate": layout.rotate,
    "--card-left": layout.left,
    "--card-top": layout.top,
    "--card-width": layout.width,
    "--card-padding": layout.padding,
    "--card-line-clamp": String(layout.lineClamp),
  } as CSSProperties;
}

function getViewerTextSizeClass(text: string) {
  if (text.length > 520) {
    return styles.noteViewerTextTiny;
  }

  if (text.length > 280) {
    return styles.noteViewerTextSmall;
  }

  return "";
}
