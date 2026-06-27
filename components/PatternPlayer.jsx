'use client';

import { COMPONENTS } from './vizComponents';

export default function PatternPlayer({ keyName }) {
  const Component = COMPONENTS[keyName];
  if (!Component) return <p className="empty">Unknown pattern.</p>;
  return <Component />;
}
