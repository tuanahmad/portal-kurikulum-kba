import { useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/** Kotak isian yang tingginya mengikuti isi: tulisan panjang memanjang ke bawah (tanpa scrollbar kecil), jadi semua
 *  tulisan langsung terlihat. Tinggi minimum = `rows`. `satuBaris`: Enter tidak membuat baris baru (untuk isian judul/nama). */
export function AutoTextarea({
  value,
  satuBaris,
  onKeyDown,
  style,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> & { value: string; satuBaris?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const sesuaikan = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(sesuaikan, [value]);

  // lebar kotak berubah (jendela diubah ukurannya / kolom bergeser / font selesai dimuat) -> tinggi dihitung ulang
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let lebar = el.offsetWidth;
    const ro = new ResizeObserver(() => {
      if (el.offsetWidth !== lebar) {
        lebar = el.offsetWidth;
        sesuaikan();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={rest.rows ?? 1}
      {...rest}
      onKeyDown={(e) => {
        if (satuBaris && e.key === "Enter") e.preventDefault();
        onKeyDown?.(e);
      }}
      style={{ overflow: "hidden", resize: "none", ...style }}
    />
  );
}
