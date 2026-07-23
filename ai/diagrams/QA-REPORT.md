# Studio Foundry diagrams: independent layout QA

Independent QA pass over all 11 diagrams in the Lucid folder "Microsoft AI Foundry"
(folder id `445735630`), run against the document IDs in `INDEX.md`. Every diagram
was exported to PNG with `lucid_export_document_as_PNG` and visually inspected, then
cross-checked against exact shape and connector coordinates pulled from the Lucid
document itself (not just eyeballed), so overlap and crossing claims below are backed
by bounding-box math, not just a look at the picture.

Checklist applied to each diagram:

1. No two shapes overlap.
2. No label overflows its shape or touches another label.
3. No connector line passes through a shape it does not connect.
4. Spacing between shapes is even and generous.
5. Flow direction is consistent and easy to follow.
6. Text is legible at export size.
7. Every connector is labeled.
8. Title present, no em-dashes, no secrets or GUIDs in any label.

Small, clean fixes were applied directly in Lucid with `lucid_edit_item`,
`lucid_add_block`, and `lucid_add_line`. Anything that could not be fixed through
the available tools is called out by name below rather than silently left broken.

## Results

| # | Diagram | Verdict | Issues found and what was fixed |
| --- | --- | --- | --- |
| 1 | Solution context | PASS (fixed) | Two connectors (R2 to reader apps, and marketing origin to reader apps) converged on the exact same anchor point on the apps shape, so their "app assets" and "hotlink" labels overlapped. Re-anchored the second connector to a distinct point lower on the shape. The diagram had no on-canvas title; added one, positioned above the container's floating title tab after an initial placement collided with it. |
| 2 | Azure resource topology and CAF naming | PASS | Verified the full containment hierarchy by coordinates: tenant to subscription to resource groups to resources. No overlaps, consistent 20 to 40 px margins throughout, no secret values or GUIDs (explicitly labeled "by display name only" / "names only, no values in git"). Pure nesting diagram with no connectors, so nothing to label. No fix needed. |
| 3 | Identity and auth flow | PASS (fixed) | The on-canvas title was a tiny, unstyled text block that read much smaller than the rest of the diagram. First resize attempt (larger, bold) wrapped to two lines and overlapped the Entra ID box; corrected to a size that fits on one line clear of it. Verified the identity-to-DefaultAzureCredential and identity-to-vault connectors share a start point but diverge immediately (a normal fork, not an overlap). |
| 4 | Image generation sequence | PASS | Native Lucid sequence diagram built from a PlantUML spec; lifeline spacing, activation bars, and the nested alt/loop fragments are engine-laid-out and clean. Title is present, bold, legible, and does not overlap anything. Found a text typo in the title ("tools//mai-image.mjs" double slash, plus a double space) but both the edit and delete APIs report success without actually changing this generator-owned text item; could not fix through available tools. This is a content typo, not a layout defect. |
| 5 | Voice variant generation sequence | PASS | Same native sequence-diagram construction as #4, equally clean: lifelines evenly spaced, notes and the nested loop fragment properly contained, every message labeled. Same class of title typo (double space before the parenthesis) and the same tool limitation prevents fixing it. Not a layout defect. |
| 6 | End-to-end asset pipeline | PASS (fixed) | Same undersized-title problem as #3; resized to a legible single-line bold title. Verified by coordinates that the long diagonal "covers (content-hashed)" connector clears the tts.mjs, stitch.mjs, and marketing-origin boxes by 78 to 260 px along its entire path; it only looks like it cuts through the middle of the diagram. |
| 7 | Cost and governance flow | PASS (fixed) | No on-canvas title; added one. Seven of the eleven connectors (the plain sequential ones between process boxes) had no label, breaking the "every connector is labeled" rule every other diagram follows. Added a short, specific label to each (call details, estimate, usage recorded, cost estimate, running total, spend evaluated, ceiling reached). Along the way, hit and worked around a stale-export problem: several labels saved correctly but did not appear in the exported PNG until re-edited with genuinely different text, which is now documented for future edits to this diagram set. |
| 8 | Content-safety and responsible-AI flow | PASS (fixed) | No title; added one. Six sequential connectors were unlabeled; labeled them (prompt, genericized prompt, framed prompt, model response, provenance recorded, ready to publish). Confirmed by coordinates that both loop-back paths (revise prompt, log refusal) run in the clear margin to the left of the decision diamonds and never cross a box. |
| 9 | Tenant selection and fallback decision | PASS (fixed) | No title; added one. Two sequential connectors were unlabeled; labeled them (provision request, candidate selected). Confirmed the "region forced to eastus2" diagonal clears the HARD BLOCK box by a comfortable margin, and that the unconnected "Not ready" note is an intentional standalone footnote about a separate, unrelated management group rather than a broken connector. |
| 10 | Deployment runbook | PASS (fixed) | No title; added one. All ten sequential connectors linking the numbered steps were unlabeled; gave each a short state label (kickoff, names OK, RG created, tagged, account ready, model deployed, roles assigned, key stored, budget set, checks run). |
| 11 | Data and state model (ERD) | PASS (fixed) | No title; added one, positioned above the two entity tables that start at the very top of this page (placing it at the same y as the other diagrams would have overlapped them). Independently re-verified the pre-existing note in `INDEX.md` about the BrandState foreign-key lines by tracing both relationships against every entity's bounding box: a direct path would cut through ImageLedger, and the actual rendered route detours around its bottom-right to avoid it, clearing every table. Confirmed accurate, not just taken on faith. |

## Overall verdict

11 of 11 PASS.

Nine diagrams needed and received direct fixes (1, 3, 6, 7, 8, 9, 10, 11): missing
titles added, an oversized/undersized title corrected, unlabeled connectors given
real labels, and one pair of overlapping connector labels re-routed. Diagram 2
needed no changes. Diagrams 4 and 5 each carry one small, purely cosmetic title
typo that the available Lucid tools could not apply (see below); nothing else on
either diagram needed a fix.

No diagram in the folder currently has: overlapping shapes, a label that overflows
its shape or touches another label, a connector that cuts through a shape it does
not connect, cramped or uneven spacing, an inconsistent flow direction, illegible
text, an unlabeled connector, a missing title, an em-dash, or a secret/GUID in any
label.

## Fixes still needed by hand (could not be applied through the available tools)

- **Diagram 4, Image generation sequence.** Title currently reads "Image generation
  sequence  (tools//mai-image.mjs, pilot brand)" (double space before the
  parenthesis, double slash in the path). Should read "Image generation sequence
  (tools/mai-image.mjs, pilot brand)". The title is a text item that belongs to
  the auto-generated sequence-diagram cluster; both `lucid_edit_item` and
  `lucid_delete_items` against it return success with no error but leave the text
  unchanged. Fix by opening the document in Lucid and retyping the title directly.
- **Diagram 5, Voice variant generation sequence.** Title currently reads "Voice
  variant generation sequence  (publish.mjs + tts.mjs)" with a double space before
  the parenthesis. Should read "Voice variant generation sequence (publish.mjs +
  tts.mjs)". Same tool limitation as diagram 4; fix by hand in the Lucid editor.

Neither item affects layout, legibility, overlap, or the presence of the title
itself; both diagrams still PASS the layout checklist.
