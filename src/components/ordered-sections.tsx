import { Children, isValidElement, type ReactNode } from "react";
export function OrderedSections({
  order,
  children,
}: {
  order: string;
  children: ReactNode;
}) {
  const nodes = Children.toArray(children);
  const sections = new Map(
    nodes
      .filter(isValidElement<{ "data-cms-section": string }>)
      .map((node) => [node.props["data-cms-section"], node]),
  );
  const keys = [...new Set([...order.split(","), ...sections.keys()])];
  return <>{keys.map((key) => sections.get(key))}</>;
}
