/** True when a scroll box is at (or within `slack_px` of) its bottom, so new content should keep it pinned there. */
export function isNearBottom(scrollHeight: number, scrollTop: number, clientHeight: number, slack_px = 80): boolean {
  return scrollHeight - scrollTop - clientHeight <= slack_px;
}
