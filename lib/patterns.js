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
  // Last on purpose: 'Hash Table' is a broad tag, so the more specific
  // patterns above win first and this catches the pure lookup problems.
  {
    key: 'hash-map',
    label: 'Hash Map Lookup',
    tags: ['Hash Table'],
    blurb: 'Trade space for time — remember what you’ve seen for O(1) lookups.',
    example: 'two-sum',
  },
  // Catch-all workhorse: one index marching across the data. Also the
  // guaranteed fallback in pickPattern, so EVERY problem gets a visualizer.
  {
    key: 'scan',
    label: 'Linear Scan',
    tags: ['Array', 'String', 'Math', 'Greedy', 'Sorting', 'Simulation', 'Counting',
      'Enumeration', 'Prefix Sum', 'Bit Manipulation', 'Matrix', 'Number Theory',
      'Geometry', 'Game Theory', 'Brainteaser', 'Randomized', 'Iterator', 'Counting Sort'],
    blurb: 'March one index across the data, folding each element into a running answer.',
    example: 'best-time-to-buy-and-sell-stock',
  },
];

export function pickPattern(tags = []) {
  const set = new Set(tags);
  // Fall back to the linear-scan pattern so no problem is ever left without a
  // visualizer (Database/Shell/Concurrency problems get the generic demo too).
  return PATTERNS.find((p) => p.tags.some((t) => set.has(t))) || PATTERNS[PATTERNS.length - 1];
}
