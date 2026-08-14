export function Button({ value }: { value: string }) {
  return (
    <button
      className="
        w-full
        flex items-center justify-center
        rounded-xl
        bg-linear-to-br from-[#805FF8] to-[#4C18EF]
        px-4 py-3
        text-white
        font-bold
        shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.2)]
        transition-all
        active:translate-y-px
        active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)]
        cursor-pointer
      "
    >
      {value}
    </button>
  );
}