/**
 * Pattern registry — pure data, safe to import anywhere (no client components).
 * Order = match priority: the first pattern whose tags intersect a problem's tags wins.
 * Keep this in sync with components/vizComponents.js (same keys).
 */
export const PATTERNS = [
  {
    key: 'two-pointers',
    label: 'Two Pointers / Sliding Window',
    tags: ['Two Pointers', 'Sliding Window'],
    blurb: 'Two indices converging, or a window sliding across an array/string.',
    example: '3sum',
  },
  {
    key: 'binary-search',
    label: 'Binary Search',
    tags: ['Binary Search'],
    blurb: 'Halve a sorted search space each step.',
    example: 'binary-search',
  },
  {
    key: 'tree-traversal',
    label: 'Binary Tree Traversal',
    tags: ['Binary Tree', 'Tree', 'Binary Search Tree'],
    blurb: 'Preorder, inorder, postorder and level-order over a tree.',
    example: 'binary-tree-level-order-traversal',
  },
  {
    key: 'dp-grid',
    label: 'Dynamic Programming (grid)',
    tags: ['Dynamic Programming'],
    blurb: 'Fill a table cell-by-cell from a recurrence.',
    example: 'unique-paths',
  },
  {
    key: 'backtracking',
    label: 'Backtracking',
    tags: ['Backtracking'],
    blurb: 'Explore a decision tree, recording solutions and backtracking.',
    example: 'subsets',
  },
  {
    key: 'trie',
    label: 'Trie (Prefix Tree)',
    tags: ['Trie'],
    blurb: 'Build a prefix tree by inserting words letter by letter.',
    example: 'implement-trie-prefix-tree',
  },
  {
    key: 'heap',
    label: 'Heap / Priority Queue',
    tags: ['Heap (Priority Queue)'],
    blurb: 'Insert into a min-heap and sift values up the tree.',
    example: 'kth-largest-element-in-an-array',
  },
  {
    key: 'stack',
    label: 'Stack / Monotonic Stack',
    tags: ['Monotonic Stack', 'Stack'],
    blurb: 'A stack that resolves elements as new ones arrive.',
    example: 'daily-temperatures',
  },
  {
    key: 'linked-list',
    label: 'Linked List',
    tags: ['Linked List'],
    blurb: 'Pointer manipulation — reversing a list in place.',
    example: 'reverse-linked-list',
  },
  {
    key: 'graph',
    label: 'Graph Traversal (BFS / DFS)',
    tags: ['Graph', 'Breadth-First Search', 'Depth-First Search', 'Union Find'],
    blurb: 'Explore a graph breadth-first (queue) or depth-first (stack).',
    example: 'number-of-islands',
  },
];

export function pickPattern(tags = []) {
  const set = new Set(tags);
  return PATTERNS.find((p) => p.tags.some((t) => set.has(t))) || null;
}
