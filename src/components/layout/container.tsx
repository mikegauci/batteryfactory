import type { ComponentProps } from "react";

// Matches the live site's content width: 1200px with 20px side padding on
// smaller screens.
export function Container({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      className={`mx-auto w-full max-w-[1240px] px-5 ${className}`}
      {...props}
    />
  );
}
