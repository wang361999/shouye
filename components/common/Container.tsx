"use client";

import { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

function Container({ children, className }: ContainerProps) {
  return (
    <div className={`max-w-7xl mx-auto px-4 ${className ?? ""}`}>
      {children}
    </div>
  );
}

export { Container };
export default Container;
