import Image from "next/image";
import type { CSSProperties, FormEventHandler, RefObject } from "react";
import styles from "./note-panel.module.css";

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
};

type NotesStatus = "idle" | "loading" | "saving" | "ready" | "error";

type NotePanelProps = {
  isOpen: boolean;
  isEditing: boolean;
  notesStatus: NotesStatus;
  hasHydrated: boolean;
  previewNotes: NoteItem[];
  selectedNoteId: string | null;
  cardLayouts: CardLayout[];
  draft: string;
  isSaveDisabled: boolean;
  noteInputRef: RefObject<HTMLTextAreaElement | null>;
  onClose: () => void;
  onSelectNote: (noteId: string) => void;
  onStartEditing: () => void;
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
  previewNotes,
  selectedNoteId,
  cardLayouts,
  draft,
  isSaveDisabled,
  noteInputRef,
  onClose,
  onSelectNote,
  onStartEditing,
  onSubmit,
  onDraftChange,
  onInputFocus,
  onInputBlur,
  formatShortDate,
}: NotePanelProps) {
  const selectedPreviewNote =
    previewNotes.find((note) => note.id === selectedNoteId) ?? previewNotes[0] ?? null;

  return (
    <section
      id="notes-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Notes"
      aria-hidden={!isOpen}
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
            type="button"
            className={styles.panelClose}
            onClick={onClose}
            aria-label="Close notes"
          >
            <span aria-hidden="true">x</span>
          </button>
        </header>

        <div className={styles.noteBoard}>
          {notesStatus === "loading" && !hasHydrated ? (
            <div className={styles.emptyBoard}>
              <p>Loading shared notes...</p>
              <span>Notes from everyone in this space will appear here.</span>
            </div>
          ) : hasHydrated && previewNotes.length === 0 ? (
            <div className={styles.emptyBoard}>
              <p>No notes yet.</p>
              <span>The first note in this space will show up here.</span>
            </div>
          ) : (
            previewNotes.map((note, index) => (
              <button
                type="button"
                key={note.id}
                className={`${styles.boardCard} ${
                  selectedPreviewNote?.id === note.id ? styles.boardCardActive : ""
                }`}
                style={getCardStyle(cardLayouts[index] ?? cardLayouts[0])}
                onClick={() => onSelectNote(note.id)}
                aria-pressed={selectedPreviewNote?.id === note.id}
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
            ))
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
              />
              <button type="submit" className={styles.saveButton} disabled={isSaveDisabled}>
                {notesStatus === "saving" ? "Saving..." : "Save"}
              </button>
            </div>
          ) : (
            <div className={styles.noteViewer}>
              {selectedPreviewNote ? (
                <>
                  <p className={styles.noteViewerText}>{selectedPreviewNote.text}</p>
                </>
              ) : (
                <p className={styles.noteViewerEmpty}>Click a note to view it here.</p>
              )}
              <button type="button" className={styles.saveButton} onClick={onStartEditing}>
                Write note
              </button>
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
  } as CSSProperties;
}
