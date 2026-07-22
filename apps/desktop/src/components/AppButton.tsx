import type { ButtonHTMLAttributes, ReactNode } from "react";

import { AppIcon, type AppIconName } from "./AppIcon.js";

export type AppButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type AppButtonSize = "small" | "regular" | "icon";

interface AppButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "className"
> {
  readonly children: ReactNode;
  readonly className?: string;
  readonly icon?: AppIconName;
  readonly iconPosition?: "start" | "end";
  readonly size?: AppButtonSize;
  readonly variant?: AppButtonVariant;
}

export function AppButton({
  children,
  className,
  icon,
  iconPosition = "start",
  size = "regular",
  type = "button",
  variant = "secondary",
  ...buttonProps
}: AppButtonProps) {
  const classes = [
    "app-button",
    `app-button--${variant}`,
    `app-button--${size}`,
    className,
  ].filter((value): value is string => value !== undefined && value.length > 0);
  const buttonIcon = icon === undefined
    ? null
    : <AppIcon name={icon} className="app-button__icon" />;

  return (
    <button
      {...buttonProps}
      type={type}
      className={classes.join(" ")}
    >
      {iconPosition === "start" ? buttonIcon : null}
      <span className="app-button__label">{children}</span>
      {iconPosition === "end" ? buttonIcon : null}
    </button>
  );
}
