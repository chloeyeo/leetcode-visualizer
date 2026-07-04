'use client';

import TwoPointerViz from './TwoPointerViz';
import BinarySearchViz from './BinarySearchViz';
import TreeTraversalViz from './TreeTraversalViz';
import DpGridViz from './DpGridViz';
import BacktrackingViz from './BacktrackingViz';
import TrieViz from './TrieViz';
import HeapViz from './HeapViz';
import StackViz from './StackViz';
import LinkedListViz from './LinkedListViz';
import GraphViz from './GraphViz';
import HashMapViz from './HashMapViz';

/** Map of pattern key -> visualizer component. Keys match lib/patterns.js. */
export const COMPONENTS = {
  'two-pointers': TwoPointerViz,
  'binary-search': BinarySearchViz,
  'tree-traversal': TreeTraversalViz,
  'dp-grid': DpGridViz,
  backtracking: BacktrackingViz,
  trie: TrieViz,
  heap: HeapViz,
  stack: StackViz,
  'linked-list': LinkedListViz,
  graph: GraphViz,
  'hash-map': HashMapViz,
};
