import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
};

const PageHeader: FC<PageHeaderProps> = ({
  title,
  description,
  children,
  className,
}) => {
  return (
    <div
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}
    >
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="flex shrink-0 gap-2">{children}</div>}
    </div>
  );
};

export default PageHeader;
