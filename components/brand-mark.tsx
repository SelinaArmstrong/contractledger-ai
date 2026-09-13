import Image from 'next/image';

/** Shared visual identity: keep artwork in sync through npm run brand:generate. */
export function BrandMark({ className = 'size-10' }: { className?: string }) {
  return (
    <Image
      unoptimized
      src="/brand/mark.svg"
      width={64}
      height={64}
      alt=""
      aria-hidden="true"
      className={className}
    />
  );
}
