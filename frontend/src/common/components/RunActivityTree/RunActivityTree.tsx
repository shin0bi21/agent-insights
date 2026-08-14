import type { RunActivityNode } from '../../../types';

function ActivityNode({ node }: { node: RunActivityNode }) {
  return <li className={`activity-node ${node.status}`}>
    <span className="activity-marker" aria-hidden="true"/>
    <div><strong>{node.label}</strong>{node.detail && <p>{node.detail}</p>}</div>
  </li>;
}

export default function RunActivityTree({ nodes }: { nodes: RunActivityNode[] }) {
  const roots = nodes.filter(node => node.parentId === null);
  return <div className="activity-tree" aria-label="Live agent activity" role="region" tabIndex={0}>
    {roots.map(root => <section key={root.id} className="activity-branch">
      <ActivityNode node={root}/>
      <ol>{nodes.filter(node => node.parentId === root.id).map(node => <ActivityNode key={node.id} node={node}/>)}</ol>
    </section>)}
  </div>;
}
