import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Visual pagination for a continuous editor.
 *
 * ProseMirror holds one flowing document, so there is nothing to "split" into
 * page nodes without rewriting the document on every keystroke. Instead this
 * measures the laid-out height of each top-level block and injects a spacer
 * widget wherever a block would cross a page boundary. The spacer fills the
 * remainder of the sheet, draws the gutter between pages, and supplies the
 * next page's top margin, so the block is pushed onto a fresh page and the
 * caret follows it down naturally.
 *
 * What this does NOT do: split a single block across pages. A paragraph or
 * image taller than the page body stays whole and simply overhangs. Breaking
 * mid-block requires laying out text runs, which is a typesetting engine.
 */

/** Printable height of one page, in CSS pixels at 96dpi (US Letter minus margins). */
export const PAGE_CONTENT_HEIGHT = 912;
/** Grey gutter drawn between two sheets. */
export const PAGE_GUTTER = 32;
/** White margin at the top of every page after the first. */
export const PAGE_TOP_MARGIN = 80;
/** White margin below the last line of every page, mirroring the top. */
export const PAGE_BOTTOM_MARGIN = 80;

const paginationKey = new PluginKey<DecorationSet>("pagination");

type Break = { pos: number; fill: number };

function buildSpacer(fill: number): HTMLElement {
  // Remaining body space, then the page's bottom margin, then the gutter,
  // then the next page's top margin.
  const white = fill + PAGE_BOTTOM_MARGIN;
  const gutterEnd = white + PAGE_GUTTER;

  const el = document.createElement("div");
  el.setAttribute("data-page-spacer", "true");
  el.className = "page-spacer";
  el.style.height = `${gutterEnd + PAGE_TOP_MARGIN}px`;
  el.style.background = [
    "linear-gradient(to bottom,",
    `#fff 0, #fff ${white}px,`,
    `#e2e8f0 ${white}px, #e2e8f0 ${white + 1}px,`,
    `#f1f5f9 ${white + 1}px, #f1f5f9 ${gutterEnd - 1}px,`,
    `#e2e8f0 ${gutterEnd - 1}px, #e2e8f0 ${gutterEnd}px,`,
    `#fff ${gutterEnd}px, #fff 100%)`,
  ].join(" ");
  return el;
}

export const Pagination = Extension.create({
  name: "pagination",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: paginationKey,

        state: {
          init: () => DecorationSet.empty,
          apply(tr, value) {
            const next = tr.getMeta(paginationKey);
            if (next) return next as DecorationSet;
            return value.map(tr.mapping, tr.doc);
          },
        },

        props: {
          decorations(state) {
            return paginationKey.getState(state);
          },
        },

        view(view) {
          let frame = 0;
          let signature = "";

          const measure = () => {
            frame = 0;
            if (!view.dom.isConnected) return;

            const dom = view.dom as HTMLElement;
            // Top-level blocks, in document order, ignoring our own spacers.
            const blocks = Array.from(dom.children).filter(
              (child): child is HTMLElement =>
                child instanceof HTMLElement && child.dataset.pageSpacer !== "true",
            );

            const breaks: Break[] = [];
            // Accumulated height of the current page's body.
            //
            // Deliberately summed from each block's own height rather than read
            // off offsetTop: offsetTop already includes the spacers from the
            // previous pass, so measuring it fed the calculation its own output
            // and the breaks oscillated. Natural heights do not move when a
            // spacer is added, so this converges in a single pass.
            let used = 0;
            let index = 0;

            view.state.doc.forEach((node, offset) => {
              const el = blocks[index];
              index += 1;
              if (!el) return;

              const height = el.offsetHeight;
              const gap = used === 0 ? 0 : parseFloat(getComputedStyle(el).marginTop) || 0;

              const fitsOnAPage = height <= PAGE_CONTENT_HEIGHT;
              const overflows = used + gap + height > PAGE_CONTENT_HEIGHT;

              if (used > 0 && overflows && fitsOnAPage) {
                // Push this block to the next page and fill out this one.
                breaks.push({ pos: offset, fill: Math.max(PAGE_CONTENT_HEIGHT - used, 0) });
                used = height;
              } else {
                used += gap + height;
                // A block taller than a page overhangs; start counting again
                // after it rather than breaking every block that follows.
                if (used > PAGE_CONTENT_HEIGHT && !fitsOnAPage) used = 0;
              }
            });

            const nextSignature = breaks.map((b) => `${b.pos}:${Math.round(b.fill)}`).join("|");
            if (nextSignature === signature) return;
            signature = nextSignature;

            const decorations = DecorationSet.create(
              view.state.doc,
              breaks.map((b) =>
                Decoration.widget(b.pos, () => buildSpacer(b.fill), {
                  side: -1,
                  key: `page-${b.pos}-${Math.round(b.fill)}`,
                }),
              ),
            );

            view.dispatch(view.state.tr.setMeta(paginationKey, decorations));
          };

          const schedule = () => {
            if (frame) return;
            frame = requestAnimationFrame(measure);
          };

          schedule();
          window.addEventListener("resize", schedule);

          return {
            update: schedule,
            destroy() {
              if (frame) cancelAnimationFrame(frame);
              window.removeEventListener("resize", schedule);
            },
          };
        },
      }),
    ];
  },
});
