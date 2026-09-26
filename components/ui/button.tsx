import React from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'default' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'default' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: 'bg-neutral-100 text-neutral-900 hover:bg-white',
  outline: 'border border-neutral-800 bg-transparent hover:bg-neutral-900',
  ghost: 'bg-transparent hover:bg-neutral-900',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  default: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

function hasOwnBackground(className: string | undefined): boolean {
  return !!className && /(^|\s)bg-/.test(className);
}

// Button styling for elements that aren't <button>, e.g. a Link that should
// look like one. A <button> nested inside an <a> is invalid HTML and leaves
// the link without an accessible name.
export function buttonClassName({
  className,
  variant = 'default',
  size = 'default',
}: { className?: string; variant?: ButtonVariant; size?: ButtonSize } = {}): string {
  return cn(
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none',
    // Two competing bg-* utilities resolve by stylesheet order, not
    // by the order written here, so a caller's own background (the
    // amber primary buttons) could silently lose to the variant's.
    // When the caller sets a background, the variant colours step aside.
    hasOwnBackground(className) ? undefined : VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return <button ref={ref} className={buttonClassName({ className, variant, size })} {...props} />;
  }
);
Button.displayName = 'Button';

export default Button;
