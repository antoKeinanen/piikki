import { useId, type ReactNode } from "react";

/** A label above one control. The control receives the generated id. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children(id: string): ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`field ${className ?? ""}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

/** Image formats accepted for logos and item photos, at most 1 MB. */
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
export const IMAGE_ERROR = "Valitse PNG-, JPG-, WebP- tai SVG-kuva, enintään 1 Mt.";
export const IMAGE_READ_ERROR = "Kuvaa ei voitu lukea. Kokeile toista kuvaa.";
