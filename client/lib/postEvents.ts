// Lightweight pub-sub for cross-screen post lifecycle events.
//
// PostDetailScreen → emitPostDeleted → SocialFeedScreen / SocialProfileScreen
// can drop the row immediately instead of waiting for the next pull-to-
// refresh. Module-level Set so any subscriber on any screen sees the
// event; no global store/context needed for this scale.
//
// Extend with more event types (postLiked, postEdited) if other screens
// need to stay in sync without re-fetching.

type DeletedListener = (postId: number) => void;

const deletedListeners = new Set<DeletedListener>();

export function emitPostDeleted(postId: number): void {
  for (const l of deletedListeners) {
    try {
      l(postId);
    } catch (err) {
      // Listener errors mustn't break the chain.
      console.log("postDeleted listener threw:", err);
    }
  }
}

export function onPostDeleted(listener: DeletedListener): () => void {
  deletedListeners.add(listener);
  return () => {
    deletedListeners.delete(listener);
  };
}
