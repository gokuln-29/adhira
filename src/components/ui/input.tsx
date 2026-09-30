import { useId } from "react";
import { cn } from "@/lib/utils";

const fieldStyles =
  "w-full rounded-[2px] border border-(--color-hairline) bg-(--color-surface) px-4 py-3 text-[15px] text-(--color-ink) placeholder:text-(--color-muted)/70 transition-[border-color,box-shadow] duration-200 hover:border-(--color-ink)/30 focus-visible:border-(--color-ink) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--color-primary)/10 motion-reduce:transition-none";

interface FieldWrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}

function FieldWrapper({
  label,
  hint,
  error,
  htmlFor,
  required,
  children,
}: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="font-mono-label text-[11px] text-(--color-muted)">
          {label}
          {required && <span className="text-(--color-primary)"> *</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs text-(--color-muted)">{hint}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, className, id, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      htmlFor={inputId}
      required={props.required}
    >
      <input
        id={inputId}
        className={cn(fieldStyles, error && "border-red-500", className)}
        aria-invalid={!!error}
        {...props}
      />
    </FieldWrapper>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Textarea({
  label,
  hint,
  error,
  className,
  id,
  rows = 4,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      htmlFor={inputId}
      required={props.required}
    >
      <textarea
        id={inputId}
        rows={rows}
        className={cn(fieldStyles, "resize-y", error && "border-red-500", className)}
        aria-invalid={!!error}
        {...props}
      />
    </FieldWrapper>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Select({
  label,
  hint,
  error,
  className,
  id,
  children,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      htmlFor={inputId}
      required={props.required}
    >
      <select
        id={inputId}
        className={cn(fieldStyles, error && "border-red-500", className)}
        aria-invalid={!!error}
        {...props}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}
