import { Image, Text, View } from "nsh";

interface BrandMarkProps {
  name: string;
  logoUrl?: string | null;
  size?: "small" | "medium" | "large";
}

const sizeClasses = {
  small: "size-8 rounded-[10px] text-[11px]",
  medium: "size-10 rounded-[12px] text-[13px]",
  large: "size-14 rounded-[18px] text-[17px]",
} as const;

export function BrandMark(props: BrandMarkProps) {
  const size = props.size ?? "medium";
  return (
    <View
      class={`relative shrink-0 items-center justify-center overflow-hidden bg-[#F0EEE9] font-semibold text-[#1D1C24] ${sizeClasses[size]}`}
      accessibilityLabel={`${props.name} logo`}
      role="image"
    >
      <Text class="font-semibold">{props.name.slice(0, 1)}</Text>
      {props.logoUrl ? (
        <Image
          src={props.logoUrl}
          class="absolute inset-0 size-full object-contain p-2"
          accessibilityLabel={`${props.name} logo`}
        />
      ) : null}
    </View>
  );
}
